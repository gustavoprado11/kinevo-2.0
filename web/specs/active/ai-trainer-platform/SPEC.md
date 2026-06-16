# IA do Treinador — Spec de Implementação (master)

> **Status:** Rascunho para iniciar desenvolvimento · jun/2026
> **Tipo:** Spec de produto + engenharia. Nenhum código alterado ainda.
> **Escopo:** transformar a IA do Kinevo numa **camada de operação do app para o treinador**
> (não é IA para o aluno), monetizada por **4 tiers com créditos**.
>
> **Relação com specs existentes:** esta spec é o **master**. A engine conversacional
> (ponte in-memory, tool-policy, HITL, metering) já está detalhada em
> [`chat-first-workspace/SPEC.md`](../chat-first-workspace/SPEC.md) — esta spec **reusa**
> aquela arquitetura e **atualiza/estende**: (a) pricing para os 4 tiers definidos,
> (b) 55 tools (não 27), (c) limite de alunos por tier, (d) as superfícies além do chat
> (barra de comando, UI generativa, proativo, mobile/voz), (e) o portão LGPD, (f) o mapa
> completo de touchpoints. Onde houver divergência de pricing, **esta spec prevalece**.
>
> **Fundamentação:** `docs/analise-mcp-assistente-custos.md` (custos verificados + telemetria
> real prod), e os HTMLs de planejamento na raiz do repo (`ai-trainer-master.html`,
> `ai-trainer-economics.html`, `ai-trainer-pricing-mock.html`, mocks de superfície).

---

## 1. Decisões já fechadas (NÃO re-discutir)

1. **É o TREINADOR operando o Kinevo via IA** — executar ações no app. Não é IA para o aluno.
2. **Diferencial = ter o código:** UI generativa, estado compartilhado, IA embutida nas telas,
   proatividade, voz/Siri, undo/auditoria — coisas que o conector externo (Claude) não faz.
3. **Uma engine, N superfícies:** as **55 tools** via ponte in-memory alimentam todas as superfícies.
   Não construir 5 produtos; construir a engine 1× e acender superfícies por cima.
4. **Sequência:** engine (F0) → **barra de comando ⌘K** → **UI generativa** → **proativo** → **mobile/voz**.
5. **4 tiers com créditos e teto** (o teto garante a margem). Estrutura definida pelo Gustavo (§3).
6. **Portão LGPD precede tudo** (ordem 0): DPA + zero-retention + no-training com a OpenAI antes de
   escalar features que tocam dado de saúde [S].
7. **Roteamento de custo:** "gera um programa" → action determinística `generateProgram` (1 chamada),
   não os ~20 writes do MCP.
8. **Degradar pra GUI** quando a cota acaba — nunca travar o trabalho do treinador.
9. **Não tocar em `lib/prescription/`** (CLAUDE.md). Não commitar/push até autorização (WORKFLOW.md).

---

## 2. Visão geral da arquitetura (1 engine, N superfícies)

```
┌─ SUPERFÍCIES (fachadas finas, 1 por fase) ────────────────────────────┐
│  ⌘K command bar · /assistente workspace · canvas UI-generativa        │
│  briefing proativo · mobile chat · voz/Siri                            │
└───────────────────────────────┬───────────────────────────────────────┘
                                 │ todas chamam
┌─ ORQUESTRAÇÃO (parte nova, parte pronta) ─────────────────────────────┐
│  api/assistant/* (streamText) · mcp-bridge.ts (in-memory)             │
│  tool-policy.ts (read/write + créditos + SUBSETTING) · execute-tool   │
│  streamUI (UI generativa) · metering/quota · gate de tier             │
└───────────────────────────────┬───────────────────────────────────────┘
                                 │ um catálogo só
┌─ ENGINE (55 tools MCP — JÁ EM PRODUÇÃO, escopo por trainerId) ────────┐
│  createMcpServer(trainerId) · readOnly/destructive hints · núcleos     │
│  compartilhados action↔MCP · generateProgram (1 call)                  │
└───────────────────────────────┬───────────────────────────────────────┘
                                 │ fontes proativas (já existem)
┌─ SINAIS ──────────────────────────────────────────────────────────────┐
│  cron/generate-insights (6 tipos + action_type) · draft-message ·      │
│  winback-draft · assistant_insights (action_metadata)                  │
└────────────────────────────────────────────────────────────────────────┘
```

A engine e os sinais **já existem**. O trabalho desta spec é: a camada de orquestração
(monetizada) + as superfícies (faseadas) + o billing/tiers + os limites.

---

## 3. Modelo de produto — 4 tiers + créditos

### 3.1 Tiers (definidos pelo Gustavo)

| Tier | Preço/mês | Alunos | Créditos IA/mês | Superfícies de IA | Stripe |
|---|---|---|---|---|---|
| **Gratuito** | R$ 0 | **1 — você mesmo** (aluno-teste) | **1× cada ação** (teste único) | prova cada ação uma vez, em você mesmo | sem assinatura |
| **Essencial** | R$ 39,90 | ilimitados | **20** | gostinho (chat básico) | Price ID **já existe** |
| **Pro** ⭐ | R$ 79,90 | ilimitados | **300** | ⌘K + workspace + UI generativa + proativo | **Price ID novo** |
| **Premium** | R$ 129,90 | ilimitados | **1.000** | tudo do Pro + voz/mobile + suporte exclusivo + acesso prioritário | **Price ID novo** |

- **Top-up:** pacote avulso **+500 créditos por R$ 29,90** (pagamento único, não vira assinatura).
- **Parceiros comped:** Lucas Damiani e Lucas Martins entram no **R$ 39,90 cortesia** —
  `trainers.ai_tier='essencial'` (override manual) + sem cobrança no Stripe.
- Créditos renovam por ciclo e **não acumulam**.

### 3.2 Pesos de crédito (config)

| Ação | Créditos | Classe (`action_class`) |
|---|---|---|
| Pergunta / consulta / leitura | 1 | `query` |
| Ação simples (1 write: marcar pago, reagendar…) | 1 | `write` |
| Ação composta (várias tools num turno) | 2–3 | `write` |
| Gerar programa completo (`generateProgram`) | **5** *(afrouxado — decisão Gustavo)* | `prescription` |
| Envio em massa | 1 / aluno (máx 10) | `bulk` |

> 1 crédito ≈ **R$0,02 de custo real** (ancorado no doc de custos); teto modelado a R$0,04.
> Margem bruta IA: ~98% (R$39,90) · 85–94% (R$79,90) · 69–88% (R$129,90). Detalhe em `ai-trainer-economics.html`.
>
> **Prescrição = 5 créditos** (era 8–10) → por mês: **Essencial ~4 prescrições · Pro ~60 · Premium ~200.**
> Custo da prescrição (~$0,012/op) ainda cabe folgado em qualquer tier; afrouxar o peso não estoura margem
> (o driver de custo é o chat input-pesado, não a prescrição). Se "3 prescrições" referia-se a outro tier,
> recalibrar é só mudar este número.

### 3.3 Mecânica do Gratuito ("1× cada ação")

- O Free **não usa o balde de créditos** — usa um registro de "ações já experimentadas".
- Cada `action_class` (ou tool) pode ser disparada **1 vez**; depois, a UI mostra
  *"Você já testou essa ação — assine para usar de verdade"*.
- **1 aluno = o próprio treinador (aluno-teste).** O treinador adiciona **a si mesmo** como aluno
  para experimentar o app dos dois lados (prescrever pra si, ver o app do aluno, testar as ações de IA
  nele mesmo). Cap Free = **1**; criar um 2º aluno exige plano pago. UX recomendada: botão
  *"Adicionar a mim mesmo como aluno-teste"* que cria um self-student (vinculado ao e-mail do treinador).
- **Decisão fechada (§11):** o Free **substitui o hard-block** pós-trial — em vez de mandar para
  `/subscription/blocked`, o treinador cai no Free (limitado) e continua no funil.

---

## 4. Os 6 domínios que a estrutura toca (mapa macro)

> Esta é a resposta a "considerar todos os pontos em que essa estrutura irá tocar".
> Cada domínio é detalhado nas seções 5–10.

| # | Domínio | O que muda | Risco |
|---|---|---|---|
| **A** | **Dados / migrations** | `trainers.ai_tier`, `subscriptions.stripe_price_id`, metering (`ai_usage_periods`/`events` + RPC), Free-trials, top-ups | médio (DDL) |
| **B** | **Billing / Stripe / tiers** | 2 Price IDs novos, checkout por tier, webhook grava price→tier, upgrade/downgrade, top-up, portal | **alto (dinheiro)** |
| **C** | **Gate de acesso & limites** | `getAiTier`, gate de superfície por tier, **limite de alunos** (Free=0), repensar o `/subscription/blocked` | alto |
| **D** | **Engine de IA** | ponte in-memory, tool-policy (55 tools), HITL, **subsetting** (custo), metering no `onFinish` | médio |
| **E** | **Superfícies** | ⌘K, workspace, UI generativa, proativo, mobile, voz — faseadas | médio |
| **F** | **LGPD / compliance / observabilidade** | DPA/ZDR (ordem 0), feed "IA fez X" + undo, logs de uso, custo real | **bloqueante (F)** |

---

## 5. Domínio A — Dados / migrations

Uma migration nova (`NNN_ai_platform.sql`), backward-compatible. Rodar `gen:types` depois.

```sql
-- A1. Tier de IA por treinador (override manual; precedente: ai_prescriptions_enabled, migr 036)
alter table trainers add column ai_tier text not null default 'free'
  check (ai_tier in ('free','essencial','pro_ia','premium_ia'));

-- A2. Preço do Stripe na assinatura → deriva o tier do plano pago
alter table subscriptions add column stripe_price_id text;

-- A3. Metering (da chat-first-workspace/SPEC.md — reusar idêntico)
create table ai_usage_periods ( ... );   -- trainer_id, period_type, period_start, credits_used, cost_usd_micros, turns_count
create table ai_usage_events  ( ... );    -- trainer_id, action_class, credits, tokens, cost_usd_micros, model, surface
create function increment_ai_usage(...);  -- upsert atômico

-- A4. Free trials por ação (mecânica "1× cada ação")
create table ai_free_trials (
  trainer_id uuid not null references trainers(id) on delete cascade,
  action_class text not null,
  used_at timestamptz not null default now(),
  primary key (trainer_id, action_class)
);

-- A5. Top-ups de crédito (pagamento avulso)
create table ai_credit_topups (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references trainers(id) on delete cascade,
  credits integer not null,
  cost_brl_cents integer not null,
  stripe_payment_intent_id text,
  consumed_in_period date,           -- a qual período os créditos foram somados
  created_at timestamptz not null default now()
);
```

- **`ai_usage_events.surface`** (novo vs. spec antiga): qual superfície gerou o evento
  (`command_bar` | `workspace` | `canvas` | `proactive` | `mobile` | `voice`) — para analytics por superfície.
- **RLS:** treinador lê só as próprias linhas de uso/trials/topups; escrita só via service role.
- **Limite de alunos NÃO vira coluna** — é derivado do tier (mapa em código): `free→0`, demais `∞`.
- Índices: `ai_usage_periods (trainer_id, period_type, period_start)` unique; `ai_usage_events (trainer_id, created_at)`.

---

## 6. Domínio B & C — Billing, tiers e gate de acesso

### 6.1 Stripe (Domínio B)

**Hoje:** `api/stripe/checkout/route.ts` usa **um** `STRIPE_PRICE_ID` (env) + trial 7d.
`api/webhooks/stripe/route.ts` faz upsert em `subscriptions` **sem** price/tier.

**Mudanças:**
1. **Criar 2 Price IDs no Stripe:** Pro IA (R$79,90) e Premium IA (R$129,90). O R$39,90 **já existe**.
   Mapa `price_id → tier` em env/config (`STRIPE_PRICE_ESSENCIAL/PRO/PREMIUM`).
2. **Checkout por tier:** parametrizar `api/stripe/checkout/route.ts` com `priceId`/`tier`
   (validar contra o mapa; nunca aceitar price arbitrário do cliente). Upgrade/downgrade = trocar
   o item da subscription (`stripe.subscriptions.update`) ou novo checkout.
3. **Webhook grava o price** (`api/webhooks/stripe/route.ts`): no upsert, setar
   `subscriptions.stripe_price_id = sub.items.data[0].price.id`. Em `customer.subscription.updated`
   (mudança de plano) também. **Derivar o tier** do price e — quando NÃO houver override manual —
   refletir em `trainers.ai_tier`.
4. **Top-up:** checkout de pagamento único (mode `payment`) → webhook `checkout.session.completed`
   com `metadata.kind='ai_topup'` → insere `ai_credit_topups` + soma no período corrente.
5. **Portal** (`api/stripe/portal`) continua para gestão/cancelamento.
6. **Regra do incidente (CLAUDE.md):** todo webhook/URL usa `https://www.kinevoapp.com` (com www).
   Idempotência via `webhook_events`.

### 6.2 Resolução de tier (Domínio C)

```ts
// lib/auth/get-ai-tier.ts (novo)
// Precedência: override manual (trainers.ai_tier != 'free') > tier derivado do stripe_price_id > 'free'
function getAiTier(trainer, subscription): 'free'|'essencial'|'pro_ia'|'premium_ia'
```
- `getTrainerWithSubscription` (`lib/auth/get-trainer.ts`) ganha `ai_tier` e
  `subscriptions.stripe_price_id` no select (1 linha cada).
- **Repensar `/subscription/blocked`:** hoje, sem assinatura ativa → hard-block. Novo: trial expirado
  ou sem plano pago → **cai no Free** (entra, limitado), não bloqueia. (Decisão §11.)

### 6.3 Limite de alunos (Domínio C) — **ponto novo crítico**

Hoje **não há limite** (`create-student-core.ts`, MCP `students-write.ts`). Regra nova: **Free = 1 aluno
(o próprio treinador); pago = ilimitado.**

- `lib/limits/student-cap.ts` (novo): `STUDENT_CAP = { free: 1, essencial: Infinity, pro_ia: Infinity, premium_ia: Infinity }`.
- **Enforçar em 3 pontos** (todos antes do insert):
  1. `actions/create-student.ts` (wrapper) — `count(students where coach_id) >= cap` → erro amigável.
  2. `lib/mcp/tools/students-write.ts` (`kinevo_create_student`) — mesma checagem (admin client + count).
  3. **Mobile** — a tela de criar aluno chama action/endpoint web; herda o gate, mas a UI esconde/bloqueia
     o botão no Free (mostra "Assine para adicionar alunos").
- **Conversão de lead** (`kinevo_convert_lead`, `convertLeadToStudent`) **também cria aluno** → mesma checagem.
- **Self-student do Free:** o 1 aluno permitido deve ser o próprio treinador. Opções: (a) botão dedicado
  que cria o self-student a partir do perfil do treinador, ou (b) permitir 1 aluno qualquer mas posicioná-lo
  como "aluno-teste". Recomendado (a) para deixar o intuito claro.

**Downgrade / fim de assinatura (decisão Gustavo):** *"para usar com alunos, o treinador precisa pagar".*
- **Downgrade Pro/Essencial → Free é BLOQUEADO se houver aluno real** (mais que o self-student). A UI de
  cancelamento/downgrade avisa: *"Você tem N alunos — para voltar ao Gratuito, remova-os ou mantenha um plano."*
- Se a assinatura **caducar de fato** (Stripe cancela, sem plano pago) e houver alunos: a gestão de alunos
  entra em **estado travado** (read-only / "reative um plano para continuar") — os dados não são apagados,
  mas não dá pra adicionar/operar alunos até voltar a pagar. (Substitui o atual hard-block total por um
  bloqueio só na parte que exige plano.)

### 6.4 Gate de superfície por tier

| Superfície | Free | Essencial | Pro IA | Premium IA |
|---|---|---|---|---|
| Provar ação 1× | ✓ | ✓ | ✓ | ✓ |
| Chat básico (cota) | — | 20 cr | 300 cr | 1.000 cr |
| ⌘K command bar | — | — | ✓ | ✓ |
| Workspace + UI generativa | — | — | ✓ | ✓ |
| Briefing proativo | — | — | ✓ | ✓ |
| Voz / mobile / Siri | — | — | — | ✓ |
| Suporte exclusivo / prioridade | — | — | — | ✓ |

Gate em **dois níveis** (igual `ai_prescriptions_enabled`): (a) rota/UI esconde o que o tier não tem;
(b) o handler de API revalida o tier (defense-in-depth) e a cota antes do turno.

---

## 7. Domínio D — Engine de IA (reusa chat-first-workspace/SPEC, com deltas)

Detalhe completo em [`chat-first-workspace/SPEC.md`](../chat-first-workspace/SPEC.md). **Deltas desta spec:**

1. **55 tools, não 27.** `tool-policy.ts` lista as 55 com classe e peso. Os 5 W-GATE
   (`create_contract`, `mark_payment_as_paid`, `cancel_contract`, `convert_lead`, `finalize_assessment`)
   + os W-DESTR vão para `CONFIRM_TOOLS` (HITL). Os W-GATE **já têm `confirm`** no schema — o card de
   confirmação in-app é a UI desse gate (reuso direto).
2. **Subsetting é 1ª classe (custo):** não mandar as 55 defs sempre (~7.500 tok). Carregar por intenção
   (financeiro / prescrição / agenda…). `tool-policy.ts` define os subconjuntos; o handler escolhe pela
   primeira mensagem / pela superfície. **Corta 60–70% do input** (doc de custos). Sem isso, o pesado
   não fecha nem a R$79,90.
3. **Prompt caching deliberado:** prefixo estável (system + subconjunto de tools) no início; contexto
   volátil (aluno, data) no fim. Cache automático da OpenAI dá 75% off (confirmado na telemetria).
4. **Metering no `onFinish`:** `usage` → custo (PRICING de `llm-client.ts`) → créditos (pesos §3.2) →
   `increment_ai_usage` + `ai_usage_events` (com `surface`). Free → grava em `ai_free_trials`, não em créditos.
5. **Modelo:** `gpt-4.1-mini` (manter). Head-to-head com Gemini 3.5 Flash só se a acurácia de
   tool-calling com 55 tools se mostrar instável (doc: Gemini lidera tool-calling, mas ~3× o custo).

---

## 8. Domínio E — Superfícies (faseadas)

Cada superfície é uma fachada fina sobre a engine. Detalhe visual nos mocks (raiz do repo).

| Fase | Superfície | Entrada | Arquivos (novos) | Gate |
|---|---|---|---|---|
| F1 | **⌘K command bar** | estende `command-palette.tsx` (hoje só navega) | `assistant/command-bar/*`, `api/assistant/command/route.ts` | Pro+ |
| F2 | **Workspace + UI generativa** | rota `/assistente` | `app/assistente/page.tsx`, `components/assistant/chat-workspace.tsx`, `artifacts/*`, `streamUI` | Pro+ |
| F3 | **Briefing proativo** | card no `/dashboard` | `components/assistant/briefing.tsx`, `api/assistant/briefing/route.ts` (lê insights + drafts) | Pro+ |
| F4 | **Mobile chat** | `app/(trainer-tabs)/ia.tsx` (RN) | tela RN + reuso da API web via JWT | Premium |
| F4 | **Voz** | mic na tela mobile | add `expo-speech`/Whisper (não existe hoje) | Premium |
| F5 (v2) | **Siri / App Intents** | módulo nativo (bare Expo) | config plugin + Swift AppIntent | Premium |

- **Reuso:** todas chamam a mesma engine (mcp-bridge) e o mesmo metering. A diferença é só transporte+auth
  (web = sessão Supabase; mobile = JWT no header — padrão já usado em `api/notifications/register-token`).
- **UI generativa (F2):** `streamUI` renderiza componentes Kinevo existentes (`ProgramTable`, `ContractCard`)
  — editar a célula chama a tool/action real (salvamento otimista). É o diferencial vs. conector externo.
- **Insights como starters (F3):** `assistant_insights` (cron) viram botões que injetam prompt com contexto.

---

## 9. Domínio F — LGPD / compliance / observabilidade

1. **Portão LGPD (ordem 0, bloqueante):** confirmar **DPA + zero data retention + no-training** com a
   OpenAI na org/projeto de produção. 14 das 55 tools tocam dado de saúde [S]. Versionar a evidência.
   **Nenhuma feature [S] escala antes disso.**
2. **Subsetting reduz exposição:** mandar só as tools da intenção limita quanto dado [S] vai ao LLM.
3. **Feed "a IA fez X" + desfazer:** `ai_usage_events` já registra cada ação; expor um feed auditável
   no app (e undo nas ações reversíveis). Confiança + diferencial de ter o estado no nosso banco.
4. **Observabilidade de margem:** `cost_usd_micros` é a verdade interna; dashboard interno
   custo/treinador/tier para validar as premissas de crédito com uso real (hoje a telemetria está no piso).

---

## 10. Mapa de touchpoints (arquivo × mudança) — exaustivo

### Novos
| Arquivo | Domínio | Papel |
|---|---|---|
| `supabase/migrations/NNN_ai_platform.sql` | A | ai_tier, stripe_price_id, metering, free_trials, topups + RLS |
| `lib/auth/get-ai-tier.ts` | C | resolve tier (override > price > free) |
| `lib/limits/student-cap.ts` | C | cap por tier + checagem |
| `lib/ai-usage/quota.ts` · `metering.ts` | D | cota por plano + crédito/custo |
| `lib/assistant/mcp-bridge.ts` · `tool-policy.ts` (55 + subsetting) | D | engine |
| `api/assistant/command/route.ts` · `workspace/route.ts` · `execute-tool/route.ts` · `briefing/route.ts` | D/E | handlers |
| `app/assistente/page.tsx` · `components/assistant/*` (command-bar, chat-workspace, artifacts, confirmation-card, briefing, insight-starters) | E | UI web |
| `api/stripe/checkout` (tier) · top-up route | B | billing |
| `app/(trainer-tabs)/ia.tsx` + tela RN | E | mobile |

### Modificados
| Arquivo | Domínio | Mudança |
|---|---|---|
| `lib/auth/get-trainer.ts` | C | select `ai_tier` + `subscriptions.stripe_price_id`; repensar block→Free |
| `app/api/webhooks/stripe/route.ts` | B | gravar `stripe_price_id`; derivar tier; tratar top-up |
| `app/api/stripe/checkout/route.ts` | B | aceitar `tier`/`priceId` validado |
| `actions/create-student.ts` + `create-student-core.ts` | C | gate de cap de alunos |
| `lib/mcp/tools/students-write.ts` (`kinevo_create_student`) + `leads.ts` (`convert_lead`) | C | gate de cap |
| `app/api/assistant/chat/route.ts` | C/D | gate de tier + cota (hoje só auth+rate-limit) |
| `command-palette.tsx` | E | campo de IA (⌘K command bar) |
| `app/settings/page.tsx` + `components/settings/billing-section.tsx` | B/E | seção "Plano & uso de IA" (medidor de créditos, upgrade) |
| Sidebar/nav (`components/layout/sidebar.tsx`) | E | item "Assistente" (gate por tier) |
| `app/subscription/blocked/*` | C | virar tela de "upgrade/Free" em vez de hard-block |
| Mobile: tela criar aluno, tela de plano/assinatura | C/E | esconder no Free; medidor de créditos |
| `shared/types/database.ts` | A | `gen:types` após migration |

### Fora de escopo (v1)
- Migrar `lib/prescription/` (proibido). Tools novas de financeiro/forms-write (deep-link basta).
- Siri/App Intents (v2). Substituir o painel-assistente contextual (segue como está).

---

## 11. Decisões fechadas (Gustavo · 16/jun/2026)

1. ✅ **Free substitui o hard-block.** Reestruturar: trial expirado / sem plano pago → cai no **Free**
   (entra limitado), não em `/subscription/blocked`. Toca `get-trainer.ts`, `/subscription/blocked` e o webhook.
2. ✅ **O único aluno do Free é o próprio treinador** (self-student, para testar o app com ele mesmo).
   Cap Free = **1**; o 2º aluno exige plano pago.
3. ✅ **Afrouxar a prescrição:** peso 8–10 → **5 créditos** (Essencial ~4 prescrições/mês, Pro ~60, Premium ~200).
4. ✅ **Downgrade bloqueado:** quem estava no Pro+ e tenta voltar ao Free **é bloqueado se tiver alunos** —
   *"para usar com alunos, precisa pagar"*. Assinatura caducada com alunos → gestão de alunos travada (não apaga).
5. ✅ **Top-up = v1.1** (não entra no v1).
6. ✅ **Primeira superfície = ⌘K** (recomendado). **Mas só lança publicamente após a equipe configurar e
   testar tudo internamente** (dogfooding) — ver gate de lançamento na §12.

### Ainda a confirmar (não bloqueia F0)
- "3 prescrições" da decisão 3 referia-se a qual tier? Apliquei peso 5 (folga em todos). Recalibrável num número.
- Self-student: botão dedicado (recomendado) vs. permitir 1 aluno qualquer.

---

## 12. Plano faseado

| Fase | Entrega | Critério de pronto |
|---|---|---|
| **F0 · LGPD** | DPA + ZDR + no-training confirmados e versionados | evidência no doc interno |
| **F0 · Fundações** | migration (A), `get-ai-tier`, student-cap, mcp-bridge + tool-policy (55+subsetting), metering+RPC, execute-tool | script: 1 read + 1 write (HITL) via ponte; cap bloqueia no Free; crédito incrementa |
| **F0 · Billing** | 2 Price IDs, checkout por tier, webhook grava price→tier, portal | upgrade real muda `ai_tier`; webhook idempotente |
| **F1 · ⌘K command bar** | IA no palette opera a tela atual + HITL + gate Pro + medidor de cota | executa read e write da tela atual; estoura cota → degrada |
| **F2 · Workspace + UI generativa** | `/assistente` + `streamUI` (treino/cobrança editáveis) | artifact editável reflete no estado |
| **F3 · Proativo** | briefing matinal + fila de aprovação (insights + drafts) | aprovar dispara a tool com confirmação |
| **F4 · Mobile + voz** | tela RN consumindo a API + voz + push→chat | ação por voz com Face ID |
| **F5 · Siri (v2)** | App Intents via config plugin | "Ei Siri, …" dispara ação |

> Cada fase é entregável e testável isolada. F0 habilita todas. F1 prova o valor com menor esforço.

### Gate de lançamento (decisão Gustavo: lançar só após testar tudo internamente)

O público **não** vê a feature até a equipe validar. Mecânica:
- **Dogfooding via `trainers.ai_tier` (override manual):** a equipe e os parceiros comped
  (Lucas Damiani, Lucas Martins) recebem o tier manualmente e usam a feature em produção **antes**
  de qualquer venda. Os 2 Price IDs novos (Pro/Premium) ficam **criados mas não divulgados** (a tela de
  planos com Pro/Premium fica atrás de uma flag até o go-live).
- **Checklist de go-live público:** (a) portão LGPD confirmado; (b) ⌘K + cota + degradação validados em
  prod pela equipe; (c) webhook de upgrade/downgrade testado (inclui o bloqueio de downgrade com alunos);
  (d) métrica de custo real/treinador dentro do previsto; (e) self-student do Free funcionando.
- Só depois disso a tela de planos expõe Pro/Premium e o checkout por tier é ligado.

---

## 13. Critérios de aceite (transversais)

- [ ] Tier resolvido por `getAiTier` (override > price > free); webhook grava `stripe_price_id`.
- [ ] **Free não cria aluno** (action + MCP + lead-convert) e prova cada ação **1×**.
- [ ] Cada turno registra créditos + custo real em `ai_usage_periods`/`events` (atômico, com `surface`).
- [ ] Estouro de cota degrada pra GUI (banner), nunca trava o app.
- [ ] Superfícies gated por tier em 2 níveis (UI + API).
- [ ] HITL nas `CONFIRM_TOOLS` (inclui os 5 W-GATE que já têm `confirm`).
- [ ] Subsetting ativo (não manda 55 defs sempre).
- [ ] Tenant isolation preservado (toda tool por `trainerId`).
- [ ] LGPD: DPA/ZDR confirmados antes de escalar [S].
- [ ] Retrocompat: `api/mcp` externo (Claude) e painel-assistente (3 tools) intactos.
- [ ] Zero novos erros TS; sem `any`; `gen:types` rodado.

---

## 14. Testes requeridos

**Unitários (obrigatório):** `tool-policy` (classe/peso/subsetting), `metering` (tokens→custo→créditos,
floor de 1), `quota` (allow/block + reset), `get-ai-tier` (precedência override>price>free),
`student-cap` (Free=0 bloqueia; pago libera).
**Integração:** `increment_ai_usage` atômico; webhook Stripe grava price→tier + idempotência;
gate de tier/cota nos handlers; HITL não executa sem confirmação; cap em create-student (action + MCP).
**Componentes (crítico):** card de confirmação; banner de cota; medidor de créditos.
**Não testar:** layout/navegação/puramente visual.

---

## 15. Riscos

| Risco | Mitigação |
|---|---|
| Custo escapa (power-user) | subsetting + cache + **teto de créditos** (3 pernas obrigatórias do doc) |
| LGPD (dado de saúde no LLM) | portão DPA/ZDR ordem 0; subsetting reduz exposição |
| Billing quebrado (dinheiro) | idempotência `webhook_events`; www-only; testes de webhook; W-GATE com confirm |
| Acurácia de tool-calling com 55 tools | subsetting reduz o leque por turno; head-to-head Gemini se preciso |
| Dispersão (5 superfícies) | 1 ponta-de-lança (⌘K) + engine única; resto por fase |
| Free abusado | 0 alunos + 1× por ação + sem superfícies premium |

---

## Referências
- `docs/analise-mcp-assistente-custos.md` — custos verificados + telemetria real (fonte da economia).
- `web/specs/active/chat-first-workspace/SPEC.md` — engine conversacional detalhada (reusada).
- HTMLs de planejamento (raiz): `ai-trainer-master`, `ai-trainer-economics`, `ai-trainer-pricing-mock`,
  `ai-trainer-mock-canvas/commandbar/proactive`, `mcp-chat-mockup`, `mcp-mobile-storyboard`.
- Código: `lib/mcp/*` (55 tools), `api/assistant/chat`, `api/webhooks/stripe`, `api/stripe/checkout`,
  `lib/auth/get-trainer`, `actions/create-student*`, `cron/generate-insights`, `command-palette.tsx`.
- Memória: `project_kinevo_inapp_mcp_chat`, `project_kinevo_llm_surfaces`.

---

## Notas de Implementação (Fase 0 — executado 16/jun/2026)

**Status:** F0 (Fundações + Billing) implementada no working tree. Migration **aplicada em prod**
(`lylksbtgrihzepbteest`) + `gen:types` rodado. **Sem commit/push** (aguarda autorização). `tsc` limpo,
`vitest run` verde (1208 passed), E2E live verde.

### Decisões e descobertas
1. **🔴 Correção crítica do `getAiTier` (revisão):** `subscriptions.stripe_price_id` nasce NULL, então
   pagante ativo resolveria para `free` e o cap (free=1) bloquearia adicionar alunos num pagante com N
   alunos — regressão real. Fix: **pagante ATIVO com price desconhecido/NULL → `essencial`** (nunca free).
   E **sem backfill** de `trainers.ai_tier` (override = `ai_tier != 'free'`; gravar congelaria upgrades
   por price). Provado LIVE: a conta de teste (sub ativa, price NULL) resolve `essencial`.
2. **Webhook NÃO grava `trainers.ai_tier`** (diverge do rascunho §3.E). Como override é `ai_tier != 'free'`,
   escrever o tier derivado do price o transformaria em override e travaria upgrades futuros. O webhook
   persiste só `subscriptions.stripe_price_id`; o tier é derivado em **tempo de leitura** por `getAiTier`.
3. **Migration = `208_ai_platform.sql`** (a 207 `assistant_llm_usage` é um ledger de custo bruto, conceito
   diferente do orçamento por crédito — coexistem). `increment_ai_usage` com `search_path=''` (advisor).
4. **Student-cap em 2 edits cobre 3 caminhos:** `createStudentCore` (action `createStudent` + `convertLeadToStudentCore`,
   que chama o core) e a tool MCP `kinevo_create_student` (lógica própria, fora do core).
5. **HITL via ponte:** `client.tools()` entrega tudo com `execute`; o bridge **substitui** as `CONFIRM_TOOLS`
   por versões sem `execute` (pausa o stream). `CONFIRM_TOOLS` = 5 W-GATE + W-DESTR (§7.1) = 9 tools.
6. **Cotas:** master prevalece sobre a chat-first → Essencial 20 / Pro 300 / Premium 1000. Prescrição peso 5.
7. **Tipos:** a migration foi aplicada **antes** de escrever o TS (recomendação da revisão), então `gen:types`
   tipou tudo de verdade — **nenhum cast `as any`** foi necessário.
8. **`gen:types` via CLI falhou** (a auth do CLI Supabase não tem privilégio nesta conta) — tipos foram
   gerados via **MCP** (`generate_typescript_types`) e gravados em `shared/types/database.ts`.

### Pendente para F1 (anotado, fora do escopo F0)
- **`/subscription/blocked` → Free:** `getAiTier` já trata "sem assinatura ativa → free" corretamente, mas a
  troca do `redirect('/subscription/blocked')` em `get-trainer.ts` por "cair no Free" é UI-acoplada → F1.
- **`assertCanDowngradeToFree`** existe e está ligado ao checkout (tier `free`); falta ligar ao fluxo de
  cancelamento/portal e ao estado "gestão de alunos travada (read-only)" quando a assinatura caduca (§6.3).
- **Top-up:** só a tabela `ai_credit_topups` (lógica é v1.1).
- **Mobile:** esconder criação de aluno no Free + medidor de créditos (herdam o gate da action).
- **Metering do turno de chat:** `recordAiUsage` cobre custo+crédito; o handler de chat (workspace/command)
  que chama no `onFinish` é F1 (este F0 entrega o executor HITL `execute-tool` e o encanamento).

### Precisa de autorização do Gustavo
- ✅ **Migration 208 já aplicada em prod** (autorizada na revisão). `gen:types` já rodado.
- **Env vars novas** (Vercel): `STRIPE_PRICE_ESSENCIAL` (= ao `STRIPE_PRICE_ID` atual, R$39,90),
  `STRIPE_PRICE_PRO`, `STRIPE_PRICE_PREMIUM` — necessárias para o checkout/webhook por tier (sem elas, o
  checkout cai no default `STRIPE_PRICE_ID` e o webhook grava o price mas o mapa não o reconhece → resolve
  `essencial`). **Não criar os Price IDs é tarefa manual de negócio.**
- **Commit/push:** sugestão de commits atômicos por domínio abaixo (no prompt da fase).
```
