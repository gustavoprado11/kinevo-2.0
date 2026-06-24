# 02 — Fluxo de Pagamento Stripe (onde o dinheiro entra)

> Frente B da auditoria de prontidão de venda. READ-ONLY. Foco: assinatura do **treinador ao Kinevo** (caminho de monetização) → price → tier de IA.
> Cada afirmação tem `arquivo:linha` e está marcada **[confirmado por leitura]** ou **[hipótese — verificar em Stripe-test/runtime]**.
> Data da auditoria: 2026-06-23. Projeto Supabase: `lylksbtgrihzepbteest` (Kinevo 2.0).

---

## TL;DR — GO/NO-GO

**NO-GO para vender Pro IA / Premium IA hoje.** Um treinador **não consegue comprar** Pro nem Premium pelo fluxo real:

1. Landing pública e signup só vendem **um price** (o legado R$ 39,90 → `essencial`).
2. A única tela que oferece os 3 tiers (`AiPlanSection`, em /settings) depende de `STRIPE_PRICE_PRO` / `STRIPE_PRICE_PREMIUM` existirem — **ausentes no `.env.local`** e a verificar na Vercel.
3. A derivação price→tier só conhece esses tiers se os envs estiverem setados; sem eles, qualquer price ativo cai no fallback `essencial`.
4. **Runtime confirma:** 0 treinadores em `pro_ia`/`premium_ia` via Stripe. O único `premium_ia` da base é **override manual** de `trainers.ai_tier`, não um pagamento. 13 de 14 assinaturas têm `stripe_price_id` **NULL**.

O caminho **essencial** funciona (signup → trial 7 dias → R$ 39,90). O caminho **Pro/Premium** — que é onde mora o produto-âncora (Assistente IA ⌘K) — está quebrado de ponta a ponta.

---

## Tabela de achados

| # | Sev | Arquivo:linha | Evidência | Impacto | Fix (descrito) | Status |
|---|-----|---------------|-----------|---------|----------------|--------|
| 1 | **Crítico** | `landing-pricing.tsx:76-123`, `signup/page.tsx:144-147`, `checkout/route.ts:68-70` | Landing anuncia "Plano único — tudo incluso" R$ 39,90; CTA → `/signup`; signup faz `POST /api/stripe/checkout` **sem body** → cai no `else` → `STRIPE_PRICE_ID` (essencial). Não há seleção de Pro/Premium em nenhum funil de aquisição. | Pro/Premium são **inalcançáveis** para um cliente novo. Ticket médio travado em R$ 39,90; upsell impossível na entrada. | Expor os 3 tiers na landing/signup (passar `{tier}` ao checkout) **ou** redirecionar pós-trial para `AiPlanSection`. Decidir estratégia de aquisição (trial → essencial e upsell depois, vs. escolha no signup). | [confirmado por leitura] |
| 2 | **Crítico** | `get-ai-tier.ts:51-54`, `checkout/route.ts:61-67`, `.env.local` (só `STRIPE_PRICE_ID`) | `STRIPE_PRICE_ESSENCIAL`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_PREMIUM` **ausentes no `.env.local`**. Sem `STRIPE_PRICE_PRO`/`PREMIUM`: (a) `priceIdForTier('pro_ia')` → null → checkout `500 "Price não configurado para o tier pro_ia"`; (b) o mapa price→tier não reconhece o price → fallback `essencial`. | Mesmo com a UI de tiers, clicar "Assinar Pro IA" → erro 500. E se o price existir mas o env não, o pagante cai em essencial. | Criar os 3 recurring prices no Stripe **live**, setar `STRIPE_PRICE_PRO`/`STRIPE_PRICE_PREMIUM`/`STRIPE_PRICE_ESSENCIAL` na Vercel (Production), redeploy. | [confirmado por leitura] (local) / [hipótese — verificar Vercel prod] |
| 3 | **Alto** | `command-engine.ts:100,113-126` | `gateAssistant` exige `PRO_TIERS = {pro_ia, premium_ia}`; tier abaixo → `403 tier_locked`. | O Assistente IA (⌘K, voz, briefing) — feature que justifica Pro/Premium — está **bloqueado para 100% dos pagantes reais** (todos resolvem essencial). Só o 1 override manual usa. Vende-se IA que o comprador não acessa. | Sai de graça assim que #1+#2 forem resolvidos (cliente consegue chegar em pro/premium). Sem isso, o gate está correto mas o produto é vendido e não entregue. | [confirmado por leitura] + runtime |
| 4 | **Alto** | `sync/route.ts:84-91` | O fallback `/api/stripe/sync` faz `upsert` **sem `stripe_price_id`**. É chamado por `checkout-polling.tsx:37-45` (fase 2) quando o webhook não disparou. | Cliente que pagou Pro mas cujo webhook falhou tem a row criada **sem price** → resolve `essencial` (20 créditos em vez de 300). Auto-cura só no próximo evento de webhook que grave price; se nenhum vier, fica preso. | Incluir `stripe_price_id: activeSub.items?.data?.[0]?.price?.id` no upsert do sync (espelhar o webhook). | [confirmado por leitura] |
| 5 | **Alto** | runtime (`subscriptions`), `get-ai-tier.ts:98` | **13/14** assinaturas com `stripe_price_id` NULL — incluindo **11 de 12** active/trialing. A única não-nula = o price legado (= `STRIPE_PRICE_ID`, mapeia `essencial`). | A "janela price-NULL" do header de `get-ai-tier` **não é transitória** — é o estado da base. A derivação por price **não opera** na prática; tudo depende do fallback `active→essencial`. Pro/Premium nunca seriam entregues mesmo se vendidos. | Backfill de `stripe_price_id` rodando um sync que leia o item da subscription no Stripe (corrigido o #4). Depois, monitorar % de rows com price não-nulo. | [confirmado — runtime] |
| 6 | **Médio** | `route.ts:182-191,173-180`, `route.ts:138-146` | `handleSubscriptionUpdated`/`PaymentFailed` filtram por `stripe_subscription_id`. Se chegam **antes** do `checkout.session.completed` criar a row, casam **0 linhas** (no-op, 200). A row só nasce em `handleCheckoutCompleted` (upsert por `trainer_id`) ou no `/api/stripe/sync`. | Se `checkout.session.completed` for perdido em definitivo (cenário do incidente abr/2026), o pagante fica **sem row** → resolve `free` → bloqueado de adicionar alunos. Remediação é manual (`scripts/sync-stale-subscriptions.ts`). | Tornar `subscription.updated` capaz de **criar** a row (upsert por `stripe_subscription_id` buscando `trainer_id` via metadata/customer), não só atualizar. | [confirmado por leitura] |
| 7 | **Médio** | `get-trainer.ts:98`, `blocked/page.tsx:38-47`, `get-ai-tier.ts:29,93` | Acesso/tier dependem só de `status ∈ {active,trialing}` — **não** de `current_period_end`. `past_due` → fora de ACTIVE → tier `free` + `studentsLocked` se tiver alunos. `trialing` "stale" passa o gate indefinidamente. | Dunning agressivo: 1 falha de cobrança → `past_due` → derruba para `free` na hora (sem grace). E `trialing` preso (bug de webhook) dá acesso eterno de graça. | Adicionar grace em `past_due` (manter tier por X dias via `current_period_end`) e/ou um cron que reconcilie status com o Stripe. | [confirmado por leitura] |
| 8 | **Baixo** | `blocked-client.tsx:49-54` | `BlockedClient` (estados `no_subscription`/`canceled`) faz `POST /api/stripe/checkout` **sem body** → sempre essencial. `past_due` → portal (correto). | Reativação/assinatura pela tela de bloqueio nunca oferece Pro/Premium. | Passar `{tier}` ou linkar para `AiPlanSection`. | [confirmado por leitura] |
| 9 | **Baixo** | `generate-checkout.ts:64,93,99`, webhook secrets distintos | Checkout do Connect (cobrança aluno→treinador) também seta `metadata.trainer_id`. Vai para `api/webhooks/stripe-connect` (secret `STRIPE_CONNECT_WEBHOOK_SECRET`), separado do webhook de assinatura. | Sem cross-contamination **desde que** o Dashboard roteie os eventos do Connect só ao endpoint do Connect. Eventos com secret trocado falham na verificação de assinatura. | Verificar no Dashboard que os 2 endpoints existem com os secrets certos e que o de assinatura **não** está em modo Connect (`Listen to events on Connected accounts`). | [confirmado por leitura] / [hipótese — verificar Dashboard] |

---

## Respostas às 6 perguntas

### 1. Checkout → subscription → tier (trace completo)

**O motor de checkout suporta os 3 tiers; o funil de aquisição não.**

- Rota: `web/src/app/api/stripe/checkout/route.ts`. Resolve o price assim (`checkout/route.ts:35-70`):
  - `body.priceId` válido (mapeado e tier pago) → usa esse price (linhas 36-41);
  - senão `body.tier` ∈ {essencial,pro_ia,premium_ia} → `priceIdForTier(tier)` (linhas 42-67); se o env do tier não existir → **500** (linhas 62-66);
  - senão (sem body) → `process.env.STRIPE_PRICE_ID` (linhas 68-70) = essencial.
- Cria checkout `mode: 'subscription'`, `trial_period_days: 7`, `subscription_data.metadata.trainer_id` e `metadata.trainer_id` (`checkout/route.ts:97-121`). É **esse** `trainer_id` que o webhook lê (`route.ts:124`).
- **Quem chama com tier?** Só `AiPlanSection` (settings) envia `{tier}` para os 3 pagos (`ai-plan-section.tsx:149-157`), montada em `settings/page.tsx:256`. 
- **Quem chama sem tier (→ essencial)?** `signup/page.tsx:147` (aquisição), `blocked-client.tsx:54` (reativação). Mobile só usa `portal`/`cancel-subscription`, não passa tier.
- Landing (`landing-pricing.tsx:118-123`) só tem CTA "Comece grátis agora" → `/signup`. Anuncia **um** plano (R$ 39,90).

**Conclusão:** há 3 tiers no código, mas o único caminho que um cliente percorre naturalmente (landing→signup) produz **sempre essencial**. Pro/Premium só via /settings, e só se os envs existirem (ver #2). **[confirmado por leitura]**

### 2. Envs de price — o que é obrigatório

Grep de `process.env.STRIPE_PRICE` (todos os usos):
- `get-ai-tier.ts:51` `STRIPE_PRICE_ID` → essencial (legado)
- `get-ai-tier.ts:52` `STRIPE_PRICE_ESSENCIAL` → essencial
- `get-ai-tier.ts:53` `STRIPE_PRICE_PRO` → pro_ia
- `get-ai-tier.ts:54` `STRIPE_PRICE_PREMIUM` → premium_ia
- `get-ai-tier.ts:68` `STRIPE_PRICE_ESSENCIAL ?? STRIPE_PRICE_ID` (priceIdForTier)
- `get-ai-tier.ts:70` `STRIPE_PRICE_PRO`; `:72` `STRIPE_PRICE_PREMIUM`
- `checkout/route.ts:69` `STRIPE_PRICE_ID` (default sem body)

**Checklist para a Vercel (Production) — verificar (não consigo ler env prod):**
- [ ] `STRIPE_PRICE_ID` — **provável presente** (a única subscription com price aponta para ele; signup essencial funciona).
- [ ] `STRIPE_PRICE_ESSENCIAL` — opcional (cai em `STRIPE_PRICE_ID`).
- [ ] `STRIPE_PRICE_PRO` — **bloqueador se ausente**: checkout Pro retorna 500 e nenhum price resolve `pro_ia`.
- [ ] `STRIPE_PRICE_PREMIUM` — **bloqueador se ausente**: idem `premium_ia`.
- [ ] Cada env deve apontar para um **recurring price em modo LIVE** que exista no Stripe (não basta a string existir).

`.env.local` (dev) tem **só `STRIPE_PRICE_ID`** — forte indício de que Pro/Premium nunca foram configurados. **[confirmado por leitura local / hipótese — verificar Vercel]**

### 3. Estados da assinatura → tier/acesso

`ACTIVE_STATUSES = {active, trialing}` (`get-ai-tier.ts:29`). Resolução em `getAiTier` (`:81-99`) e guard em `get-trainer.ts:98`.

| Status Stripe | Onde é setado | Tier resultante | Acesso |
|---|---|---|---|
| `active` | webhook checkout/invoice/updated | price→tier, ou `essencial` se price NULL/desconhecido (`:98`) | Total. |
| `trialing` | checkout (`trial_period_days:7`) | idem active | Total. **Risco:** trialing "stale" (bug de webhook abr/2026) passa o gate para sempre. |
| `past_due` | `handlePaymentFailed` (`route.ts:178`) | **`free`** (fora de ACTIVE) | Entra **limitado**; `studentsLocked=true` se tiver >0 alunos (`get-trainer.ts:104-109`). |
| `canceled` | `handleSubscriptionDeleted` (`route.ts:195`) | `free` | Limitado + studentsLocked. Dados preservados. |
| `incomplete`/`incomplete_expired`/`unpaid` | não tratados explicitamente | `free` (qualquer status ≠ active/trialing) | Limitado. |

**Dunning:** assim que `invoice.payment_failed` chega, status vira `past_due` → tier `free` **imediatamente, sem grace**. O hard-block antigo não existe mais (Free o substituiu — `blocked/page.tsx:6-16`); o ex-pagante entra read-only. **[confirmado por leitura]**

### 4. Upgrade/downgrade

- **Tier muda no read-time** (`getAiTier` lê `subscriptions.stripe_price_id` a cada request). Logo, trocar de price no portal **deveria** mudar o tier assim que `customer.subscription.updated` gravar o novo `stripe_price_id` (`route.ts:188`). **MAS** na prática o price quase nunca é gravado (achado #5) e Pro/Premium não estão no mapa (#2), então o upgrade essencial→pro **não refletiria** hoje. **[confirmado por leitura + runtime]**
- **Cota segue o tier** automaticamente: `getAiUsageSummary`→`getAiTierForTrainer`→`checkQuota` (`usage-summary.ts:71-75`, `quota.ts:23-28`: 20/300/1000). Sem trabalho extra. **[confirmado por leitura]**
- **Proração:** o checkout não força `proration_behavior`; mudanças de plano passam pelo **Billing Portal** do Stripe (`portal/route.ts:48-51`), que usa a proração default do Stripe. Não há controle de proração no código. **[confirmado por leitura]**
- **Downgrade para Free:** `checkout/route.ts:43-57` chama `assertCanDowngradeToFree` (`student-cap.ts:86-106`) e **bloqueia** se o treinador tem >1 aluno. **Porém** o Billing Portal do Stripe pode cancelar a assinatura direto (fora desse guard) → `subscription.deleted` → `canceled` → `free` → `studentsLocked` (não apaga alunos, vira read-only). O guard só protege o caminho via app. **[confirmado por leitura]**

### 5. Segurança/robustez do webhook

- **Assinatura:** `constructEvent` verifica (`route.ts:51`); sem header → 400 (`:38-39`); sem secret → 500 (`:43-45`). **[confirmado por leitura + teste `route.test.ts:84-109`]**
- **Idempotência:** insert-first em `webhook_events UNIQUE(event_id)` (`route.ts:69-81`); duplicata (`23505`) → 200 sem reprocessar; erro de store → 500 para retry. **[confirmado + teste `:112-148`]**
- **Falha de handler:** deleta a row de idempotência e retorna 500 → Stripe re-entrega limpo (`route.ts:105-118`). **[confirmado + teste `:198-218`]**
- **Out-of-order (gap real):** `subscription.updated`/`payment_failed`/`payment_succeeded` atualizam **por `stripe_subscription_id`**; se a row ainda não existe (checkout não processado), casam **0 linhas** e viram no-op silencioso (200). A row só é **criada** por `checkout.session.completed` (upsert por `trainer_id`, `route.ts:138-146`) ou pelo `/api/stripe/sync`. Se `checkout.session.completed` for perdido em definitivo → pagante sem row → tier `free`. **Blast radius:** o do incidente abr/2026 (precisou de sync manual). **[confirmado por leitura]**
- **Janela price-NULL:** o header de `get-ai-tier.ts:9-14` descreve como transitória, mas o **runtime mostra que é permanente**: 13/14 rows com price NULL. O fallback `active→essencial` (`:98`) mascara — por isso ninguém percebeu — mas significa que **a derivação por price não está entregando Pro/Premium a ninguém**. Provável causa: recuperação pós-abr/2026 via `sync-stale-subscriptions.ts` + `/api/stripe/sync` (ambos sem gravar price — achado #4). **[confirmado — runtime]**

### 6. Roteiro Stripe-test — ver seção dedicada abaixo.

---

## Evidência de runtime (SELECTs read-only — 2026-06-23)

```
subscriptions por status:   active=8 (7 NULL price), trialing=4 (4 NULL), canceled=2 (2 NULL)
subscriptions por price:     NULL=13,  price_1SzFqDPHNGbdOejbSURQRAaZ=1  (== STRIPE_PRICE_ID = essencial)
trainers por ai_tier:        free=24,  premium_ia=1  (override MANUAL — não é pagamento Stripe)
active/trialing period_end:  todos no futuro (jun–jul/2026); nenhum expirado  → webhook saudável pós-correção abr/2026
```

Leitura: **nenhum** treinador está em `pro_ia`/`premium_ia` por pagamento. O único `premium_ia` é override de `ai_tier`. A derivação price→tier resolve, na prática, **só essencial**. **[confirmado — runtime]**

---

## Roteiro de teste em Stripe TEST-MODE (para o Gustavo rodar de manhã)

> Objetivo: validar o que a análise estática não fecha — se Pro/Premium **realmente** resultam no tier certo end-to-end, e se o webhook grava `stripe_price_id`.
> Pré-requisitos: Stripe em **test mode**, webhook test apontando para `https://www.kinevoapp.com/api/webhooks/stripe` (com **www** — incidente abr/2026), envs de price test no ambiente alvo. Use cartões de teste do Stripe.

**Setup (verificar antes):**
1. No Stripe (test): existem 3 recurring prices (essencial R$39,90 / pro R$79,90 / premium R$129,90)? Anote os `price_…`.
2. No ambiente: `STRIPE_PRICE_ID`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_PREMIUM` setados e iguais aos de cima? **(Este é o teste #2 — provável ponto de falha.)**

**Cenário A — Essencial via signup (caminho de aquisição):**
1. `/signup` com email novo → cartão `4242 4242 4242 4242`.
2. Esperado: redirect `/dashboard?checkout=success`; `checkout-polling` acha a row em ~2-16s.
3. DB esperado: `subscriptions` 1 row, `status='trialing'`, `stripe_price_id = STRIPE_PRICE_ID`, `current_period_end ≈ now+7d`.
4. Tier esperado: `essencial` (settings mostra "Plano atual = Essencial", 20 créditos).
5. **Confirmar se `stripe_price_id` ficou não-nulo** (se vier NULL, o achado #5 reproduz no fluxo novo).

**Cenário B — Pro IA via settings (o caminho de monetização que suspeitamos quebrado):**
1. Logado, /settings → `AiPlanSection` → "Assinar Pro IA".
2. Resultado **esperado se env ausente:** erro na UI ("Price não configurado para o tier pro_ia") — **confirma o bloqueador #2**.
3. Resultado **esperado se env presente:** checkout abre com R$ 79,90 → pagar.
4. DB esperado: `stripe_price_id = STRIPE_PRICE_PRO`. Tier esperado: `pro_ia`. ⌘K (`gateAssistant`) deve **liberar** (300 créditos).

**Cenário C — Premium IA via settings:** idem B com Premium → `premium_ia`, 1000 créditos.

**Cenário D — Falha de pagamento / dunning:**
1. Assine com cartão `4000 0000 0000 0341` (anexa mas falha na cobrança) ou force `invoice.payment_failed` via Stripe CLI.
2. DB esperado: `status='past_due'`. Tier esperado: cai para `free`; se houver >0 alunos → `studentsLocked`. Tela /subscription/blocked oferece "Atualizar pagamento" (portal).

**Cenário E — Webhook perdido + fallback sync:**
1. Desative temporariamente o endpoint de webhook test. Faça um checkout.
2. Esperado: `checkout-polling` fase 1 falha (16s) → fase 2 chama `/api/stripe/sync` → cria a row.
3. **Confirmar:** a row criada pelo sync tem `stripe_price_id` **NULL** (reproduz achado #4). Se o cliente pagou Pro, o tier vira `essencial` — bug.

**Cenário F — Out-of-order:** via Stripe CLI, dispare `customer.subscription.updated` para um `sub_id` que ainda não tem row. Esperado: 200, **0 linhas** afetadas, nenhuma row criada (reproduz achado #6).

**Cenário G — Upgrade/downgrade:** no Billing Portal (test), troque Essencial→Pro. Confirme `subscription.updated` grava o novo price e o tier/quota mudam no próximo load. Teste cancelar pelo portal (bypassa `assertCanDowngradeToFree`) → `canceled` → `free`.

**Confirmado por leitura (não precisa de Stripe):** verificação de assinatura, idempotência, release-on-failure, mapa price→tier, gates de tier/quota, student-cap, escolha de price no checkout.
**Só confirmável pagando em test:** se os envs Pro/Premium existem e apontam para prices válidos (B/C), se o webhook grava price end-to-end (A/E), comportamento real de dunning/proração (D/G).

---

## O que falta para vender o fluxo Stripe? (punch-list)

**Bloqueadores (resolver antes de vender Pro/Premium):**
1. **Criar os 3 recurring prices no Stripe LIVE** e setar `STRIPE_PRICE_PRO`/`STRIPE_PRICE_PREMIUM`/`STRIPE_PRICE_ESSENCIAL` na Vercel (Production) + redeploy. Sem isso, Pro/Premium retornam 500 e nunca resolvem (#2). **[verificar Vercel]**
2. **Expor a escolha de tier no funil de aquisição** (landing/signup) ou um upsell pós-trial — hoje só /settings vende Pro/Premium, e a entrada força essencial (#1).
3. **Gravar `stripe_price_id` no `/api/stripe/sync`** (e no script de recuperação) — senão pagantes Pro/Premium caem em essencial sempre que o fallback roda (#4), e o backfill da base (13/14 NULL hoje) não acontece (#5).

**Alto (vender com risco controlado):**
4. Reconciliação: tornar `subscription.updated` capaz de **criar** a row (não só atualizar) para fechar o gap out-of-order/webhook-perdido (#6); ou um cron diário que reconcilie com o Stripe.
5. Backfill único de `stripe_price_id` em todas as assinaturas ativas (corrige #5 e destrava o upgrade real essencial→pro).

**Médio:**
6. Grace em `past_due` antes de derrubar para `free` (dunning hoje é instantâneo, #7).
7. Garantir no Dashboard que o webhook de **assinatura** e o de **Connect** estão separados com secrets corretos (#9).

**Baixo:**
8. `BlockedClient` e mobile passarem `{tier}` ao reativar, para não forçar essencial (#8).

**O que JÁ está pronto e correto:** verificação de assinatura, idempotência insert-first, release-on-failure-com-500, fallback sync por polling, derivação de tier no read-time, student-cap, gates de quota, guard de acesso por status (com a ressalva de não checar period_end).
