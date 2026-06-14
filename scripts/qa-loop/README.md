# QA Visual Loop (Kinevo web)

Um "loop" no estilo orquestrador → verificador: dirige o app por CDP, captura
cada tela, e um fan-out de agentes de visão produz um relatório priorizado de
**regressões** + **melhorias** com prompts de fix prontos. Saída: só relatório
(nada toca o código sozinho).

```
capture.sh  ── computer-use ──>  shots/*.png + manifest.json
     │
     └──> Workflow qa-visual-loop  ── N agentes (1/tela) ──>  análise por visão
                    │
                    └──> síntese ──> docs/qa-loop/REPORT-<data>.md
```

## Pré-requisitos
- `npm run dev` rodando no `web/` (porta 3000, banco = PROD).
- Google Chrome instalado. O harness sobe uma instância **dedicada** de debug
  em `:9222` com profile descartável — **não toca** o seu Chrome logado.
- `node_modules/` local (já instalado: `playwright-core`). Fora dos workspaces
  do monorepo de propósito; `node_modules/` e `shots/` estão no `.gitignore`.

## Como rodar (manual)
```bash
cd scripts/qa-loop
./capture.sh                       # sobe Chrome, cria conta QA, captura telas
```
Depois, no Claude Code, dispare o Workflow apontando para o manifest:
> "rode o workflow qa-visual-loop com o manifest em scripts/qa-loop/shots/manifest.json"

(O agente lê o manifest, passa como `args` e o workflow gera o relatório em
`docs/qa-loop/REPORT-<data>.md`.)

Ao terminar, **teardown** da conta QA (o `capture.sh` imprime o comando exato):
```bash
node lib/qa-account.mjs teardown <trainerId> <authUserId>
```

## Peças
- `lib/env.mjs` — lê `web/.env.local` e localiza o `supabase-js` do monorepo.
- `lib/qa-account.mjs` — cria/destrói a conta QA descartável (auth → trainer →
  subscription trialing → 2 alunos). CLI: `bootstrap` | `teardown`.
- `drive.mjs` — conecta no Chrome via CDP (contexto default — `newContext()` é
  rejeitado por Chrome novo), faz login único e captura cada rota.
- `capture.sh` — orquestra o acima.
- `../../.claude/workflows/qa-visual-loop.js` — o Workflow de análise + síntese.

## Precisão (por que o loop não vira ruído)
Três defesas, todas em `drive.mjs` + o workflow:
- **Ground-truth por rota (`intent` em `ROUTES`)**: descreve o que a tela É e seus
  comportamentos *by-design* conhecidos (KPI em 0, grade da agenda em 05h, preview
  vazio sem slug…). Vai pro analisador E pro verificador — impede re-reportar design
  intencional como bug e cortar sugestão clichê. **Ao adicionar tela nova, escreva o `intent`.**
- **Captura em segmentos** (`captureSegments`): rola a página e tira vários shots
  limpos (a página inteira, não só a dobra) sem o artefato de costura do `fullPage`
  em listas virtualizadas/animadas. Para se a página não rolar (scroll interno, ex. /schedule).
- **Verificador julga VALOR, não só existência**: status `low_value` descarta
  cosmético (tooltip/microcopy/helper) que "não existe" mas não agrega — só sobra
  o que de fato corrige uso. Console errors viram regressão candidata (pega hydration mismatch).

## Estender
- **Mais telas:** edite `ROUTES` em `drive.mjs` — **inclua `intent`** (ver acima).
- **Fluxos interativos** (builder, sala de treino): adicione passos antes do
  `screenshot` (clicar, preencher) — cuidado com os gotchas do CDP QA (tour,
  wizard de preferências, header auto-hide, inputs React via `pressSequentially`).
- **Agendar:** use o skill `/schedule` para rodar `capture.sh` + workflow num cron
  (ex.: a cada deploy ou diariamente) e te notificar quando o relatório sair.

## Gotchas aprendidos
- `connectOverCDP` exige um Chrome com ao menos 1 aba; **não** chame
  `browser.close()` (deixa o Chrome com 0 targets e quebra a próxima conexão).
- Skew de versão playwright↔Chrome quebra o handshake (`setDownloadBehavior`);
  mantenha `playwright-core` recente.
- Remover nós do DOM (overlays) gera erros `removeChild` do React e polui o
  sinal de console — o driver **oculta** via CSS em vez de remover.
