# Análise do Assistente (web + mobile) — prontidão para liberar a todos os treinadores

> Data: 07/jul/2026. Escopo: funcionalidade Assistente IA (motor, superfícies web, mobile) + economia dos novos planos por crédito. Método: 4 auditorias de código em paralelo + verificações AO VIVO (banco de produção `lylksbtgrihzepbteest`, envs do Vercel `kinevo-web`, validade das API keys, Stripe price IDs).

## 0. Veredito executivo

**A descoberta que muda a pergunta: o Assistente JÁ ESTÁ liberado para todos os tiers em produção desde 26/jun** (commit `80085ed feat(assistant): open the AI assistant to all tiers (free = taste)`, deployado). Não existe mais gate "Pro+ override" — `ASSISTANT_TIERS` inclui `free/essencial/pro_ia/premium_ia` (`command-engine.ts:110`). O gating efetivo é 100% por USO: free = "taste" (25 conversas/mês + 1× por classe de ação), pagos = balde de créditos (20/300/1000).

O que os dados de produção mostram: **ninguém descobriu**. 26 treinadores, 25 free — e fora o Gustavo (premium override) e 2 contas de teste, **zero uso real**. "Liberar para todos" na prática significa: (1) corrigir os bloqueadores abaixo, (2) cortar um build EAS mobile (o binário das lojas é pré-Onda 3), (3) anunciar.

**Bloqueadores reais antes de anunciar (em ordem):**
1. **Mobile desatualizado nas lojas** — novo build EAS obrigatório (sem OTA no projeto).
2. **Dark mode quebrado** nas superfícies principais web (`/assistente`, ⌘K, tela de planos, CreditMeter).
3. **Promessa do free não bate com a cobrança** ("25 conversas" vs débito por peso — 1 build = 6-12 "conversas").
4. **Latência do gate** (`fetchAiAccess` em leque, ~9s na 1ª carga fria).

**Economia dos planos: sustentável**, com um ponto de atenção no Premium (pior caso margem 15%). Detalhe em §4.

**Verificado ao vivo e OK:** os 3 Stripe price IDs em prod (Essencial reusa o legado 39,90; Pro 79,90; Premium 129,90), `OPENAI_API_KEY` válida (piso de todos os turnos), build em Gemini operante (traces + key local válida). **`ANTHROPIC_API_KEY` de prod segue INVÁLIDA (HTTP 401, testada hoje)** — não afeta o Assistente (build default = Gemini), mas o R2 da auditoria continua aberto para as outras superfícies (ai-builder-chat).

---

## 1. Estado real em produção (verificado ao vivo, 07/jul)

| Métrica | Valor |
|---|---|
| Treinadores | 26 (25 `free`, 1 `premium_ia` = Gustavo) |
| Assinaturas ativas | 8 (7 com `stripe_price_id`, todas no price Essencial; 1 sem price → resolve `essencial` pelo fix do get-ai-tier) |
| Conversas / mensagens | 31 / 110 — 28 conversas são do Gustavo; resto = contas de teste |
| Uso por surface (créditos) | workspace 264 · proactive 49 · mobile 19 · voice 2 |
| Free trials consumidos | 1 (conta de teste, classe `write`) |
| Top-ups | 0 (tabela existe, lógica é v1.1 — não é válvula de escape) |
| COGS total registrado | ~US$ 4,61 para ~600 créditos ≈ **R$ 0,04/crédito** (sem desconto de cache — teto) |
| Modelos nos traces | gpt-4.1-mini 134 turnos (avg 35k in/331 out) · sonnet 6 · gemini-3.5-flash 3 (até 25/jun) · nenhum build desde 25/jun |

**Envs do Vercel (kinevo-web, production):** `STRIPE_PRICE_ESSENCIAL/PRO/PREMIUM` presentes e batem com os IDs do Stripe LIVE; `OPENAI_API_KEY` **válida** (HTTP 200); `GOOGLE_GENERATIVE_AI_API_KEY` presente (tipo *sensitive*, não-decriptável via API; a key homônima do `.env.local` é válida e os traces mostram Gemini rodando em prod 23-25/jun); `ANTHROPIC_API_KEY` **inválida** (HTTP 401 — desde mar/2026, nunca rotacionada); `NEXT_PUBLIC_ENABLE_VOICE_MODE` ausente (voz corretamente desligada); `ASSISTANT_BUILD_MODEL` ausente (default `gemini-3.5-flash`).

**Nota lateral:** `web/.vercel/project.json` está linkado ao projeto errado (`web`, não `kinevo-web`) — `vercel env pull` local puxa vazio.

---

## 2. Web — o que está sólido e o que precisa de correção

### Sólido (não mexer)
- **Cota atômica com clamp**: RPC `consume_ai_usage` com `LEAST` (migr 216) + teto `MAX_TURN_CREDITS=12` (`tool-policy.ts:235`) — o medidor nunca estoura o plano, nem sob concorrência.
- **HITL robusto**: CONFIRM tools chegam sem `execute` (`mcp-bridge.ts:64-67`); `execute-confirmed-tool` revalida tier/cota/args, `confirm:true` forçado, falha real não vira sucesso e libera idempotência.
- **Idempotência dupla** (ação confirmada + `client_message_id` do turno), streaming com Stop real no servidor (não cobra turno abortado), não cobra tool que falhou (fix C2).
- **Fallbacks determinísticos de modelo**: sem key do provedor → mini; build que falha em runtime reinicia no mini.
- **402 amigável com upsell**: cota esgotada degrada pra GUI com CTA "Ver planos" → `/settings#planos` (`assistant-banner.tsx:36-45`).
- **Webhook Stripe → tier**: idempotência insert-first, grava `stripe_price_id`, `getAiTier` reflete na leitura seguinte; downgrade-to-free bloqueado com alunos ativos.

### Corrigir antes de anunciar

| # | Sev. | Problema | Onde |
|---|---|---|---|
| W1 | **ALTA** | **Dark mode quebrado** nas superfícies-carro-chefe: `assistant-workspace/assistant-sidebar/credit-meter/ai-plan-section/command-bar` têm 0 classes `dark:` (cores hardcoded `#F5F5F7`/`bg-white`). Treinador em dark mode vê tela branca. Só `conversation-view` (64 `dark:`) e o dock são dark-aware. | `components/assistant/**` |
| W2 | **ALTA** | **Copy do free mente**: UI e mensagens prometem "25 conversas/mês" (`quota.ts:38-40`), mas o débito é por PESO (build=6-12). Um free que pede 1 programa gasta metade da franquia num turno. Além disso o free NÃO tem clamp no DB (`creditLimit: null`, `command-engine.ts:886`) — `credits_used` pode passar de 25 dentro de um turno (display mascara com `Math.min`). Alinhar: ou cobrar 1/turno do free, ou dizer "créditos". | `quota.ts`, `command-engine.ts:150,886` |
| W3 | MÉDIA | **`fetchAiAccess` em leque**: 3-4 GETs independentes por page-load (`app-layout.tsx:78`, `sidebar.tsx:52`, `assistant-launcher.tsx:26`, `command-palette.tsx:31`), cada um com query de subscription+cota. Explica os ~9s da 1ª carga fria. Deduplicar num provider/SWR. | layout/sidebar/launcher |
| W4 | MÉDIA | **Free-trial é por `action_class`, não por tool**: confirmar QUALQUER write queima o único trial da classe `write` p/ todos os writes (`execute-confirmed-tool.ts:103-114`). E writes auto-executados (ex.: build de rascunho) nem passam pelo trial. Decisão de produto: é o taste desejado? | `execute-confirmed-tool.ts` |
| W5 | MÉDIA | **Tela de planos sem downgrade**: só faz checkout de upgrade; troca Pro→Essencial dispara checkout novo em vez de portal/troca. Cancelamento vive noutra seção (BillingSection→portal). | `ai-plan-section.tsx` |
| W6 | BAIXA | Free não recebe aviso de "acabando" (banner ≥85% exige `tier !== 'free'`) — pula do silêncio pro 402. Meter âmbar em 80% vs banner em 85% (limiares divergem). | `use-assistant-thread.ts:252`, `credit-meter.tsx:52` |
| W7 | BAIXA | MicButton (ditado) renderiza incondicionalmente — se "voz invisível" era requisito, vaza (`assistant-home.tsx:183`, `conversation-view.tsx:252`). Naming drift "Free" vs "Kinevo Gratuito". | cosmético |
| W8 | INFO | Casca única (/assistente dentro do AppLayout) **não está em main** — a spec ficou num working tree antigo que se perdeu ou nunca foi commitada. `/assistente` segue casca própria. Funciona; decidir se a unificação ainda é desejada (a pendência "working tree antigo?" do STATUS.md morre aqui). | `app/assistente/page.tsx:1-9` |
| W9 | OPER. | Sob 25+ treinadores simultâneos: queries redundantes por turno (gate+summary+tier 2×) e builds de 60-120s podem esbarrar em rate limit do provedor (Google/OpenAI) → degradação silenciosa pro mini. Validar quotas dos provedores; observabilidade de `[build-model-fallback]` nos traces. | `command-engine.ts`, `execute-confirmed-tool.ts:99-217` |

---

## 3. Mobile — o principal bloqueador do lançamento

**Paridade de código: excelente.** Streaming NDJSON + stop + HITL cards (editáveis/destrutivos) + créditos (CreditMeter home e chat) + insights IA na home + escopo por aluno + deep-links pós-ação — tudo em `main`, working tree limpo.

**O problema é release, não código:**
- O último bump de versão (1.5.6, commit `3216175`) é **anterior** a todos os commits do assistente moderno (streaming `836c16b`, Onda 3 `8df5529`, billing por crédito `8b51642`, 5 tools `15523e7`). Se o binário das lojas foi cortado aí, **produção mobile hoje não tem streaming, insights, escopo por aluno nem deep-links**.
- **Não há OTA**: nenhum `expo-updates`/`runtimeVersion` no projeto. Qualquer correção do assistente mobile = build EAS + review de loja. (Decidir se vale adotar expo-updates antes do lançamento amplo — reduz drasticamente o custo de hotfix.)
- Recomendação: **bump 1.5.7** antes de buildar (evita dois binários distintos rotulados 1.5.6).

**Problemas de código mobile (por severidade):**

| # | Sev. | Problema | Onde |
|---|---|---|---|
| M1 | **ALTA** | **Risco de política Apple (IAP 3.1.1)**: upgrade que destrava IA in-app é vendido por link externo à web (`trainer-subscription-blocked.tsx:15,26`), e créditos são consumidos dentro do app. Avaliar com cuidado antes do lançamento amplo (review da Apple pode implicar). | decisão produto/jurídico |
| M2 | MÉDIA-ALTA | **Gate fail-closed**: erro/offline no `/api/trainer/assistant/access` → `allowed=false` → toggle e Home Assistente somem (`useAssistantAccess.ts:56-58`, `dashboard.tsx:99`). Um blip de API remove a feature. Cachear última resposta boa. | `useAssistantAccess.ts` |
| M3 | MÉDIA | **Sem CTA de upgrade nas paredes**: free/cota esgotada recebe só ErrorBanner dispensável (`assistant.tsx:270-302`) — sem botão de plano. Perde a venda no pico de intenção (respeitando a decisão do M1). | `assistant.tsx` |
| M4 | MÉDIA | **Descobribilidade**: não há tab do Assistente; o único caminho é Dashboard → toggle → composer/card (2 call-sites). Quem fica no modo Clássico nunca vê. Considerar entrada adicional (ex.: botão no perfil do aluno — já era follow-up da Onda 3). | `(trainer-tabs)/_layout.tsx:35-41` |
| M5 | MÉDIA | Rótulo de escopo não atualiza ao trocar de conversa pelo sheet dentro do chat (cosmético, servidor correto) — edge conhecido da Onda 3. | `assistant.tsx:150-152,226,242` |
| M6 | BAIXA | Falha de rede no envio descarta o texto digitado (`dropTemp()`, `useAssistantChat.ts:464-472`); histórico não virtualizado (ScrollView, jank em conversa longa); tela órfã `assistant-program-review.tsx` (demo fake — deletar). | diversos |

---

## 4. Planos e economia de créditos (a pergunta dos tokens)

**Arquitetura de cobrança**: crédito (peso por tool: read/write=1, superset/assign/contract/duplicate=2, build=6, bulk=1/aluno cap 10; piso 1, teto 12/turno) ≠ tokens ≠ COGS (registrado em `cost_usd_micros`). Modelos: turnos normais **gpt-4.1-mini**; build **gemini-3.5-flash** (fallback mini). Reset mensal dia 1 UTC (não ancora na assinatura).

**Receita por crédito** (o número que fecha ou não a conta):

| Plano | Preço | Cota | Receita/crédito |
|---|---|---|---|
| Essencial | R$ 39,90 | 20 | **R$ 2,00** |
| Pro IA | R$ 79,90 | 300 | **R$ 0,27** |
| Premium IA | R$ 129,90 | 1000 | **R$ 0,13** |

**COGS por crédito** (estimado do código + validado com traces reais de prod: R$ ~0,04/crédito médio registrado): leitura R$ 0,02-0,04 · write R$ 0,03-0,06 · **build Gemini R$ 0,05-0,11** (output a US$ 9/1M domina).

**Margem (preço − COGS IA − Stripe ~4-5%):**

| Plano | Cenário típico (mix 70/25/5) | Pior caso (100% build Gemini) |
|---|---|---|
| Essencial | **~94%** | ~90% |
| Pro | **~86%** | ~56% |
| Premium | **~76%** | **~15%** 🔴 |

**Veredito: as cotas fecham a conta.** Essencial e Pro têm colchão enorme em qualquer cenário. O único ponto de tensão é **Premium no pior caso** (uso quase-exclusivo de builds): margem cai para 15-53% — positiva, mas fina.

**Calibração com uso real**: o Gustavo (power user) consumiu ~330 créditos em 3 semanas → **Pro (300) fica justo para um power user**; Premium é o plano natural desse perfil — coerente com o desenho.

**Recomendações de ajuste (nenhuma bloqueia o lançamento):**
1. Build peso **6 → 7-8** (mantém COGS/crédito abaixo dos R$ 0,13 do Premium com folga) — OU cota Premium 1000 → 600-700. Mexer no peso é mais simples e menos visível.
2. **Registrar `cachedInputTokens`** no COGS (`command-engine.ts:843-846`) — hoje superestima 25-40%; sem isso a vigilância de margem fica cega ao cache.
3. **Metrificar a transcrição Whisper** do ditado/voz em `ai_usage_events` (hoje COGS invisível, pequeno).
4. **Subsetting de tools no mobile**: sem rota, o mobile manda as 62 tools (~8k tokens de definição POR PASSO). Um subset default corta 60-70% do input — é o maior driver de COGS do mobile.
5. **Briefing proativo consome a cota do próprio treinador** (~30 créditos/mês, Pro+ only = 10% da cota Pro). Intencional e documentado no código, mas comunicar no marketing do plano ("briefing diário incluso" e não "grátis").
6. Rate limits existem (15 turnos/min, 300/dia) e o clamp de cota limita o COGS total por assinante — abuso está contido.

---

## 5. Checklist de lançamento (ordem sugerida)

**Bloqueadores:**
- [ ] W1 dark mode das superfícies web do assistente
- [ ] W2 alinhar promessa × cobrança do free (copy ou mecânica) + clamp do free no DB
- [ ] Build EAS mobile (bump 1.5.7) com a Onda 3 + decidir M1 (Apple/IAP) antes de submeter
- [ ] M2 gate mobile fail-closed → cachear última resposta boa

**Fortemente recomendado (semana do lançamento):**
- [ ] W3 dedupe do fetchAiAccess (latência 1ª impressão)
- [ ] M3 CTA de upgrade nas paredes mobile (na medida do permitido pela Apple)
- [ ] W4 decidir semântica do free-trial (classe vs tool)
- [ ] Ajuste de peso do build (recomendação §4.1)
- [ ] Observabilidade: alerta para traces `[build-model-fallback]` (degradação silenciosa de qualidade)

**Pós-lançamento / higiene:**
- [ ] R2 da auditoria: rotacionar `ANTHROPIC_API_KEY` no Vercel (não afeta o assistente, afeta ai-builder-chat)
- [ ] W5 downgrade na tela de planos · W6 banner free · M4 descobribilidade · M5 rótulo de escopo · M6 texto perdido offline
- [ ] `cachedInputTokens` + Whisper no metering · subsetting mobile
- [ ] Deletar `assistant-program-review.tsx` (órfã com dados fake)
- [ ] Relinkar `web/.vercel` ao projeto `kinevo-web`
- [ ] Considerar `expo-updates` (OTA) para hotfix mobile sem review

---

*Gerado por análise de código (4 auditorias paralelas) + verificação ao vivo de banco/envs/keys em 07/jul/2026. Fontes de referência: `analise-modo-assistente-2026-06-22.md` (§6 custos — desatualizado no modelo de build), `analise-mcp-assistente-custos.md` (pré-planos).*
