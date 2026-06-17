# Prompt para o Claude Code — Auditoria completa do Modo Assistente (pré-produção)

> Cole o conteúdo a partir de "Você é..." no Claude Code, na raiz do repositório
> `kinevo`. Objetivo: auditoria 360° do **Modo Assistente** (harness, backend, frontend/
> design, funcionalidades, segurança, prontidão para produção) para destravar o trabalho
> de amanhã e colocar a funcionalidade no ar o quanto antes. Saída esperada: um relatório
> escrito + checklist de produção + lista de ações priorizadas.

---

Você é um(a) engenheiro(a) sênior fazendo uma **auditoria de prontidão para produção** do
**Modo Assistente de IA** do Kinevo (a aba "Assistente", ⌘K, conversas, voz e proativo).
Seja minucioso, cético e concreto. **Não altere código de produção** durante a auditoria
(exceto criar os arquivos de relatório pedidos); o objetivo é DIAGNOSTICAR, não consertar.
Onde propuser correção, descreva o patch — não o aplique sem eu aprovar.

## Princípios da auditoria
- **Baseie tudo em evidência do código.** Cite arquivo:linha em cada achado. Não suponha.
- **Classifique por severidade:** 🔴 Bloqueador (impede produção), 🟠 Alto, 🟡 Médio,
  🟢 Baixo/limpeza.
- **Verifique em loop (obrigatório):** cada área crítica deve ser checada **pelo menos
  duas vezes**, idealmente por caminhos diferentes (ex.: ler o código + rodar uma busca
  textual que contradiga sua conclusão). Veja "Loops de verificação" abaixo.
- Se houver subagentes disponíveis, **paralelize** as áreas (segurança, frontend, backend,
  evals) em investigações separadas e consolide.

## Mapa do que investigar (não se limite a isto)

Backend / harness:
- `web/src/lib/assistant/*` — `command-engine.ts` (motor de turno), `system-prompt.ts`,
  `context-builder.ts`, `tool-policy.ts`, `mcp-bridge.ts`, `hitl-types.ts`,
  `arg-validation.ts`, `rate-limits.ts`, `turn-trace.ts`, `proactive.ts`, `voice.ts`,
  `errors.ts`, `conversations.ts`, e `evals/*`.
- Rotas: `web/src/app/api/assistant/*` (command, chat, conversations/[id], execute-tool,
  voice, draft-message, winback-draft) e `web/src/app/api/cron/morning-briefing`.
- `web/src/lib/mcp/*` (55 tools, server, auth, cors, logger) e `web/src/lib/ai-usage/*`
  (metering, quota, usage-summary).
- Migrations relacionadas: `supabase/migrations/2*` (esp. 208 ai_platform, 209
  conversations, 211 assistant_turn_traces) e RLS.

Frontend / design:
- `web/src/components/assistant/*` (workspace: home, sidebar, conversation-view,
  command-bar; tool-confirmation-card; credit-meter) e a página `web/src/app/assistente`.
- Avalie a UX do fluxo HITL (card de confirmação), estados de erro/limite/cota, loading,
  vazio, acessibilidade básica e i18n (pt-BR). Confira consistência com a tela atual
  (home "O que vamos resolver hoje?", medidor de créditos, "Precisa de atenção").

Mobile (se houver paridade): `mobile/*` que consuma as rotas do assistente.

Docs: `docs/harness/*` (arquitetura, prompt, evals, guardrails) — confirme se o código
bate com o que está documentado e aponte divergências.

## Perguntas que a auditoria precisa responder

1. **Correção & consistência**
   - O system-prompt v2 está realmente sendo usado nos dois caminhos (command-engine e
     chat)? Sobrou alguma referência à tool fantasma `analyzeStudentProgress` no caminho MCP?
   - Os nomes de tools usados em prompts/evals existem em `ALL_MCP_TOOLS`?
   - Contexto temporal (data/hora/timezone) chega ao modelo em todas as superfícies?

2. **Segurança (peso máximo — é o que decide o go/no-go)**
   - **Isolamento por treinador:** toda tool/rota filtra por `trainer_id`/`coach_id`?
     Procure qualquer query que use service role sem escopo. Há teste de isolamento?
   - **HITL:** é impossível uma CONFIRM_TOOL ser executada sem o card? Confirme que elas
     chegam sem `execute` no bridge e que `/execute-tool` revalida tier+cota+args+rate-limit.
   - **Prompt injection:** mensagens do usuário/aluno não conseguem forjar `role:'system'`
     nem disparar ação sensível sem confirmação? Conteúdo de aluno (check-ins, formulários)
     entra no contexto — pode injetar instrução?
   - **Vazamento:** algum catch/resposta devolve stack, SQL, nome de tabela, UUID, ou
     nomes de tool ao cliente? Segredos no código/diff?
   - **Validação de args (G5):** cobre os alvos certos? Onde é best-effort/fail-open, isso
     é seguro (a tool checa posse na execução)?

3. **Quota, créditos e custo**
   - O metering cobra corretamente (turno ≥1, pesos, bulk)? Há risco de cobrança dupla
     entre o turno e o `/execute-tool`? O proativo consumir cota do treinador é aceitável?
   - Limites de rate (turno e sensível) cobrem todos os caminhos que gastam LLM?
   - Estime o custo por turno e por dia (proativo) com os modelos atuais (`gpt-4.1-mini`).

4. **Confiabilidade & operação**
   - Best-effort real? (trace, metering, push não derrubam a resposta.)
   - O cron `morning-briefing` está no `vercel.json`, autenticado por `CRON_SECRET`, e é
     idempotente/seguro para muitos treinadores dentro do `maxDuration`? Risco de timeout?
   - Migration 211 é aditiva e reversível? RLS correto? Falta índice/retention?
   - **Variáveis de ambiente necessárias** para produção: faça a lista completa
     (`OPENAI_API_KEY`, `CRON_SECRET`, Supabase, Stripe, `EVAL_TRAINER_ID` p/ evals, etc.)
     e aponte o que falta documentar.
   - Há **feature flag** para ligar/desligar o assistente por treinador/tier? Como é o
     rollout? O que acontece para tier free/sem cota (degrada pra GUI)?

5. **Testes & evals**
   - `npx tsc --noEmit` e `npx vitest run` passam? Liste o que está verde/vermelho.
   - Cobertura: cada CONFIRM_TOOL tem caso de eval garantindo o HITL? Lacunas?
   - A suíte comportamental (`RUN_EVALS`) está pronta para rodar (fixtures por resolução,
     `EVAL_TRAINER_ID`)? O que é preciso para rodá-la amanhã?

6. **Frontend / design / UX**
   - O fluxo end-to-end funciona na UI (enviar comando → executar/ler → card HITL →
     confirmar via execute-tool → refletir resultado)? Aponte gaps de estado (erro 402/429/
     422, loading, vazio).
   - Acessibilidade e i18n pt-BR; responsividade; consistência visual com a tela atual.
   - A resposta de voz é curta/falável de fato? Há UI para gravar/enviar áudio ou só texto?

7. **Performance**
   - Latência esperada por turno; `maxSteps`/`maxTokens` adequados; N+1 em context-builder
     ou nas tools; tamanho do system-prompt (cacheabilidade).

## Loops de verificação (faça, não pule)

Execute estes loops e registre o resultado de CADA passada:

1. **Loop de build/test (rodar 2×):** `cd web && npx tsc --noEmit` e `npx vitest run`.
   Rode uma vez, depois rode de novo após reler os achados — confirme estabilidade
   (sem flakiness). Não rode `*.live.test.ts` nem `RUN_EVALS` (precisam de env/staging),
   mas confirme que o modo integridade dos evals passa.
2. **Loop de segurança (2 passadas independentes):**
   - Passada A — leitura dirigida das rotas e tools procurando filtros de tenant e HITL.
   - Passada B — busca textual adversária para tentar PROVAR o contrário: ex.
     `rg "from\('"` em tools sem `trainer_id/coach_id`; `rg "service" `; `rg "execute"`
     no bridge; `rg "role:\s*'system'"`; `rg "error.message"` nas respostas.
     Se A e B divergirem, investigue até reconciliar.
3. **Loop de consistência doc×código:** para cada afirmação relevante em `docs/harness/*`,
   confirme no código. Liste divergências.
4. **Loop de revisão própria:** depois de escrever o relatório, releia-o uma vez tentando
   derrubar suas próprias conclusões (red team). Ajuste severidades.

## Entregáveis (crie estes arquivos)

1. `docs/harness/AUDITORIA-ASSISTENTE-<YYYY-MM-DD>.md` contendo:
   - **Sumário executivo**: go / no-go para produção + os 3–5 riscos principais.
   - **Achados por severidade** (🔴/🟠/🟡/🟢), cada um com: descrição, arquivo:linha,
     impacto, e correção proposta (sem aplicar).
   - **Matriz de segurança**: isolamento de tenant, HITL, injeção, vazamento, validação,
     rate-limit — status de cada.
   - **Checklist de prontidão para produção** (caixas marcáveis): migrations aplicadas,
     env vars, feature flag/rollout, monitoramento/logs, custo estimado, testes verdes.
   - **Lista de ações priorizadas para amanhã** (ordenada, com esforço estimado).
   - **Resultados dos loops** (saída resumida de tsc/vitest nas 2 passadas; achados das
     passadas de segurança).
2. Se encontrar bloqueadores, um apêndice `docs/harness/AUDITORIA-FIXLIST.md` com os patches
   propostos (diffs descritos), pronto para virar tarefas.

## Regras
- Não aplique correções de código nesta rodada (só os arquivos de relatório).
- Não rode testes live/eval que dependam de segredos ou banco de staging; apenas explique
  como rodá-los.
- Se algo estiver ambíguo, registre como "pergunta aberta" no relatório em vez de assumir.
- Ao final, me dê um resumo de 10 linhas: go/no-go, bloqueadores, e as 5 primeiras ações.
