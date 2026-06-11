# Chat-First Workspace — Trabalhar o Kinevo via conversa

## Status
- [x] Rascunho (investigações técnicas resolvidas — ver ✅ nas seções)
- [ ] Em implementação
- [ ] Concluída

> Spec derivada de uma análise de produto (jun/2026). Antes de implementar, ler também
> a seção **Decisões já fechadas** — elas não devem ser re-questionadas pelo executor.
> Os pontos antes marcados "Investigar" foram verificados no código/SDK e estão resolvidos (✅).

---

## Contexto

Hoje o treinador interage com a IA do Kinevo de duas formas desconexas:
1. **Painel-assistente embutido** (`api/assistant/chat`) — Vercel AI SDK com **apenas 3 tools**
   (`generateProgram`, `analyzeStudentProgress`, `getStudentInsights`).
2. **Servidor MCP** (`api/mcp`) — **27 tools** completas, mas só acessível conectando um
   cliente externo (Claude Desktop) via OAuth + API key. Atrito alto de setup.

A oportunidade: dar ao treinador uma **tela dedicada onde ele opera o Kinevo conversando**,
com o **mesmo poder das 27 tools do MCP**, mas **sem nenhum setup** (ele já está autenticado
na sessão Supabase). É um diferencial de produto e um **upsell natural** — diferente da maioria
das features SaaS, essa tem **custo marginal de API por uso**, então vira um tier pago com cota.

### Decisões já fechadas (NÃO re-discutir)
- **NÃO é "chat-only".** As 27 tools cobrem só 3 das 9 áreas do app (alunos, prescrição,
  comunicação). Financeiro/forms são read-only; training-room/settings/criar-exercício/criar-form
  **não têm tool**. O alvo é **chat-first**: o chat resolve o núcleo; o resto é **deep-link pra GUI**.
- **Reusar as 27 tools existentes** via ponte in-memory — **não duplicar** nem criar tools novas no v1.
- **Gate no plano Premium** + **metering por crédito no banco** (o `rate-limit.ts` atual é em
  memória, serve anti-abuso, **não** serve cota de billing).
- **Degradar pra GUI** quando a cota acaba — nunca travar o trabalho do treinador.
- **HITL (human-in-the-loop)** obrigatório nas tools de escrita destrutivas/externas.
- **Roteamento de custo:** "gera um programa" → action determinística `generateProgram` (1 chamada),
  **não** os ~20 writes granulares do MCP.

---

## Objetivo

Entregar uma **tela de workspace de chat** (rota dedicada, dentro do app shell) onde um treinador
no plano Premium:
- Conversa em linguagem natural e o agente executa as 27 tools do MCP em seu nome.
- Recebe **artifacts renderizados** (preview de programa, card de aluno) — nunca texto cru.
- **Confirma** explicitamente ações de escrita arriscadas antes de executá-las.
- É **deep-linkado** pra GUI nas áreas que o chat não cobre.
- Tem o uso **medido por crédito** e limitado pela cota do plano, com UI de "% usado / reinicia em X".

E (fase 2) pode **tornar o chat sua tela inicial**, onde os insights proativos do cron viram
**starters de conversa acionáveis**.

---

## Escopo

### Incluído
- Rota dedicada `/assistente` (workspace full-screen dentro do app shell, sidebar viva).
- Backend de agente reusando `createMcpServer(trainerId)` via **ponte in-memory** → `streamText`.
- Classificação read/write das 27 tools + **HITL** nas de escrita.
- Renderização de **artifacts** (program preview, student card, deep-link cards).
- **Metering por crédito** (tabelas `ai_usage_periods` + `ai_usage_events`, RPC atômico).
- **Gate de plano** Premium + **degradação graciosa** ao bater a cota.
- UI de uso (% usado + reset) na tela e em Configurações.
- (Fase 2) preferência **"Chat como tela inicial"** + insights como starters.

### Excluído
- Criar tools novas de **financeiro-write, forms-write, criar-exercício, training-room, settings**
  (esses ficam na GUI via deep-link). Reavaliar em v2 com dados de uso.
- Migrar a prescrição (`lib/prescription/`) — **proibido** por CLAUDE.md.
- Substituir o painel-assistente contextual existente (continua funcionando como está).
- Cobrança/checkout do tier Premium em si (assume que o plano e o flag de tier já existem ou
  serão criados na esteira de billing — ver "Investigar").

---

## Arquitetura

### 1. Ponte in-memory: 1 catálogo de tools, 2 consumidores

As tools já estão fatoradas em `lib/mcp/tools/*` e montadas por `createMcpServer(trainerId)`
(`lib/mcp/server.ts`). O workspace consome **o mesmo servidor MCP** via transporte in-memory —
sem HTTP, sem OAuth. Fonte única da verdade: toda tool nova entra automaticamente nos dois lados.

```ts
// lib/assistant/mcp-bridge.ts (novo)
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { experimental_createMCPClient } from 'ai'
import { createMcpServer } from '@/lib/mcp/server'

export async function buildMcpTools(trainerId: string) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const server = createMcpServer(trainerId)
  await server.connect(serverTransport)
  const client = await experimental_createMCPClient({ transport: clientTransport })
  const tools = await client.tools() // as 27, idênticas ao Claude Desktop
  return { tools, close: () => client.close() }
}
```

> ✅ **Verificado (jun/2026):** `experimental_createMCPClient` **está** exportado pelo `ai` 4.3.19 e
> `InMemoryTransport.createLinkedPair()` existe em `@modelcontextprotocol/sdk/inMemory.js`. PORÉM o
> `client.tools()` do AI SDK **descarta as annotations** — ele só lê `{ name, description, inputSchema }`
> de cada tool (`node_modules/ai/dist/index.mjs:7720`). Logo `readOnlyHint`/`destructiveHint` **NÃO**
> sobrevivem à ponte → a classificação estática em `tool-policy.ts` é a **fonte de verdade primária**
> (não fallback). Além disso, **toda** tool vinda do MCP já vem com `execute` automático
> (`index.mjs:7731`) — ver implicação no HITL abaixo.

### 2. Política de tools (read vs write + peso de crédito)

```ts
// lib/assistant/tool-policy.ts (novo) — classificação estática (fallback das annotations)
export const READ_TOOLS = new Set([
  'kinevo_ping','kinevo_list_students','kinevo_get_student','kinevo_list_programs',
  'kinevo_get_program','kinevo_list_exercises','kinevo_list_training_methods',
  'kinevo_get_student_progress','kinevo_get_form_responses','kinevo_get_dashboard_summary',
  'kinevo_list_subscriptions','kinevo_get_revenue_summary','kinevo_list_conversations',
  'kinevo_get_conversation',
])
// Escrita que SEMPRE exige confirmação explícita (destrutiva ou efeito externo):
export const CONFIRM_TOOLS = new Set([
  'kinevo_send_message','kinevo_delete_workout_session','kinevo_delete_workout_item',
  'kinevo_expire_program','kinevo_create_student','kinevo_assign_program',
])
// Demais writes (add/update workout item/session, create_superset, update_student,
// create_program) executam dentro de um fluxo, mas o RESULTADO é revisável (rascunho/artifact).

export const CREDIT_WEIGHTS: Record<string, number> = {
  __turn_base: 1,                       // toda interação custa ≥1
  kinevo_get_student_progress: 1,       // análise (multi-query)
  generateProgram: 10,                  // prescrição completa = ação cara
  kinevo_send_message: 1,
  // writes simples: +1 (default no cálculo); reads: +0
}
```

### 3. HITL (confirmação de escrita)

Padrão human-in-the-loop do AI SDK: tools em `CONFIRM_TOOLS` **não auto-executam** —
o agente para, o cliente renderiza um **card de confirmação** e só executa após o clique.

> ✅ **Verificado:** como a ponte entrega TODAS as 27 tools já com `execute` automático, **não dá**
> pra simplesmente "não passar execute" pegando da ponte. O `buildMcpTools` precisa **transformar**
> o conjunto: reads passam direto; para cada tool em `CONFIRM_TOOLS`, **substituir** pela versão
> *client-side* (mesmo `description` + `parameters`, **sem `execute`**) — assim o `streamText` pausa
> e o `useChat` expõe a `tool-call` pra confirmação.

- **Reads** → `execute` direto da ponte (auto).
- **Writes em `CONFIRM_TOOLS`** → tool client-side sem `execute`. O cliente renderiza o card;
  em "Confirmar", chama um **endpoint dedicado** (`POST /api/assistant/execute-tool`, que reusa a
  mesma ponte in-memory para invocar a tool MCP real por nome) e devolve o resultado ao chat via
  `addToolResult`. Em "Cancelar", devolve um resultado de recusa (não executa, não cobra crédito de escrita).
- Confirmação no **nível da operação**, não da tool: uma prescrição inteira gera **1** card
  (preview do rascunho), não 20. Por isso prescrição é roteada pra `generateProgram`, que salva
  rascunho e devolve `reviewUrl` — o rascunho **é** a confirmação.

### 4. Rota de API

Novo handler que reusa os guard-rails do `api/assistant/chat/route.ts` existente (auth, sanitização
de mensagens com `role` forçado, clamps anti-cost-amplification) mas com **toolset completo + metering**:

- `api/assistant/workspace/route.ts` (novo) — ou parametrizar o existente. Preferir **novo** pra
  não tocar no contrato do painel contextual (que usa 3 tools).
- Fluxo: auth → resolve trainer → **checa plano Premium** → **checa cota** (bloqueia se estourou) →
  `buildMcpTools` + `generateProgram` tool → `streamText({ model, tools, maxSteps, system })` →
  `onFinish` registra usage (tokens→custo→créditos) no metering.

### 5. Modelo e custo

- Modelo default: `gpt-4.1-mini` (confiável em tool calling; 27 tools é exigente — medir acurácia).
- **Prompt caching é o lever #1:** o system prompt (instruções + 27 schemas ≈ 8k tokens) é
  re-enviado a cada step. Manter esse **prefixo estável** (dados voláteis — contexto do aluno,
  data — vão no **fim**, fora do bloco cacheável).
- Custo é **input-dominated** (contexto re-enviado a cada step; output é fração mínima).

---

## Metering & Planos

### Schema (nova migration)

```sql
-- Janela de cota por treinador (uma linha por período corrente)
create table ai_usage_periods (
  id            uuid primary key default gen_random_uuid(),
  trainer_id    uuid not null references trainers(id) on delete cascade,
  period_type   text not null check (period_type in ('week','month')),
  period_start  date not null,
  credits_used  integer not null default 0,
  cost_usd_micros bigint not null default 0,
  turns_count   integer not null default 0,
  updated_at    timestamptz not null default now(),
  unique (trainer_id, period_type, period_start)
);

-- Log de eventos (analytics / reconciliação de custo real)
create table ai_usage_events (
  id            uuid primary key default gen_random_uuid(),
  trainer_id    uuid not null references trainers(id) on delete cascade,
  created_at    timestamptz not null default now(),
  action_class  text not null,        -- 'query' | 'analysis' | 'write' | 'prescription' | 'message'
  credits       integer not null,
  input_tokens  integer, cached_input_tokens integer, output_tokens integer,
  cost_usd_micros bigint,
  model         text
);

-- Incremento atômico (evita race entre instâncias serverless)
create or replace function increment_ai_usage(
  p_trainer_id uuid, p_period_type text, p_period_start date,
  p_credits integer, p_cost_micros bigint
) returns void language sql as $$
  insert into ai_usage_periods (trainer_id, period_type, period_start, credits_used, cost_usd_micros, turns_count)
  values (p_trainer_id, p_period_type, p_period_start, p_credits, p_cost_micros, 1)
  on conflict (trainer_id, period_type, period_start) do update
    set credits_used = ai_usage_periods.credits_used + excluded.credits_used,
        cost_usd_micros = ai_usage_periods.cost_usd_micros + excluded.cost_usd_micros,
        turns_count = ai_usage_periods.turns_count + 1,
        updated_at = now();
$$;
```
- **RLS:** treinador lê só as próprias linhas; escrita só via service role (no `onFinish` server-side).
- Crédito é o orçamento **visível ao treinador**; `cost_usd_micros` é a **verdade interna** de margem.

### Cota por plano (config v1)

```ts
// lib/ai-usage/quota.ts
export const PLAN_AI_QUOTA: Record<string, { period: 'week'|'month'; credits: number } | null> = {
  essencial:  { period: 'month', credits: 20 },   // test drive (cria desejo)
  pro_ia:     { period: 'month', credits: 600 },
  premium_ia: { period: 'month', credits: 1400 },
}
```

### Tiers & margem (referência de negócio)

| | Essencial | Pro IA | Premium IA |
|---|---|---|---|
| Preço/mês | R$79,90 | R$129,90 | R$199,90 |
| Créditos/mês | 20 (test drive) | 600 | 1.400 |
| Custo IA esperado (40% uso) | ~R$1 | ~R$12 | ~R$28 |
| Custo IA pior caso (100%) | ~R$1 | ~R$30 | ~R$70 |
| Margem esperada | ~91% | ~85% | ~82% |
| Margem pior caso | ~91% | ~71% | ~60% |

> Premissa: 1 crédito ≈ R$0,05 de custo de API com gpt-4.1-mini. Caching/modelo mais barato
> melhoram tudo. Acima da cota → reset mensal **ou** top-up (ex.: R$19,90 por +400 créditos).

> ✅ **Verificado (jun/2026): NÃO existe conceito de tier hoje.** `getTrainerWithSubscription`
> (`lib/auth/get-trainer.ts`) trata acesso como **binário** — `isActive = status ∈ {trialing, active}`,
> senão redireciona pra `/subscription/blocked`. A tabela `subscriptions` tem só
> `status, current_period_end, cancel_at_period_end, stripe_customer_id, stripe_subscription_id,
> trainer_id` — **sem coluna de tier/produto/price**. Logo, o gate Premium precisa ser **introduzido**.
>
> **Recomendação (2 camadas):**
> 1. **v1 — flag por treinador:** adicionar `trainers.ai_tier text` (null | 'pro' | 'premium'),
>    seguindo o precedente já existente `trainers.ai_prescriptions_enabled`. Permite liberar beta/comp
>    manualmente e destrava a feature sem depender de billing. O gate (`getAiTier(trainerId)`) lê essa coluna.
> 2. **fonte de verdade de billing:** popular `subscriptions.stripe_price_id` (nova coluna) via o
>    webhook Stripe e mapear price→tier; `ai_tier` vira override manual sobre o tier derivado do plano pago.
>
> Como o webhook do trainer-SaaS vive em `api/webhooks/stripe/route.ts`, a coluna `stripe_price_id`
> entra lá no upsert de subscription. O `getTrainerWithSubscription` ganha o campo no select.

---

## Comportamento Esperado

### Fluxo do Usuário (workspace)
1. Treinador Premium abre **Assistente** na sidebar → workspace full-screen.
2. Vê (fase 2) cards de insights proativos como starters: *"João sem treinar há 10 dias [Conversar] [Gerar novo programa]"*. Clicar injeta o prompt com contexto.
3. Digita em linguagem natural (*"mostra os alunos estagnados no supino"*) → agente chama tools de leitura → responde com **lista renderizada** (cards, não texto).
4. Pede uma ação de escrita (*"manda mensagem pro João avisando do treino novo"*) → aparece **card de confirmação** com o conteúdo → "Enviar" executa, "Editar/Cancelar" não.
5. Pede algo fora de cobertura (*"cria um plano de R$150"*) → agente responde com **botão de deep-link**: *"Isso é no Financeiro → [Abrir Planos]"*.
6. UI mostra **% de uso da cota**; ao estourar, banner: *"Cota de IA do mês atingida — reinicia em X. Você pode continuar pela interface normal ou adquirir créditos."* e o input fica desabilitado (degrada pra GUI, não trava o app).

### Fluxo Técnico (por turno)
1. `POST /api/assistant/workspace` → auth (`getUser`) → resolve trainer → **gate Premium** → **checa cota** (`ai_usage_periods` do período corrente vs `PLAN_AI_QUOTA`). Se estourou → 402/403 com payload amigável.
2. Sanitiza mensagens (reusa padrão do route existente). Monta system prompt **estável** (instruções + 27 schemas) + contexto volátil no fim.
3. `buildMcpTools(trainerId)` + tool `generateProgram` (override de roteamento de prescrição).
4. `streamText({ model: openai('gpt-4.1-mini'), tools, maxSteps, system, messages })`.
5. Reads auto-executam; tools em `CONFIRM_TOOLS` pausam pra HITL no cliente.
6. `onFinish({ usage })` → calcula custo (PRICING de `llm-client.ts`) e créditos (pesos) →
   `increment_ai_usage(...)` + insere `ai_usage_events`. Fire-and-forget (não bloqueia a resposta).
7. `client.close()` da ponte in-memory.

---

## Arquivos Afetados

**Novos:**
- `web/src/app/assistente/page.tsx` (+ layout se preciso) — rota do workspace, guard de plano.
- `web/src/components/assistant/chat-workspace.tsx` — UI principal (`useChat`, streaming).
- `web/src/components/assistant/artifacts/` — `program-preview-artifact.tsx`, `student-card-artifact.tsx`, `deep-link-card.tsx`.
- `web/src/components/assistant/tool-confirmation-card.tsx` — HITL.
- `web/src/components/assistant/insight-starters.tsx` — (fase 2) insights como prompts.
- `web/src/app/api/assistant/workspace/route.ts` — handler do agente com metering.
- `web/src/app/api/assistant/execute-tool/route.ts` — execução confirmada de tool de escrita (HITL).
- `web/src/lib/assistant/mcp-bridge.ts` — ponte in-memory.
- `web/src/lib/assistant/tool-policy.ts` — classificação + pesos.
- `web/src/lib/ai-usage/` — `quota.ts`, `metering.ts` (cálculo crédito/custo + RPC).
- `supabase/migrations/NNN_ai_usage.sql` — tabelas + RPC + RLS.

**Modificados:**
- Sidebar/nav — adicionar item "Assistente" (visível só no Premium).
- `web/src/app/settings/page.tsx` — bloco "Uso de IA" (% usado + reset). (Fase 2: toggle "chat como home".)
- (Fase 2) middleware/redirect da home pra `/assistente` quando a preferência estiver ligada.
- `web/src/lib/auth/get-trainer.ts` — adicionar `ai_tier` (e `subscriptions.stripe_price_id`) ao select.
- `web/src/app/api/webhooks/stripe/route.ts` — popular `stripe_price_id` no upsert de subscription.
- Migration: `trainers.ai_tier` + `subscriptions.stripe_price_id` (além das tabelas de metering).

---

## Critérios de Aceite
- [ ] Workspace executa qualquer das 27 tools via ponte in-memory (sem HTTP/OAuth).
- [ ] Tools de leitura auto-executam; `CONFIRM_TOOLS` exigem confirmação visual antes de efetivar.
- [ ] "Gera um programa" roteia pra `generateProgram` (1 ação + preview), não 20 writes.
- [ ] Áreas não cobertas geram **deep-link** pra GUI, não tentativa de execução.
- [ ] Cada turno registra créditos + custo real em `ai_usage_periods`/`ai_usage_events` (incremento atômico).
- [ ] Estouro de cota bloqueia o input com mensagem amigável e **não** quebra o resto do app.
- [ ] Feature só acessível no plano Premium (gate de rota + de API).
- [ ] Tenant isolation preservado: toda tool opera só sobre dados do `trainerId` da sessão.
- [ ] Sem novos erros de TypeScript. Sem `any`.
- [ ] Retrocompatível: painel-assistente contextual (3 tools) e `api/mcp` externo seguem intactos.

## Restrições Técnicas
- Seguir CLAUDE.md. **Não tocar em `lib/prescription/`.**
- Mudanças cirúrgicas; reusar guard-rails do `api/assistant/chat/route.ts` (sanitização, clamps).
- Server Actions/route handlers conforme convenção; admin client só onde necessário.
- Nova migration com RLS + índices; rodar `gen:types` depois.
- **Não commitar/push** durante dev (WORKFLOW.md) — working tree até autorização do Gustavo.

## Edge Cases
- **Cota estourada no meio de um turno multi-step:** checar cota **antes** do turno; um turno
  iniciado completa (não cortar no meio), mas o próximo é bloqueado.
- **HITL abandonado:** treinador não confirma uma escrita → não cobra crédito de escrita, não executa.
- **Tool erra o aluno (2 "Joãos"):** o card de confirmação mostra nome+contexto resolvido; resolver
  ambiguidade ANTES de confirmar. (As tools já validam ownership por `trainerId`.)
- **Plano cai de Premium → base no meio do mês:** perde acesso ao workspace; cota não é reembolsada.
- **Ponte in-memory falha ao conectar:** degrada com erro claro; não deixa conexão pendurada (`close`).
- **Modelo escolhe tool errada entre 27:** medir; se acurácia baixa, considerar agrupamento/router (v2).
- **Concorrência de metering:** dois turnos paralelos → `increment_ai_usage` atômico evita perda.

## Testes Requeridos

### Lógica Pura (unitários — obrigatório)
- [ ] `tool-policy`: classificação read/write e cálculo de créditos por turno (vários mixes de tools).
- [ ] `ai-usage/metering`: tokens→custo (PRICING) e custo→créditos; arredondamento e floor de 1.
- [ ] `quota`: dado uso atual + plano, decide allow/block e calcula reset.

### Server Actions / Queries (recomendado)
- [ ] `increment_ai_usage`: incremento atômico, upsert no período correto, isolamento por trainer.
- [ ] Route `workspace`: gate de plano (não-Premium → bloqueado) e gate de cota (estourado → bloqueado), com Supabase mockado.
- [ ] HITL: tool de `CONFIRM_TOOLS` não executa sem confirmação.

### Componentes (apenas crítico)
- [ ] `tool-confirmation-card`: render do preview e ações confirmar/cancelar.
- [ ] Banner de cota estourada desabilita input.

> Não testar: layout do workspace, navegação, componentes puramente visuais.

---

## Plano Faseado

- **Fase 0 — Fundações (sem UI):** `mcp-bridge` (com transformação read/write + strip de execute nas
  `CONFIRM_TOOLS`), `tool-policy`, migration de metering + RPC, `quota`, migration de tier
  (`trainers.ai_tier` + `subscriptions.stripe_price_id`) + `getAiTier`, endpoint `execute-tool`.
  Critério: teste do agente executando 1 read e 1 write (via execute-tool) por script.
- **Fase 1 — Workspace MVP (rota dedicada):** `/assistente`, `useChat` streaming, reads auto +
  HITL nas `CONFIRM_TOOLS`, roteamento de prescrição, deep-link cards, gate Premium + cota, UI de uso.
  **Entrega o valor central.**
- **Fase 1.5 — Artifacts ricos:** program preview, student card, links clicáveis.
- **Fase 2 — Chat como tela inicial:** preferência em settings + redirect da home + **insights como
  starters** (reusa `assistant_insights`). Validar adoção da Fase 1 antes.
- **Fase 3 (condicional a dados de uso):** fechar gaps de cobertura (financeiro/forms-write) com tools
  novas, se a demanda justificar; otimização de custo (caching agressivo, A/B de modelo mais barato).

---

## Referências
- `lib/mcp/server.ts`, `lib/mcp/tools/*` — as 27 tools (fonte única).
- `api/assistant/chat/route.ts` — guard-rails a reusar (auth, sanitização, clamps).
- `api/cron/generate-insights/route.ts` — `assistant_insights` (starters da Fase 2).
- `lib/prescription/llm-client.ts` — tabela PRICING (cálculo de custo).
- `lib/rate-limit.ts` — limiter em memória (anti-abuso; NÃO usar pra cota de billing).
- Memória do projeto: `project_kinevo_inapp_mcp_chat`, `project_kinevo_llm_surfaces`.
- Análise de custo/tiers e decisões de produto: conversa de jun/2026.

## Notas de Implementação
(Preenchido pelo executor durante/após a implementação.)
