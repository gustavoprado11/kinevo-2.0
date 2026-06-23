# Relatório noturno — Modo Assistente (23/jun/2026)

> Missão da noite (autônoma): configurar e testar de ponta a ponta a Onda 2 + o hardening do Modo Assistente, deixar tudo em produção e gerar este relatório de manhã.

---

## 1. TL;DR

Passei a noite fechando o Modo Assistente em **três frentes**: **UX do turno** (parar, erro no meio, aviso de crédito), **segurança/billing** (anti-injeção, TTL de dados) e **robustez do build de programa**. Foram **7 commits em produção**, todos com `tsc` limpo, **87 testes verdes**, `eslint` ok, e **3 migrations aplicadas** no banco de prod. Testei tudo no navegador real (Chrome CDP) contra a conta logada.

**O que você precisa fazer (2 itens):**
1. **[P1 — 2 min] Rotacionar a `ANTHROPIC_API_KEY` no Vercel.** Descobri (via teste E2E) que a key da Anthropic em produção está **inválida** (`invalid x-api-key`). Isso fazia o build de programa do Assistente **quebrar com "Algo deu errado"**. Já blindei com um fallback (cai pro gpt-4.1-mini e funciona), mas pra ter a **qualidade Sonnet** de volta no build é só pôr uma key válida. Não consigo setar env por mim (a API de env do Vercel é bloqueada pro meu token, e `vercel env add` grava vazio em modo agente). Passo-a-passo na seção 5.
2. **[P2 — decisão] Streaming do texto.** É a única melhoria de UX que **deixei de propósito pra fazer com você acompanhando** (é reescrita do motor, alto risco, e o erro de stream é invisível no log do Vercel). Plano pronto na seção 6.

Fora isso: **está tudo no ar e validado.** Nenhum treinador real foi afetado — só você tem `ai_tier` Pro+ (os outros 24 são free), então o Assistente é 100% dogfooding.

---

## 2. O que mudou em produção (7 commits)

| Commit | O quê | Por quê | Validação |
|---|---|---|---|
| `6c2d400` | **Onda 1 — segurança & billing** (HITL p/ ações externas/$, parar de cobrar em falha, cota atômica + teto de 12 créditos/turno, idempotência, redação de segredos) | Auditoria apontou: ações sensíveis sem confirmação, cobrança em falha, cota não-atômica (race), PII em traces | tsc + 87 testes + eslint; migrations 216/217 |
| `bfd736e` | **UX da mensagem** — draft-first, card editável, sem vazar "tool-speak" | Você pediu uma ação e o assistente respondia técnico/robótico, como se fosse estúdio | E2E (CDP) |
| `4326065` | **Fix 500 pós-ação** — `bind(this)` no `admin.rpc` do metering | `const consume = admin.rpc` perdia o `this` → `recordAiUsage` lançava em TODA chamada; a ação executava e DEPOIS dava 500 | Teste de regressão + E2E (crédito debitando 220→223) |
| `b237a99` | **Destinatário em destaque + guardrail** contra enviar pro aluno errado | No teste, "Gustavo Prado" virou "Giovanna" — reforço de prompt não basta | E2E: guardrail bloqueou em prod |
| `b14480a` | **Onda 2 quick wins** — botão Parar (`AbortController`), erro no meio do stream não é mais engolido, banner de crédito baixo (≥85%), peso do build 3→6, `maxDuration` 60→300 | Turno sem como cancelar; falha de rede silenciosa; cota estourava sem aviso; build podia dar timeout no meio | E2E smoke ✅ |
| `45e9081` | **Anti-injeção + TTL** — system-prompt v2.3.0 (resultados de TOOL também são dado não-confiável); pg_cron apaga traces > 90 dias | Defesa em profundidade sobre o HITL; LGPD (retenção) | Migration 218; cron verificado ativo |
| `3db38df` | **Build à prova de falha** — se o modelo de build (Sonnet) lançar, degrada pro gpt-4.1-mini em vez de derrubar o turno; erro original vira trace | O build era o único caminho com Sonnet → key inválida o quebrava por inteiro | **E2E ✅ (seção 4)** |

Deploy de produção atual: **`3db38df`** (Vercel `Ready`). `git status` limpo, `main` em sincronia com `origin/main`.

---

## 3. Migrations aplicadas no banco de produção (`lylksbtgrihzepbteest`)

| Migration | O quê | Verificação |
|---|---|---|
| `216_ai_usage_quota_clamp` | RPC `consume_ai_usage` com clamp atômico (sem corrida; nunca passa do teto) | Smoke: incrementa e faz clamp corretos; rollback limpo |
| `217_ai_idempotency` | `client_message_id` + tabela `ai_action_idempotency` (claim/finish/release) | Mesma ação 2× não duplica; status `done` observado em teste |
| `218_traces_ttl` | pg_cron `purge-assistant-turn-traces` apaga traces > 90 dias (diário 04:23 UTC) | Job ativo na `cron.job` |

---

## 4. Matriz de testes E2E (navegador real, prod, conta logada)

Tudo dirigido via Chrome CDP (`playwright-core`) na conta `gustavoprado11@hotmail.com`.

| # | Cenário | Resultado | Evidência |
|---|---|---|---|
| 1 | **Leitura** — "Quem está estagnado?" | ✅ Responde certo; **botão Parar apareceu**; sem erro; **crédito debitou** (220→223) | smoke |
| 2 | **Destinatário** — "mensagem pro Gustavo Prado" (modelo resolveu Giovanna) | ✅ **Guardrail bloqueou em prod**: *"a mensagem parece endereçada a 'Gustavo', mas o destinatário é Giovanna Prado. Confirme…"* — nada enviado (cancelei) | e2e-C |
| 3 | **Build (antes do fix)** — "Monta um treino full body 3x pro Gustavo Prado" | ❌ **Falhava** "Algo deu errado" (sem trace, sem log no Vercel) → motivou o diagnóstico | — |
| 4 | **Build (re-teste pós-fix)** — mesma frase | ✅ **Não quebra mais**; o assistente pede o objetivo (já no gpt-4.1-mini do fallback) | build-retest |
| 5 | **Build (conclusão)** — respondi "Hipertrofia, seg/qua/sex" | ✅ **Rascunho gerado E2E**: *"Full Body 3x Semana - Hipertrofia"*, 18 exercícios em 3 sessões, card **"Revisar rascunho"** no perfil — o fallback produz programa usável | build-finish |

Capturas em `/tmp/kinevo-drive/*.png` (s1–s3, e2e-A/C, build-retest, build-finish). São temporárias; aviso se quiser que eu mova pro Desktop.

---

## 5. Causa-raiz do build que falhava (diagnóstico fechado) + ação P1

**O que era:** o build de programa é o **único** turno que troca de modelo pra **Claude Sonnet** (`DEFAULT_BUILD_MODEL`), porque medições mostraram que o Sonnet entrega split profissional e o mini põe volume zero no grupo enfatizado. Em produção, a chamada à Anthropic voltava **`invalid x-api-key`** — a `ANTHROPIC_API_KEY` do Vercel **existe mas é inválida** (expirada/errada).

**Por que passava despercebido:** `resolveBuildModel()` só checa **presença** da key (`command-engine.ts:71`) — não dá pra validar sem fazer a chamada. Então ele escolhia Sonnet, a Anthropic rejeitava, e o erro acontecia **dentro do `ReadableStream.start()`** — onde `console.error` **não é capturado** pelo log do Vercel. Daí "Algo deu errado" sem rastro.

**Como blindei (já em prod):** `3db38df` — se o modelo de build lançar, faz fallback pro `gpt-4.1-mini` e **conclui o turno**; o erro original vira um trace `[build-model-fallback] …`. Foi assim que capturei a mensagem exata. Provado nos testes #4 e #5.

**O que NÃO foi afetado:** o **motor de prescrição** (o produto principal) tem `DEFAULT_GENERATION_MODEL = gpt-4.1-mini` e degrada via `missing_api_key` sem quebrar — ou seja, **a prescrição não depende dessa key** e segue intacta. A key inválida só rebaixa a qualidade do build do Assistente (Sonnet→mini).

**Ação P1 (sua, ~2 min):**
1. Vercel → projeto Kinevo → **Settings → Environment Variables**.
2. Editar **`ANTHROPIC_API_KEY`** (escopo **Production**) com uma key válida do console da Anthropic.
3. **Redeploy** (Deployments → ⋯ → Redeploy, ou um push qualquer).
4. Conferir: no Assistente, "Monta um treino full body 3x" deve gerar o rascunho **sem precisar do fallback**. (Se quiser, eu re-testo via CDP e confirmo que voltou pro Sonnet checando que não há novo trace `[build-model-fallback]`.)

> Enquanto a key não for trocada, **nada quebra** — o build só sai com qualidade de mini.

---

## 6. Deferido de propósito (com plano)

### U-STREAM — streaming de texto no turno (P2, decisão sua)
Hoje o turno usa `generateText` (resposta aparece de uma vez). Streaming (`streamText`) faz o texto pingar token-a-token (sensação de rapidez).
- **Por que não fiz sozinho à noite:** é **reescrita do motor** (o caminho com HITL/tools/idempotência), **alto risco**, e o **erro de stream é invisível no log do Vercel** (foi exatamente o que escondeu o bug do build). Além disso **não dá pra testar em preview** porque o Assistente é gated por auth.
- **Plano seguro:** implementar em branch → **preview deploy** → eu dirijo o preview no CDP e valido (texto pinga, Parar aborta de verdade, HITL ainda pausa, crédito debita) → só então **promover**. Quero você por perto porque é o caminho crítico do produto.

### U-ENG — convergência dos dois motores (técnico, baixa prioridade)
Há dois caminhos de turno (comando vs. conversa) com lógica sobreposta. Unificar reduz risco de divergência futura. Não é urgente; melhor depois do streaming pra não mexer em tudo de uma vez.

### Mobile / voz do Assistente
A paridade da experiência no app mobile (e o fluxo de voz) não entrou nesta noite — escopo era a superfície web. Vale uma passada dedicada depois.

---

## 7. Política e segurança adotada na noite

- **Raio de impacto verificado:** só **1 treinador** tem `ai_tier` Pro+ (você). Os outros 24 são free e **não enxergam** o Assistente → mudanças nele **não afetam treinador real**. Por isso deploys noturnos foram seguros.
- **Escopo contido:** fiquei **dentro da feature do Assistente**; não toquei em motor de prescrição nem em código compartilhado.
- **Test-gate antes de cada deploy:** `tsc` + `vitest` + `eslint`; pra fluxo/UI, smoke E2E (CDP). A mudança de maior risco (streaming) ficou pra fazer via preview supervisionado — não empurrei.
- **Commits atômicos** + deploy + verificação a cada incremento. `git status` limpo no fim.

---

## 8. Pendências menores (não bloqueiam nada)

- Mover capturas E2E de `/tmp/kinevo-drive/` pro Desktop se você quiser guardá-las (são temporárias).
- Fechar o Chrome de debug + perfil temporário (faço ao encerrar).
- Re-teste do build pós-rotação da key (eu confirmo que voltou ao Sonnet quando você trocar).

---

*Detalhe técnico de cada item nas seções 2–5. Qualquer "por que assim?" eu abro o diff do commit correspondente.*
