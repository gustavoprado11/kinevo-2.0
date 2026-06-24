# Frente A — Travas de plano e tokens (o coração do dinheiro)

Auditoria de prontidão de venda do **Assistente de IA pago**. READ-ONLY. Toda
afirmação tem `arquivo:linha`. Cada achado marcado **[LIDO]** (confirmado por
leitura do código) ou **[RUNTIME]** (hipótese a verificar em execução).

Data: 2026-06-23 · Branch: `main` · Projeto Supabase: `lylksbtgrihzepbteest` (Kinevo 2.0)

---

## 0. Estado de produção (grounding — SELECTs read-only)

| Métrica | Valor | Implicação |
|---|---|---|
| `trainers.ai_tier` | 24 `free`, 1 `premium_ia` | Tiers pagos hoje vêm do **price do Stripe**, não de override. Só 1 conta dogfooding tem o Assistente de verdade. |
| `subscriptions.status` | 8 `active`, 4 `trialing`, 2 `canceled` | 12 pagantes ativos — todos dependem do price-map p/ resolver o tier. |
| `ai_prescriptions_enabled` | 2 `true`, 23 `false` | Motor de prescrição (F2/F3/F4) ligado só p/ 2 contas. |
| `ai_usage_periods` | **1 linha** | Metering de crédito praticamente **não exercitado** em prod. |
| `ai_free_trials` | **0 linhas** | A mecânica "1× cada ação" **nunca disparou** em produção. |
| `ai_credit_topups` | **0 linhas** | Tabela órfã e vazia. |

> **Leitura macro:** o sistema de cota/crédito/free-trial está em estado
> **pré-lançamento e não-testado em runtime**. Tudo abaixo marcado [LIDO] é
> verdade do código; o comportamento sob carga real é [RUNTIME].

---

## 1. Tabela de achados

| # | Sev. | arquivo:linha | Evidência | Impacto (receita/exp.) | Fix sugerido (descrito) | Conf. |
|---|---|---|---|---|---|---|
| A1 | **Crítico** | `command-engine.ts:100,118` + `get-ai-tier.ts:51` | `PRO_TIERS = {pro_ia, premium_ia}` — **essencial fora**. O price único atual (`STRIPE_PRICE_ID`, R$39,90) mapeia p/ `essencial`. | Pagante de R$39,90 = essencial → `gateAssistant` devolve **403 "disponível nos planos Pro e Premium"** em ⌘K/workspace/voz/canvas. A landing (`landing-pricing.tsx:13,26`) vende "Assistente IA" **incluído** a R$39,90. Cliente paga, vê o recurso anunciado, clica e leva 403. | Decidir o pacote: **(a)** incluir `essencial` em `PRO_TIERS` (essencial já tem 20 créditos), ou **(b)** reescrever a landing p/ separar tiers e NÃO prometer Assistente no plano base. Reconciliar `get-ai-tier` ↔ landing ↔ `PRO_TIERS` antes de vender. | [LIDO] |
| A2 | **Crítico** | `draft-message/route.ts:34-105`, `winback-draft/route.ts:34-125` | Chamam `callLLM` (gpt-4.1-mini) com **só auth + rate-limit**. SEM `gateAssistant`, SEM `checkQuota`, SEM `checkFreeTrial`. Uso logado em `assistant_llm_usage` (migr 207) — tabela **separada**, fora de `ai_usage_periods`. | Qualquer treinador autenticado (inclusive **free** e **Pro com cota esgotada**) gera rascunhos de IA até **100/dia cada** sem gastar 1 crédito. LLM pago entregue de graça + sem teto por tier. Feature de "IA" vaza para fora do produto pago. | Envolver ambos no mesmo gate das demais superfícies: `gateAssistant`/`getAiUsageSummary.exhausted` + `recordAiUsage` no balde do período (ou free-trial no free). Manter o rate-limit como 2ª camada. | [LIDO] |
| A3 | **Alto** | `quota.ts:101` + `rate-limits.ts:20` + `216_…sql:39-46` | Gate `allowed: used < quota.credits` é **cost-UNAWARE/TOCTOU**. O clamp (216) tampa só o **LEDGER**; o COGS já foi pago. `TURN_LIMIT=15/min`. | Na fronteira `used=limit-1`, até **15 turnos concorrentes** passam o gate (cada lê `used<limit`), todos rodam build (~$0,055–0,15 cada) → ~**$1–2,25 de COGS** por período/treinador cujo "valor" o ledger descarta. Bounded, 1×/período, mas real. | Gate **cost-aware**: bloquear se `used + custo_estimado_do_turno (≈MAX_TURN_CREDITS) > limit`, e/ou reservar crédito otimista antes do turno (debitar real no fim). Reduz a janela TOCTOU a ~0. | [LIDO] |
| A4 | **Alto** | `ai-canvas/route.ts:83` + `tool-policy.ts:195` | Canvas cobra **fixo** `CANVAS_BUILD_CREDITS=3` por build renderizado. O turno roda Gemini 3.5 Flash com **até 16 passos** e `maxOutputTokens:8000` (`run-canvas-turn.ts:218,222`) + N `search_exercises`. | Build do canvas custa **provavelmente MAIS** que o build do MCP (que pesa **6**, `tool-policy.ts:180`) mas é cobrado **metade**. Saída de 8000 tok no Gemini ($9/Mtok out) ≈ $0,072 só de output + reinjeção de contexto por passo → COGS ~$0,08–0,15. Vs 3 créditos de receita → **margem fina a negativa** dependendo do preço do crédito. | Cobrar o canvas pela mesma régua do build MCP (peso 6) OU medir o custo real (tem `turn.usage`) e converter custo→créditos com piso. Aplicar `MAX_TURN_CREDITS` também aqui. | [LIDO] |
| A5 | **Médio** | `generate-insights/route.ts:109` → `insight-enricher.ts:53,133` | `enrichInsightsWithLLM` roda no cron p/ **TODOS os treinadores** com insights, **sem checar tier** e **sem metering** (custo só vai p/ `console.log`, `insight-enricher.ts:159`). | Treinador **free** ganha insights reescritos por LLM (gpt-4.1-mini) **todo dia**, de graça e sem teto. COGS diário fixo proporcional à base, fora de qualquer balde. Feature "IA" vazando p/ free. | Gatear o enricher por tier (Pro+) ou por `ai_assistant` habilitado, como o `morning-briefing` já faz (`morning-briefing/route.ts:86-90`). Ou aceitar como custo de produto e documentar — mas então a landing não pode tratar insights-IA como diferencial pago. | [LIDO] |
| A6 | **Médio** | `proactive.ts:46-53` (via `morning-briefing`) | `generateBriefing` chama `runAssistantTurn` **sem `tier`** → `creditLimit=null` → **clamp desligado** (`command-engine.ts:723`). | O briefing diário **debita crédito mas NÃO respeita o teto** do plano: pode empurrar `credits_used` acima do limite (o clamp é a trava). 1×/dia, pequeno, mas fura a invariante "ledger nunca passa do teto". | Passar o `tier` (já resolvido no cron, `morning-briefing/route.ts:86`) para `generateBriefing`/`runAssistantTurn` p/ ligar o clamp. | [LIDO] |
| A7 | **Médio** | `prescription/generate/route.ts:77`, `analyze/route.ts:61` | Motor de prescrição (Sonnet, caro) gated só por `ai_prescriptions_enabled` (flag) + rate-limit 5/min,20/day. SEM tier, SEM crédito. | Quem tem a flag ligada (hoje 2 contas) gera **até 20 prescrições/dia** com o LLM caro, **sem consumir crédito** e sem relação com o plano pago. Canal de COGS paralelo ao balde. **Mitigado** porque default da flag = `false` (`036_…sql:16`). | Se a prescrição for vendida dentro do mesmo pacote de IA, debitar crédito (já existe `GENERATE_PROGRAM=5`). Senão, manter, mas tratar como linha de custo separada e cap explícito por tier. | [LIDO] |
| A8 | **Médio** | `rate-limit.ts:25-29,39-42` | `consumeRateLimit` é **fail-OPEN**: erro/exceção no RPC → `{allowed:true}`. | Sob hiccup do DB, **todos** os rate-limits caem juntos (turno, sensível, draft, prescrição). Combinado com A3 (gate cost-unaware), some a única trava de concorrência → COGS sem teto durante o incidente. | Para os caminhos que gastam LLM, considerar **fail-CLOSED** (ou um teto local de emergência) quando o RPC falha; logar e alertar. Trade-off com disponibilidade — decisão de produto. | [LIDO] |
| A9 | **Baixo** | `voice/route.ts:84-92` | Transcrição (Whisper/OpenAI) roda no servidor; o custo dela **nunca entra** em `costMicros` (só o turno de texto é medido em `command-engine.ts:680`). | COGS de STT não contabilizado na margem. Gated Pro+ e rate-limited, então bounded. Subestima o custo real do turno de voz na reconciliação. | Somar o custo da transcrição ao `costMicros` do turno (ou logar à parte em `ai_usage_events`). | [LIDO] |
| A10 | **Baixo** | `get-ai-tier.ts:45-56` (env) + `web/CLAUDE.md` ("LOAD-BEARING") | Sem `STRIPE_PRICE_PRO`/`STRIPE_PRICE_PREMIUM` no env, todo price desconhecido de pagante ativo → `essencial` (`get-ai-tier.ts:98`) → 403 no Assistente (A1). | Se os price IDs Pro/Premium não estiverem setados em prod, **nenhum** comprador de Pro/Premium acessa o que pagou. | Validar presença de `STRIPE_PRICE_*` em prod antes do lançamento (smoke test do `buildPriceTierMap`). Adicionar health-check. | [RUNTIME] |
| A11 | **Baixo** | `chat/route.ts:104-120` vs `command-engine.ts:118` | **Gating inconsistente por superfície**: o dock legado (`/api/assistant/chat`) gateia só em `usage.exhausted` (essencial e free passam); ⌘K/workspace/voz/canvas exigem Pro+. | Essencial usa o chat dock (20 créditos) mas leva 403 nas superfícies novas; free entra no dock via free-trial. Experiência incoerente — o mesmo "Assistente" responde num lugar e bloqueia no outro. | Unificar a política de acesso por tier num único helper e aplicar em TODAS as superfícies (incluindo A2/A5). | [LIDO] |

---

## 2. Respostas às 7 perguntas

### Q1 — Cobertura do gate / vazamento de custo

Inventário **completo** dos call-sites que tocam um LLM e seu gate:

| Call-site | LLM | Gate de tier | Gate de cota/free-trial | Metering no balde |
|---|---|---|---|---|
| `assistant/command/route.ts:91` (⌘K) | gpt-4.1-mini / Gemini build | **`gateAssistant` Pro+** ✓ | ✓ (no gate) | ✓ `recordAiUsage` (clamp) |
| `assistant/conversations/[id]/route.ts:168` (workspace) | idem | **Pro+** ✓ | ✓ | ✓ (clamp) |
| `assistant/voice/route.ts:55` | Whisper + turno | **Pro+** ✓ | ✓ | ✓ (texto; STT não — A9) |
| `programs/ai-canvas/route.ts:36` | Gemini 3.5 Flash | **Pro+** ✓ | ✓ | ✓ mas **custo fixo 3** (A4) |
| `assistant/chat/route.ts:106` (dock legado) | gpt-4.1-mini | **só `exhausted`** (essencial+free passam) | ✓ free-trial/balde | ✓ |
| `assistant/execute-tool/route.ts:117-146` (HITL) | nenhum (executa tool) | tier+cota/free-trial ✓ | ✓ | ✓ (clamp), C2 ok |
| **`assistant/draft-message/route.ts`** | gpt-4.1-mini | **❌ NENHUM** | **❌ só rate-limit** | **❌ tabela separada** → **A2** |
| **`assistant/winback-draft/route.ts`** | gpt-4.1-mini | **❌ NENHUM** | **❌ só rate-limit** | **❌ separada** → **A2** |
| **cron `generate-insights` → `insight-enricher`** | gpt-4.1-mini | **❌ todos os tiers** | **❌ nenhum** | **❌ só console.log** → **A5** |
| cron `morning-briefing` → `proactive` | turno | **Pro+** ✓ (`:86-90`) | n/a | ✓ mas **clamp off** (A6) |
| `prescription/generate` + `analyze` | Sonnet (caro) | flag `ai_prescriptions_enabled` | rate-limit 5/min,20/day | **❌ sem crédito** → **A7** |
| `forms/generate-form-with-ai.ts:482` (F5) | gpt-4o-mini | **❌ só auth+rate-limit** | rate-limit 5/min,20/day | ❌ sem crédito |
| `prescription/parse-text/route.ts:214` (F4) | gpt-4.1-mini | **❌ só auth+rate-limit** | rate-limit 5/min,50/day | ❌ sem crédito |
| `assistant/evals/judge.ts` | gpt-4o-mini | n/a (offline/dev) | n/a | n/a |

**Resposta:** NÃO, o gate de tier/cota **não** cobre todo caminho que gasta LLM.
Vazam: **draft-message, winback-draft (A2)**, **insight-enricher (A5)**, e os
caminhos de prescrição/forms (A7) que rodam por flag/rate-limit fora do balde de
crédito. Um treinador free ou de cota esgotada dispara inferência paga em A2/A5
sem custo. [LIDO]

### Q2 — Atomicidade/corrida & teto

- **Clamp atômico confirmado** (`216_ai_usage_quota_clamp.sql:39-50`): o
  `INSERT … ON CONFLICT … SET credits_used = least(credits_used + greatest(excluded,0), v_cap)`
  garante que `credits_used` **nunca passa do teto** mesmo sob concorrência —
  upsert sob a unique key `(trainer_id, period_type, period_start)`. `cost_usd_micros`
  acumula **real** (sem clamp) → margem honesta. **[LIDO]**
- **Resíduo TOCTOU real (A3):** o gate (`quota.ts:101`) é cost-unaware. O clamp
  tampa o **ledger**, não o **COGS**. A leitura "15/min × 12 créditos" do enunciado
  refina-se assim: depois que `credits_used` chega **exatamente** ao teto, o gate
  bloqueia (`used < limit` falso). O vazamento real é **na fronteira**: em
  `used = limit-1`, vários turnos concorrentes (até o teto do rate-limit, **15/min**)
  leem `used<limit` e **todos rodam**, cada um custando até um build (~$0,055–0,15
  no Gemini). COGS desperdiçado ≈ **15 × custo_do_build ≈ $1–2 por período/treinador**,
  bounded e ~1×/período. O `MAX_TURN_CREDITS=12` (`tool-policy.ts:222`) limita o
  dano ao **ledger** de UM turno, não o COGS dos concorrentes. **[LIDO/RUNTIME]**
- **Teto por turno (12) é aplicado em todo metering?** NÃO uniformemente:
  - `computeTurnCredits` (com teto 12) roda em **command-engine** (`:679`) e **chat/route** (`:213`). ✓
  - **ai-canvas** NÃO usa `computeTurnCredits` — hardcoda 1 ou 3 (`route.ts:83`); teto irrelevante mas **margem fixa** (A4).
  - **execute-tool** usa `creditWeightForCall` de **uma** tool (máx 6); sem teto de turno, mas single-tool. OK.
  - **proactive** usa `computeTurnCredits` (teto ok) mas **sem clamp** (A6).

### Q3 — Cobrança em falha (C2)

- `command-engine.ts:674`: `successfulCalls = executed.filter(toolResultOk)` →
  só tools que **deram certo** entram em `turnCalls`/créditos. Piso de 1 crédito
  de LLM permanece mesmo se todas falharem (correto: o LLM rodou). **C2 presente.** ✓ [LIDO]
- `chat/route.ts onFinish` (`:193-238`): cobra `computeTurnCredits(turnCalls)` —
  mas `turnCalls` inclui **toda** `step.toolCalls` (`:198`), **sem** filtrar por
  sucesso. As 3 tools do chat retornam `{success:false,…}` em erro, e isso **não**
  é descontado. Risco baixo (só 3 tools, custo 1 cada), mas **C2 não está aplicado
  aqui** com o mesmo rigor do command-engine. Anotar. [LIDO]
- `execute-tool`: cobra **depois** da execução; em `throw` libera idempotência e
  não cobra (`:198-201`); metering é best-effort pós-sucesso (`:229-245`). Não
  cobra falha. ✓ [LIDO]
- `ai-canvas`: cobra `turn.rendered ? 3 : 1` (`route.ts:83`) — só cobra "prescrição"
  se **renderizou**; turno que não renderizou = 1 (query). Razoável. ✓ [LIDO]
- **Turno morto por timeout (maxDuration):** se o handler for morto **antes** do
  `recordAiUsage`/`onFinish`, **não cobra** (o registro vem depois do `generateText`).
  Logo: COGS gasto, **0 crédito cobrado** → vazamento a favor do cliente. `maxDuration`
  é 300s nas rotas de build (`command/route.ts:28`, `conversations:34`, `voice:27`),
  120s no canvas — folga grande, risco baixo, mas é um caminho de COGS não-cobrado. [RUNTIME]

### Q4 — Free-trial "1× cada ação"

- Mecânica (`quota.ts:120-154`): PK `(trainer_id, action_class)`, upsert
  idempotente, 4 classes `query|write|prescription|bulk` (`208_…sql:53`).
- **ID não manipulável:** `trainerId` vem de `auth.getUser()` → linha `trainers`
  no servidor (`chat/route.ts:81`, `execute-tool:82`); o cliente não escolhe o id. ✓ [LIDO]
- **Cobertura das 4 classes:** o **free** só alcança o LLM pelo **dock legado**
  (`chat/route.ts`), cujas tools são `generateProgram|analyzeStudentProgress|getStudentInsights`
  → cobre **prescription** e **query**. **write** e **bulk** só seriam testados via
  **execute-tool**, mas para chegar lá é preciso um card de confirmação vindo de
  ⌘K/workspace — superfícies **bloqueadas p/ free** (A1/A11). Ou seja, na prática o
  free testa só `prescription` e `query`; `write`/`bulk` ficam inacessíveis. **Inconsistência**, não vazamento. [LIDO]
- **Farming "um free = muito valor":**
  - **prescription:** UM free-trial = **um programa COMPLETO** (motor caro) via
    `chat/route.ts:290-295`. Generoso (é o core do produto) mas **1×/treinador**,
    não manipulável. Aceitável como isca. [LIDO]
  - **write em lote:** `computeTurnCredits` permite muitos writes num turno, mas o
    free não chega ao execute-tool (acima). E o command-engine cobra crédito por
    tool real, não free-trial. Sem farming aberto detectado. [LIDO]
  - **A2 é o verdadeiro furo de "valor grátis"**: draft/winback dão LLM ao free
    **sem** sequer gravar free-trial — não é "1×", é **100/dia**.
- **Mensagem de degrade-para-GUI:** clara e amigável (`chat/route.ts:108-110`,
  `command-engine.ts:133`, `execute-tool:127`). ✓ [LIDO]
- **Runtime:** `ai_free_trials` = **0 linhas** em prod → a trilha free **nunca
  rodou**; comportamento real ainda **não validado**. [RUNTIME]

### Q5 — Topups

`ai_credit_topups` existe (`208_ai_platform.sql:102-138`, com RLS de SELECT do
dono) mas **grep em `web/src` por `ai_credit_topups|topup|top_up` = ZERO**.
Nenhum código: (a) insere topup, (b) lê topup, (c) soma topup ao crédito
disponível. `checkQuota` (`quota.ts:64-109`) consulta **só** `ai_usage_periods` —
não consulta topups. Em prod: **0 linhas**. → **Tabela ÓRFÃ.** [LIDO]

**Conclusão:** crédito comprável **não está implementado**. A landing/pricing
**não pode** prometer "compre mais créditos" — hoje seria propaganda falsa. (A
landing atual não promete topup; só não pode passar a prometer.) [LIDO]

### Q6 — Reset de período

- `currentPeriodStart('month')` = 1º dia do mês **UTC** (`metering.ts:93-103`).
  `nextPeriodStart` = 1º do mês seguinte (`quota.ts:49-57`). Como a chave do
  período é `period_start` (`208_…sql:45`), na virada do mês a linha do mês novo
  **não existe** → `used=0` → cota cheia. **Reset correto e automático.** ✓ [LIDO]
- **Borda UTC:** treinador em BRT (UTC-3) "vira o mês" 3h **depois** da meia-noite
  local — diferença de fuso, não bug. Documentar p/ suporte. [LIDO]
- **Upgrade mid-month (essencial→pro):** `checkQuota` lê `PLAN_AI_QUOTA[tier]`
  no **momento da chamada** (`quota.ts:70`). O `period_start` não muda (mesmo mês),
  e `credits_used` é preservado. Então: **o teto pula imediatamente** (20→300) e o
  **uso acumulado é mantido** (ex.: usou 18/20 → vira 18/300). **Não prorrateia,
  não zera — salto imediato do teto.** Isso **favorece o cliente** (ganha os 300
  cheios menos o já-gasto) e é seguro p/ receita. Downgrade no mesmo mês: teto cai
  e o clamp pode deixar `used > novo_teto` momentaneamente (gate bloqueia até o
  reset) — aceitável. [LIDO]

### Q7 — Sanidade de margem

Pesos (`tool-policy.ts:175-195`) × COGS (`docs/analise-mcp-assistente-custos.md`):

| Caminho | Créditos | COGS estimado | Veredito |
|---|---|---|---|
| Build MCP (`create_program_template`/`draft`) | **6** | Gemini 3.5 Flash ~**$0,055**/build (c/ cache, doc:336) | **Margem positiva** se 1 crédito ≳ $0,01. Em Pro (300 créd. ≈ R$79,90 → ~$0,048/créd) → 6 créd ≈ $0,29 vs $0,055 → **~5× folga.** ✓ |
| **Canvas build** | **3** (fixo) | Gemini, **até 8000 tok out** + N buscas + 16 passos → ~**$0,08–0,15** | **Margem fina a NEGATIVA** e cobra **metade** do build MCP apesar de custar **igual ou mais** → **A4.** ⚠️ |
| Turno de chat/consulta | 1 | gpt-4.1-mini ~$0,006–0,015 (doc:266) | Positivo. ✓ |
| `GENERATE_PROGRAM` (prescrição) | 5 | Sonnet ~$0,013–0,015 real (doc:266) | Positivo — mas só cobrado **via chat**; via `/prescription/generate` é **0 crédito** (A7). |
| draft/winback | **0** (não medido) | gpt-4.1-mini ~$0,001–0,003 | **A2** — receita zero, COGS>0. ⚠️ |
| insight-enricher | **0** | gpt-4.1-mini/batch | **A5** — receita zero, COGS>0. ⚠️ |

**Caminhos de margem negativa/zero:** **A4 (canvas)**, **A2 (draft/winback)**,
**A5 (enricher)**. O build MCP em si está **saudável** com Gemini a 6 créditos.
O alerta da memória ("rotacionar ANTHROPIC_API_KEY / Sonnet") está **stale** — o
build agora é Gemini (`command-engine.ts:71`). [LIDO]

---

## 3. O que falta para vender com as travas de token ligadas? (punch-list)

**Bloqueadores GO/NO-GO (resolver antes de cobrar):**

1. **[A1] Reconciliar tier ↔ preço ↔ landing.** Hoje o único price (R$39,90) =
   `essencial` e `essencial` leva **403** no Assistente, mas a landing vende
   "Assistente IA incluído". Decidir: incluir essencial em `PRO_TIERS`, **ou**
   reescrever pricing com tiers explícitos. Sem isso, **todo comprador atual é
   enganado**. (`command-engine.ts:100`, `get-ai-tier.ts:51`, `landing-pricing.tsx:13`)
2. **[A2] Fechar draft-message + winback-draft no gate de IA.** São LLM pago
   entregue a free/esgotado, fora do balde. Vazamento direto de COGS e de valor
   pago. (`draft-message/route.ts`, `winback-draft/route.ts`)
3. **[A10] Confirmar `STRIPE_PRICE_PRO/PREMIUM/ESSENCIAL` em prod.** Sem eles,
   pagantes Pro/Premium resolvem p/ essencial → 403. Smoke-test do `buildPriceTierMap`.

**Travas a apertar (pré-escala, não bloqueia 1 cliente):**

4. **[A4] Cobrar o canvas pela margem real** (peso 6 ou custo→crédito), não 3 fixo.
5. **[A3] Gate cost-aware / reserva otimista** p/ matar o resíduo TOCTOU na fronteira do teto.
6. **[A5] Gatear o insight-enricher por tier** (como o morning-briefing já faz) ou aceitá-lo como custo de produto fora do discurso "IA paga".
7. **[A6] Passar `tier` ao briefing proativo** p/ ligar o clamp.
8. **[A7] Decidir o lugar da prescrição** (dentro do balde de crédito ou linha de custo separada com cap por tier).
9. **[A8] Reavaliar fail-open** dos rate-limits nos caminhos que gastam LLM.

**Higiene / coerência:**

10. **[A11] Unificar a política de acesso** num único helper aplicado a TODAS as superfícies (dock, ⌘K, workspace, voz, canvas, draft, enricher).
11. **Remover ou implementar `ai_credit_topups`** (A5/Q5) — não deixar tabela órfã sugerindo feature que não existe; nunca prometer topup na landing até existir.
12. **[A9] Somar custo de transcrição** ao COGS do turno de voz.
13. **Validar a trilha de cota/free-trial em runtime** — hoje `ai_free_trials`=0 e
    `ai_usage_periods`=1 linha: o sistema **nunca foi exercitado** com volume.
    Rodar um teste E2E de free→essencial→pro→esgotamento→reset antes do lançamento.

---

### Apêndice — confirmações rápidas
- Clamp atômico: `216_ai_usage_quota_clamp.sql:39-50`. **[LIDO]**
- `increment_ai_usage` antigo (sem clamp) está órfão; o código usa `consume_ai_usage` (`metering.ts:165`). **[LIDO]**
- C2 (não cobra tool que falhou): `command-engine.ts:674`. **[LIDO]**
- Default `ai_prescriptions_enabled=false`: `036_ai_prescription_feature_flag.sql:16`. **[LIDO]**
- Build default = Gemini 3.5 Flash, fallback gpt-4.1-mini sem `GOOGLE_GENERATIVE_AI_API_KEY`: `command-engine.ts:71-77`. **[LIDO]**
