# Execução de treino do aluno — modos "Lista completa" e "Um por vez" (foco)

## Status
- [x] Rascunho (plano)
- [x] Em implementação — **Fases 0-5 CONCLUÍDAS (08/jul)** no simulador; todas com smoke visual aprovado. Working tree, não commitado. Decisões D1-D5 fechadas e honradas.
- [ ] Concluída (falta apenas: QA em **device físico** — Watch/offline + smoothness do player inline; commit + build EAS 1.5.7). Simulador 100% validado.

## Contexto

Aprimorar a tela de execução de treino do aluno (`mobile/app/workout/[id].tsx`). O handoff de design (`~/Desktop/design_handoff_execucao_treino/`) adiciona:

1. Um **toggle de preferência** no cabeçalho — **Lista completa** vs **Um por vez** (foco) — **persistido por aluno**.
2. **Lista completa**: comportamento atual, mas com separação clara — só o exercício **atual** fica expandido (grade de séries); os demais recolhem numa linha-resumo.
3. **Um por vez (foco)**: um item por vez, navegação por swipe + botão "Próximo", e um **player de vídeo do YouTube ancorado embaixo que cresce conforme o aluno rola** (138→452px).

**Estado atual (mapeado no código):** hoje NÃO existe conceito de modo/foco/exercício-atual — todos os cards renderizam sempre expandidos numa `ScrollView` (`[id].tsx:990-1077`). A tela monta um `renderList` unificado (`section_header | warmup_cardio | note | superset | exercise`) via `useMemo` (`[id].tsx:854-940`) e delega a cada componente.

**Lacuna crítica do handoff:** o protótipo desenha **só exercícios simples** (grade de 3 séries peso/reps). **Não cobre supersets, métodos avançados (drop-set/pirâmide/cluster/5x5/top+backoff), cardio nem aquecimento** — que são o coração do produto e a exigência explícita do dono ("um superset ou qualquer método precisa funcionar corretamente"). Este plano define o comportamento desses casos em cada modo.

## Objetivo

Entregar os dois modos de execução **reaproveitando a lógica e os componentes existentes**, sem tocar no contrato de dados (`set_logs`), na sincronização com o Watch, na fila offline nem no hook `useWorkoutSession`. Modo lista/foco é **100% camada de apresentação** — projeções visuais diferentes do mesmo array plano `exercises[]`.

## Princípio arquitetural central

Tudo se apoia em três fatos verificados no código:

- **O modo é UI pura.** Não há "exercício atual" hoje; um `activeIndex` + navegação por-página é **estado local de tela**, sem tocar hook/banco. O progresso já deriva de `exercises[].setsData` (fonte única).
- **A unidade de foco é UM `RenderItem`, não uma série nem um filho de superset.** O `renderList` (`[id].tsx:854-940`) já produz exatamente as unidades certas. O modo foco **pagina sobre o `renderList`**; o modo lista **renderiza a lista com colapso**. Ambos consomem os mesmos itens e os mesmos callbacks (`onSetChangeStable`/`onToggleSetCompleteStable`/`openSwapModal`, ancorados em `globalIndex`).
- **Refatoração-chave: extrair `<ExerciseBody>` do `ExerciseCard`.** Hoje `ExerciseCard.tsx` é monolítico (chrome + corpo). Extrair o corpo (cabeçalhos de coluna + loop de `SetRow`/`RestConnector` + layout composto por `round_number`, hoje `ExerciseCard.tsx:166-202,305-440`) num componente reutilizável que `ExerciseCard`, `SupersetGroup` e as páginas de foco consomem. Padronizar os callbacks no caminho **Global + `globalIndex`** (eliminando as closures locais do `SupersetGroup.tsx:101-104`).

## Escopo

### Incluído
- Toggle de modo no cabeçalho, persistido por aluno (MMKV, novo `workoutViewModeStore` espelhando `themePreferenceStore`).
- Cabeçalho compartilhado redesenhado (voltar, eyebrow+título, timer, toggle, barra de conclusão).
- Modo Lista completa com colapso do não-atual (linha-resumo) e expansão do atual.
- Modo Foco: pager por `RenderItem`, botão "Próximo/Voltar" fixo, swipe, e player de vídeo expansível.
- Estado vazio "vídeo indisponível" no modo foco.
- Extração de `<ExerciseBody>` e padronização de callbacks (refatoração interna, sem mudança de comportamento).
- Comportamento explícito de superset/métodos/cardio/aquecimento nos dois modos.

### Excluído
- Qualquer mudança em `useWorkoutSession`, `set_logs`, hidratação de `setScheme`, contrato Watch, fila offline, snapshot MMKV.
- Gravação de novos campos (%1RM/RIR/tempo/set_type continuam **hints de leitura**, não persistidos).
- Migration de banco / coluna de preferência em `students` (preferência é local).
- Mudanças no builder do treinador ou na prescrição.
- Bundlar fonte (Plus Jakarta Sans **já está no app**).

## Decisões de produto necessárias (com recomendação)

> O handoff deixou estes pontos em aberto ou não os cobre. Recomendação padrão indicada; confirmar antes da Fase 3-4.

**D1 — Vídeo de um SUPERSET no modo foco. ✅ DECIDIDO (08/jul):** o superset (página única) TEM o player expansível, com um **botão para alternar entre os vídeos** dos exercícios do grupo. O `GrowingVideoPlayer` recebe uma lista de fontes (uma por filho) + um seletor (chips/segmented com os nomes dos filhos); default = filho da rodada atual (`computeRoundInfo`), mas o aluno troca manualmente pelo botão. Exercício sem vídeo → item desabilitado no seletor / estado vazio.

**D2 — Cardio/Aquecimento no modo foco. ✅ DECIDIDO (recomendação):** páginas do pager **sem o player expansível** (mostram `CardioCard`/`WarmupCard` inteiros; o botão "Próximo" fixo permanece).

**D3 — Colapso no modo lista. ✅ DECIDIDO (08/jul):** "atual" = primeiro item do `renderList` com alguma série incompleta, expandido por padrão; os demais viram linha-resumo. **Tocar num card recolhido o re-expande** (multi-expansão por toque; o "atual" é só o default). Preserva a liberdade de editar qualquer exercício.

**D4 — Métrica da barra de conclusão. ✅ DECIDIDO (recomendação):** a barra mostra **exercícios concluídos** (exercício = todas as `setsData` completas). O **gate de "Finalizar" continua por séries** (invariante 8). Ambos derivam do mesmo array; sem mudança de dado.

**D5 — Player crescente: player real vs. capa+modal. ✅ DECIDIDO (08/jul):** prototipar o **player real** cedo (Fase 4). Se o WebView não sustentar o resize suave, **fallback:** container que cresce com **thumbnail do YouTube** + play; toque abre o `ExerciseVideoModal` (reprodução real). Crescimento visual preservado; reprodução no modal robusto.

## Fases de implementação

### Fase 0 — Fundação (refatoração invisível, sem mudança de comportamento)
Extrair e padronizar para destravar os dois modos sem duplicar lógica.
- Novo `mobile/components/workout/ExerciseBody.tsx`: recebe `setsData`, `setScheme`, `methodKey`, `rounds`, `previousSets`, `globalIndex`, e os callbacks Global (`onSetChangeGlobal`, `onToggleSetCompleteGlobal`, `onSetCompleteGlobal`). Contém os cabeçalhos de coluna + layout composto por `round_number` + loop de `SetRow`/`RestConnector` (migrado de `ExerciseCard.tsx:166-202,305-440`).
- `ExerciseCard.tsx` vira chrome (BlurView, header, chip de método, "carga anterior", badge substituído, botões swap/vídeo) + `<ExerciseBody>`.
- `SupersetGroup.tsx` passa a fornecer `globalIndex` por filho e consome `<ExerciseBody>` via `ExerciseCard` no caminho Global (elimina as closures locais de `:101-104`).
- **Sem mudança visual.** Critério: pixel-paridade com hoje; `tsc` limpo; QA de um treino com superset + drop-set + cardio idêntico ao atual.
- Arquivos: `components/workout/{ExerciseBody(novo),ExerciseCard,SupersetGroup}.tsx`, `app/workout/[id].tsx` (só ajuste de props de callback se necessário).

### Fase 1 — Cabeçalho compartilhado + toggle + preferência persistida
- Novo `mobile/stores/workoutViewModeStore.ts` (Zustand + MMKV `kinevo-workout-viewmode`, fallback in-memory; espelha `themePreferenceStore.ts:10-53`). Estado `mode: 'lista' | 'foco'`, default `'lista'`.
- Redesenhar o cabeçalho de `[id].tsx:962-982` conforme handoff: botão voltar (38×38, raio 13, sombra), eyebrow (`DIA A · HIPERTROFIA` — derivar de `exerciseFunction`/nome do dia) + título, timer (tabular-nums), **segmented control** (`Lista completa`/`Um por vez`, ícones `list`/`scan`, `Haptics.selectionAsync()` na troca), e barra de conclusão (D4).
- Nesta fase os dois segmentos renderizam **o mesmo corpo atual** (lista sem colapso) — só o cabeçalho e a persistência entram. De-risca o toggle antes dos modos.
- Arquivos: `stores/workoutViewModeStore.ts` (novo), `app/workout/[id].tsx` (header), possível `components/workout/WorkoutModeToggle.tsx` (novo, reusa padrão do `AssistantModeToggle`).

### Fase 2 — Modo Lista completa (colapso do não-atual)
- Derivar `currentRenderIndex` = primeiro `RenderItem` com série incompleta (helper puro sobre `renderList`).
- Card de exercício recolhido = linha-resumo (pílula numérica + nome + meta + chip de status: Concluído/Em andamento/A fazer, cores do handoff). Card atual = expandido (chrome + `<ExerciseBody>`), com borda/sombra roxa. Toque expande recolhidos (D3).
- Superset e cardio/aquecimento também recolhem numa linha-resumo quando não são o atual (o `SupersetGroup` ganha um modo "resumo").
- Arquivos: `app/workout/[id].tsx` (render da lista + estado de expansão), `components/workout/{ExerciseCard,SupersetGroup,CardioCard,WarmupCard}.tsx` (prop `collapsed`/summary line), possível `components/workout/ExerciseSummaryRow.tsx` (novo).

### Fase 3 — Modo Foco (pager por RenderItem, sem player crescente ainda)
- Pager horizontal sobre o `renderList` (pulando `section_header`/`note` como páginas — exibir o header da seção como faixa no topo da página seguinte). Uma página = um `exercise` | `superset` | `warmup_cardio`.
- Navegação: swipe (gesture-handler + Reanimated, ou `react-native-pager-view` se preferir — **não há pager lib hoje**; avaliar adicionar) + botão fixo "Próximo/Voltar" (`[id].tsx` novo bloco fixo, layout do handoff). Auto-avanço opcional reusando sinais existentes (`computeRoundInfo.allDone`, `setsData` todas completas).
- Cada página reusa `<ExerciseBody>`/`SupersetGroup`/`CardioCard`/`WarmupCard` com os mesmos callbacks e `globalIndex`. Superset e cardio/aquecimento conforme D1/D2.
- Vídeo nesta fase: botão "Vídeo" → `ExerciseVideoModal` existente (o player crescente entra na Fase 4).
- Arquivos: `app/workout/[id].tsx` (container de modo + pager), `components/workout/WorkoutFocusPager.tsx` (novo), reuso dos cards.

### Fase 4 — Player de vídeo expansível (foco) + estado vazio
- Player ancorado embaixo (raio 26px topo), altura mapeada ao scroll da área de séries: `h = clamp(138, 452, 138 + scrollY*(452-138)/190)` via `useAnimatedScrollHandler` + `interpolate` (Reanimated, thread de UI). Controles sobre o player (handle, chip "Demonstração", "Tela cheia" → `ExerciseVideoModal` fullscreen).
- Reprodução: `react-native-youtube-iframe` (D5 — prototipar real; fallback thumbnail+modal). Toque alterna play/pause.
- Estado vazio "Vídeo indisponível" quando `video_url` é nula.
- Cardio/aquecimento: sem player (D2).
- Arquivos: `components/workout/GrowingVideoPlayer.tsx` (novo), `app/workout/[id].tsx` (só no modo foco), reuso de `lib/youtube.ts` e `ExerciseVideoModal.tsx`.

### Fase 5 — Polimento + QA
- Motion/haptics do handoff (scale 0.97 spring, `selectionAsync` no toggle, durações). Dark mode dos novos componentes (a tela hoje usa BlurView; conferir tokens `useV2Colors`).
- QA em simulador (fluxo completo) **e device físico** (Watch: garantir que marcar série nos novos containers ainda espelha `SET_COMPLETE_FROM_PHONE` e que o finish/retomada funcionam offline).

## Invariantes a preservar (não quebrar)

1. Superset nunca vira exercícios soltos — identidade só por `supersetId` (=`parent_item_id`); manter o re-agrupamento em `renderList` + `sortExerciseItems`.
2. Execução do superset é **por rodada** (alternando filhos) — `computeRoundInfo`; não fatiar por filho.
3. Descanso do superset é **por filho, o último carrega o rest da rodada** (`program-builder-store.ts:659-671`; timer em `[id].tsx:99-121`).
4. Filho de superset **não tem método** (regra V1: `set_scheme:null, method_key:null, rounds:1`).
5. `rounds>1` gera N `set_logs`; a UI agrupa por `round_number` real (fix M5), nunca por fatiamento.
6. `set_number` é **flat** e é a chave de conflito do upsert `(workout_session_id, assigned_workout_item_id, set_number)` — não reindexar por rodada.
7. `globalIndex` = posição no array plano é o contrato de todos os callbacks de escrita/swap.
8. Progresso e gate de "Finalizar" contam sobre o array plano `exercises[].setsData`.
9. Só **peso + reps** são gravados; %1RM/RIR/tempo/set_type são hints de leitura.
10. Aquecimento **não persiste**; cardio persiste **1 log** com `item_config` serializado em `notes`.

## Restrições técnicas
- Não tocar `useWorkoutSession.ts`, `set_logs`, `hydrate-workout-sets.ts`, contrato Watch (`getProgramSnapshotForWatch`, `finishWorkoutFromWatch`), fila offline (`pendingSetLogQueue.ts`), snapshot (`workoutStatePersistence.ts`).
- **Gotcha RN Pressable (RN 0.81/Fabric):** `Pressable` com `style` como função-arrow inline retornando objeto literal **NÃO pinta `backgroundColor`**. Usar `PressableScale`, `TouchableOpacity` ou `StyleSheet.create` — nunca `style={() => ({backgroundColor})}`. Vale para moldura do superset, chips de método, badge de rodada, círculo de check.
- `flex:1` dos inputs de peso/reps (`SetRow.tsx:186,233`) pode colapsar dentro de um pager de largura fixa — garantir largura definida na página.
- Mudanças cirúrgicas; reusar `SetRow`, `RestConnector`, `SetTypeBadge`, `ExerciseVideoModal`, `RestTimerOverlay`, `PressableScale` sem reescrever.

## Riscos técnicos
1. **[ALTO] Player YouTube que cresce com o scroll.** WebView redimensionado a cada frame pode reflow/recarregar e brigar por toques com o swipe do pager. Mitigação: prototipar cedo (Fase 4, D5); fallback thumbnail+modal. Isolado como última fase para o resto embarcar independente.
2. **[MÉDIO] Swipe do pager × gestos do WebView/scroll interno.** Conflito de gesture-handler. Mitigação: `react-native-pager-view` (nativo, lida melhor) ou zonas de gesto delimitadas.
3. **[MÉDIO] Colapso no modo lista muda comportamento consolidado.** Alunos acostumados com tudo visível. Mitigação: D3 (toque re-expande) + o modo lista é o default e mantém todos acessíveis.
4. **[BAIXO] Superset/cardio no modo foco** — decisões D1/D2; começar simples.

## Persistência da preferência
`workoutViewModeStore` (Zustand + MMKV `kinevo-workout-viewmode`), padrão de `mobile/stores/themePreferenceStore.ts`. É preferência de UI local; **não** vai ao banco (a tabela `students` não tem coluna de preferência de UI e criar uma violaria "mudanças cirúrgicas"). Se um dia quiserem sincronizar entre devices/Watch, estender `students.notification_preferences`→`preferences` JSON é escopo de backend, fora daqui.

## Critérios de Aceite
- [ ] Toggle Lista/Foco funciona e a escolha **persiste** entre execuções (MMKV).
- [ ] **Superset**: no modo lista renderiza a moldura com rodadas e descanso corretos; no modo foco é UMA página com o grupo inteiro; séries gravam sob o item-filho certo (`set_logs` idênticos ao atual).
- [ ] **Método avançado** (drop-set/pirâmide/cluster/5x5/top+backoff): grade por rodada/linear idêntica ao atual nos dois modos; `set_number` flat preservado; badges e "Meta:" corretos.
- [ ] **Cardio/aquecimento**: cards com timer funcionam nos dois modos; cardio grava 1 log, aquecimento não persiste.
- [ ] Marcar série, editar peso/reps, trocar exercício, timer de descanso, retomar treino, finalizar e Watch (espelhamento/finish) — **inalterados**.
- [ ] Modo foco: navegação por swipe + botão fixo; player cresce ao rolar (ou fallback D5); estado "vídeo indisponível".
- [ ] Sem novos erros de TypeScript; `npm test` verde.
- [ ] Retrocompatível; testado no fluxo principal em device físico (incl. Watch).

## Testes Requeridos
### Lógica pura (unitários — obrigatório)
- [ ] Helper de `currentRenderIndex` (primeiro item com série incompleta) — casos: nada feito, meio, tudo feito, superset no meio.
- [ ] Helper de progresso por exercício (D4) — exercício parcialmente completo, superset, cardio.
- [ ] `workoutViewModeStore` — default, set, persistência (mock MMKV como em `themePreferenceStore`).
- [ ] Mapeamento `renderList` → páginas do pager (superset = 1 página; método composto = 1 página; section_header/note não viram página própria).
### Componentes (fluxos críticos — opcional)
- [ ] `ExerciseBody` renderiza layout composto (rounds) e linear com os mesmos `SetRow`s de antes (snapshot/estrutura).

## Edge Cases
- Superset com filho sem vídeo (D1); exercício sem `video_url` (estado vazio D5).
- Treino só de cardio/aquecimento (sem exercício de força) no modo foco.
- Retomar treino no meio: o "atual" (lista) e a página inicial (foco) devem cair no primeiro item incompleto.
- Trocar de modo no meio da execução não perde estado (mesmos `setsData`).
- Método composto onde `setScheme.length` não divide por `rounds` (fix M5) — agrupar por `round_number` real.
- Superset de 1 rodada; drop-set de 1 rodada.
- Offline: marcar série no modo foco enfileira igual ao modo lista.

## Arquivos Afetados
**Novos:** `components/workout/ExerciseBody.tsx`, `components/workout/WorkoutFocusPager.tsx`, `components/workout/GrowingVideoPlayer.tsx`, `components/workout/WorkoutModeToggle.tsx`, `components/workout/ExerciseSummaryRow.tsx`, `stores/workoutViewModeStore.ts`.
**Modificados:** `app/workout/[id].tsx` (header, container de modo, pager, render da lista), `components/workout/{ExerciseCard,SupersetGroup,CardioCard,WarmupCard}.tsx` (consumir `ExerciseBody`, prop `collapsed`/summary, callback Global).
**Reuso sem alterar:** `SetRow`, `RestConnector`, `SetTypeBadge`, `ExerciseVideoModal`, `RestTimerOverlay`, `PressableScale`, `lib/youtube.ts`.
**Intocáveis (lógica sagrada):** `hooks/useWorkoutSession.ts`, `lib/{finishWorkoutFromWatch,getProgramSnapshotForWatch,pendingSetLogQueue,workoutStatePersistence}.ts`, `shared/lib/hydrate-workout-sets.ts`.

## Referências
- Handoff: `~/Desktop/design_handoff_execucao_treino/` (`README.md`, `Execucao Treino Final.dc.html`, `kinevo-tokens.css`).
- Fonte Plus Jakarta Sans já bundlada (uso em `components/assistant/AssistantDashboard.tsx`).
- Tokens de marca: violeta `#7C3AED`, raio de card 20px, player 26px.

## Notas de Implementação

**Fase 0 — CONCLUÍDA (08/jul, working tree).** Extração verbatim, sem mudança visual.
- Novo `components/workout/ExerciseBody.tsx`: corpo (cabeçalhos de coluna + grade de séries + layout composto por rodadas) + helper puro `computeRoundLayout(setScheme, rounds)` (fonte única do agrupamento por rodada, fix M5 preservado). Recebe callbacks JÁ resolvidos (`onSetChange`/`onToggleSetComplete`) — agnóstico a local-vs-global.
- `components/workout/ExerciseCard.tsx`: agora é chrome (BlurView + header + chip de método + botões swap/vídeo) + `<ExerciseBody>`. Reexporta `SetData`/`PreviousSetData` (do ExerciseBody) para compat. Header usa `computeRoundLayout` para o resumo composto. Removidos imports mortos (`Check`, `RestConnector`, `SetRow`).
- `SupersetGroup.tsx` e os outros 3 consumidores (`training-room`, `program-builder/preview`, `workout/[id]`) **intocados** — a API pública do card não mudou; `ExerciseCard` resolve local/global internamente e repassa ao corpo.
- Validação: `tsc` 0, `eslint` 0, 374 testes verdes. Comportamento idêntico (JSX movido sem alteração).
- **Smoke visual APROVADO (08/jul, simulador iPhone 17 Pro)** via rota dev temporária (`app/qa-execucao-fase0.tsx`, criada e DELETADA) renderizando os 4 casos com mock: (1) exercício normal linear; (2) pirâmide (metas por série + badge Top + descansos per-set); (3) drop-set composto (3 rodadas × 2 fases, "RODADA k DE 3", check de rodada, conectores "Drop imediato · sem descanso"/"Fim da rodada", metas AMRAP/falha); (4) superset (moldura + "Rodada 2 de 3" + filhos via ExerciseBody + "Sem descanso"). Toggles interativos funcionando. Zero regressão. Truque da rota dev evitou semear dado em prod / RLS.
- **Padronização SupersetGroup→Global adiada** (não necessária p/ Fase 0; o corpo recebe callback resolvido, então ambos os modos o consomem sem o SupersetGroup mudar). Reavaliar na Fase 3 se o pager de foco precisar.

**Fase 1 — CONCLUÍDA (08/jul, working tree).** Header + toggle + preferência persistida. Dois segmentos ainda renderizam a mesma lista (branching vem nas Fases 2-4).
- Novo `stores/workoutViewModeStore.ts` (Zustand + MMKV `kinevo-workout-viewmode`, espelha themePreferenceStore; `mode: 'lista'|'foco'`, default `'lista'`).
- Novo `components/workout/WorkoutModeToggle.tsx` (espelha AssistantModeToggle; itens List/Scan; Pressable com style estático em array — seguro no gotcha RN 0.81; `Haptics.selectionAsync()` na troca).
- `app/workout/[id].tsx`: header redesenhado (voltar 38×38 arredondado+sombra, eyebrow "TREINO" + título, timer tabular + "tempo", toggle, barra de conclusão). Barra agora conta **exercícios** (D4: exercício = todas as setsData completas; aquecimento setsData vazio e cardio não-engajado não contam); **gate de Finalizar segue por séries** (`allSetsCompleted`, invariante 8). Novo memo `doneExercises/totalExercises` (o `completedSets/totalSets` fica intacto p/ o gate).
- Decisão do eyebrow: usado "TREINO" (estático). Enriquecer p/ "DIA A · OBJETIVO" precisa de nome do programa/dia — hoje só `workoutName` é carregado (`useWorkoutSession` fetch `assigned_workouts.name`); fica como follow-up (tocaria o load, fora do UI-only).
- Validação: `tsc` 0, `eslint` 0, 374 testes. **Smoke visual APROVADO (simulador iPhone 17 Pro, rota dev temporária criada+deletada):** header fiel ao design; toggle troca com haptic; **preferência PERSISTE após relançar o app do zero** (Lista→Um por vez→terminate+launch→reabre em foco). MMKV+zustand-persist confirmado E2E.

**Fase 2 — CONCLUÍDA (08/jul, working tree).** Modo Lista completa com colapso do não-atual (só o atual expandido). SEM tocar nos cards existentes (ExerciseCard/SupersetGroup/CardioCard/WarmupCard seguem servindo training-room/builder/foco-placeholder).
- Novo `components/workout/ExerciseSummaryRow.tsx`: linha-resumo (pílula numerada por status + nome + meta + chip Concluído/Em andamento/A fazer + chevron). Pressable com style estático (gotcha RN 0.81).
- Novo `components/workout/ExecutionExerciseCard.tsx`: card colapsável do player — linha-resumo + (expandido) divisor + ações Trocar/Vídeo + chip de método + `<ExerciseBody>` (reuso Fase 0). Anel roxo (borda+sombra) só no atual; callbacks Global+globalIndex ligados aqui.
- `app/workout/[id].tsx`: no modo `lista`, exercise → ExecutionExerciseCard; superset → linha-resumo recolhida OU (expandido) linha-resumo + SupersetGroup. Novos: estado `manualExpanded` (Set) + `toggleExpand` + memo `{listMeta, currentKey}` (número/done por item; atual = 1º item de trabalho incompleto). Modo `foco` = card/grupo completo como hoje (placeholder até Fase 3). Cardio/aquecimento/nota/section_header inalterados.
- Decisões honradas: D3 (atual expandido por padrão; toque re-expande recolhidos, reversível); D4 (barra por exercício já da Fase 1).
- Validação: `tsc` 0, `eslint` 0, 374 testes. **Smoke visual APROVADO** (rota dev temp criada+deletada): done→recolhido (check+Concluído), current→expandido com anel roxo+ações+grade, todo→recolhido (A fazer), superset→recolhido; **toque num "todo" expande** (chevron vira, grade aparece, sem anel) e recolhe de volta. Fiel ao Modo A do handoff.

**Fase 3 — CONCLUÍDA (08/jul, working tree).** Modo Foco: pager por item de trabalho + navegação. Vídeo ainda via ExerciseVideoModal (player crescente = Fase 4).
- Novos: `WorkoutFocusExercise.tsx` (página de foco de um exercício: eyebrow "EXERCÍCIO k DE n" + nome + meta + Trocar/Vídeo + card de instruções + `<ExerciseBody>`); `WorkoutFocusPager.tsx` (ScrollView horizontal pagingEnabled — JS puro, sem dep nativa; índice CONTROLADO: botão scrollTo, swipe reporta via onMomentumScrollEnd; cada página é um ScrollView vertical); `WorkoutFocusNav.tsx` (barra fixa Voltar/Próximo; "Próximo" vira "Concluir treino" no último item).
- `app/workout/[id].tsx`: modo `foco` renderiza pager+nav (o ScrollView da lista vira branch `lista`); `focusItems` = renderList sem section_header/note; `focusIndex` state + effect que aterrissa no item atual ao entrar no foco; superset/cardio/warmup como página inteira reusando SupersetGroup/CardioCard/WarmupCard; "Finalizar" fixo do rodapé escondido no foco (o "Concluir treino" da nav faz o papel, com o MESMO gate por séries).
- Invariante respeitada: superset = UMA página (grupo inteiro), não fatiado por filho.
- Validação: `tsc` 0, `eslint` 0, 374 testes. **Smoke visual APROVADO** (rota dev temp): página de foco fiel ao Modo B (eyebrow/nome/meta/Trocar+Vídeo/instruções/grade); **navegação por botão** (1→2→3, contador+label sincronizam, Voltar habilita/desabilita nas bordas); **navegação por swipe** bidirecional (sincroniza índice controlado); superset numa página só; último item → "Concluir treino ✓". Gotcha QA: swipe curto/companion-frio falha — swipe deliberado (com --duration) funciona.

**Fase 4 — CONCLUÍDA (08/jul, working tree).** Player de vídeo ancorado que cresce ao rolar (D5: thumbnail crescente + toque abre ExerciseVideoModal, em vez de WebView inline redimensionado — robusto).
- Novo `components/workout/GrowingVideoPlayer.tsx`: Animated.View (Reanimated) com altura interpolada do scrollY [0,190]→[138,452] clamp; thumbnail do YouTube (`img.youtube.com/vi/<id>/hqdefault.jpg`, id via `lib/youtube.extractYoutubeId`) + handle + "Demonstração" + "Tela cheia" + play central (toque → onOpenFullscreen = modal). Estado vazio "Vídeo indisponível" quando sem vídeo. D1 (superset): `childOptions` + chips de seleção (default 1º filho).
- `WorkoutFocusPager.tsx`: novo prop `scrollY` (SharedValue); páginas viram `Animated.ScrollView` com `useAnimatedScrollHandler` escrevendo contentOffset.y no scrollY (só a página ativa rola); reset scrollY=0 na troca de página.
- `app/workout/[id].tsx`: `focusScrollY = useSharedValue(0)` passado ao pager; `focusChildVideo` state (reset ao trocar item); GrowingVideoPlayer renderizado abaixo da nav (design: player no rodapé); D2 — cardio/aquecimento NÃO renderizam player; pageBottomPadding subiu (220/300) p/ dar range de scroll.
- Validação: `tsc` 0, `eslint` 0, 374 testes. **Smoke visual APROVADO** (rota dev temp): player colapsado (138) com thumbnail/controles; **cresce ao rolar** a área de séries (Reanimated, thread de UI); **estado vazio** sem vídeo (VideoOff + texto, sem "Tela cheia"); **seletor de superset (D1)** troca o vídeo (chip ativo + thumbnail muda). Gotcha conhecido (polish Fase 5): na troca por BOTÃO o player não colapsa instantâneo — colapsa ao rolar a nova página (o reset scrollY=0 no useEffect não reflete de imediato numa transição). Player REAL inline (youtube-iframe redimensionado) fica p/ avaliar em device (a smoothness não é medível por screenshot); o fallback thumbnail+modal é o embarcado.

**Fase 5 — CONCLUÍDA no simulador (08/jul, working tree).** Polish + haptics + validação do colapso.
- **Colapso na troca (o gotcha da Fase 4) — CORRIGIDO.** Causa-raiz: o `scrollY` compartilhado era escrito pelo handler de scroll de TODAS as páginas; a página que acabava de sair (ainda desacelerando o momentum, offset alto) continuava gravando seu offset DEPOIS do reset `scrollY=0` → o player "ressuscitava" grande e só colapsava quando a nova página era rolada. Fix em `WorkoutFocusPager.tsx`: (1) refatorado para um filho `FocusPage` por página, cada um com seu `useAnimatedScrollHandler` guardado por um `activeIndex` (SharedValue) — **só a página ativa escreve no `scrollY`**; (2) `enterPage(i)` centraliza a entrada: marca `activeIndex=i`, zera `scrollY`, e leva a lista de destino ao topo via `scrollTo({y:0})` imperativo (mantém player e lista coerentes). Vale para botão (useEffect) E swipe (onMomentumEnd).
- **Haptics** (regra 6 do CLAUDE.md) adicionados nos toques que faltavam: Voltar (Light), pills Trocar/Vídeo em `WorkoutFocusExercise`+`ExecutionExerciseCard` (selection), linha-resumo expandir/recolher em `ExerciseSummaryRow` (selection), play/Tela-cheia (Light) e chips de seletor de vídeo (selection) em `GrowingVideoPlayer`.
- **Dark mode:** confirmado que os 6 componentes novos (exceto o player) já usam `useV2Colors()`/tokens → adaptam ao tema por construção. `GrowingVideoPlayer` é superfície de mídia escura por design (fiel ao handoff), não muda com tema. Nenhuma mudança necessária.
- Validação: `tsc` 0, 374 testes. **Smoke APROVADO** (rota dev temp `qa-collapse-fase5`, criada+deletada): com o player CRESCIDO, tocar **Próximo** → colapsa na hora (page 2, lista no topo); **Voltar** → colapsa; **swipe** de página crescida → colapsa; e a página ativa AINDA cresce ao rolar (interação preservada). 4 cenários OK.
- **Resta só device físico:** Watch (marcar série nos novos containers espelhando `SET_COMPLETE_FROM_PHONE`, finish/retomada offline) + avaliar o player REAL inline (youtube-iframe) vs. o fallback thumbnail+modal embarcado. E2E com seed de treino real fica melhor no device. Depois: commit + build EAS 1.5.7.
