# Camada 2 — Loops de desenvolvimento multi-domínio (modelo Replit)

> Estado: **desenho** (jun/2026). Camada 1 (loop visual endurecido) já em produção
> e validada — ver `scripts/qa-loop/` + `.claude/workflows/qa-visual-loop.js`.

## Objetivo

Generalizar o loop visual num **orquestrador** que dispara vários loops de domínio
em paralelo, cada um seguindo o mesmo tripé já provado, no espírito do que o Amjad
(Replit) descreve: *orquestrador → agentes paralelos → verificador (inclusive
computer-use) → agentes geram prompts de fix*. O humano revisa/aprova; o loop não
toca código sozinho (Camada 3, opcional, fecharia o ciclo de implementação).

## Princípio central (as 4 lições da Camada 1)

Toda imprecisão do 1º loop veio de partir do **sinal fraco** (imagem) e usar o código
só pra refutar. A Camada 2 inverte isso em TODO domínio:

1. **Ground-truth primeiro.** Cada domínio carrega um "o que é esperado" que o analisador
   e o verificador recebem (intent visual; postura de segurança esperada; allowlist de
   erros aceitáveis em prod; keywords/respostas-alvo em SEO).
2. **Verificador adversarial obrigatório.** O verificador tenta REFUTAR o achado; default
   cético. Onde dá, **confirma ao vivo** (computer-use), não só por leitura.
3. **Sinal completo, não a dobra.** Captura segmentada / janela inteira de logs / HTML
   renderizado inteiro — nunca uma amostra.
4. **Barra de valor + dedupe.** Veredito `low_value` mata clichê; dedupe cross-domínio
   evita o mesmo achado em dois relatórios.

## Contrato comum de um loop de domínio

Todo loop é um Workflow salvo em `.claude/workflows/<dominio>-loop.js` com 4 estágios:

| Estágio | O que faz | Saída |
|---|---|---|
| **1. Collect** | coleta o sinal do domínio (capturar telas / ler RLS+rotas / puxar logs / fetch HTML) | artefatos + manifest |
| **2. Analyze** | fan-out de agentes → achados candidatos | `[{title, severity, evidence, area}]` |
| **3. Verify** | 1 agente cético por achado → veredito + (quando possível) confirmação ao vivo | `verdict ∈ {real, false_positive, by_design, low_value, uncertain}` + file:line/repro |
| **4. Synthesize** | só o que é `real`/`absent` e VALE → relatório + fix-prompts | markdown + `fixPrompts[]` |

Entrada padrão: `{ date, repoRoot, reportDir, groundTruth }`.
Saída padrão: `{ domain, findings, fixPrompts, markdown }`.

## Orquestrador

`.claude/workflows/dev-loops.js` — roda os domínios e unifica:

1. Dispara os loops de domínio (paralelos quando independentes; via `workflow(nome, args)`
   inline — aninhamento é 1 nível, então cada domínio usa `parallel()`/`pipeline()` de
   **agentes** internamente, não sub-workflows).
2. **Dedupe cross-domínio** (ex.: um endpoint sem auth aparece em segurança E produção).
3. Relatório unificado `docs/dev-loops/REPORT-<date>.md`: uma seção por domínio + **uma
   lista de ação priorizada** (severidade × impacto × esforço).
4. (Camada 3) opcional: encaminhar `fixPrompts` verificados para um loop de implementação
   em worktrees com testes, e um verificador final confirma.

## Os 4 domínios

### 1. Visual/UX — ✅ existe (Camada 1)
Sinal: screenshots CDP segmentados + console errors + `intent` por rota.
Verificador: lê o código + barra de valor (`low_value`). Já em prod.

### 2. Segurança
- **Collect:** código (migrations/RLS por tabela, `app/api/**`, edge functions, uso de
  env/`NEXT_PUBLIC_*`, MCP server) + **duas contas descartáveis A e B** em prod via
  `scripts/qa-loop/lib/qa-account.mjs`.
- **Analyze (fan-out por área):** RLS cross-tenant; auth/IDOR em cada rota/edge; segredos
  e exposição no bundle; abuso de IA/MCP (prompt injection, vazamento de contexto, custo
  sem limite); `npm audit` nos 3 workspaces. Checklist-semente = seção A do
  `PROMPT-ANALISE-NOTURNA.md`.
- **Verify (adversarial + computer-use):** para cada vuln candidata, um agente tenta
  refutar lendo a policy/guard real; para IDOR/RLS o **verificador executa o exploit ao
  vivo** (conta A tenta ler dados da conta B via REST/API e reporta o HTTP). `real` só se
  reproduz ou o caminho de código é inequívoco.
- **Saída:** vulns por severidade + fix-prompts (descritos, nunca aplicados — fix de
  segurança exige revisão humana).

### 3. Produção / runtime — (maior ROI: vê o que quebra de verdade)
- **Collect = telemetria REAL, não código:** Supabase MCP `get_logs` (api/postgres/edge/
  auth) + `get_advisors` (lints de segurança e performance); Vercel MCP `get_runtime_logs`
  + `list_deployments` + `get_deployment_build_logs`; Speed Insights / Web Vitals (baseline
  conhecida: INP 552ms, LCP 3.75s); saúde de webhooks (anomalias em `contract_events`/
  dedupe de pagamento via SQL).
- **Analyze:** clusteriza erros por assinatura, ranqueia por frequência × severidade, mapeia
  cada um ao caminho de código que o emite.
- **Verify:** confirma que o erro é ATUAL (timestamp recente, não log velho) e reproduz o
  gatilho onde for seguro; separa ruído esperado (401 de probe, 404 conhecido) de falha real
  via **allowlist** de erros aceitáveis (o ground-truth deste domínio).
- **Saída:** top falhas de runtime + regressões de performance + fix-prompts.

### 4. SEO / GEO — (conecta com o trabalho de GEO já feito)
- **Collect:** fetch do HTML **renderizado (SSR)** do domínio canônico (`www.kinevoapp.com`)
  + rotas-chave; parse de title/description/canonical/OG/Twitter/JSON-LD/robots/sitemap;
  Lighthouse SEO; e um check **GEO** (o conteúdo SSR contém de fato a resposta que uma IA
  citaria?).
- **Analyze:** auditoria SEO por página + lacunas GEO (answerability, completude de schema).
- **Verify contra o HTML real, não suposição:** ex.: "OG image faltando" só vale após fazer
  fetch da URL de `og:image` e checar 200 + dimensões; atenção ao gotcha do matcher do
  middleware (opengraph-image/twitter-image precisam de exclusão, senão 307→/login).
- **Saída:** gaps de SEO/GEO + fix-prompts.

## Ativos que já temos pra reaproveitar

- **Driver CDP / computer-use:** `scripts/qa-loop/drive.mjs` + `capture.sh` (login único,
  Chrome de debug descartável, captura segmentada).
- **Contas descartáveis em prod:** `lib/qa-account.mjs` (bootstrap/teardown) — base das
  duas contas A/B do loop de segurança.
- **Checklist de segurança:** `PROMPT-ANALISE-NOTURNA.md` seção A.
- **MCP conectados:** Supabase (logs/advisors/SQL) e Vercel (runtime logs/deploys) — o
  combustível do loop de produção.
- **Tripé Analyze→Verify→Synthesize com schemas:** `qa-visual-loop.js` é o template.

## Roadmap sugerido

1. **Produção/runtime primeiro** (maior ROI, menor risco — só leitura de telemetria; nenhuma
   conta nova nem exploit). Prova o contrato comum num 2º domínio.
2. **Segurança** (precisa das contas A/B e do verificador computer-use — mais peças).
3. **SEO/GEO** (fetch + parse; conecta com [[project-kinevo-geo]]).
4. **Orquestrador** unificando os 4 + dedupe + lista de ação única.
5. **Cadência:** agendar via `/schedule` (noturno ou por deploy) com notificação quando o
   relatório sair.
6. **Camada 3 (opcional):** loop de implementação que pega os fix-prompts verificados,
   aplica em worktree com testes, e um verificador final confirma — fecha o ciclo Replit.

## Decisões tomadas (14/jun/2026)

- **1º domínio a construir:** Produção/runtime.
- **Orquestração:** cada loop é disparável **isolado**, + um orquestrador "rodar todos".
- **Camada 3:** entra no escopo agora (desenho abaixo).

---

## Camada 3 — Loop de implementação (fecha o ciclo Replit)

> Pega os `fixPrompts` JÁ VERIFICADOS de qualquer loop de domínio e os aplica de forma
> autônoma e segura, com verificação dupla. É o "agente que conserta" do modelo Replit.

**Gatilho:** um conjunto de fix-prompts com veredito `real`/`absent` e impacto ≥ `med`,
aprovado pelo humano (gate explícito — nada entra sem o OK do Gustavo).

**Contrato por fix (pipeline, 1 item = 1 fix):**

| Estágio | O que faz | Guard |
|---|---|---|
| **1. Isolate** | cria worktree dedicado (`isolation: 'worktree'`) — fixes paralelos não colidem | 1 worktree por fix |
| **2. Implement** | 1 agente aplica SÓ aquele fix, seguindo o prompt + convenções do CLAUDE.md | escopo travado: não toca fora dos arquivos do prompt |
| **3. Verify (duplo)** | (a) `tsc` + lint + testes do workspace; (b) agente revisor adversarial lê o diff: resolve o achado? introduz regressão? respeita o escopo? | falha em qualquer → descarta o worktree |
| **4. Confirm** | para fix de UI, **computer-use** reabre a tela no CDP e confere o outcome do prompt | screenshot antes/depois |
| **5. Land** | só os fixes que passaram viram commits atômicos numa branch `dev-loops/<date>`; **push e deploy seguem exigindo OK humano** | nunca push automático |

**Invariantes de segurança:**
- Nunca commita em `main` direto; sempre branch isolada.
- Nunca faz push/deploy sem autorização (regra do projeto — auto-deploy Vercel).
- Fix de **segurança** nunca é auto-aplicado (só descrito) — risco alto demais.
- Cada fix é atômico e reversível; um fix que falha no verify é descartado sem poluir os outros.

**Reaproveita:** `isolation: 'worktree'` do Workflow; o driver CDP pra confirmação visual;
o padrão de verificação adversarial dos loops de detecção.
