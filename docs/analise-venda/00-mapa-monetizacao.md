# 00 — Mapa da Monetização (o circuito do dinheiro, ponta a ponta)

> **Tipo:** análise read-only. Nenhum código/config/migration foi alterado.
> **Data:** 2026-06-23. **Escopo:** Modo Assistente + tokens/créditos, rumo a abrir a venda ao público.
> **Convenção de evidência:** toda afirmação leva `arquivo:linha`. Marco **[CONFIRMADO]** (lido na fonte) vs **[HIPÓTESE]** (a verificar em runtime/Stripe-test).
> Leia junto: `01-travas-tokens.md` (frente A), `02-stripe-pagamento.md` (B), `03-landing-pricing.md` (C), `04-onboarding-ativacao.md` (D), `05-riscos-lancamento.md`.

---

## 0. TL;DR do circuito

```
 SIGNUP (free)
   │   trainers.ai_tier='free', sem subscription  → getAiTier()='free'
   │   STUDENT_CAP.free = 1 aluno (o "aluno-teste")
   ▼
 PRIMEIRO USO  ───────────────────────────────────────────────┐
   │  • Dock flutuante  → /api/assistant/chat  (gate = usage.exhausted, NÃO exige tier)
   │       free usa via ai_free_trials "1× cada action_class" (query/write/prescription/bulk)
   │  • Aba /assistente, ⌘K, voz, canvas "Gerar com IA"  → gateAssistant = PRO_TIERS only (403 p/ free e essencial)
   ▼
 PAYWALL  (3 gatilhos distintos)
   │  (a) 2º aluno         → assertCanCreateStudent → StudentCapError (free=1)
   │  (b) free-trial gasto → execute-tool 402 'free_trial_used' / chat 402 'ai_quota_exhausted'
   │  (c) (pago) cota do mês esgotada → 402 'quota_exceeded' → degrada p/ GUI
   ▼
 ASSINATURA (Stripe)  → checkout sets session.metadata.trainer_id
   │  webhook checkout.session.completed → subscriptions.upsert(status, stripe_price_id, …)
   ▼
 TIER PAGO  (price → tier por env, em tempo de LEITURA)
   │  STRIPE_PRICE_ID/ESSENCIAL→essencial(20)  PRO→pro_ia(300)  PREMIUM→premium_ia(1000)
   ▼
 CONSUMO  → recordAiUsage → RPC consume_ai_usage (clamp atômico no teto do plano)
   │  créditos = computeTurnCredits (piso 1, TETO 12/turno); só tools com sucesso (toolResultOk)
   ▼
 ESTOURO  → checkQuota.allowed=false → 402 amigável (não trava o app; GUI segue)
   ▼
 RESET    → ai_usage_periods por period_start (mês, UTC); vira no 1º dia do mês seguinte
```

Pontos de falha marcados ao longo das seções com **⚠️**.

---

## 1. Tiers e cotas

**Fonte da verdade do orçamento:** `web/src/lib/ai-usage/quota.ts:23-28`.

| Tier | Cota mensal de crédito | Mecânica | Evidência |
|---|---|---|---|
| `free` | `null` (sem balde) | `ai_free_trials` — cada `action_class` 1× | `quota.ts:24`, `quota.ts:120-154` |
| `essencial` | **20** / mês | balde mensal `ai_usage_periods` | `quota.ts:25` |
| `pro_ia` | **300** / mês | idem | `quota.ts:26` |
| `premium_ia` | **1000** / mês | idem | `quota.ts:27` |

- As 4 `action_class` do free são `query/write/prescription/bulk` (`usage-summary.ts:51`, `tool-policy.ts:155`).
- **[CONFIRMADO]** As cotas batem com a "master SPEC §3.1" citada no próprio arquivo (`quota.ts:6,22`). A coerência com a **landing** (preços e cotas mostradas) é a checagem de maior risco de promessa falsa → ver `03-landing-pricing.md`.
- **[CONFIRMADO] ⚠️ Armadilha de tier `essencial`** (era C8 na auditoria 06-22): `essencial` tem cota de 20 créditos definida em código, **mas o gate do Assistente (`gateAssistant`) só admite `PRO_TIERS = {pro_ia, premium_ia}`** (`command-engine.ts:100,118-126`). Ou seja: quem assina `essencial` **paga e leva 403** no ⌘K / aba `/assistente` / voz / canvas. A cota de 20 só seria consumível pelo **dock legado** (`/api/assistant/chat`), que não exige tier. Se a landing vender "essencial com Assistente IA", é **promessa falsa** (frente C/D confirmam).

### Custo × crédito (margem)
- Pesos de crédito: `tool-policy.ts:175-185` — `create_program_template`=6, `create_student_draft_program`=6, `create_superset`=2, `assign_program`=2, `create_contract`=2, `generateProgram`(determinístico)=5; canvas build = `CANVAS_BUILD_CREDITS`=3 (`tool-policy.ts:195`); default=1.
- **[CONFIRMADO] Mudança vs baseline:** o build do Assistente agora roda em **Gemini 3.5 Flash** por padrão (`command-engine.ts:71 DEFAULT_BUILD_MODEL='gemini-3.5-flash'`), não Claude Sonnet. `resolveBuildModel()` (`:72-78`) cai pro `gpt-4.1-mini` se faltar `GOOGLE_GENERATIVE_AI_API_KEY`. Logo a antiga pendência "rotacionar ANTHROPIC_API_KEY p/ qualidade Sonnet" está **superada**; a chave load-bearing do build virou a do Google (ver §6 e `01`/`05`). A reconciliação de margem Gemini×crédito está em `01-travas-tokens.md`.

---

## 2. Resolução de tier

`web/src/lib/auth/get-ai-tier.ts` — `getAiTier(trainer, subscription)` (`:81-99`):

1. **Override manual:** `trainers.ai_tier != 'free'` e válido → usa esse tier (`:85-89`). É como o Gustavo é Pro+ hoje (dogfooding).
2. **Sem assinatura ativa** (`status ∉ {active,trialing}`) → `free` (`:92-95`).
3. **Pagante ativo:** deriva do `stripe_price_id` via `buildPriceTierMap()` (`:45-56`); **price desconhecido → `essencial`** (nunca free) (`:98`).

- Envs do mapa: `STRIPE_PRICE_ID` (legado, R$39,90 → essencial), `STRIPE_PRICE_ESSENCIAL`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_PREMIUM` (`:51-54`). **[CONFIRMADO]** `web/CLAUDE.md` marca esses envs como "LOAD-BEARING": sem `STRIPE_PRICE_PRO`/`PREMIUM`, esses tiers **não resolvem** e o assinante cai em `essencial` → e `essencial` é 403 no Assistente. **Bloqueante de venda dos tiers Pro/Premium** se os envs não existirem em produção (verificação em `02-stripe-pagamento.md`).
- **[CONFIRMADO] ⚠️ Janela de `stripe_price_id` NULL:** o header do arquivo (`:9-14`) alerta que o price nasce NULL e só preenche no próximo evento. O webhook `handleCheckoutCompleted` **já grava** `stripe_price_id` no upsert (`webhooks/stripe/route.ts:145`), encurtando a janela — mas se um `customer.subscription.updated` chegar **antes** do `checkout.session.completed`, o `UPDATE … eq('stripe_subscription_id')` casa 0 linhas e o price não é setado (ver §4 e frente B). O fallback `→ essencial` segura o acesso de aluno (STUDENT_CAP), mas **não** dá acesso ao Assistente (Pro+).

---

## 3. Contabilização (metering) e o gate nos call-sites

### 3.1 Persistência atômica
`web/src/lib/ai-usage/metering.ts` — `recordAiUsage()` (`:141-199`) chama a RPC **`consume_ai_usage`** (migration `216_ai_usage_quota_clamp.sql`):
- **[CONFIRMADO]** `consume_ai_usage` faz upsert atômico com **CLAMP em `p_limit`** via `LEAST(credits_used + Δ, v_cap)` (`216:43-46`) — o medidor **nunca passa do teto do plano**, nem sob concorrência (corrige C1). `cost_usd_micros` segue **real** (reconciliação de margem, `216:47`). `p_limit` NULL = sem teto (ex.: briefing proativo). `revoke execute … from public/anon/authenticated` (`216:57-58`) — só service role.
- **[CONFIRMADO]** `bind(admin)` no `admin.rpc` (`metering.ts:153`) — corrige o 500 pós-ação do relatório noturno (`const consume = admin.rpc` perdia o `this`).
- Idempotência de ação sensível: migration `217_ai_idempotency.sql` + `ai_action_idempotency` (claim/finish/release), usada no `execute-tool` (`execute-tool/route.ts:151-204`).

### 3.2 Créditos do turno
`tool-policy.ts` — `computeTurnCredits()` (`:229-235`): soma dos pesos com **piso 1** e **TETO `MAX_TURN_CREDITS=12`** (`:222`). 2ª camada sobre o clamp do DB.
- **[CONFIRMADO]** Só cobra tool que deu certo: `command-engine.ts:674` filtra `executed.filter(e => toolResultOk(e.result))` antes de computar créditos (corrige C2 — "cobrar falha"). O mesmo predicado alimenta o trace (`:739-743`).

### 3.3 Gate nos call-sites (defense-in-depth — a UI também esconde)

| Call-site | Gate | Tier exigido | Evidência |
|---|---|---|---|
| Aba `/assistente` + ⌘K (`command-engine.runAssistantTurn`) | `gateAssistant` | **Pro+** (403 p/ free/essencial); 402 se cota esgotada | `command-engine.ts:113-139` |
| Canvas "Gerar com IA" (`/api/programs/ai-canvas`) | `gateAssistant` | **Pro+** | `programs/ai-canvas/route.ts:36-39` |
| `/api/assistant/command` (⌘K backend) | `gateAssistant` *(a confirmar na frente A)* | Pro+ | — |
| `/api/assistant/execute-tool` (confirma HITL) | re-auth + `limitSensitive` + `checkFreeTrial`(free) / `checkQuota`(pago) | qualquer (free via trial) | `execute-tool/route.ts:111-146` |
| **Dock legado `/api/assistant/chat`** | `getAiUsageSummary().exhausted` (free-trial OU balde) | **NÃO exige tier** — free entra | `chat/route.ts:104-120` |

- **[CONFIRMADO] ⚠️ Assimetria de gate (era S5/U-ENG):** o **dock** não exige Pro+ — um treinador **free** chega ao chat (3 tools: `generateProgram` grava rascunho, `analyzeStudentProgress`, `getStudentInsights`) e é barrado só por `ai_free_trials` (`chat/route.ts:106,206-211,290-295`). O **flagship** (aba/⌘K/canvas) é Pro+. Dois motores com política de gate divergente. Impacto de venda/UX (e o caminho mais descoberto abrir o motor *sem HITL*) detalhado em `04-onboarding-ativacao.md`.
- **⚠️ TOCTOU residual no gate (não no medidor):** `checkQuota` decide `allowed: used < quota.credits` (`quota.ts:101`) — **binário, cego ao custo do turno**. Com `used=299/300`, o gate passa e o turno pode custar até 12 créditos; o clamp do DB trava o **ledger** em 300, mas o **COGS de inferência** dos créditos "clampados" foi gasto (under-billing, não overshoot). Sob concorrência (rate-limit ~15/min), vários turnos passam o gate antes do reset → vazamento de COGS limitado. Quantificação em `01-travas-tokens.md`.

### 3.4 Medidor visível (contrato único)
`web/src/lib/ai-usage/usage-summary.ts` — `getAiUsageSummary()` (`:66-107`): shape estável `{tier, creditsUsed/Total/Remaining, periodStart/End, exhausted}` consumido por **todas** as superfícies (medidor, banner, gates, mobile). Pago = balde via `checkQuota`; free = nº de `action_class` já testadas (total simbólico = 4).

---

## 4. Stripe (entrada do dinheiro)

`web/src/app/api/webhooks/stripe/route.ts`:
- **[CONFIRMADO]** Verificação de assinatura (`constructEvent`, `:51`); falha → 400 (`:52-55`). Sem `STRIPE_WEBHOOK_SECRET` → 500 (`:42-46`).
- **[CONFIRMADO]** Idempotência **insert-first** na `webhook_events UNIQUE(event_id)` (`:69-81`): duplicata (retry do Stripe) cai em `23505` → skip; store doente (erro ≠ unique) → 500 p/ retry.
- **[CONFIRMADO]** Handler que falha **após** o registro → `delete` do `event_id` + **500** p/ re-entrega limpa (`:105-118`) — evita o "pular evento pra sempre" do incidente de abril/2026.
- **[CONFIRMADO]** Persiste `stripe_price_id` (1º item) e **NÃO** grava `trainers.ai_tier` (`:18-25,138-146`) — preserva a resolução por price.
- Eventos: `checkout.session.completed` → upsert `onConflict:'trainer_id'` (`:138-146`); `invoice.payment_succeeded` → update status/price (`:156-171`); `invoice.payment_failed` → `past_due` (`:173-180`); `subscription.updated` (`:182-191`); `subscription.deleted` → `canceled` (`:193-197`).
- **[CONFIRMADO] ⚠️ Out-of-order:** `handleSubscriptionUpdated`/`Deleted` fazem `UPDATE … eq('stripe_subscription_id')` (`:190,196`) — se a linha ainda não existe (checkout.completed não rodou), casa **0 linhas** e o estado se perde até o próximo evento. Blast radius e mitigação em `02-stripe-pagamento.md`.
- **[CONFIRMADO]** Incidente documentado (`web/CLAUDE.md`): o webhook **tem** que apontar para `https://www.kinevoapp.com/...` (o apex 307-redireciona e o Stripe não segue) e o guard de acesso checa **status**, não `current_period_end`. Verificar config do dashboard Stripe (runtime) em `02`.

**Trainer ↔ assinatura** (monetização): o checkout que seta `session.metadata.trainer_id` é o que importa; **se hoje só existe 1 price**, os tiers `pro_ia`/`premium_ia` são **invendáveis** na prática → frente B confirma. O fluxo **student → trainer** (Stripe Connect, `kinevo_generate_checkout_link` → `api/financial/checkout-link`) é adjacente e está em HITL (`CONFIRM_TOOLS`, `tool-policy.ts:136`).

---

## 5. Espelho mobile + travas adjacentes

- **Espelho mobile:** `web/src/app/api/trainer/ai-status/route.ts` (`:30-77`) — JWT Bearer → `getAiUsageSummary` + `STUDENT_CAP` → `{tier, credits…, studentsLocked}`. **[CONFIRMADO]** É só UX; o gate real é revalidado no backend (`assertCanCreateStudent`). Mobile não chama LLM (cliente das rotas web).
- **Student cap:** `web/src/lib/limits/student-cap.ts` — `STUDENT_CAP` free=1, pagos=∞ (`:17-22`); `assertCanCreateStudent` (`:47-70`) conta `students` por `coach_id` e lança `StudentCapError` no 2º (free). `assertCanDowngradeToFree` (`:86-106`) recusa downgrade com aluno real. **⚠️** Em erro de contagem, **falha-aberto** (loga e segue, `:60-65`) — gate de produto, não de segurança; aceitável, mas registrar.

---

## 6. Pendências conhecidas que tocam o dinheiro (status atual)

| Item (origem) | Status atual [CONFIRMADO/HIPÓTESE] | Impacto na venda |
|---|---|---|
| Rotacionar `ANTHROPIC_API_KEY` (relatório noturno) | **Superada** — build padrão é Gemini 3.5 Flash (`command-engine.ts:71`) | Baixa. A chave load-bearing agora é `GOOGLE_GENERATIVE_AI_API_KEY` — **[HIPÓTESE]** confirmar que está setada em prod, senão o build cai p/ mini (qualidade menor, sem quebrar) |
| Streaming de texto (relatório noturno) | Ainda usa `generateText` no flagship (`command-engine.ts:532`); dock usa `streamText` (`chat/route.ts:182`) | UX (silêncio), não bloqueante de venda |
| LGPD: DPA/ZDR + dado de saúde p/ LLM (custos doc, portão-0) | **[HIPÓTESE]** nenhuma config no repo; depende do console dos provedores | **Bloqueante regulatório** — ver `05` |
| `essencial` paga mas é 403 no Assistente (C8) | **[CONFIRMADO]** persiste (`command-engine.ts:118`) | Médio/Alto — risco de promessa falsa, ver `03`/`04` |
| Topups (`ai_credit_topups`) plugado? | **[HIPÓTESE]** — frente A confirma se é tabela órfã | Alto se a landing prometer compra de créditos |

---

## 7. Diagrama de pontos de falha (resumo)

| # | Ponto de falha | Onde | Severidade prelim. |
|---|---|---|---|
| F1 | `essencial` paga, sem acesso ao Assistente | `command-engine.ts:118` | Alto (promessa falsa) |
| F2 | Sem `STRIPE_PRICE_PRO/PREMIUM` → tiers não resolvem / 1 price só → invendável | env + checkout | **Bloqueante** (a confirmar B) |
| F3 | Gate `checkQuota` cego ao custo (TOCTOU) → COGS vaza além da cota | `quota.ts:101` | Médio |
| F4 | Webhook out-of-order → tier não setado | `stripe/route.ts:190,196` | Médio |
| F5 | `GOOGLE_GENERATIVE_AI_API_KEY` ausente → build rebaixa p/ mini | `command-engine.ts:76` | Médio (qualidade) |
| F6 | LGPD: dado de saúde → LLM sem DPA/ZDR comprovado | provedores (fora do repo) | **Bloqueante** regulatório |
| F7 | Dock free sem HITL nem tier-gate | `chat/route.ts:104` | Médio (confiança/UX) |

> Severidades finais e os achados completos por frente nos relatórios `01`–`05` e no `RESUMO-EXECUTIVO.md`.
