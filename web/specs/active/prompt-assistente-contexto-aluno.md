# Prompt para o executor — Coluna de Contexto do Aluno (Fases F0 + F1)

Copie o bloco abaixo e cole no modelo executor, numa sessão nova, rodando a partir da raiz do
repo `~/kinevo`.

---

Leia e siga, nesta ordem:

1. `web/CLAUDE.md` — contexto e regras invioláveis do app web. **Ler inteiro antes de qualquer coisa.**
2. `web/specs/active/assistente-contexto-aluno.md` — a spec do projeto. Leia **inteira** (ela
   traz o design, o mapa do código, os contratos e os gotchas), mas você vai executar **somente
   as Fases F0 e F1** da seção "§7 Plano faseado".

Você **NÃO** vai executar F2 nem F3. As "Decisões em aberto" (§10 da spec) **não são suas para
tomar** — se algum passo parecer depender delas, pare e reporte. A spec foi escrita contra o
main `434c3a3` (10/jul/2026); linhas citadas podem ter derivado — confie em nomes de
arquivo/função e re-localize.

## Objetivo da sessão

Entregar o MVP da coluna de contexto do aluno no `/assistente` web: fundações de dados sem UI
(F0) + o painel single-select interativo (F1), com dark mode, critérios de aceite do §8
cumpridos e QA E2E feito.

## Antes de editar qualquer arquivo

1. **Baseline de testes**: rode a suíte web (`tsc`, `eslint`, testes) ANTES de mudar qualquer
   coisa e registre as falhas pré-existentes. Sua entrega não pode adicionar nenhuma falha nova
   — e você não é responsável por consertar as que já existiam.
2. Produza um **plano de execução** e **aguarde aprovação** antes de editar. O plano deve ter:
   - Passos ordenados, cada um com os arquivos que vai tocar e o critério de pronto.
   - Ordem que mantém o repo compilando entre passos (F0 inteira antes da UI; extrações de
     `attentionKind`/aderência com a home e a página do aluno re-consumindo no MESMO passo).
   - Confirmação explícita de três pontos que a spec manda verificar no código:
     a) qual helper de início de semana (segunda-feira) a página do aluno usa hoje e como você
        vai reusá-lo;
     b) a assinatura exata da função de aderência extraída e a prova de que
        `/students/[id]` continua com comportamento idêntico (quais testes cobrem);
     c) onde vai morar a extração de `attentionKind`/`KIND_TAG`/`attentionPrompt`
        (módulo novo `lib/assistant/attention.ts` vs ampliar `workspace/ui-util.ts`) e por quê.
   - Riscos/ambiguidades que você prevê.

Se durante a execução algo contrariar o plano ou a spec, **pare e reporte** antes de desviar.

## Guardrails desta sessão (além do §9 da spec)

- **O working tree contém mudanças NÃO relacionadas em andamento** (frente de
  formulários/avaliações: arquivos em `mobile/`, `web/src/actions/forms/`, cron de insights,
  training-room, e a migration untracked `supabase/migrations/238_*`). **Não toque, não
  reverta, não "arrume" e não inclua nada disso no seu trabalho.** Se um arquivo que você
  precisa editar já estiver modificado por essa frente, pare e reporte.
- **NÃO faça commit nem push de nada.** A entrega fica no working tree para revisão por outra
  sessão. (Exceção: se o Gustavo pedir explicitamente durante a sessão.)
- **Nenhuma migration, nenhum `gen:types`, nenhuma tool MCP nova.** Se parecer necessário,
  você está desviando da spec — pare e reporte.
- Não altere o motor do turno (`use-assistant-thread.ts` além de consumir a API pública,
  `command-engine.ts`, rotas de turno) nem o comportamento existente da home/rail fora do que
  a spec pede (G4 é a única mudança de comportamento na home).
- Estilo: Shield Strategy obrigatória em todo elemento novo (light hex + par `dark:` com os
  tokens semânticos), usando os pares mapeados no §2.3 da spec.

## Definição de pronto

1. **Critérios do §8 da spec, um a um** — para cada um, evidência concreta (teste, comando ou
   passo de QA reproduzível).
2. `tsc` 0 erros, `eslint` 0 erros, suíte web sem falhas novas versus o baseline.
3. Testes novos: rota `student-context` (posse/404, payload completo, aluno sem programa, sem
   histórico, `readOnly`), função de aderência extraída (paridade com o cálculo antigo) e
   módulo de atenção extraído.
4. **QA E2E local via CDP** (gotchas do §9: modal "Bem-vindo", `networkidle` nunca chega,
   escopar seletores no `aside`): fluxo completo rail→painel→badge de alerta→composer
   preenchido→Agir; botão Mensagem terminando no card HITL com "Enviar"; Perfil e Programa
   navegando; colapso/reabertura persistindo; estado vazio; painel dentro de conversa escopada
   (sem ×); dark mode. Capture screenshots dos 4 estados (aberto/colapsado/vazio/dark).

## Relatório de execução (obrigatório)

Ao terminar, crie `web/specs/active/assistente-contexto-aluno-execucao.md` com:

- Lista completa de arquivos criados/modificados (e nada além deles no seu diff).
- Tabela: critério do §8 → como foi verificado (comando/evidência/screenshot).
- Desvios da spec, se houve, com justificativa (idealmente nenhum sem reporte prévio).
- Pendências e follow-ups que você identificou (sem implementá-los).
- Instruções de teste manual para o Gustavo (passo a passo, 5 minutos).

Esse relatório + o diff do working tree serão a base da **revisão final, feita por outra
sessão**. Escreva-o para esse leitor.
