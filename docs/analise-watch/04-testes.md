# Investigação D — Testes do caminho Apple Watch

**Data:** 2026-06-11 · **Escopo:** `mobile/` (TS/JS) + `mobile/targets/watch-app/` (SwiftUI) · **Modo:** somente leitura

## Sumário

O caminho do Apple Watch tem **cobertura de testes automatizados praticamente zero**: não existe nenhum teste Swift no target do Watch (nenhum target de teste, nenhum arquivo `*Test*.swift`), e nenhum dos quatro módulos TS que alimentam o Watch (`getNextWorkoutForWatch.ts`, `getProgramSnapshotForWatch.ts`, `finishWorkoutFromWatch.ts`, `useWatchConnectivity.ts`) é referenciado por qualquer teste. A única cobertura existente é **indireta**: dois helpers usados por `getProgramSnapshotForWatch` (`hydrateWorkoutSets` e `sortExerciseItems`) têm testes próprios e passam. A suíte do mobile está saudável — **292 testes em 32 arquivos, todos passando** — e `tsc --noEmit` está limpo, ou seja, a infraestrutura (Vitest 4 + jsdom + aliases) já existe e adicionar testes ao caminho do Watch é só uma questão de escrevê-los. As unidades mais críticas sem cobertura são a gravação no Supabase (`finishWorkoutFromWatch.ts`, onde mora o risco de perda de treino) e o redutor de estado do Watch (`WorkoutExecutionStore.swift` + `WorkoutExecutionState.swift`, onde mora a lógica de merge/reconcile que decide quando estado local é preservado ou destruído).

---

## 1. Inventário — o que tem teste hoje

### 1.1 Swift (watch-app): NENHUM teste — confirmado

- `find mobile/targets/watch-app -name "*Test*"` → vazio. Não há diretório de testes, nem target XCTest, nem arquivo de teste.
- Arquivos Swift do Watch (13 arquivos, ~5.470 linhas) **todos sem teste**: `WorkoutModels.swift` (690 l), `Services/WorkoutExecutionStore.swift` (732 l), `Views/WorkoutExecutionView.swift` (1.402 l), `Services/WatchSessionManager.swift` (535 l), `Views/CardioExecutionView.swift` (477 l), `Services/HealthKitManager.swift` (396 l), `Models/WorkoutExecutionState.swift` (392 l), `Views/WorkoutListView.swift` (367 l), `Views/WorkoutDashboardView.swift` (204 l), `KinevoWatchApp.swift` (141 l), `Services/WorkoutStatePersistence.swift` (74 l), `KinevoTheme.swift`, `Views/NowPlayingView.swift`.
- **Severidade ALTA**: a lógica mais delicada do Watch (reducer de estado, merge de reconcile, decodificação de payload) vive 100% em Swift sem nenhuma rede de proteção.

### 1.2 TS/JS (mobile): 37 arquivos de teste, nenhum no caminho do Watch

A suíte existente (`vitest run`, config em `mobile/vitest.config.ts`, ambiente jsdom, include `**/*.test.{ts,tsx}`):

| Área | Arquivos de teste | Toca o Watch? |
|---|---|---|
| `lib/__tests__/` | cache, cache-keys, calculateWeeklyProgress, **hydrateWorkoutSets**, resolve-exercise-video, toast | hydrateWorkoutSets: **indireto** (ver abaixo) |
| `lib/` (soltos) | hrv.test.ts, resetPasswordMessage.test.ts, healthInsights/rules.test.ts, healthSync/shared.test.ts | não |
| `hooks/__tests__/` | 11 arquivos (useProgramBuilder, useCreateStudent, useDebounce, etc.) | **não — `useWatchConnectivity.ts` não tem teste** |
| `stores/__tests__/` | program-builder-store (2 arquivos) | não |
| `utils/__tests__/` | youtube, **sortExerciseItems** | sortExerciseItems: **indireto** |
| `theme/__tests__/` | responsive, design-tokens, breakpoints | não |
| `components/trainer/program-builder/__tests__/` | 4 arquivos | não |

### 1.3 Cobertura dos módulos que alimentam o Watch

Verificado por grep: **nenhum** arquivo `*.test.ts*` referencia `getNextWorkoutForWatch`, `getProgramSnapshotForWatch`, `finishWorkoutFromWatch` ou `useWatchConnectivity`.

| Módulo | Cobertura direta | Cobertura indireta |
|---|---|---|
| `mobile/lib/getNextWorkoutForWatch.ts` (206 l) | ❌ | — (e ver achado abaixo: código aparentemente morto) |
| `mobile/lib/getProgramSnapshotForWatch.ts` (319 l) | ❌ | ✅ parcial — usa `hydrateSetPrescriptions` (`lib/hydrateWorkoutSets.ts`, testado em `lib/__tests__/hydrateWorkoutSets.test.ts`) e `sortExerciseItems` (`utils/sortExerciseItems.ts`, testado em `utils/__tests__/sortExerciseItems.test.ts`) |
| `mobile/lib/finishWorkoutFromWatch.ts` (503 l) | ❌ | nenhuma |
| `mobile/hooks/useWatchConnectivity.ts` (216 l) | ❌ | nenhuma |
| `mobile/app/_layout.tsx` — componente `WatchBridge` (linha 44+; orquestra SESSION_SYNC, FINISH, auto-sync) | ❌ | nenhuma |
| `mobile/modules/watch-connectivity/src/WatchConnectivityModule.ts` | ❌ | nenhuma |

**Achado (severidade BAIXA — código morto):** `getNextWorkoutForWatch.ts` não é importado por nenhum arquivo do app (grep em `app/`, `components/`, `hooks/`, `lib/` só encontra o próprio arquivo). É o caminho legado v1, substituído pelo snapshot v2 (`getProgramSnapshotForWatch`). Testá-lo tem valor baixo; candidato a remoção em sessão futura (fora do escopo desta análise).

---

## 2. Execução das verificações

Comandos rodados em 2026-06-11 (script `test` confirmado no `mobile/package.json` como `vitest run` — já é one-shot, não watch-mode):

| Verificação | Comando | Resultado |
|---|---|---|
| Suíte de testes | `cd mobile && npm run test` | ✅ **32 arquivos / 292 testes — todos passaram** (3.6s, Vitest 4.1.2) |
| Type-check | `cd mobile && npx tsc --noEmit` | ✅ **limpo, zero erros** (exit 0, sem output) |

Nenhuma falha pré-existente; nada relacionado ao Watch falhou (porque nada do Watch é testado). As mudanças não commitadas no working tree (`mobile/package.json`, `package-lock.json`, `web/src/test/supabase-admin-stub.ts`) não afetaram os resultados e não foram tocadas.

---

## 3. Unidades críticas e os testes que deveriam existir

Critério: lógica pura/determinística, alto impacto em perda de dados ou execução errada de treino, e testável sem device (Swift puro via XCTest; TS via Vitest com mock do Supabase).

> Nenhum arquivo de teste foi criado — abaixo é a especificação do que escrever.

### U1 — Decodificação de payload no Watch (`WorkoutModels.swift`) — severidade ALTA

Funções `WatchWorkoutSnapshot.parse` (linha 269), `WatchExerciseSnapshot.parse` (185), `WatchSetDetail.parse` (93), `WatchProgramSnapshot.parse` (320), `WatchProgramWorkoutSummary.parse` (530), `WatchCardioItem.parse` (667). É a fronteira do dicionário `[String: Any]` vindo do WCSession — qualquer campo com tipo errado derruba o treino silenciosamente (`compactMap` engole exercícios inválidos).

| # | Input (dict) | Output esperado |
|---|---|---|
| 1 | Payload v2 completo e válido (programa com 2 treinos, supersets, setDetails) | Snapshot com todos os campos preenchidos, ordem preservada |
| 2 | `dict["program"]` ausente (hasProgram=false) | `WatchProgramSnapshot.parse` → `nil` (sem crash) |
| 3 | Exercício sem `id` ou sem `name` | Exercício descartado pelo `compactMap`; demais exercícios sobrevivem |
| 4 | Exercício sem `sets`/`reps`/`restTime` | Defaults: sets=3, reps=0, restTime=60 (`WatchProgramExerciseSummary.parse`, linhas 469-472) |
| 5 | `weight` ausente (peso nulo) | `weight == nil` (opcional), sem default 0 |
| 6 | `setDetails` com entry sem `setNumber` | Entry descartada; `setDetails` restante intacto |
| 7 | `setDetails` ausente | `setDetails == []` → caminho de sets uniformes |
| 8 | `scheduledDays` como `[NSNumber]` vs `[String]` | NSNumber → parseado; String → descartado (documentar comportamento atual: linha 543 só aceita NSNumber) |
| 9 | `scheduleMode` desconhecido (ex. "biweekly") | Fallback `.flexible` (linha 338) |
| 10 | `lastCompletedAt` ISO8601 com e sem frações de segundo | Ambos parseiam (`WatchDateParser.parseISO8601`, WorkoutExecutionState.swift:379) |
| 11 | Payload v1 legado (`hasWorkout`/`workout`) | `WatchProgramSnapshot.fromLegacy` → programa sintético `programId == "legacy"`, 1 treino |
| 12 | Cardio sem `config` | `WatchCardioItem.parse` → config default `mode == "continuous"` (linha 670-682) |
| 13 | `WatchExercise.parse` com `reps` como Double (15.0 via bridge) | **Edge real**: `as? Int` pode falhar com NSNumber double — verificar/fixar; teste documenta o contrato |

### U2 — Montagem do estado de execução (`Models/WorkoutExecutionState.swift`) — severidade ALTA

Funções puras: `makeExercise(from:)` (linha 205), `from(snapshot:)` (263), `startingReps(from:fallback:)` (334), `toResumeSnapshot()` (294), `buildFinishPayload()` (348), `buildCardioPayload()` (366).

**`startingReps` (tabela direta input → output):**

| `target` | `fallback` | Esperado |
|---|---|---|
| `"8-12"` | 10 | 8 |
| `"8+4+2"` | 10 | 8 |
| `"10"` | 5 | 10 |
| `"AMRAP"` | 12 | 12 (fallback) |
| `""` | 12 | 12 |
| `"0"` | 12 | 12 (n>0 falha → fallback) |
| `"até a falha 6x"` | 9 | 6 (primeiro inteiro) |

**`makeExercise`:**

| # | Input | Esperado |
|---|---|---|
| 1 | `setDetails` vazio, sets=4, reps=10, weight=nil, completedSets=0 | 4 SetStates uniformes, weight=0, repsTarget=targetReps, restSeconds=restTime, currentSetIndex=0 |
| 2 | `setDetails` vazio, completedSets=2, sets=4 | Sets 0-1 `isCompleted=true`, currentSetIndex=2 |
| 3 | `setDetails` com 5 entries (pirâmide), `weightTargetKg` só nas 3 primeiras | 5 sets; sets 1-3 com peso do target; sets 4-5 com `lastWeight ?? weight ?? 0` |
| 4 | `setDetails[i].repsTarget = "8-12"`, lastReps=nil, reps=0 | startReps = 8 |
| 5 | Todos os sets completos (completedSets == sets) | `currentSetIndex = sets-1` (clamp, linha 244) |
| 6 | `ex.sets = 0` (treino malformado) | `sets == []`, currentSetIndex=0, **sem crash** (range `0..<0`) |

**`from(snapshot:)`:** `currentExerciseIndex` fora do range (ex. 10 com 3 exercícios) → clamp para 2; snapshot com 0 exercícios → startIndex 0 sem crash; `startedAt` nil → usa `updatedAt` → senão `Date()`.

**`buildFinishPayload` / `buildCardioPayload`:** payload inclui TODOS os sets (completos e não), `setIndex` 0-based; cardio só inclui `isCompleted == true`.

### U3 — Reducer do `WorkoutExecutionStore.swift` (mutações) — severidade ALTA

`completeSet` (linha 397), `undoLastCompletedSet` (449), `updateReps`/`updateWeight` (467/479), `setExerciseIndex` (505), `applyRemoteSetComplete` (189).

| # | Ação | Estado inicial | Esperado |
|---|---|---|---|
| 1 | `completeSet(0,0)` | exercício padrão 3 sets, set0 reps=10 weight=20 | set0 completo; sets 1-2 herdam reps=10/weight=20 (carry-forward); currentSetIndex=1; `lastCompletedSet` registrado |
| 2 | `completeSet(0,0)` | exercício com `methodKey="drop_set"`, sets com `weightTargetKg` próprio | sets seguintes **NÃO** herdam reps; weight só herdado em set sem `weightTargetKg` (linhas 417-430) |
| 3 | `completeSet(0,0)` duas vezes | — | segunda chamada é no-op (guard `!isCompleted`, linha 401) |
| 4 | `completeSet(5,0)` (índice inválido) | 3 exercícios | no-op, sem crash |
| 5 | `undoLastCompletedSet` após (1) | — | set0 `isCompleted=false`, currentSetIndex=0, `lastCompletedSet=nil` |
| 6 | `undoLastCompletedSet` sem completar nada | — | no-op |
| 7 | `updateReps(0,0,-5)` | — | clamp para 0 (`max(0, reps)`) |
| 8 | `applyRemoteSetComplete` com exerciseId inexistente | — | no-op |
| 9 | `applyRemoteSetComplete(set 1 de exercício 2)` enquanto Watch via exercício 0 | — | set marcado, `exerciseIndex` segue para 2, currentSetIndex avança para próximo incompleto |
| 10 | `startWorkout` com treino já ativo | state != nil | ignorado (linha 57) — não perde progresso |

### U4 — Reconcile/merge do `WorkoutExecutionStore.swift` — severidade ALTA (proteção contra perda de progresso)

`reconcile(with:)` (linha 519), `clearIfNotPending` (573), `reconcileWithSnapshot` (592), `reconcileProgram`/`mergeProgramExercises` (257/290), `updateExerciseOrder` (339), `acknowledgeFinish` (123), `handleRemoteFinish/Discard/Start` (147/168/216).

| # | Cenário | Esperado |
|---|---|---|
| 1 | v2 context com treino ativo presente no programa | ordem de exercícios atualizada, progresso preservado |
| 2 | v2 context SEM o treino ativo, `hasStarted=true` | **estado mantido** (nunca destruir treino iniciado) |
| 3 | v2 context sem o treino ativo, `hasStarted=false` | estado limpo |
| 4 | `hasProgram=false`, finishState=`.pending` | estado mantido (espera ACK) |
| 5 | `schemaVersion=3` (futuro desconhecido) | tratado como v2 (case `2...`, linha 525), não cai no caminho v1 |
| 6 | v1 snapshot do MESMO treino com `completedSets` maior | merge: completions do iPhone aplicadas, progresso local intacto |
| 7 | v1 snapshot de treino DIFERENTE, local iniciado | local mantido (linha 622) |
| 8 | `acknowledgeFinish` com workoutId errado | ignorado, estado não limpo |
| 9 | `acknowledgeFinish` com finishState=`.none` | ignorado |
| 10 | `mergeProgramExercises`: trainer adiciona exercício no meio da sessão | exercício novo inserido na ordem canônica com estado fresco; exercícios removidos do programa **mantidos** (linha 318) |
| 11 | `updateExerciseOrder` reordena enquanto usuário vê exercício X | `exerciseIndex` segue X na nova posição |
| 12 | `handleRemoteStart` com programa não sincronizado (cache nil) | retorna `false`, sem crash |

### U5 — Persistência/restauração (`Services/WorkoutStatePersistence.swift` + decoders custom) — severidade MÉDIA-ALTA

`save/load/delete` (linhas 15/44/64) + decoders retrocompatíveis de `WorkoutExecutionState` (init(from:) linha 41) e `SetState` (linha 138) + lógica de restauração no init do store (`WorkoutExecutionStore.init`, linha 29).

| # | Input | Esperado |
|---|---|---|
| 1 | save → load round-trip de estado completo (cardio, sessionId, setDetails) | estado idêntico (`Equatable`) |
| 2 | JSON antigo SEM `finishState`/`cardioStates`/`sessionId`/`startedRemotely`/`cardioItems` | decodifica com defaults (`.none`, `[]`, nil, false, `[]`) — retrocompat |
| 3 | JSON de SetState antigo sem `setType`/`repsTarget`/`restSeconds` | decodifica como set "normal" |
| 4 | Arquivo corrompido (JSON inválido) | `load()` → nil, sem crash |
| 5 | Arquivo inexistente | `load()` → nil |
| 6 | Estado `finishState=.pending` com `lastPersistedAt` > 10 min | store init **descarta** (stale, linha 36) |
| 7 | Estado `.pending` recente (< 10 min) | restaurado, aguardando SYNC_SUCCESS |
| 8 | Campo obrigatório ausente (ex. `workoutId`) | decode falha → nil (sem estado fantasma) |

### U6 — Montagem do snapshot no iPhone (`mobile/lib/getProgramSnapshotForWatch.ts`) — severidade ALTA

Testável com mock do client Supabase (mesma técnica dos testes de hooks existentes). Pontos: ordenação superset-aware, `setDetails` via `hydrateSetPrescriptions`, lastWeight/lastReps, cardio config, notas, `currentWeek`.

| # | Input (dados mockados) | Esperado |
|---|---|---|
| 1 | Sem student / sem programa ativo | `null` |
| 2 | Programa com 2 treinos, exercícios com superset (2 filhos) | filhos ordenados pelo `order_index` do pai; `supersetIndex` 0/1, `supersetTotal` 2 |
| 3 | Item com `reps="8-12"` | `reps: 8` (parseInt), `targetReps: "8-12"` |
| 4 | Item com `reps=null` | `reps: 0`, `targetReps: null` |
| 5 | Item sem set_logs anteriores (peso nulo) | `weight: null`, `lastWeight: null`, `lastReps: null` |
| 6 | set_logs com weight=0 | ignorado no weightMap (linha 132: `row.weight > 0`) |
| 7 | Item com `assigned_workout_item_sets` (pirâmide 5 rows) | `setDetails.length === 5` e `sets === 5` (sets segue setDetails, linha 245) |
| 8 | Item sem rows de set | `setDetails` uniforme via `hydrateSetPrescriptions` (3 sets default) |
| 9 | Treino vazio (0 itens) | workout presente com `exercises: []` (não explode) |
| 10 | `method_key` desconhecido (ex. "novo_metodo") | `methodKey` repassado; `methodLabel` = retorno de `getMethodChipLabel` (verificar: null para chave desconhecida) |
| 11 | Cardio `mode="interval"` com intervals | `workSeconds/restSeconds/rounds` extraídos de `cfg.intervals` |
| 12 | Cardio com `equipment` fora do EQUIPMENT_LABELS | `equipmentLabel: undefined` |
| 13 | Sessão completada hoje (status completed, completed_at hoje) | `isCompletedToday: true` |
| 14 | `item_type='note'` com texto | agregado em `notes[]` ordenado por order_index |
| 15 | `scheduled_days=["1","4"]` (strings) | `scheduledDays: [1,4]` (map Number, linha 292) |

### U7 — Gravação no Supabase (`mobile/lib/finishWorkoutFromWatch.ts`) — severidade CRÍTICA (perda de treino)

A unidade mais importante a testar. Mock do Supabase + SecureStore.

| # | Cenário | Esperado |
|---|---|---|
| 1 | Sem usuário autenticado | retorna `'pending'`, payload salvo na fila SecureStore |
| 2 | Erro transiente ao buscar student | `'pending'` + fila (linha 172) |
| 3 | Student não existe (permanente) | `null`, **sem** enfileirar (linha 178) |
| 4 | `payload.sessionId` presente | UPDATE direto na sessão canônica; nenhum SELECT de resolução (linha 231) |
| 5 | Sem sessionId, existe sessão `in_progress` | atualiza essa sessão p/ completed, corrige `started_at` com o do Watch |
| 6 | Sem sessionId, sessão `completed` < 5 min atrás | **reusa** (dedup 6b) — finalização dupla Watch+iPhone não duplica |
| 7 | Sem sessão nenhuma | INSERT completed com `program_week` calculado |
| 8 | `startedAt` há 7h (stale) | `duration_seconds: null` (cap 6h, linha 224) |
| 9 | `startedAt` ausente | duration null; started_at do insert = now |
| 10 | Exercícios com sets `weight: null`/`reps: null` no payload bruto | set_logs com `weight: 0`, `reps_completed: 0` (linha 375-376) |
| 11 | Exercício com id não resolvível em assigned_workout_items | pulado com warn; demais gravados (linha 361) |
| 12 | Upsert de set_logs FALHA | sessão **revertida** p/ in_progress + payload re-enfileirado + retorna `'pending'` (linha 394-408, fix A3) |
| 13 | Upsert de cardio FALHA | mesmo tratamento (linha 482) |
| 14 | `rpe: 0` | gravado como `null` (`rpe \|\| null`) |
| 15 | Fila: salvar 2x o mesmo workoutId | fila deduplica — 1 entrada (linha 66) |
| 16 | `processPendingWatchWorkouts` com auth indisponível | fila intacta, nenhuma tentativa |
| 17 | `processPendingWatchWorkouts` com 1 sucesso + 1 `'pending'` | sucesso removido; pending permanece (1 cópia) |
| 18 | set.completed=false | `is_completed: false`, `completed_at: null` |

### U8 — Parsing de mensagens do Watch (`mobile/hooks/useWatchConnectivity.ts`) — severidade MÉDIA

A lógica de validação/coerção do listener (linhas 71-188) merece ser extraída para função pura `parseWatchMessage(event)` — hoje só é testável montando o hook. Casos:

| # | Evento | Esperado |
|---|---|---|
| 1 | `SET_COMPLETE` sem `exerciseIndex` | descartado (parsed.exerciseIndex=-1 < 0) |
| 2 | `SET_COMPLETE` com reps/weight como string numérica | coerção `Number()` correta |
| 3 | `FINISH_WORKOUT` sem `workoutId` | descartado, callback não chamado |
| 4 | `FINISH_WORKOUT` sem `exercises` | callback com `exercises: undefined` (não `[]`) |
| 5 | `FINISH_WORKOUT` com set sem campos | defaults setIndex=0, reps=0, weight=0, completed=false |
| 6 | `CARDIO_COMPLETE` sem itemId | descartado |
| 7 | `WORKOUT_HEALTH_SAMPLES` com avgHeartRate string | vira `null` (typeof check) |
| 8 | Tipo de mensagem desconhecido ("FOO") | ignorado sem crash |

### U9 — `getNextWorkoutForWatch.ts` — severidade BAIXA (código morto)

Sem consumidores no app. Se for mantido: testar a priorização (scheduled_days hoje e não completado → retorna; tudo completado hoje → null; dia de descanso → null; programa sem agenda → primeiro não completado hoje; `reps="8-12"` → `reps: 8`). Se confirmado morto, **remover** em vez de testar.

### U10 — `WatchSessionManager.swift` (despacho de mensagens) — severidade MÉDIA

O switch de `didReceiveMessage`/`applicationContext` (535 l) é testável injetando dicts e verificando os callbacks no store. Casos mínimos: SESSION_SYNC antes do treino carregar (cache `sessionIdByWorkout` aplica depois — `WorkoutExecutionStore.setSessionId`, linha 92), WORKOUT_FINISHED_FROM_PHONE com id divergente (ignora), SYNC_SUCCESS duplicado (segundo é no-op).

**Observação de viabilidade Swift:** hoje não existe target de teste no Xcode project (gerado por `@bacons/apple-targets` via `plugins/with-watch-app.js`). Adicionar XCTest exigiria mexer no config plugin — alternativa pragmática: manter as unidades U1-U5 como funções puras (já são) e validá-las via um pequeno target de teste criado manualmente no Xcode gerado, ou priorizar o roteiro manual abaixo.

---

## 4. Roteiro de teste manual em device real

Pré-requisitos: iPhone físico com build dev/TestFlight do Kinevo + Apple Watch pareado com o app instalado; conta de aluno com programa ativo (≥ 2 treinos, 1 deles com superset e 1 método avançado, idealmente 1 cardio); acesso ao Supabase (project `lylksbtgrihzepbteest`) para verificar `workout_sessions`/`set_logs`. Em caso de falha em qualquer passo, anotar: timestamp, lado (Watch/iPhone), logs do Console.app filtrando `[WorkoutStore]`, `[WatchBridge]`, `[finishWorkoutFromWatch]`, e estado das tabelas.

### Bloco A — Sync do programa ao Watch

1. **Login no iPhone com Watch por perto.** Abrir o app do Watch. → *Esperado:* lista de treinos do programa ativo aparece (nome do programa, semana atual, treinos com nomes corretos). *Se falhar:* anotar se `isWatchReachable` loga true; se a lista fica vazia ou em "aguardando iPhone".
2. **Conferir detalhes de um treino no Watch** (exercícios, ordem, supersets agrupados, chips de método, alvos de reps tipo "8-12"). → *Esperado:* ordem idêntica à do iPhone; superset com posição (1/2, 2/2); reps-alvo corretos. *Se falhar:* anotar exercício/campo divergente (aponta para U1/U6).
3. **Trainer edita o programa no web** (reordenar 2 exercícios) com o app iPhone aberto. Aguardar ~1 min. → *Esperado:* Watch reflete a nova ordem sem reiniciar nada. *Se falhar:* anotar se o iPhone re-sincronizou (log `[WatchBridge] Auto-synced`).

### Bloco B — Execução completa pelo Watch

4. **Iniciar treino pelo Watch** ("Iniciar treino"). → *Esperado:* HealthKit inicia sessão (anel/ícone de treino ativo no Watch), iPhone cria sessão `in_progress` e manda SESSION_SYNC (verificar no Supabase: 1 linha `workout_sessions` in_progress). *Se falhar:* anotar se há 0 ou 2 sessões.
5. **Completar 2 séries no Watch ajustando peso/reps pela Digital Crown.** → *Esperado:* iPhone (tela do treino aberta) marca as mesmas séries em ~1-2s, com mesmos reps/peso. *Se falhar:* anotar índices (exercício/série) e valores nos dois lados.
6. **Completar 1 série no iPhone.** → *Esperado:* Watch espelha (série marcada, avança para a próxima, segue o exercício ativo). *Se falhar:* anotar se o Watch ficou parado na série 1 (regressão do `applyRemoteSetComplete`).
7. **Série de método avançado (drop-set/pirâmide):** completar a 1ª série prescrita. → *Esperado:* as séries seguintes MANTÊM os pesos-alvo próprios (não herdam o peso da 1ª). *Se falhar:* anotar pesos exibidos antes/depois (U3 caso 2).

### Bloco C — Watch fora de alcance durante o treino

8. **Com treino em andamento, afastar o iPhone** (outro cômodo / modo avião no iPhone) e completar 2 séries no Watch. → *Esperado:* Watch continua funcionando normalmente (estado é local). 
9. **Reaproximar / tirar do modo avião.** → *Esperado:* séries feitas offline aparecem no iPhone ao reconectar (ou no máximo ao finalizar, via payload do FINISH). *Se falhar:* anotar quais séries chegaram e quais não — distingue perda no transporte (sendMessage sem fila) de perda no merge.

### Bloco D — App do Watch morto no meio do treino (restauração)

10. **Com treino em andamento (≥ 3 séries feitas, peso ajustado), matar o app do Watch** (segurar botão lateral → swipe no card; ou forçar reboot do Watch). 
11. **Reabrir o app do Watch.** → *Esperado:* treino restaurado exatamente onde estava — séries completas, pesos/reps editados, exercício atual, cronômetro coerente com `startedAt` original (não zerado). *Se falhar:* anotar o que se perdeu (tudo → falha no save; só últimas edições de Crown → janela do debounce 500ms é aceitável; cronômetro zerado → `startedAt` regravado).
12. **Variante cardio:** repetir 10-11 com item de cardio em andamento. → *Esperado:* cardio resumível (cardioItems persistidos). 

### Bloco E — Finalização pelo Watch e verificação no banco

13. **Finalizar o treino pelo Watch** (informar RPE, ex. 8). → *Esperado:* Watch entra em "salvando/aguardando" (finish pending) e, com iPhone alcançável, recebe confirmação e limpa o treino; iPhone navega/mostra treino concluído; haptic de sucesso.
14. **Verificar no Supabase:** `workout_sessions` → exatamente **1** sessão `completed` para o treino, com `rpe=8`, `started_at` ≈ início real no Watch, `duration_seconds` plausível (não null, não > 6h); `set_logs` → 1 linha por série (completas com `is_completed=true`, não feitas com false), pesos/reps batendo com o que foi digitado no Watch. → *Se falhar:* anotar contagem de sessões (2 = dedup falhou), contagem de set_logs (0 = bug A3 regrediu) e se ficou sessão `in_progress` órfã.
15. **Verificar no app iPhone (Histórico/logs):** o treino aparece com as séries e volume corretos; home marca o treino como feito hoje. 
16. **Verificar HealthKit/Activity:** treino salvo no app Atividade/Saúde com duração e calorias. 

### Bloco F — Finalização dupla (Watch e iPhone)

17. **Iniciar treino, completar séries nos dois lados; finalizar no iPhone PRIMEIRO; em < 1 min, tentar finalizar também no Watch** (se a UI ainda permitir). → *Esperado:* Watch recebe WORKOUT_FINISHED_FROM_PHONE e limpa sozinho antes; se ainda assim enviar FINISH, o dedup (sessionId canônico ou janela de 5 min do 6b) **não cria segunda sessão**. Verificar no Supabase: 1 sessão. *Se falhar:* anotar ids das 2 sessões e qual caminho criou a duplicata.
18. **Inverso: finalizar no Watch primeiro e, sem esperar, finalizar no iPhone.** → *Esperado:* 1 sessão; set_logs sem duplicar (upsert por `workout_session_id,assigned_workout_item_id,set_number`). 

### Bloco G — Permissão HealthKit negada

19. **Revogar permissões do Kinevo no Watch/iPhone** (Ajustes → Saúde → Apps) e iniciar treino pelo Watch. → *Esperado:* treino executa normalmente (marcação de séries e finalização NÃO dependem de HealthKit); sem FC/calorias exibidas; nenhum crash; ao finalizar, sessão e set_logs gravam normalmente, apenas sem amostras de saúde (WORKOUT_HEALTH_SAMPLES nulos). *Se falhar:* anotar onde travou (pedido de permissão em loop? crash no start da HKWorkoutSession?).
20. **Re-conceder permissão e fazer 1 treino curto.** → *Esperado:* FC ao vivo volta a aparecer; amostras chegam ao iPhone (verificar campos de saúde da sessão, se aplicável).

### Bloco H — Troca de treino no iPhone durante execução no Watch

21. **Iniciar Treino A pelo Watch (completar ≥ 1 série). No iPhone, abrir e INICIAR o Treino B.** → *Esperado (comportamento atual por design):* o Watch **mantém** o Treino A em andamento (estado iniciado nunca é destruído por reconcile); anotar como o Watch apresenta a situação. *Se falhar (perda):* Treino A sumiu do Watch com séries feitas → regressão grave do `clearIfNotPending`/`reconcileWithSnapshot`.
22. **Trainer remove o Treino A do programa (web) enquanto ele roda no Watch.** → *Esperado:* Watch mantém o treino em execução até o usuário finalizar; finalização ainda grava no banco (workout pode não existir mais — anotar o que acontece no passo 4 do finish: workout not found → retorna null permanente; **ponto de atenção**, dado real a coletar). 
23. **Trainer ADICIONA um exercício ao Treino A em execução.** → *Esperado:* exercício novo aparece no Watch na posição canônica, com séries zeradas, sem perder progresso dos demais (`mergeProgramExercises`). 

### Bloco I — Pendências e recuperação

24. **Finalizar treino pelo Watch com o iPhone em modo avião; depois de 2 min, religar o iPhone e abrir o app.** → *Esperado:* Watch fica em finish-pending (até 10 min); ao reconectar, FINISH chega (transferUserInfo/fila) ou o usuário reabre e o `processPendingWatchWorkouts` drena a fila; resultado final no banco: 1 sessão completed com todas as séries. *Se falhar:* anotar se o Watch descartou o pending (>10 min?) e se a fila SecureStore tinha a entrada.

---

### Resumo de severidades (cobertura ausente)

| Unidade | Severidade |
|---|---|
| U7 finishWorkoutFromWatch.ts (gravação no banco) | **Crítica** |
| U3/U4 WorkoutExecutionStore (reducer + reconcile) | Alta |
| U1 WorkoutModels.parse | Alta |
| U2 WorkoutExecutionState (montagem/startingReps/payloads) | Alta |
| U6 getProgramSnapshotForWatch.ts | Alta |
| U5 WorkoutStatePersistence + decoders retrocompat | Média-alta |
| U8 useWatchConnectivity (parsing de mensagens) | Média |
| U10 WatchSessionManager (despacho) | Média |
| U9 getNextWorkoutForWatch.ts (morto) | Baixa — remover |
