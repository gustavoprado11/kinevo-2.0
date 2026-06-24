# RESUMO EXECUTIVO — Prontidão para Venda (Modo Assistente + Tokens)

> **Data:** 2026-06-23 · **Tipo:** análise read-only (nenhum código/config/migration alterado).
> **Pergunta-mãe:** *"isto está pronto para receber dinheiro de cliente real?"*
> **Relatórios:** `00-mapa-monetizacao.md` · `01-travas-tokens.md` · `02-stripe-pagamento.md` · `03-landing-pricing.md` · `04-onboarding-ativacao.md` · `05-riscos-lancamento.md`.
> **Convenção:** **[C]** = confirmado por leitura de código/runtime · **[H]** = hipótese a verificar (Stripe-test/legal/runtime). `arquivo:linha` em cada achado nos relatórios.

---

## ✅ VEREDITO ATUALIZADO (24/jun/2026): **GO** — bloqueantes de lançamento resolvidos

Todas as correções foram **implementadas, deployadas em produção e testadas E2E ao vivo**. O funil vende os **4 tiers** (free / essencial / pro_ia / premium_ia), o tier comprado libera exatamente o que a landing promete, os prices live do Stripe + envs Vercel estão corretos, os vazamentos de custo/monetização foram tapados, a **conversão in-app** leva ao upsell na tabela de planos, e o **LGPD** está OK (código — disclosure dos 2 sub-processadores + minimização do dado de saúde — deployado; DPA/ZDR/tier-pago dos provedores **confirmados pelo Gustavo**). **Um cliente real já consegue comprar Pro (R$ 79,90) e Premium (R$ 129,90), e o produto entrega o que anuncia.**

**Não há mais bloqueante de lançamento.** Os itens ⚠️ remanescentes (margem do build, gate ciente de custo, graça no dunning, dívida de lint) são **polimento pós-lançamento** — não travam o GO.

> **Histórico (resolvido):** o funil vendia só 1 plano (R$ 39,90 → `essencial`) que era 403 no Assistente; havia vazamento de custo (LLM/criação de aluno sem gate); o chat free era ilimitado; e o LGPD estava aberto. **Caminho B — escada de 4 tiers** escolhido, entregue, LGPD fechado e conversão in-app concluída (24/jun). Plano de execução na §5.

---

## 1. CHECKLIST DE LANÇAMENTO (GO / NO-GO)

Legenda status: ✅ pronto · ⚠️ risco · ❌ bloqueante. Esforço: **P** (≤2h) · **M** (½–1 dia) · **G** (>1 dia / externo).

| # | Item necessário para vender | Status | Sev. | O que falta (resumo) | Esforço |
|---|---|:--:|:--:|---|:--:|
| 1 | **Cliente consegue comprar Pro/Premium** | ✅ | — | **FEITO + no ar** (commit `35aed91`): funil vende os 4 tiers, CTA `?tier=` → checkout. E2E live: pro/premium/essencial → sessão Stripe `cs_live_…` (200). `landing-pricing.tsx`, `checkout/route.ts` | — |
| 2 | **Tier comprado libera o que a landing promete** | ✅ | — | **FEITO**: landing honesta — `essencial` = entrada barata SEM Assistente agêntico (só IA leve, 20 cr); `pro`/`premium` liberam ⌘K/voz. Fonte única `lib/billing/tiers.ts` (landing = /settings = código) | — |
| 3 | **Price→tier resolve em produção** | ✅ | — | **FEITO**: 3 prices live + envs Vercel **corretos** [C: env pull] — `STRIPE_PRICE_PRO=price_1Tix2d…`, `PREMIUM=price_1Tix2n…`, `ESSENCIAL`/`ID=price_1SzFq…`. Confirmado por 3 checkout 200 | — |
| 4 | **LGPD: dado de saúde → LLM com DPA + ZDR + disclosure** | ✅ | — | **OK.** Código (deployado, commit `278cade`): disclosure dos **2** sub-processadores in-app (**OpenAI** + **Google/Gemini**) na política de privacidade + **minimização** do payload (restrição clínica/check-in cru só nos turnos que precisam). Externo (DPA + ZDR + Gemini no tier pago): **confirmado OK pelo Gustavo**. `privacy/page.tsx` | — |
| 5 | **Trava de "Free = 1 aluno" inviolável** | ✅ | — | **FEITO + deployado** (edge fn `create-student` v7): cap com paridade web/MCP. E2E live: free+1→403 `student_cap_reached`, premium/sub→bypass (pagante nunca bloqueado) | — |
| 6 | **Nenhuma chamada LLM fora do gate de cota** | ✅ | — | **FEITO + deployado**: `draft-message`/`winback-draft` atrás do gate (402 esgotado) + débito no balde; `insight-enricher` só tier pago. E2E live: 402 + 1 crédito debitado (`ai_usage_events surface=proactive`) | — |
| 7 | **Economia de cota testada end-to-end** | ✅ | — | **FEITO**: exercitada E2E ao vivo — gate 402, débito de 1 crédito, surface `proactive`, reset UTC correto. [C live] (antes: `ai_free_trials`=0, nunca rodada) | — |
| 8 | **Landing comunica crédito/cota e os 4 tiers** | ✅ | — | **FEITO + no ar**: grade de 4 tiers com preços (R$ 39,90/79,90/129,90), cotas (20/300/1.000 créditos) e nota de degrade-pra-GUI. SSR verificado live; card "plano único" removido | — |
| 9 | **Margem positiva por tier (build Gemini)** | ⚠️ | Médio | Canvas cobra 3 créditos por turno Gemini de 8000 tok/16 passos (peso ½ do build MCP); revalidar com custos reais. `ai-canvas/route.ts:83` | P (análise) |
| 10 | **Gate ciente do custo do turno** | ⚠️ | Médio | `checkQuota` binário/TOCTOU; clamp tampa o ledger, não o COGS clampado. `quota.ts:101` | M |
| 11 | **Conversão no muro (paywall → planos)** | ✅ | — | **FEITO + deployado + E2E live**: o dock surfaceia 402/403 (antes engolia) + CTA → **tabela de planos** `/settings#planos` (Pro "Recomendado"); upsell no cap de aluno e na 2ª geração de programa; **franquia de 25 conversas/mês no free** (antes ilimitado). Commits `ac79e60`/`78f743a`/`5d411ee` | — |
| 12 | **Dunning com período de graça** | ⚠️ | Médio | `past_due` → tier `free` na hora; acesso checa só `status`, não `period_end`. `get-trainer.ts:98` | P |
| 13 | **Webhook Stripe seguro e idempotente** | ✅ | — | Assinatura + insert-first em `UNIQUE(event_id)` + release-on-fail 500. `webhooks/stripe/route.ts:51,69-118` | — |
| 14 | **Cobrança atômica (clamp + teto + só sucesso)** | ✅ | — | `consume_ai_usage` clamp (migr 216); `MAX_TURN_CREDITS=12`; `toolResultOk` antes de cobrar. `command-engine.ts:674` | — |
| 15 | **HITL nas ações externas/financeiras** | ✅ | — | `send_message/send_form/schedule_form/generate_checkout_link` em `CONFIRM_TOOLS`. `tool-policy.ts:133-136` | — |
| 16 | **Isolamento multi-tenant em billing/cota** | ✅ | — | Tudo por `trainer_id` resolvido da sessão/JWT; sem furo cross-tenant. `00 §5`/`05 R5` | — |
| 17 | **Topups (`ai_credit_topups`) — não prometer** | ✅ | — | Tabela **órfã** (0 refs, 0 linhas) [C]. Não anunciar compra de créditos avulsos enquanto não for plugada | — |
| 18 | **Saúde do código (baseline pré-mexida)** | ⚠️ | Baixo | typecheck ✅; testes ✅; **lint ❌** (dívida pré-existente, não do Assistente) | — |

> **Status de execução (24/jun/2026): todos os bloqueantes resolvidos — GO.** Deployados em produção e testados E2E ao vivo: **Fase 3** (vazamentos — edge fn `create-student` v7 + gates de cota + tier no enricher, `b8b9abf`); **Fase 2** (escada de 4 tiers — `lib/billing/tiers.ts` + landing + funil `signup?tier=`, `35aed91`); **LGPD** (disclosure + minimização, `278cade`; externo confirmado OK); **Conversão in-app** (muros → tabela de planos + franquia de 25 chats/mês no free, `ac79e60`/`78f743a`/`5d411ee`). Stripe live prices + envs Vercel corretos. Restam só os itens **9, 10, 12, 18** (⚠️ polimento de margem/dunning/lint) — **não travam o GO comercial**. Execução detalhada na §5.

---

## 2. Saúde do código (baseline — rodado agora, números reais)

| Check | Resultado | Observação |
|---|---|---|
| `npm run typecheck` (`tsc --noEmit`) | ✅ **limpo** (exit 0) | — |
| `npm run test:run` (vitest) | ✅ **1264 passed · 41 skipped** (124 arquivos, 5 skipped) | suíte ampla e verde (cresceu com os testes dos gates de cota) |
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
