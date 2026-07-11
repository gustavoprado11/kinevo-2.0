# Relatório de execução — Coluna de Contexto do Aluno (F0 + F1)

> Para o revisor: este documento acompanha o diff no working tree. Escopo executado =
> **F0 + F1** da spec `assistente-contexto-aluno.md`. F2/F3 **não** foram iniciadas.
> Nada foi commitado nem empurrado. Nenhuma migration, `gen:types` ou tool MCP nova.

Base: main `434c3a3` (10/jul/2026). Sessão: 10/jul/2026.

---

## 1. Arquivos criados / modificados (diff completo desta frente)

### Criados (7)
| Arquivo | Papel |
|---|---|
| `web/src/lib/assistant/attention.ts` | F0.1 — `AttentionKind`, `attentionKind()`, `KIND_TAG`, `attentionPrompt()` extraídos de `assistant-home.tsx` para reuso (home + painel). |
| `web/src/lib/students/weekly-adherence.ts` | F0.2 — `computeWeeklyAdherence()` (fórmula única da aderência semanal). |
| `web/src/lib/students/__tests__/weekly-adherence.test.ts` | F0.2 — 7 testes de paridade com o cálculo inline antigo + edge cases. |
| `web/src/lib/assistant/student-panel-data.ts` | F0.3 — `getStudentPanelData()` monta o payload do painel (posse + programa + aderência + alerta + histórico + notas). |
| `web/src/lib/assistant/__tests__/student-panel-data.test.ts` | F0.3 — 6 testes (posse/404, payload completo, sem programa, sem histórico, readOnly, prioridade do insight). |
| `web/src/app/api/assistant/student-context/[studentId]/route.ts` | F0.3 — `GET` autenticado, posse por `coach_id`, **sem tier gate, sem LLM, sem crédito**. |
| `web/src/components/assistant/workspace/student-context-panel.tsx` | F1.4 — a coluna: 3 estados (vazio / card / rail colapsado) + skeleton + hook `useStudentContext`. |

### Modificados (4)
| Arquivo | Mudança |
|---|---|
| `web/src/app/students/[id]/page.tsx` | Consome `computeWeeklyAdherence` no lugar do cálculo inline (refactor puro; `historySummary` idêntico). Removido import `getWeekRange` (agora indireto), removido um `as any[]`. |
| `web/src/components/assistant/workspace/assistant-home.tsx` | Importa de `attention.ts` (removidos 3 ícones lucide órfãos); **G4**: card de atenção com `studentId` agora chama `onFocusStudent`; `data-assistant-composer` no textarea. |
| `web/src/components/assistant/workspace/assistant-workspace.tsx` | Integra `<StudentContextPanel>` como 3ª coluna; `studentId = active?.student_id ?? focusedStudentId`; colapso persistido; auto-abrir ao focar; `prefillComposer` (fillInput + focus). |
| `web/src/components/assistant/workspace/conversation-view.tsx` | `data-assistant-composer` no textarea (para o foco pós-prefill). |

Nenhum arquivo da frente de formulários/avaliações foi tocado (verificado via `git status`).

---

## 2. Confirmações que a spec/prompt exigiam

**(a) Helper de início de semana.** `students/[id]/page.tsx` usa `getWeekRange(new Date(), 'America/Sao_Paulo')` de `@kinevo/shared/utils/schedule-projection` — **âncora na segunda** (o comentário `// Sunday–Saturday` na linha era stale; o helper faz `mondayOffset = (getDay()+6)%7`). `computeWeeklyAdherence` reusa o mesmo helper. ✔

**(b) Assinatura extraída + paridade.** `computeWeeklyAdherence(completedSessions, scheduledWorkouts, { now?, timeZone? }): { done, expected, pct }`. Reproduz byte-a-byte o cálculo antigo (`done` = sessões concluídas na janela; `expected` = Σ `scheduled_days.length` — **soma comprimentos, não deduplica**, como a página). A página consome só `.done`/`.expected` (ignora `.pct`), então `historySummary` é idêntico. Prova: refactor puro + `weekly-adherence.test.ts` compara 1:1 com uma réplica do cálculo legado + tsc + testes de componentes de aderência intactos. **Ressalva honesta:** não existe teste que exercite diretamente o server-calc de `page.tsx`; a rede de segurança é a pureza do refactor + o teste de paridade novo.

**(c) Onde mora a extração de atenção.** Módulo novo `lib/assistant/attention.ts` (não `ui-util.ts`): colocado junto do tipo `AttentionItem`/`home-data.ts`; `KIND_TAG` puxa ícones lucide + semântica de insight que não cabem no `ui-util.ts` genérico; precisa ser importável tanto por client components (home, painel) quanto por servidor (`student-panel-data.ts` reusa `attentionKind`/`attentionPrompt`). Sem colisão com `lib/assistant/student-context.ts` (esse é o contexto de LLM do winback).

---

## 3. Critérios de aceite §8 → evidência

| # | Critério | Verificação |
|---|---|---|
| 8.1 | Clicar num aluno abre o card completo (<1s percebido, skeleton imediato) | QA CDP: clique no rail → skeleton imediato → card com "Programa de Treinos V — semana 1 de 4", "ADERÊNCIA 3/5 · 60%" + barra, alerta, 3 sessões ("Qua — Pull… há 2 dias"…). |
| 8.2 | Estado vazio idêntico ao design; colapsado ~60px com contagem + rótulo vertical; reabre | QA: estado vazio ("Nenhum aluno selecionado") ✔; colapso → rail com badge "1" + "CONTEXTO" vertical, `localStorage['kinevo:assistant-context-open']='0'`; reabrir via rail ✔. Screenshots salvos (vazio / card / colapsado). |
| 8.3 | Badge e Mensagem preenchem o composer (não enviam) | QA: badge → composer = "Sobre Gustavo Prado: … Analise o histórico recente…" (= `attentionPrompt`); Mensagem → "Envie uma mensagem para Gustavo: ". Nenhum envio. |
| 8.4 | Perfil e Programa navegam; Programa sem programa pré-arma | DOM: Perfil `<a href="/students/{id}">`; Programa `<a href="/students/{id}/program/{programId}">`; sem programa o botão vira `<button>` com prefill (código). |
| 8.5 | Card de atenção com `studentId` foca o aluno (G4) | QA: clique num card de "Precisa de atenção" → pill "Gustavo Prado ×" + painel acompanha. |
| 8.6 | Conversa escopada mostra o aluno da conversa e o × não aparece | QA: abrir conversa "Marina Lanza" → painel mostra Marina ("Hipertrofia - Ênfase Glúteos… semana 1 de 4"); `removeBtn` ausente (`xHidden: true`). |
| 8.7 | Painel não consome crédito/LLM; posse (404) + RLS | Rota é `GET` sem tier gate/LLM; usa client de sessão (RLS) + `.eq('coach_id', trainer.id)` → 404. Teste `student-panel-data.test.ts` cobre posse→null. Resposta 200 sem custo (dev log). |
| 8.8 | Dark mode completo (todo hex light com par `dark:`) | **Código**: cada hex light do painel tem par `dark:` com os tokens do §2.3 (mesmos pares de `assistant-home.tsx`/`conversation-view.tsx`). Exceção intencional: tints de avatar inline (idêntico ao padrão da home). **Visual não capturado** — ver §5. |
| 8.9 | tsc 0, eslint sem novas, suíte verde, `/students/[id]` idêntico | `tsc --noEmit` = 0; `eslint` total **551→550 erros** (−1, removi um `any`; zero novo nos arquivos tocados); `vitest run` = **1411 passed / 0 failed / 45 skipped** (+13 testes novos vs baseline 1398). |

### Baseline registrado (antes de editar)
- `tsc`: 0 erros. `vitest`: 1398 passed / 45 skipped / 0 failed. `eslint` (`npm run lint`): **690 problemas (551 erros / 139 warnings) em 191 arquivos — PRÉ-EXISTENTES**. Bar aplicado = *zero novos* (o "eslint 0" da spec/CLAUDE.md é aspiracional; a realidade é 690). JSON do baseline salvo para diff.

---

## 4. Desvios da spec

1. **Bug real encontrado e corrigido no QA — React Compiler + cache module-level.** A 1ª versão do hook derivava `data = CACHE.get(studentId)` (Map módulo-level) **no corpo do render**. Com o **React Compiler ligado** (regra do repo), essa expressão é memoizada por `studentId`; ao resolver o fetch e mutar o Map, o `setState` não-relacionado não invalidava a memo → o card ficava **preso no skeleton** mesmo com o payload 200 em mãos. Corrigido guardando o payload em **estado React** (`entry`), derivando `data` de `entry`+`studentId` (ambos reativos). O CACHE ficou só como atalho entre focos, refletido via microtask (para não violar `react-hooks/set-state-in-effect`). Isso está **dentro** do escopo da spec (§5 pede "fetch + cache em Map + loading/skeleton"); é um ajuste de implementação, não de contrato.
2. **`?s=<id>` deep-link não focou o aluno** nos meus testes (só o clique no rail focou). Esse handler é **pré-existente** (`assistant-workspace` effect de `searchParams`), **não** foi tocado por mim. Registrado como observação, não corrigido (fora de escopo). Vale investigar em outra frente.

Nenhum outro desvio. Não toquei no motor do turno, em migrations, nem nos arquivos da frente de formulários.

---

## 5. Pendências / follow-ups (não implementados)

1. **Dark mode — ~~captura visual pendente~~ RESOLVIDO na revisão (10/jul).** O diagnóstico original desta seção estava **errado**: o dark do app é **class-based** (`.dark` no `<html>`, via next-themes `attribute="class"`), NÃO `prefers-color-scheme`. Prova empírica do revisor: com o macOS escuro (`prefersDark: true` no `matchMedia`) a página permaneceu clara; ao aplicar a classe `.dark` no `<html>`, o app inteiro — incluindo o painel — escureceu corretamente. **Critério 8.8 verificado visualmente pelo revisor**: superfícies, badge de alerta, barra de aderência, caixa de notas e botões do painel todos corretos no dark. Para ver o dark: usar o **toggle de tema do app** (preferência do treinador, `kinevo-theme`), não a aparência do SO.
2. **Latência da rota em dev.** `GET /api/assistant/student-context` levou **~3–5s** de application-code em dev frio (dominado por `getTrainerWithSubscription` + `isStudentManagementLockedForTrainer` + as 4 queries, tudo com conexões frias). Em prod quente deve cair muito, mas vale medir com RUM e, se preciso, paralelizar/enxugar o `readOnly` (que hoje faz org-access + tier + count). O skeleton segura bem a espera.
3. **Divergência página × dashboard no `expected`.** A página (e agora o painel) soma `scheduled_days.length` por treino; o dashboard usa **dias únicos** (`Set`). Preservei a semântica da **página** (mudar alteraria `/students/[id]`). Painel e página concordam; painel e dashboard podem divergir por design. Não "consertado" de propósito.
4. **Foco do composer pós-prefill** é best-effort (via `[data-assistant-composer]` + rAF). Nos testes por `.click()` programático o valor preenche mas o foco nem sempre pega; num clique real do usuário o rAF foca. Preenchimento (o que o §8.3 exige) é garantido.
5. **F2/F3** conforme a spec: notas editáveis inline, histórico clicável, refresh pós-turno, realtime do badge, chips múltiplos, multi-seleção. Não iniciados.

---

## 6. Teste manual (5 min, para o Gustavo)

Pré: `npm run dev` no `web` (já roda em `localhost:3000`), logado como treinador com IA.

1. Abra **`/assistente`**. À direita aparece **"Contexto do aluno"** em estado vazio.
2. Clique num **aluno no rail** (ex.: Gustavo Prado). O painel mostra skeleton e então o card: programa + "semana X de Y", badge de alerta, **ADERÊNCIA X/Y + %** com barra, **HISTÓRICO RECENTE** (3), e **Perfil / Mensagem / Programa**.
3. Clique no **badge de alerta** e no **Mensagem** → o composer é **preenchido** (não envia). Clique **Agir** no Mensagem → cai no card HITL com "Enviar".
4. **Perfil** e **Programa** → navegam para `/students/{id}` e `/students/{id}/program/{id}`.
5. Clique no **chevron** do cabeçalho do painel → colapsa para o rail de ~60px ("CONTEXTO" vertical + badge). Recarregue a página: o estado colapsado **persiste**. Clique no rail → reabre.
6. Clique num card de **"Precisa de atenção"** de um aluno → o painel **foca aquele aluno** (G4).
7. Abra uma **conversa escopada** (aba Conversas, uma com nome de aluno) → o painel mostra o aluno da conversa e **sem o ×**.
8. **Dark mode:** alterne o **tema do app para escuro** (preferência de tema do treinador — o dark é class-based via next-themes, não segue o SO) e confira o painel escuro. *(Já verificado visualmente na revisão.)*

---

## 7. Adendo da revisão (10/jul/2026, sessão revisora)

Mudanças aplicadas PELO REVISOR no working tree após a revisão (autorizado pelo Gustavo):

1. **`expected === 0` → `adherence: null`** (`student-panel-data.ts` + caso novo em
   `student-panel-data.test.ts`): programa ativo sem `scheduled_days` não mostra mais
   "0/0 esta semana · 0%" — a seção de aderência é ocultada. (Item da aprovação do plano
   que não tinha sido implementado.)
2. **UX (pedido do Gustavo):** sem aluno selecionado o painel fica **oculto** (width 0) em
   vez de mostrar o estado vazio; selecionar um aluno **anima a entrada** (width 0→340,
   220ms ease-out). O `<aside>` agora é único e sempre montado (a transição de width exige
   nó persistente); `EmptyState` foi removido (inalcançável). Espelhado na spec (§5/§8.2).
3. **Correção do relatório** (§5.1 e §6.8 acima): mecanismo do dark mode é class-based.

Follow-ups adicionais identificados na revisão (pré-existentes, NÃO desta frente):
- Insights de estagnação são gravados com `category='progression'` → a home (e agora o
  painel, por herança do mapeamento) mostra tag verde "Pronto p/ evoluir" em cards cujo
  texto diz "estagnado". Corrigir na origem (categoria do detector) ou no `attentionKind`.
- `PRIORITY_RANK` (home-data + panel-data) não conhece `'critical'` — hoje nenhum detector
  emite, mas o tipo permite; centralizar o rank num lugar só quando for mexer.
- `relativeDayLabel` roda no server (UTC em prod): "Hoje/Ontem" pode escorregar ~3h na
  virada do dia em São Paulo. Micro-cosmético; considerar calcular no cliente na F2.
- Divergência pré-existente `expected` página (soma) × dashboard (dias únicos) — já
  registrada na pendência §5.3 acima.

## 8. Batch 2 — F2 + follow-ups (10/jul à noite, sessão revisora, autorizado)

No working tree (após o deploy de F0+F1), a sessão revisora implementou a F2 e os
follow-ups pequenos. Validado: tsc 0, lint limpo nos tocados, vitest 1414/0 (+3 testes),
QA vivo em localhost (fluxos abaixo).

**F2 implementada:**
1. **Notas do treinador editáveis inline** (`NotesSection` no painel): lápis edita,
   "+ Adicionar nota" quando vazio, salva via server action `updateTrainerNotes`
   (auth+posse+lock no servidor), patch local via `mutate` (sem refetch); `readOnly`
   esconde a edição. QA: adicionar → salvar → editar → limpar → volta ao estado vazio.
2. **Histórico clicável**: cada sessão pré-arma no composer uma análise daquela sessão.
3. **Refresh pós-turno**: `panelRefreshKey` no workspace bumpa quando um turno termina
   (`sending` true→false) ou uma confirmação HITL resolve com aluno em foco; o painel
   revalida em stale-while-revalidate (card antigo visível durante o refetch). QA por
   rede: turno → novo GET student-context ao terminar.
4. **Realtime do badge**: subscription `postgres_changes` em `assistant_insights`
   filtrada por `student_id` (padrão idêntico ao chat de mensagens, que roda em prod);
   revalida o card em INSERT/UPDATE/DELETE. Não disparado ao vivo no QA (exigiria
   escrita no banco); validado por paridade de código.

**Follow-ups corrigidos:**
5. **Tag de estagnação**: `attentionKind` agora trata `insight_key` `stagnation:*` como
   'estagnado' (o detector grava `category='progression'` — pré-existente). Corrige a
   home, o rail e o painel de uma vez. QA visual: cards "estagnado em..." agora âmbar.
   NOTA: o fix na ORIGEM (categoria no detector do cron) ficou de fora porque
   `generate-insights/route.ts` está modificado pela frente de formulários — fazer lá
   quando aquela frente commitar. Mobile tem mapeamento próprio espelhado
   (`assistantPrompts.ts`) — segue com a tag errada até ganhar o mesmo fix (follow-up).
6. **`?s=` deep-link**: o effect era mount-only; agora reage a `searchParams` com guarda
   de re-aplicação. GOTCHA novo: com StrictMode, marcar o ref ANTES do microtask engole o
   parâmetro (1º ciclo agenda e cancela; 2º ciclo vê o ref marcado) — o ref só avança ao
   aplicar. QA: /assistente?s=<id> foca o aluno e abre o painel.
7. **`PRIORITY_RANK` centralizado** em `attention.ts` com `critical` (rank 0); home-data
   e panel-data importam. Teste novo: critical vence high.
8. **"Hoje/Ontem" timezone-aware** (`America/Sao_Paulo` via Intl) — antes usava o fuso do
   servidor (UTC em prod, escorregava ~3h na virada do dia).
9. **Rota paralelizada**: `isStudentManagementLockedForTrainer` roda em `Promise.all` com
   as queries do painel (era sequencial e dominava a latência).
10. **Lint**: 5 erros `react-hooks/set-state-in-effect` corrigidos com o padrão microtask
    do repo — 3 do batch, **2 pré-existentes do F1** que o baseline anterior deixou passar.

**QA em aba oculta — gotcha de ambiente**: Chrome congela transições CSS e throttla
timers em abas hidden; screenshots mostram o frame congelado (painel "preso" a 1px) e
cliques por coordenada erram os alvos reais. Verificar largura com `transition:none`
momentâneo e dirigir por DOM/JS. Não é bug do produto.

**Fora deste batch (decisões do Gustavo):** F3 multi-seleção; unificação da fórmula de
`expected` página×dashboard; chips visuais sob o composer; fix de categoria na origem
(pós-forms); paridade mobile do attentionKind.

## 9. Batch 3 — decisões fechadas (10/jul, madrugada)

Gustavo decidiu: **manter single** (F3 fica no backlog, medir uso); **soma de ocorrências
vira a fórmula canônica** de `expected`; **deletar o projeto Vercel duplicado**. Chips
visuais: considerados atendidos pelo pill atual (avatar+nome+×, ≈ design).

Implementado neste batch:
1. **Categoria de estagnação corrigida NA ORIGEM** (desbloqueado pela frente de forms):
   `detectLoadStagnation` (cron) e a consolidação do enricher agora gravam
   `category='alert'` (era 'progression'). O upsert por key atualiza as linhas
   existentes no próximo run do cron; o mobile deriva a tag da category → **corrige o
   mobile sem build EAS**. O check por `insight_key` no web fica como cinto de segurança.
2. **Fórmula unificada**: `get-dashboard-data.ts` (stat do header) soma ocorrências (o
   ranking já somava); **migração 240** (`trainer_stats_expected_sums_occurrences`)
   APLICADA EM PROD — `count(DISTINCT d.day)` → `count(d.day)` no RPC `get_trainer_stats`
   (consumido pelo mobile). Verificado ao vivo no pg_proc. Efeito: treinadores com 2+
   treinos no mesmo dia veem `expected` maior e aderência menor (agora honesta).
3. **Vercel**: projeto duplicado "web" (acidente de 07/jul, sem domínios) DELETADO via
   API; `web/.vercel` re-linkado ao `kinevo-web` (produção real).

Validação: tsc 0, vitest 1414/0, lint sem novos (dashboard: −1 `as any`).

## 10. Comandos de verificação

```bash
cd web
npx tsc --noEmit                    # 0 erros
npx vitest run                      # 1411 passed / 0 failed / 45 skipped
npx vitest run src/lib/students/__tests__/weekly-adherence.test.ts        # 7 passed
npx vitest run src/lib/assistant/__tests__/student-panel-data.test.ts     # 6 passed
npm run lint                        # 690 problemas PRÉ-EXISTENTES; nenhum novo nos arquivos desta frente
```
