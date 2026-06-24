# RESUMO EXECUTIVO — Prontidão para Venda (Modo Assistente + Tokens)

> **Data:** 2026-06-23 · **Tipo:** análise read-only (nenhum código/config/migration alterado).
> **Pergunta-mãe:** *"isto está pronto para receber dinheiro de cliente real?"*
> **Relatórios:** `00-mapa-monetizacao.md` · `01-travas-tokens.md` · `02-stripe-pagamento.md` · `03-landing-pricing.md` · `04-onboarding-ativacao.md` · `05-riscos-lancamento.md`.
> **Convenção:** **[C]** = confirmado por leitura de código/runtime · **[H]** = hipótese a verificar (Stripe-test/legal/runtime). `arquivo:linha` em cada achado nos relatórios.

---

## ⛔ VEREDITO: NO-GO para abrir a venda dos planos com IA hoje

As 4 frentes convergiram **independentemente** no mesmo bloqueio central: **a economia de 4 tiers existe no backend, mas o funil só vende 1 plano (R$ 39,90 → `essencial`), e esse plano é exatamente o que o gate do Assistente bloqueia (Pro+ only).** Resultado: **nenhum cliente real consegue comprar o produto que a landing anuncia.** Runtime confirma: **24 free, 1 `premium_ia` (override manual do Gustavo, não Stripe), 0 pagantes Pro/Premium, 13/14 assinaturas com `stripe_price_id` NULL.**

Além disso há **vazamento de custo/monetização** (chamadas LLM e criação de aluno sem gate) e o **portão LGPD** segue aberto no código.

> **Caminho escolhido (24/jun/2026): B — escada de 4 tiers.** O Assistente completo é o upsell dos tiers `pro_ia`/`premium_ia`; `essencial` é a entrada barata. O backend já assume esse modelo — falta alinhar landing+funil+Stripe e tapar os vazamentos. **Plano de execução na §5.**

---

## 1. CHECKLIST DE LANÇAMENTO (GO / NO-GO)

Legenda status: ✅ pronto · ⚠️ risco · ❌ bloqueante. Esforço: **P** (≤2h) · **M** (½–1 dia) · **G** (>1 dia / externo).

| # | Item necessário para vender | Status | Sev. | O que falta (resumo) | Esforço |
|---|---|:--:|:--:|---|:--:|
| 1 | **Cliente consegue comprar Pro/Premium** | ❌ | Crít | Funil vende só 1 price; tiers só em `/settings`; `STRIPE_PRICE_PRO/PREMIUM` provavelmente não setados em prod. `checkout/route.ts:68-70`, `landing-pricing.tsx:118-123` | M |
| 2 | **Tier comprado libera o que a landing promete** | ❌ | Crít | `essencial` (R$39,90) é **403 no Assistente** (`PRO_TIERS` só pro/premium). Landing vende "Assistente IA incluído". `command-engine.ts:100,118` × `landing-pricing.tsx:13,26` | P–M |
| 3 | **Price→tier resolve em produção** | ❌ | Crít | 13/14 subs com `stripe_price_id` NULL [C runtime]; `/api/stripe/sync` não grava price (`sync/route.ts:84-91`); precisa criar 3 prices live + envs + backfill | M |
| 4 | **LGPD: dado de saúde → LLM com DPA + ZDR** | ❌ | Crít | 0 config de zero-retention/DPA em `web/src`; disclosure atual cobre só o *conector*, não o Assistente in-app. `privacy/page.tsx:71` | G (legal/config) |
| 5 | **Trava de "Free = 1 aluno" inviolável** | ❌ | Crít | Edge fn `create-student/index.ts:96-110` cria aluno **sem** `assertCanCreateStudent` → mobile/lead burlam o cap. Web e MCP travam | P–M |
| 6 | **Nenhuma chamada LLM fora do gate de cota** | ❌ | Alto | `draft-message`, `winback-draft` (sem gate de tier/crédito) e `insight-enricher` (cron, todos os tiers) chamam LLM pago fora do balde. `draft-message/route.ts:34-105` | M |
| 7 | **Economia de cota testada end-to-end** | ⚠️ | Alto | `ai_free_trials`=0, `ai_usage_periods`=1 linha [C runtime] → nunca exercitada em prod. Falta E2E free→pago→esgota→reset | M |
| 8 | **Landing comunica crédito/cota e os 4 tiers** | ⚠️ | Alto | Landing = "plano único tudo incluso"; zero menção a crédito/cota/trial; sem tabela de tiers. `landing-pricing.tsx:77` | M |
| 9 | **Margem positiva por tier (build Gemini)** | ⚠️ | Médio | Canvas cobra 3 créditos por turno Gemini de 8000 tok/16 passos (peso ½ do build MCP); revalidar com custos reais. `ai-canvas/route.ts:83` | P (análise) |
| 10 | **Gate ciente do custo do turno** | ⚠️ | Médio | `checkQuota` binário/TOCTOU; clamp tampa o ledger, não o COGS clampado. `quota.ts:101` | M |
| 11 | **Conversão no muro (paywall → checkout)** | ⚠️ | Médio | Dock engole erro 402/429 (`assistant-panel-content.tsx:106`); CTA de upgrade → `/settings`, não checkout; banner só na superfície Pro+ | M |
| 12 | **Dunning com período de graça** | ⚠️ | Médio | `past_due` → tier `free` na hora; acesso checa só `status`, não `period_end`. `get-trainer.ts:98` | P |
| 13 | **Webhook Stripe seguro e idempotente** | ✅ | — | Assinatura + insert-first em `UNIQUE(event_id)` + release-on-fail 500. `webhooks/stripe/route.ts:51,69-118` | — |
| 14 | **Cobrança atômica (clamp + teto + só sucesso)** | ✅ | — | `consume_ai_usage` clamp (migr 216); `MAX_TURN_CREDITS=12`; `toolResultOk` antes de cobrar. `command-engine.ts:674` | — |
| 15 | **HITL nas ações externas/financeiras** | ✅ | — | `send_message/send_form/schedule_form/generate_checkout_link` em `CONFIRM_TOOLS`. `tool-policy.ts:133-136` | — |
| 16 | **Isolamento multi-tenant em billing/cota** | ✅ | — | Tudo por `trainer_id` resolvido da sessão/JWT; sem furo cross-tenant. `00 §5`/`05 R5` | — |
| 17 | **Topups (`ai_credit_topups`) — não prometer** | ✅ | — | Tabela **órfã** (0 refs, 0 linhas) [C]. Não anunciar compra de créditos avulsos enquanto não for plugada | — |
| 18 | **Saúde do código (baseline pré-mexida)** | ⚠️ | Baixo | typecheck ✅; testes ✅; **lint ❌** (dívida pré-existente, não do Assistente) | — |

---

## 2. Saúde do código (baseline — rodado agora, números reais)

| Check | Resultado | Observação |
|---|---|---|
| `npm run typecheck` (`tsc --noEmit`) | ✅ **limpo** (exit 0) | — |
| `npm run test:run` (vitest) | ✅ **1262 passed · 41 skipped** (124 arquivos, 5 skipped) | 15s; suíte ampla e verde |
| `npm run lint` (eslint) | ❌ **714 problemas (559 erros, 155 warns)** | **Dívida pré-existente repo-wide**, NÃO do Assistente: `no-explicit-any` (471), `no-unused-vars` (130), `ban-ts-comment` (34), `set-state-in-effect` (28). Espalhada em scripts/actions/testes. É o "582 as any" da auditoria noturna. Viola a regra #2 do `web/CLAUDE.md`, mas não bloqueia venda |

> O relatório noturno citou "87 testes"; era uma rodada escopada. A suíte completa hoje = **1262 verdes** — sinal de saúde mais forte.

---

## 3. Coerência landing ↔ código ↔ Stripe (a checagem de maior risco)

| Dimensão | Landing | Código | Stripe (runtime) | Veredito |
|---|---|---|---|---|
| Nº de planos vendáveis | **1** ("plano único", `landing-pricing.tsx:77`) | 4 tiers (`quota.ts:23-28`) | 1 price live (legado) [C] | ❌ promessa ≠ produto |
| Assistente IA no plano R$39,90 | "incluído" (`landing-ai-assistant.tsx`) | `essencial` = **403** (`command-engine.ts:118`) | comprador real = essencial | ❌ promessa falsa |
| Crédito/cota | **não menciona** | 20/300/1000 + free "1× ação" | — | ⚠️ invisível |
| Alunos | "ilimitados" | free=1, pago=∞ (`student-cap.ts:18`) | — | ⚠️ sem disclosure do free=1 |
| Preço (R$39,90) | consistente (JSON-LD = price legado) | legado→essencial | — | ✅ número certo, produto errado |

**Conclusão:** o problema **não é número errado** — é a landing descrever um produto de **plano único** que o backend já **não é**, e vender a feature-herói no tier que a trava bloqueia.

---

## 4. TOP 10 achados por impacto em receita

1. **❌ Pro/Premium invendáveis pelo funil** — landing/signup→checkout sem body → sempre o price legado (essencial). `checkout/route.ts:68-70`, `signup/page.tsx:144-147`. **[C]**
2. **❌ `essencial` paga e leva 403 no Assistente** que a landing mais vende. `command-engine.ts:100,118` × `landing-pricing.tsx:13,26`. **[C]**
3. **❌ Price→tier não resolve em prod** — 13/14 subs com `stripe_price_id` NULL; sync não grava price. `sync/route.ts:84-91`. **[C runtime]**
4. **❌ Cap "Free=1 aluno" burlável pelo mobile** — edge fn sem `assertCanCreateStudent`. `supabase/functions/create-student/index.ts:96-110`. **[C]**
5. **❌ LLM pago fora do balde** — `draft-message`/`winback-draft` sem gate; `insight-enricher` no cron p/ todos os tiers. `draft-message/route.ts:34-105`, `generate-insights/route.ts:109`. **[C]**
6. **❌ LGPD: dado de saúde → LLM sem DPA/ZDR** comprovado; disclosure só do conector. `privacy/page.tsx:71`. **[H legal]**
7. **⚠️ Cota nunca exercitada em prod** — `ai_free_trials`=0, `ai_usage_periods`=1. Risco de bug latente no 1º cliente pagante real. **[C runtime]**
8. **⚠️ Free conversa ilimitado no dock** (`query` nunca esgota) + dock engole erro e não converte. `usage-summary.ts:51,105`, `assistant-panel-content.tsx:106`. **[C]**
9. **⚠️ Margem do canvas/gate TOCTOU** — canvas 3 créditos por turno Gemini grande; gate cego ao custo vaza COGS na fronteira. `ai-canvas/route.ts:83`, `quota.ts:101`. **[C]**
10. **⚠️ Webhook out-of-order + dunning sem graça** — `subscription.updated` antes do checkout = no-op; `past_due`→free imediato. `webhooks/stripe/route.ts:190`, `get-trainer.ts:98`. **[C]**

---

## 5. Ordem de ataque — **CAMINHO B escolhido (escada de 4 tiers)**

> **Decisão de produto fechada (Gustavo, 24/jun/2026):** modelo = **escada de planos** — `free` + `essencial` + `pro_ia` (300) + `premium_ia` (1000); o **Assistente completo é o upsell dos tiers caros**, `essencial` é a entrada barata. O backend **já assume** esse modelo (cotas 20/300/1000 + gate Pro+), então o trabalho é **alinhar landing + funil + Stripe** ao que o código já faz, e **tapar os vazamentos**. Não há mais "keystone de decisão de modelo" — só execução.

### Decisões de produto ainda pendentes (destravam o código da landing/funil)
- **D1 — Preços dos 3 tiers pagos:** `essencial` = R$ ___ · `pro_ia` = R$ ___ (a análise de custo recomenda **≥ R$ 79,90** p/ a IA ter margem) · `premium_ia` = R$ ___ .
- **D2 — O que o `essencial` entrega de IA:** (a) **sem Assistente** (só GUI + features não-IA) — é o que o código faz hoje (403); (b) Assistente com **franquia curta** (cota 20). *Recomendo (a)* para a escada ficar nítida ("IA é Pro+"), realocando/removendo a cota 20 morta. → ver `[[01-travas-tokens]]` (essencial 403) e `[[03-landing-pricing]]`.
- **D3 — Matriz de features por tier** (o que cada card da landing lista: alunos, créditos/mês, Assistente, voz, etc.).

### Fase 1 — Config externa **[Gustavo]** (pré-requisito de tudo)
1. Criar **3 prices no Stripe** (live **e** test mode): essencial/pro/premium.
2. Setar **`STRIPE_PRICE_ESSENCIAL` / `STRIPE_PRICE_PRO` / `STRIPE_PRICE_PREMIUM`** na Vercel (Production) + redeploy. (Sem isso, Pro/Premium → `essencial` → 403 — achados 1/2/3.)
3. *(Paralelo, regulatório)* **LGPD:** DPA + ZDR + no-training com **OpenAI e Google (Gemini)**; guardar evidência (achado 6).

### Fase 2 — Funil de venda **[código]** (depende de D1–D3)
4. **Landing:** trocar "plano único" por **tabela de 4 tiers** (free/essencial/pro/premium) com créditos/mês, alunos e o que cada um inclui; **CTA por tier** → checkout com o price certo. `landing-pricing.tsx`. Montar seções já prontas (`LandingStripe`/`AppleWatch`/`StudentApp`) no polish (achado 8).
5. **Funil:** `signup`/checkout passam o **tier/price escolhido** no body do `POST /api/stripe/checkout` (hoje vai sem body → cai no price legado). `checkout/route.ts:68-70`, `signup/page.tsx:144-147` (achado 1).
6. **Sync/backfill price:** `/api/stripe/sync` gravar `stripe_price_id` no upsert; **backfill** das 13/14 subs NULL *(write em prod → só com autorização)*. `sync/route.ts:84-91` (achado 3).

### Fase 3 — Tapar vazamento de monetização/custo **[código]** (independe de D1–D3 — pode começar já)
7. **Cap de aluno na edge fn `create-student`** (mobile/lead burlam o "Free=1"). `supabase/functions/create-student/index.ts:96-110` (achado 4).
8. **Gate de cota** em `draft-message` / `winback-draft` / `insight-enricher` (LLM pago fora do balde). `draft-message/route.ts:34-105`, `generate-insights/route.ts:109` (achado 5).
9. **Free:** travar `query` por classe no dock **ou** unificar o gate (conversa ilimitada hoje). `usage-summary.ts:51,105` (achado 8).

### Fase 4 — Validação **[eu dirijo + Gustavo]**
10. **E2E em Stripe test mode:** free → assina `pro_ia` → consome → esgota → reset; conferir tier resolvido, créditos debitando, gate e o medidor. Exercita a cota que **nunca rodou em prod** (achado 7; roteiro em `[[02-stripe-pagamento]]`).

### Fase 5 — Polir conversão + confiança (depois dos bloqueantes)
11. CTA de upgrade → **checkout** (não `/settings`); banner de upsell na superfície que o **free** vê; dock não engolir erro 402/429 (achado 11). Período de graça no `past_due` (achado 12). Revalidar margem do build Gemini (achado 9). Gate cost-aware (achado 10). Streaming/voz como follow-up.

> **Sequência crítica:** D1–D3 (produto) → Fase 1 (Stripe/Vercel) destrava Fase 2 (funil). A **Fase 3** (vazamentos) não depende de nada e pode rodar em paralelo já. Nada vai pra `main` sem o teste da Fase 4 e a autorização do Gustavo (workflow do projeto).

---

## 6. O que está sólido (creditar e preservar)

Webhook Stripe (assinatura+idempotência+release-on-fail), cobrança atômica (clamp migr 216 + teto 12 + só-sucesso), HITL nas ações externas/financeiras + guardrail de destinatário, redação de segredo + TTL de traces, anti-injeção v2.3.0, isolamento multi-tenant, rate-limit durável, self-student + contrato cortesia na ativação, e o fato de o estouro de cota **não brickar** o app (degrada pra GUI). A base de engenharia está madura — **o gap é comercial/de configuração, não de arquitetura.**

---

### Critério de conclusão (verificação feita)
1. ✅ Cada item GO/NO-GO tem evidência `arquivo:linha` nos relatórios `00`–`05`; especulação marcada **[H]**.
2. ✅ `typecheck` limpo · `test:run` 1262 verdes · `lint` 714 problemas (dívida pré-existente) — números reais na §2.
3. ✅ Coerência landing↔código↔Stripe checada (§3) — é o maior risco de promessa falsa e está **vermelho**.
4. ✅ Aprofundado em travas de token (`01`) e Stripe (`02`) — onde o dinheiro entra e vaza — com SELECTs read-only de produção.
