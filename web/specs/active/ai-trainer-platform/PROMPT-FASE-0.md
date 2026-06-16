# PROMPT — IA do Treinador · Fase 0 (Fundações, sem UI)

> Cole este prompt numa **aba/sessão nova** do Claude Code, na raiz do repo `kinevo`.
> Fase 0 entrega o **encanamento** que habilita todas as superfícies. NENHUMA UI ainda.

---

Você vai implementar a **Fase 0** da plataforma "IA do Treinador" do Kinevo.

## 0. Leia ANTES de tocar em qualquer código (fonte da verdade)
1. `web/specs/active/ai-trainer-platform/SPEC.md` — a spec-mãe. **Leia inteira.** Em divergência, ela prevalece.
2. `web/specs/active/chat-first-workspace/SPEC.md` — detalhe da engine (ponte in-memory, tool-policy, HITL, metering). Reusar.
3. `docs/analise-mcp-assistente-custos.md` — base de custo (pesos de crédito, subsetting).
4. `web/CLAUDE.md` e `mobile/specs/WORKFLOW.md` — convenções obrigatórias.

## 1. Guardrails (inegociáveis)
- **NÃO commitar nem dar push.** Trabalhe só no working tree. O Gustavo testa e autoriza o push depois (WORKFLOW.md).
- **NÃO tocar em `web/src/lib/prescription/`** (motor de IA, protegido por CLAUDE.md).
- **Sem `any`.** `tsc --noEmit` limpo. `vitest run` verde. Mudanças cirúrgicas.
- **Migration:** escreva o arquivo versionado em `supabase/migrations/`, mas **só aplique em prod via MCP após o Gustavo autorizar** (é DDL aditiva/backward-compat). Rode `npm run gen:types` depois de aplicar.
- **NÃO crie Price IDs no Stripe** (tarefa manual/negócio). Apenas leia/mapeie via env (ver §3.E).
- **Tenant isolation:** toda query/tool opera só sobre `trainerId` (admin client + filtro explícito por `coach_id`/`trainer_id`).
- **LGPD (ordem 0):** pode construir todo o encanamento, mas **NÃO** habilitar a feature para o público nem escalar uso real com dado de saúde até o DPA/zero-retention estar confirmado (tarefa de negócio, em paralelo). O acesso fica atrás do override `trainers.ai_tier` (dogfooding interno).

## 2. Decisões já tomadas (NÃO re-perguntar)
- **4 tiers:** Gratuito (R$0, 1 aluno = o próprio treinador, "1× cada ação") · Essencial R$39,90 (ilimitado, 20 créditos) · Pro R$79,90 (300) · Premium R$129,90 (1.000). Top-up = **v1.1** (não nesta fase).
- **Pesos de crédito:** pergunta/leitura=1 · write simples=1 · write composta=2–3 · **gerar programa (`generateProgram`)=5** · massa=1/aluno (máx 10).
- **Limite de alunos:** `free=1` (o self-student), pago=ilimitado. Enforçar em create-student (action), MCP `kinevo_create_student` e `convert_lead`.
- **Downgrade Pro+→Free bloqueado se houver aluno real.** Assinatura caducada com alunos → gestão de alunos travada (read-only), não apaga.
- **Free substitui o hard-block** pós-trial (cai no Free limitado, não em `/subscription/blocked`).
- **55 tools** (não 27). **Subsetting é obrigatório** (carregar tools por intenção; corta 60–70% do input).
- Modelo: `gpt-4.1-mini`. Roteamento de prescrição → action `generateProgram` (1 call).

## 3. Escopo da Fase 0 (o que construir) — SEM UI

### A) Migration `supabase/migrations/NNN_ai_platform.sql` (backward-compat + RLS + índices)
- `trainers.ai_tier text not null default 'free' check (in 'free','essencial','pro_ia','premium_ia')` — precedente: `ai_prescriptions_enabled` (migr 036).
- `subscriptions.stripe_price_id text` (nullable).
- `ai_usage_periods` e `ai_usage_events` + RPC `increment_ai_usage(...)` — schema da `chat-first-workspace/SPEC.md` §Metering. **Adicionar coluna `surface text` em `ai_usage_events`** (`command_bar|workspace|canvas|proactive|mobile|voice`).
- `ai_free_trials (trainer_id, action_class, used_at, pk(trainer_id, action_class))` — mecânica "1× cada ação".
- `ai_credit_topups (...)` — **só a tabela** (lógica de top-up é v1.1).
- RLS: treinador lê só as próprias linhas; escrita só via service role. Índices conforme spec §5.

### B) Resolução de tier — `web/src/lib/auth/get-ai-tier.ts` (novo)
- `getAiTier(trainer, subscription)` com precedência: override `trainers.ai_tier != 'free'` > tier derivado de `subscriptions.stripe_price_id` > `'free'`.
- Estender o `select` de `web/src/lib/auth/get-trainer.ts` para trazer `ai_tier` e `subscriptions.stripe_price_id`.

### C) Limite de alunos — `web/src/lib/limits/student-cap.ts` (novo)
- `STUDENT_CAP = { free:1, essencial:Infinity, pro_ia:Infinity, premium_ia:Infinity }` + `assertCanCreateStudent(supabase, trainerId, tier)` (conta `students where coach_id` e compara).
- Enforçar **antes do insert** em: `web/src/actions/create-student.ts`, `web/src/lib/mcp/tools/students-write.ts` (`kinevo_create_student`), e `web/src/actions/leads/convert-lead-core.ts` (`convert_lead`). Erro amigável.

### D) Engine de IA (encanamento)
- `web/src/lib/assistant/mcp-bridge.ts` (novo) — ponte in-memory (`InMemoryTransport.createLinkedPair` + `experimental_createMCPClient`) reusando `createMcpServer(trainerId)`. **Transformar** o conjunto: reads passam com `execute`; tools em `CONFIRM_TOOLS` viram versões client-side **sem `execute`** (ver SPEC §HITL — o `client.tools()` descarta annotations e dá `execute` a todas).
- `web/src/lib/assistant/tool-policy.ts` (novo) — classificação das **55 tools** (READ/WRITE/CONFIRM), pesos de crédito (§2) e **subconjuntos de subsetting** por intenção (ex.: `financeiro`, `prescricao`, `agenda`, `alunos`, `forms`).
- `web/src/lib/ai-usage/quota.ts` + `metering.ts` (novos) — `PLAN_AI_QUOTA` (essencial 20 / pro 300 / premium 1000; free = via `ai_free_trials`), cálculo tokens→custo (PRICING de `llm-client.ts`) → créditos (pesos) com floor 1, e wrapper do RPC `increment_ai_usage`.
- `web/src/app/api/assistant/execute-tool/route.ts` (novo) — executor HITL: recebe `{toolName, args}`, revalida auth+tier+cota, reusa a ponte para invocar a tool real por nome, registra o crédito.

### E) Billing (sem criar Price IDs)
- `web/src/app/api/webhooks/stripe/route.ts` — no upsert de `subscriptions`, gravar `stripe_price_id = sub.items.data[0].price.id`; derivar o tier por env (`STRIPE_PRICE_ESSENCIAL/PRO/PREMIUM`) e refletir em `trainers.ai_tier` **quando não houver override manual**. Manter idempotência (`webhook_events`) e www-only.
- `web/src/app/api/stripe/checkout/route.ts` — aceitar `tier`/`priceId` **validado contra o mapa de env** (nunca price arbitrário do cliente). Não criar UI.
- **Bloqueio de downgrade:** se a mudança de plano levar a `free` e o treinador tiver aluno real (count>1, descontando o self-student), recusar com mensagem clara.

## 4. Fora de escopo da Fase 0
- Qualquer UI (⌘K, workspace, settings, mobile) — são F1+.
- Lógica de **top-up** (v1.1) — só a tabela.
- Tools novas de financeiro/forms-write, training-room. Migrar prescrição.
- Criar Price IDs no Stripe (manual). `streamUI` / artifacts (F2).

## 5. Validação (antes de declarar pronto)
- `tsc --noEmit` limpo; `vitest run` verde.
- **Unitários obrigatórios:** `tool-policy` (classe/peso/subsetting), `metering` (tokens→custo→créditos, floor 1), `quota` (allow/block + reset), `get-ai-tier` (precedência override>price>free), `student-cap` (free bloqueia o 2º; pago libera).
- **Script E2E** (sem UI, pode ser um arquivo em `scripts/` ou um teste): pela ponte, executa **1 read** e **1 write via execute-tool**; cria o self-student no Free e confirma que o **2º aluno é bloqueado**; confirma que um turno **incrementa créditos** em `ai_usage_periods` (use conta de teste — "Trainer Carteira Teste"; limpe os dados de teste no fim).
- Auditar antes de expor escrita nova: triggers/RPCs por dependência de `current_trainer_id()` (padrão já conhecido no projeto — overload `p_trainer_id` se preciso). As 55 tools atuais já estão corrigidas.

## 6. Ao terminar
- **Não commitar.** Liste o que ficou no working tree e **sugira** os commits atômicos (por domínio A–E) para o Gustavo autorizar depois.
- Reporte: o que foi feito, o que precisa de autorização (aplicar migration, env vars novas), e o que ficou pendente para F1.
- Atualize a seção "Notas de Implementação" da `SPEC.md` com decisões/descobertas da execução.

**Comece lendo a SPEC.md inteira e me apresentando um plano curto de execução da Fase 0 antes de editar arquivos.**
