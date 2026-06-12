# Investigação A — Consistência Watch ↔ iPhone

> Análise somente-leitura (jun/2026). Escopo: contrato de dados TS↔Swift, enums prescritíveis,
> sync bidirecional de estado, lógica duplicada e tema/UX.
> Todos os achados marcam **[Confirmado por leitura]** ou **[Hipótese — testar em device]**.

## Sumário

O contrato v2 (program snapshot) está bem desenhado — parsing Swift defensivo (defaults em quase tudo, nunca crasha com enum desconhecido), ACK de finish com fila idempotente, SESSION_SYNC eliminando heurística de mapeamento — mas a auditoria campo a campo encontrou **3 riscos altos de integridade de dados** e uma família de divergências de lógica duplicada. Os altos: (A1) o iPhone aplica `SET_COMPLETE` do Watch **por índice** ignorando o `exerciseId` que o Watch já envia, e os dois lados podem reordenar/mesclar exercícios de forma divergente no meio do treino (o Watch reconcilia edições do treinador, a tela do iPhone nunca refetcha) → série gravada no exercício errado; (A2) finalizar **no iPhone** limpa o estado do Watch sem coletar as séries que só existem lá (o handler de `SET_COMPLETE` só vive na tela de treino montada) → perda silenciosa; (A3) o caminho de finish do Watch upserta **todas** as séries, inclusive `is_completed=false`, por cima dos `set_logs` do iPhone, e o fallback sem `sessionId` pode criar `workout_session` duplicada após a janela de dedup de 5 min. Nas regras duplicadas, as divergências mais visíveis: timer de descanso em superset (Watch descansa após cada série; iPhone só ao fim da rodada), descanso prescrito como 0s que vira 60s no Watch, e prescrição de %1RM/RIR/cadência que o aluno vê no iPhone mas nunca no Watch. Tema: paleta do Watch bate com os tokens legacy da marca, mas diverge da tela de treino v2 do iPhone (#09090B/#18181B) e não acompanha o branding custom do personal.

---

## 1. MODELOS — comparação campo a campo

### 1.1 Arquitetura do contrato

- **Envio**: `getProgramSnapshotForWatch.ts` monta `WatchProgramPayload` → `syncProgramToWatch()` → nativo embrulha em envelope `{schemaVersion: 2, syncedAt, hasProgram, program}` (`modules/watch-connectivity/ios/WatchConnectivityModule.swift:526-538`) → `updateApplicationContext`.
- **Recepção**: `WatchSessionManager.parseApplicationContext` (`targets/watch-app/Services/WatchSessionManager.swift:354-385`) → `WatchProgramSnapshot.parse` (`targets/watch-app/WorkoutModels.swift:320-350`).
- O v1 (`getNextWorkoutForWatch.ts` + `syncWorkoutToWatch` + `WatchWorkout`/`fromLegacy`) **não tem nenhum chamador no lado de envio** (grep em `app/`, `components/`, `hooks/` sem resultado) — só o caminho de parse legado no Watch permanece vivo. Ver achado A12.

### 1.2 Envelope e programa (`WatchProgramPayload` ↔ `WatchProgramSnapshot`)

| Campo TS (`WatchConnectivityModule.types.ts:131-139`) | Campo Swift (`WorkoutModels.swift:307-350`) | Tipo TS | Tipo Swift | Opcional? | Default Swift | Veredito |
|---|---|---|---|---|---|---|
| `schemaVersion: 2` (dentro do program) | — | literal 2 | — | não | — | **Enviado-e-ignorado** (Swift lê o `schemaVersion` do envelope, não o do program — inofensivo) |
| `programId` | `programId` | string | String | obrigatório ambos | guard → nil | OK |
| `programName` | `programName` | string | String | obrigatório ambos | guard → nil | OK |
| `currentWeek` | `currentWeek` | number | Int | obrig. TS / opt Swift | 1 | OK |
| `totalWeeks` | `totalWeeks` | number | Int | obrig. / opt | 0 | OK |
| `scheduleMode` | `scheduleMode` | `'scheduled'\|'flexible'` | enum `ScheduleMode` | obrig. / opt | `.flexible` | OK (valor desconhecido → flexible, gracioso) |
| `workouts` | `workouts` | array | array | obrigatório ambos | guard → nil | OK (`compactMap` descarta workout malformado silenciosamente) |

### 1.3 Workout (`WatchProgramWorkout` ↔ `WatchProgramWorkoutSummary`)

| TS (`types.ts:118-129`) | Swift (`WorkoutModels.swift:510-560`) | Tipo TS | Tipo Swift | Default Swift | Veredito |
|---|---|---|---|---|---|
| `workoutId` | `workoutId` | string | String | guard | OK |
| `workoutName` | `workoutName` | string | String | guard | OK |
| `orderIndex` | `orderIndex` | number | Int | 0 | OK |
| `scheduledDays` | `scheduledDays` | number[] (0=Dom) | [Int] (0=Dom) | [] | OK — convenção idêntica; TS `getDay()` vs Swift `Calendar.weekday - 1` (`WorkoutModels.swift:526`) coincidem |
| `isCompletedToday` | `isCompletedToday` | boolean | Bool | false | OK |
| `lastCompletedAt` | `lastCompletedAt` | string ISO \| null | Date? | nil | OK — `WatchDateParser` aceita com e sem frações (`WorkoutExecutionState.swift:378-392`) |
| `exercises` | `exercises` | array | array | [] | OK |
| `cardioItems?` | `cardioItems` | array | array | [] | OK |
| `notes?` (string[]) | `notes` | string[] | [String] | [] | OK (briefing Level B) |

### 1.4 Exercício (`WatchProgramExercise` ↔ `WatchProgramExerciseSummary`)

| TS (`types.ts:75-96`, montado em `getProgramSnapshotForWatch.ts:239-257`) | Swift (`WorkoutModels.swift:401-507`) | Tipo TS | Tipo Swift | Default Swift | Unidade | Veredito |
|---|---|---|---|---|---|---|
| `id` | `id` | string (assigned_workout_item_id) | String | guard | — | OK |
| `name` | `name` | string | String | guard | — | OK |
| `muscleGroup?` | `muscleGroup` | string | String? | nil | — | **Enviado-e-ignorado** — parseado e armazenado, nenhuma View do Watch exibe |
| `sets` | `sets` | number (= `setDetails.length \|\| sets \|\| 3`) | Int | 3 | — | OK |
| `reps` | `reps` | number (`parseInt('8-12')`→8) | Int | 0 | reps | OK (só fallback) |
| `weight` | `weight` | number \| null (último peso usado) | Double? | nil | **kg** | OK — mas é o peso da série mais recente, não máximo (ver A13) |
| `restTime` | `restTime` | number | Int | 60 | **segundos** | **Divergência**: TS `item.rest_seconds \|\| 60` (`getProgramSnapshotForWatch.ts:248`) transforma rest agregado 0 em 60 → ver A4 |
| `targetReps` | `targetReps` | string \| null ("8-12") | String? | nil | — | OK |
| `lastWeight` | `lastWeight` | number \| null | Double? | nil | kg | OK (valor idêntico a `weight` — redundante por design) |
| `lastReps` | `lastReps` | number \| null | Int? | nil | reps | OK |
| `supersetIndex?` / `supersetTotal?` | idem | number | Int? | nil | — | OK (0-based / total) |
| `methodKey?` | `methodKey` | string \| null | String? | nil | — | OK (catálogo §1.7) |
| `methodLabel?` | `methodLabel` | string \| null (pt-BR) | String? | nil | — | OK |
| `setDetails?` | `setDetails` | WatchSetDetail[] | [WatchSetDetail] | [] | — | OK |
| `notes?` | `notes` | string \| null | String? | nil | — | OK (nota técnica Level A) |
| — (não enviado) | — | `rounds` existe no banco/iPhone (`useWorkoutSession.ts:774`) | — | — | — | **Esperado-e-nunca-enviado**: o iPhone agrupa a UI em rodadas via `rounds`; o Watch mostra a lista linear (apenas `roundNumber` por série, que também não é exibido) — ver A11 |
| — (não enviado) | — | `supersetRestSeconds` existe no iPhone (`useWorkoutSession.ts:767`) | — | — | segundos | **Esperado-e-nunca-enviado** — alimenta a divergência de descanso de superset (A5) |

### 1.5 Série (`WatchSetDetail` TS ↔ `WatchSetDetail` Swift ↔ `SetState`)

| TS (`types.ts:58-73`, montado em `getProgramSnapshotForWatch.ts:172-191`) | Swift parse (`WorkoutModels.swift:82-107`) | Swift estado (`Models/WorkoutExecutionState.swift:100-151`) | Tipo | Default | Unidade | Veredito |
|---|---|---|---|---|---|---|
| `setNumber` | `setNumber` (guard) | — (índice) | number/Int | obrigatório | — | OK |
| `setType` | `setType` | `setType` | string (8 valores §1.7) | "normal" | — | OK — desconhecido degrada (cor default, badge via label) |
| `setTypeLabel` | `setTypeLabel` | `setTypeLabel` | string pt-BR | "" | — | OK — Watch confia no label calculado no TS (`SET_TYPE_BADGE_LABELS`), nunca traduz localmente |
| `repsTarget` | `repsTarget` | `repsTarget` | string ("8-12", "AMRAP", "8+4+2") | "" | — | OK |
| `restSeconds` | `restSeconds` | `restSeconds` | number/Int | 0 | **segundos** | OK no transporte; **divergência no consumo** (0 → fallback p/ `restTime` inflado, A4) |
| `weightTargetKg` | `weightTargetKg` | `weightTargetKg` | number\|null / Double? | nil | **kg** | OK |
| `weightTargetPct1rm` | `weightTargetPct1rm` | **descartado** | number\|null / Double? | nil | % 1RM | **Enviado-e-ignorado**: parseado em `WorkoutModels.swift:102`, mas `SetState` não tem o campo e `makeExercise` (`WorkoutExecutionState.swift:205-242`) só usa `weightTargetKg`. iPhone exibe "Meta: 75% 1RM" (`components/workout/SetRow.tsx:31,109`) — ver A6 |
| `roundNumber` | `roundNumber` | `roundNumber` | number\|null / Int? | nil | — | Parseado e persistido, **não exibido** no Watch (A11) |
| `notes?` | `notes` | `notes` | string\|null / String? | nil | — | OK (nota Level C exibida em `WorkoutExecutionView.swift:641-656`) |
| — | — | — | `rir: number\|null` existe no banco e no `SetPrescription` do iPhone (`lib/hydrateWorkoutSets.ts:22`) | — | reps em reserva | **Esperado-e-nunca-enviado** — `buildSetDetails` (`getProgramSnapshotForWatch.ts:180-191`) omite; iPhone exibe "RIR 2" (`shared/lib/prescription/set-meta-label.ts:79-81`) — ver A6 |
| — | — | — | `tempo: string\|null` idem (`hydrateWorkoutSets.ts:23`) | — | cadência | **Esperado-e-nunca-enviado** — iPhone exibe "Cadência 3-1-1-0" (`set-meta-label.ts:83-86`) — ver A6 |

### 1.6 Cardio (`WatchCardioItem` ↔ `WatchCardioItem` Swift)

| TS (`types.ts:98-116`) | Swift (`WorkoutModels.swift:603-690`) | Default Swift | Veredito |
|---|---|---|---|
| `id` | `id` (guard) | — | OK |
| `itemType: 'cardio'` | — | — | **Enviado-e-ignorado** (Swift não lê; inofensivo) |
| `orderIndex` | `orderIndex` | 999 | OK (obs.: TS envia `item.effectiveOrder ?? 999` — `effectiveOrder` só existe após `sortExerciseItems`, OK) |
| `config.mode` | `config.mode` | "continuous" | OK |
| `config.equipment` / `equipmentLabel` | idem | nil | OK (label pt-BR calculado no TS; ícone mapeado no Swift com default `heart.circle`) |
| `config.objective/durationMinutes/distanceKm/intensity` | idem | nil | OK (unidades: min, km) |
| `config.workSeconds/restSeconds/rounds` | idem | nil (defaults de exibição 30/15/8 em `summaryText`) | OK |

### 1.7 ENUMS prescritíveis — catálogo completo vs. o que o Watch entende

Catálogo (fonte da verdade: `shared/types/prescription.ts`, espelha CHECK constraints do SQL — migration 111 — e seeds de `training_method_presets`):

- **`set_type`** (`prescription.ts:543-555`): `warmup | normal | top | backoff | drop | failure | cluster | amrap` (8 valores).
- **`method_key`** (`prescription.ts:560-572`): `standard | custom | pyramid_down | pyramid_up | drop_set | top_backoff | 5x5 | cluster` (8 valores).
- **`rounds`**: inteiro ≥1 na coluna `assigned_workout_items.rounds`; métodos compostos materializam N rodadas × M fases em linhas físicas com `round_number`.

Como o Watch trata cada um:

1. **set_type — o Watch entende todos os 8 e degrada bem o desconhecido.**
   `WorkoutExecutionView.swift:1091-1104` (`setTypeColor`): `switch` com cases `drop/top/backoff/failure/warmup/cluster/amrap` e `default: return Color.kinevoViolet` — `normal` e qualquer valor futuro caem no default (sem crash). O texto do badge nunca é derivado no Swift: vem pronto do TS (`setTypeLabel`), e no TS um set_type fora do catálogo gera label `''` (`SET_TYPE_BADGE_LABELS[p.set_type as SetType] ?? ''`, `getProgramSnapshotForWatch.ts:183`) → badge oculto. **[Confirmado por leitura — sem dessincronização possível de rótulo, só de cor (default violeta).]**

2. **method_key — o Watch nunca interpreta o valor além de `!= "standard"`.**
   Único uso semântico: `WorkoutExecutionStore.swift:417-418` — `let isAdvanced = methodKey != nil && methodKey != "standard"` (decide o carry-forward de carga). Exibição usa só `methodLabel` (string pronta). Valor novo/desconhecido no banco → `getMethodChipLabel` retorna `null` (`shared/lib/prescription/method-labels.ts:24-27`) → chip oculto no Watch e no iPhone igualmente; `isAdvanced=true` no Watch (comportamento conservador correto). **Sem crash, sem fallback incorreto.** A exceção é o caso `methodKey null/standard + setDetails heterogêneo` — ver A7.

3. **rounds — o Watch não recebe nem agrupa.** O iPhone agrupa o setScheme em rodadas (`useWorkoutSession.ts:94-96,774`); o Watch mostra séries lineares. `roundNumber` chega por série mas nenhuma View o exibe. Ver A11.

4. **Métodos no parse de contexto**: workout/exercício/série malformados são descartados por `compactMap` (`WorkoutModels.swift:27,280,340,463,539`) — um item ruim não derruba o snapshot inteiro, mas **desaparece silenciosamente** (sem telemetria). [Confirmado por leitura.]

### 1.8 Eventos Watch → iPhone

| Evento | Payload Watch (`WatchSessionManager.swift`) | Parse iPhone (`useWatchConnectivity.ts`) | Veredito |
|---|---|---|---|
| `SET_COMPLETE` | workoutId, exerciseIndex, **exerciseId**, setIndex, reps, weight (`:161-182`) | parseia tudo incl. exerciseId (`:74-93`) | **exerciseId é ignorado pelo consumidor** (`app/workout/[id].tsx:248-256` usa só o índice) → A1 |
| `START_WORKOUT` | workoutId (`:185-194`) | `:95-104` | OK |
| `FINISH_WORKOUT` | workoutId, rpe, startedAt (ISO c/ frações), exercises[{id, sets[{setIndex,reps,weight,completed}]}], cardio[], sessionId? (`:199-223`) | `:106-139` | OK no transporte; consumo ver A3 |
| `CARDIO_COMPLETE` | workoutId, itemId, elapsedSeconds (`:251-261`) | `:141-153` | OK no transporte; consumo ver A8 |
| `WORKOUT_HEALTH_SAMPLES` | samples + workoutId + sessionId? (`:228-248`, sempre transferUserInfo) | `:155-176` | OK |
| `DISCARD_WORKOUT` | workoutId (`:264-272`) | `:178-187` | OK |

### 1.9 Mensagens iPhone → Watch

Todas tratadas em `WatchSessionManager.handleIncomingMessage` (`:418-534`): `SYNC_SUCCESS`, `SESSION_SYNC`, `START_WORKOUT_FROM_PHONE`, `WORKOUT_FINISHED_FROM_PHONE`, `WORKOUT_DISCARDED_FROM_PHONE`, `SET_COMPLETE_FROM_PHONE`, `UPDATE_EXERCISE_ORDER`. `default: break` para tipo desconhecido (gracioso). Nenhuma mensagem enviada pelo iPhone fica sem handler. **[Confirmado por leitura.]**

---

## 2. ESTADO — sync bidirecional, corridas e duplo-finish

### 2.1 Quem ganha em marcação simultânea de série

Fluxo Watch→iPhone: `completeCurrentSet` (`WorkoutExecutionView.swift:827-908`) → `SET_COMPLETE` → `applyWatchSetCompletion` (`useWorkoutSession.ts:996-1038`) marca a série, herda fallbacks de peso/reps vazios e chama `persistSetLog` (upsert em `set_logs` com `onConflict: workout_session_id,assigned_workout_item_id,set_number`, `:374-389`) → `persistSetLog` ecoa `SET_COMPLETE_FROM_PHONE` de volta (`:402-410`) → Watch `applyRemoteSetComplete` (`WorkoutExecutionStore.swift:189-210`) sobrescreve reps/peso da mesma série com os valores resolvidos pelo iPhone e avança `currentSetIndex`.

- **Mesma série nos dois lados**: convergente — o eco não gera loop (o Watch não reenvia ao aplicar remoto) e a última escrita no banco ganha via upsert. **[Confirmado por leitura.]**
- **Séries diferentes em paralelo**: cada lado escreve sua linha; `applyRemoteSetComplete` força `s.exerciseIndex = exIdx` (`WorkoutExecutionStore.swift:204-206`) — o Watch "pula" para o exercício que o iPhone acabou de logar, mesmo que o usuário do Watch esteja olhando outro. UX intencional ("follow the phone"), mas em uso simultâneo real causa salto de tela. **[Hipótese de UX — testar em device.]**
- **Risco real**: o mapeamento por índice (A1 abaixo).

### A1 — SET_COMPLETE aplicado por índice; `exerciseId` ignorado — **Severidade: Alta** [Confirmado por leitura; o gatilho (divergência de ordem) precisa de teste em device]

- Watch envia o índice **do seu próprio array** (`WorkoutExecutionView.swift:171-183`) junto com o `exerciseId`.
- iPhone aplica só pelo índice:
  ```ts
  // app/workout/[id].tsx:248-256
  onWatchSetComplete: ({ workoutId, exerciseIndex, setIndex, reps, weight }) => {
      ...
      applyWatchSetCompletion(exerciseIndex, setIndex, reps, weight);
  ```
  (`useWatchConnectivity.ts:75-92` parseia `exerciseId`, mas ele morre aqui.)
- Os arrays **podem divergir durante o treino**:
  - O Watch reconcilia edições do treinador: `mergeProgramExercises` reordena pela ordem canônica nova, **adiciona exercícios inseridos mid-session e move exercícios removidos para o FIM** (`WorkoutExecutionStore.swift:290-333`, especialmente `:317-320`).
  - A tela do iPhone **nunca refetcha** depois de carregada (`hasLoadedRef`, `useWorkoutSession.ts:162-176,481`), então mantém a ordem antiga.
- Resultado: treinador edita o treino no meio da execução → Watch índice 2 = "Supino inclinado", iPhone índice 2 = "Crucifixo" → `applyWatchSetCompletion(2, …)` marca e **persiste set_log no `assigned_workout_item_id` errado** (o upsert usa `exercise.id` do array do iPhone).
- **Impacto**: histórico/volume/PR do aluno corrompidos no exercício errado; duplicação possível (o item certo fica incompleto e é re-marcado).
- **Correção sugerida**: em `[id].tsx`, resolver o exercício por `exerciseId` (`exercises.findIndex(e => e.id === event.exerciseId)`) e usar o índice como fallback apenas quando `exerciseId` ausente (builds antigos do Watch). Simétrico ao que o Watch já faz em `applyRemoteSetComplete` (busca por id, `WorkoutExecutionStore.swift:191`).

### A2 — Finish no iPhone descarta séries feitas só no Watch — **Severidade: Alta** [Confirmado por leitura do caminho; cenário exige Watch fora de alcance — testar em device]

- `finishWorkout` do iPhone envia `WORKOUT_FINISHED_FROM_PHONE` (`useWorkoutSession.ts:1470-1481`); o Watch limpa o estado **sem enviar nada do que tem localmente**: `handleRemoteFinish` → `clearWorkout()` (`WorkoutExecutionStore.swift:147-162`).
- Séries marcadas no Watch enquanto o iPhone estava fora de alcance ficam enfileiradas via `transferUserInfo` (`sendReliable`, `WatchSessionManager.swift:287-304`), mas `SET_COMPLETE` **só tem handler na tela de treino montada** — o `WatchBridge` raiz não registra `onWatchSetComplete` (`app/_layout.tsx:306`). Se o `SET_COMPLETE` enfileirado chegar depois que o usuário finalizou no iPhone e saiu da tela, o evento é emitido ao JS e **cai no vazio**.
- O caminho de recuperação que existiria (payload completo no `FINISH_WORKOUT` do Watch, `buildFinishPayload`) nunca roda porque o estado foi limpo pelo finish remoto.
- **Impacto**: perda permanente e silenciosa de séries executadas no Watch quando o aluno finaliza no celular (cenário comum: marca 2–3 séries no relógio com o celular no armário, depois pega o celular e finaliza lá).
- **Correção sugerida**: (a) antes de `clearWorkout()` em `handleRemoteFinish`, enviar um payload best-effort com as séries completadas localmente (mesmo formato do `FINISH_WORKOUT`, sem RPE) e o iPhone upsertar apenas `is_completed=true`; e/ou (b) registrar `onWatchSetComplete` também no `WatchBridge` raiz, persistindo direto via upsert quando há sessão `in_progress` correspondente.

### A3 — Duplo-finish: downgrade de séries e sessão duplicada — **Severidade: Alta** [Confirmado por leitura; corrida real precisa de teste em device]

Caminho normal de finalização do iPhone: `useWorkoutSession.finishWorkout` (`useWorkoutSession.ts:1281-1491`) — atualiza a `workout_sessions` existente (ou cria `completed` no fallback `:1302-1350`) e upserta **apenas séries `completed`** (`:1415-1433`).

Caminho do Watch: `finishWorkoutFromWatch` (`lib/finishWorkoutFromWatch.ts:135-502`):
- Com `sessionId` (SESSION_SYNC): update direto da sessão (`:231-250`) — **sobrescreve `started_at`, `duration_seconds`, `rpe` mesmo que a sessão já esteja `completed` pelo iPhone** (last-write-wins, sem guard de status).
- Upserta **todas** as séries, inclusive as não feitas:
  ```ts
  // finishWorkoutFromWatch.ts:366-381
  for (const set of exercise.sets) {
      setLogs.push({ ..., is_completed: set.completed === true,
                     completed_at: set.completed ? now.toISOString() : null, ... });
  ```
  Como o upsert usa o mesmo `onConflict`, uma série que o iPhone gravou como completa pode ser **rebaixada para `is_completed=false`** se o estado do Watch estava defasado (ex.: `SET_COMPLETE_FROM_PHONE` não entregue).
- Sem `sessionId` (build antigo do Watch ou fila SecureStore antiga): dedup 6b só olha sessões `completed` dos **últimos 5 minutos** (`:288-298`); um retry da fila processado depois disso cai no 6c e **insere uma segunda `workout_session` completed** para o mesmo treino (`:304-335`).
- Mitigações existentes que limitam (mas não eliminam) o risco: dedup de evento 5s no `WatchBridge` (`_layout.tsx:196-200`), `WORKOUT_FINISHED_FROM_PHONE` limpando o Watch, e `markFinishPending`/ACK no Watch.
- **Impacto**: sessão duplicada infla frequência/aderência do aluno; downgrade de set_logs apaga trabalho real; RPE/duração do Watch sobrescrevem os do iPhone.
- **Correção sugerida**: (a) no update direto por `sessionId`, adicionar guard `.eq('status','in_progress')` ou merge condicional quando já `completed`; (b) no passo 7, upsertar somente `is_completed=true` (ou nunca sobrescrever uma linha completa com `false` — ex. RPC `ON CONFLICT ... WHERE excluded.is_completed`); (c) ampliar a janela do 6b (ex. mesmo dia) ou usar índice único parcial por (workout, dia, status).

### 2.2 Edição do treino no iPhone/web no meio da execução

- Watch: `reconcileProgram` mescla preservando progresso, mantém exercícios removidos, **nunca destrói treino iniciado** (`WorkoutExecutionStore.swift:257-333`; `clearIfNotPending` guarda `hasStarted`, `:573-590`). Bem defendido.
- iPhone: a tela montada **não reage** a edição nenhuma (guard `hasLoadedRef`). A divergência entre os dois é o combustível do A1.
- O snapshot novo só chega ao Watch nos pontos de sync do `WatchBridge` (launch com retries 0/3/8/15s, `START_WORKOUT`, pós-finish, `SIGNED_IN` — `_layout.tsx:353-396`) — **não há push/realtime de edição do treinador**. → **A9, Severidade Média** [Confirmado por leitura]: entre syncs, o Watch pode operar com prescrição obsoleta (cargas/séries antigas). Correção sugerida: assinar Realtime de `assigned_workout_items`/`assigned_workouts` no WatchBridge (ou re-sincronizar em `AppState active`).

### 2.3 Descarte e demais caminhos

- Descarte no Watch: `DISCARD_WORKOUT` → WatchBridge marca a sessão `in_progress` como `abandoned` (`_layout.tsx:257-290`). OK.
- Descarte no iPhone: apaga set_logs + `abandoned` com guard de status (`useWorkoutSession.ts:419-442`) e avisa o Watch. OK.
- Sessões órfãs: cleanup >24h no WatchBridge (`_layout.tsx:316-343`). OK.
- Snapshot MMKV do iPhone valida `sessionId` contra a sessão reanexada e descarta estado morto (`useWorkoutSession.ts:804-812`). OK — boa proteção contra o Watch ter finalizado em paralelo.

---

## 3. LÓGICA DUPLICADA — onde a mesma regra vive em Swift e TS

### A4 — Descanso prescrito 0s vira 60s no Watch — **Severidade: Média/Alta (UX de método avançado)** [Confirmado por leitura]

- iPhone: usa o rest per-set cru, inclusive 0 → não dispara timer:
  ```ts
  // app/workout/[id].tsx:110-112
  const perSetRest = exercise.setScheme?.[_setIndex]?.rest_seconds;
  const restSeconds = typeof perSetRest === 'number' ? perSetRest : exercise.rest_seconds;
  ```
- Watch: per-set 0 cai no rest agregado do exercício:
  ```swift
  // WorkoutExecutionView.swift:841-842
  let setRest = exercise.sets[setIndex].restSeconds
  let restTime = setRest > 0 ? setRest : exercise.restTime
  ```
  E o agregado chega inflado: `restTime: item.rest_seconds || 60` (`getProgramSnapshotForWatch.ts:248`) transforma 0 em 60 — sendo que `summarizeSetScheme` espelha justamente o **mínimo** do scheme no agregado (`shared/lib/prescription/set-scheme.ts:43-49`), ou seja, drop-set com 0s entre drops tem agregado 0.
- **Impacto**: aluno executando drop-set/cluster no Watch recebe timer de 60s entre fases que o treinador prescreveu sem descanso — quebra o método.
- **Correção sugerida**: no Swift, tratar `restSeconds == 0` como "sem descanso" quando o exercício tem `setDetails` (método avançado); no TS, não aplicar `|| 60` quando existe setScheme (enviar o valor real).

### A5 — Descanso de superset — **Severidade: Média** [Confirmado por leitura]

- iPhone: descansa **apenas após o último exercício da rodada** do superset, usando `supersetRestSeconds` (`app/workout/[id].tsx:79-104`).
- Watch: não tem conceito de rodada de superset no timer — descansa após **cada série de cada exercício** com o rest individual (`WorkoutExecutionView.swift:864-874`); `supersetRestSeconds` nem é enviado (§1.4).
- **Impacto**: no Watch o aluno descansa no meio da rodada A→B do superset (quando deveria emendar) — protocolo do treinador não é respeitado.
- **Correção sugerida**: enviar `supersetRestSeconds` no payload e, no Swift, suprimir o timer quando `supersetIndex < supersetTotal - 1` (há próximo exercício na rodada), disparando-o só no último.

### A6 — %1RM, RIR e cadência invisíveis no Watch — **Severidade: Média** [Confirmado por leitura]

- iPhone: `SetRow` mostra "Meta: 75% 1RM", "RIR 2", "Cadência 3-1-1-0" (`components/workout/SetRow.tsx:31-36,109-110`; `shared/lib/prescription/set-meta-label.ts:79-86`).
- Watch: `weightTargetPct1rm` é parseado e jogado fora (§1.5); `rir`/`tempo` nem são enviados (`getProgramSnapshotForWatch.ts:180-191` omite). Prescrição em %1RM sem kg → o Watch inicializa a carga com `lastWeight ?? 0` (`WorkoutExecutionState.swift:217`) sem nenhuma pista do alvo.
- **Correção sugerida**: incluir `rir`/`tempo` no `WatchSetDetail` TS+Swift e exibir junto ao "Meta:"; para %1RM, exibir "75% 1RM" como subtítulo quando `weightTargetKg == nil`.

### A7 — Carry-forward (waterfall) com critérios diferentes — **Severidade: Média** [Confirmado por leitura; dado-dependente]

- iPhone: desliga a propagação quando o **scheme é heterogêneo** (targets distintos entre séries), independente do method_key (`useWorkoutSession.ts:34-58` + `:924-942`).
- Watch: desliga quando `methodKey != nil && != "standard"` (`WorkoutExecutionStore.swift:417-430`); no modo "advanced" ainda preenche peso em séries sem `weightTargetKg` e nunca toca reps.
- Caso divergente: item com linhas heterogêneas em `assigned_workout_item_sets` mas `method_key` NULL ou `'standard'` (dados legados/importados/editados fora do builder). iPhone respeita a prescrição por série; **Watch cobre reps e peso prescritos com o valor da série anterior** (`:427-428`).
- **Correção sugerida**: no Swift, replicar o critério do iPhone — considerar "advanced" também quando `!setDetails.isEmpty` com targets heterogêneos (ou simplesmente sempre que `setDetails` existir).

### A8 — Cardio do Watch perde duração no finish do iPhone — **Severidade: Média** [Confirmado por leitura]

- `CARDIO_COMPLETE` com a tela montada: `toggleCardioComplete(itemId, true, { elapsedSeconds })` (`app/workout/[id].tsx:266`) grava a chave `elapsedSeconds` no `item_config`; o finish do iPhone serializa `actual_duration_seconds: config.actual_duration_seconds` (`useWorkoutSession.ts:1388`) → `undefined`. O caminho nativo do telefone usa a chave certa (`components/workout/CardioCard.tsx:281`), e o finish via Watch também (`finishWorkoutFromWatch.ts:452`).
- **Impacto**: cardio executado no relógio e finalizado no celular fica sem duração real no histórico.
- **Correção sugerida**: `toggleCardioComplete(itemId, true, { actual_duration_seconds: elapsedSeconds })` em `[id].tsx:266`.

### Outras regras duplicadas (auditadas, com veredito)

| Regra | iPhone (TS) | Watch (Swift) | Veredito |
|---|---|---|---|
| Timer de descanso (mecânica) | timestamp-based, overlay + Live Activity (`[id].tsx:97-123`) | timestamp-based, sheet com haptics 30s/10s/0 (`WorkoutExecutionView.swift:1253-1347`) | OK — ambos sobrevivem a background; conteúdo diverge só em A4/A5 |
| Atraso do timer | imediato | 1,8s (espera banner de undo) + só dispara se `showUndoBanner` ainda visível (`:864-874`) | Baixo — comportamento intencional, mas se o usuário trocar de página em <1,8s o timer do Watch não dispara [Hipótese — testar] |
| Reps inicial de faixa "8-12" | herda string-alvo no fallback; `parseInt` → 8 ao persistir (`useWorkoutSession.ts:212-220,383`) | `startingReps("8-12") → 8` (`WorkoutExecutionState.swift:334-345`) | OK — convergem no banco |
| Cálculo de carga | sem motor %1RM em runtime; alvo é hint visual | idem (e %1RM nem aparece — A6) | OK (não há cálculo duplicado de 1RM) |
| `program_week` | `getProgramWeek` compartilhado (`@kinevo/shared/utils/schedule-projection`) nos dois caminhos de finish | n/a (calculado no TS) | OK — única fonte |
| Próximo treino / "hoje" | TS: `scheduled_days.some(d === getDay())` (`getProgramSnapshotForWatch` marca `isCompletedToday`) | Swift: `isScheduledToday` (`WorkoutModels.swift:523-528`) + ordenação própria (`WorkoutListView.swift:267-280`) | OK — mesma convenção 0=Dom; lógica de ordenação duplicada mas equivalente |
| Volume total | finish/share filtra `exerciseFunction === 'main'` quando existe (`[id].tsx:592-611`) | conta tudo com peso>0 (`WorkoutExecutionStore.swift:706-713`) | **A13 (Baixo)** — números de "Volume" diferentes na celebração do Watch vs. card de share do iPhone [Confirmado por leitura] |
| PR | iPhone compara com `previousSets`/máximos por exercício | Watch: `weight > lastWeight`, onde `lastWeight` = peso da série **mais recente**, não o máximo histórico (`getProgramSnapshotForWatch.ts:131-134`; `WorkoutExecutionStore.swift:716-722`) | **A13 (Baixo)** — "Novo recorde!" no Watch pode disparar sem ser PR real [Confirmado por leitura] |
| Formatação de peso | `formatWeightKg` compartilhado no iPhone | `String(format: "%.1f")` no Swift (`WorkoutExecutionView.swift:563`) | Baixo — Watch mostra "80.0" (ponto, decimal sempre); iPhone normaliza "80"/"80,5" |

### A10 — Aquecimento (warmup) não existe no Watch — **Severidade: Baixa** [Confirmado por leitura]
`getProgramSnapshotForWatch.ts:212` filtra apenas `exercise|cardio`; itens `warmup` (que o iPhone mostra como `WarmupCard`) somem no Watch. O aluno que treina só pelo relógio não vê o bloco de aquecimento prescrito. Correção: enviar como nota/card informativo.

### A11 — `rounds`/`roundNumber`/`muscleGroup` sem uso no Watch — **Severidade: Baixa** [Confirmado por leitura]
`rounds` nunca é enviado; `roundNumber` e `muscleGroup` são parseados e ignorados (§1.4/1.5). Drop-set 3 rodadas × 3 fases aparece como "Série 1/9…9/9" no Watch, enquanto o iPhone agrupa por rodada. Correção: usar `roundNumber` para exibir "Rodada 2 · fase 1" no header.

### A12 — Caminho v1 morto no envio, vivo no parse — **Severidade: Baixa** [Confirmado por leitura]
`getNextWorkoutForWatch.ts` (205 linhas) não tem chamadores; `syncWorkoutToWatch`/`sendWorkoutState` idem. O Swift mantém `WatchWorkout.parse`/`fromLegacy`/`reconcileWithSnapshot` v1 (`WorkoutModels.swift:5-75,353-397`; `WorkoutExecutionStore.swift:555-629`). Código morto duplicando contrato = superfície de drift (ex.: o merge v1 `reconcileWithSnapshot` tem semântica própria de `completedSets` que ninguém mais exercita). Correção: remover o pipeline v1 dos dois lados (ou documentar a data de remoção após janela de compat).

---

## 4. TEMA / UX — `KinevoTheme.swift` vs. design system do app

Tokens do app: `tailwind.config.js` (kinevo.background `#0D0D17`, surface `#1A1A2E`), `shared/tokens/legacy/colors.ts` (primary `#7c3aed`, warning `#f59e0b`), `shared/tokens/v2/colors.ts` (purple 600 `#7C3AED` / 500 `#8B5CF6`, success `#10B981`, surfaceDark canvas `#09090B` / card `#18181B`), CLAUDE.md (brand `#7c3aed`, bg `#0D0D17`, surface `#1A1A2E`).

| Token Watch (`KinevoTheme.swift:33-44`) | Valor | Equivalente no app | Veredito |
|---|---|---|---|
| `kinevoViolet` | #7C3AED | brand/purple-600 | OK |
| `kinevoVioletLight` | #8B5CF6 | purple-500 | OK |
| `kinevoBg` | #0D0D17 | kinevo.background (legacy) | OK vs legacy; **≠ v2 dark canvas #09090B** usado pela tela de treino (`useV2Colors` + `surfaceDark`, `shared/tokens/v2/colors.ts:49-55`) |
| `kinevoCard` | #1A1A2E | kinevo.surface (legacy) | OK vs legacy; **≠ v2 dark card #18181B** |
| `kinevoCardFocused` | #1E1E38 | — | Sem equivalente nos tokens (inventado no Watch) |
| `kinevoTextPrimary` | #F1F5F9 | — (legacy usa #f1f5f9 só como `inactiveBg`; v2 dark text vem de outra escala) | Divergente/ad-hoc (Baixo) |
| `kinevoTextSecondary` | #64748B | text secondary (CLAUDE.md) | OK |
| `kinevoSuccess` | `Color.green` (system) | #10B981 | **Divergente** — o token correto existe ao lado (`kinevoSuccessGradientStart` #10B981) mas as Views usam `.green`/`tint(.green)` do sistema (`WorkoutExecutionView.swift:230,419,667`) |
| `kinevoWarning` | #F59E0B | warning | OK |

Achados de tema — **A14, Severidade Baixa (conjunto)** [Confirmado por leitura]:
1. **Fundo preto puro em vez de `kinevoBg`** em toda a execução: `Color.black` em `WorkoutExecutionView.swift:70,400,484,728,1267,1392` — enquanto `WorkoutListView.swift:29` usa `kinevoBg`. Inconsistência interna do próprio Watch + divergência do app. (Defensável por OLED/always-on, mas então a lista também deveria ser preta.)
2. **Accent de superset**: Watch usa **cyan** (`WorkoutExecutionView.swift:744-749`; notas também cyan), iPhone usa **purple-600** para superset (`components/workout/SupersetGroup.tsx:51-80`). O aluno vê duas linguagens de cor para o mesmo conceito.
3. **Branding do personal não chega ao Watch**: o app do aluno re-escala toda a paleta purple pela marca custom do coach (`hooks/useV2Colors.ts:36-50` + `deriveBrandScale`); o Watch é hardcoded #7C3AED. Com o reposicionamento de branding (R$79,90), o relógio é a única superfície fora da marca. Correção: enviar `brandColor` no snapshot e derivar `kinevoViolet` em runtime.
4. **Tipografia**: Watch usa SF (system) com `design: .rounded` nos números; app usa Plus Jakarta Sans. Divergência inerente de plataforma (aceitável em watchOS), registrar como decisão.
5. **Emoji como ícone**: o badge de PR usa `\u{1F3C6}` 🏆 (`WorkoutExecutionView.swift:944`) — viola a regra "nunca emoji como ícone" do CLAUDE.md (no iPhone PR/troféu é Lucide). Trocar por `Image(systemName: "trophy.fill")` (já usado no `FinishStatRow:457`).
6. Tela de treino v2 do iPhone (dark) usa `#09090B/#18181B`; Watch usa `#0D0D17/#1A1A2E` (legacy). Decidir qual paleta é canônica para superfícies de treino e alinhar.

---

## 5. Resumo dos achados

| ID | Severidade | Achado | Evidência principal |
|---|---|---|---|
| A1 | Alta | SET_COMPLETE aplicado por índice; exerciseId ignorado → série no exercício errado após reorder/merge | `app/workout/[id].tsx:256`; `WorkoutExecutionStore.swift:317-320`; `useWorkoutSession.ts:481` |
| A2 | Alta | Finish no iPhone limpa o Watch sem coletar séries locais; SET_COMPLETE sem handler fora da tela | `WorkoutExecutionStore.swift:147-162`; `app/_layout.tsx:306` |
| A3 | Alta | Duplo-finish: upsert do Watch rebaixa séries (`is_completed=false`) e fallback sem sessionId duplica workout_session após 5 min | `lib/finishWorkoutFromWatch.ts:366-381,288-335,235-250` |
| A4 | Média/Alta | Rest 0s prescrito vira 60s no Watch (drop-set/cluster) | `getProgramSnapshotForWatch.ts:248`; `WorkoutExecutionView.swift:841-842` |
| A5 | Média | Superset: Watch descansa após cada série; iPhone só ao fim da rodada (supersetRestSeconds não enviado) | `[id].tsx:79-104`; `WorkoutExecutionView.swift:864-874` |
| A6 | Média | %1RM descartado no Swift; RIR/cadência nem enviados — prescrição invisível no Watch | `getProgramSnapshotForWatch.ts:180-191`; `WorkoutExecutionState.swift:205-242`; `SetRow.tsx:109-110` |
| A7 | Média | Waterfall: critérios diferentes (heterogeneidade vs method_key) → Watch pode sobrescrever prescrição por série | `useWorkoutSession.ts:34-58`; `WorkoutExecutionStore.swift:417-430` |
| A8 | Média | Cardio via Watch + finish no iPhone perde duração (chave `elapsedSeconds` ≠ `actual_duration_seconds`) | `[id].tsx:266`; `useWorkoutSession.ts:1388` |
| A9 | Média | Sem realtime: edição do treinador só chega ao Watch em launch/start/finish/sign-in | `app/_layout.tsx:353-396` |
| A10 | Baixa | Itens warmup não são enviados ao Watch | `getProgramSnapshotForWatch.ts:212` |
| A11 | Baixa | `rounds` não enviado; `roundNumber`/`muscleGroup` parseados e não exibidos | `WorkoutModels.swift:455-483` |
| A12 | Baixa | Pipeline v1 morto no envio, vivo no parse — superfície de drift | `lib/getNextWorkoutForWatch.ts`; `WorkoutModels.swift:353-397` |
| A13 | Baixa | Volume (filtro 'main') e PR (último peso vs máximo) divergem entre resumos | `[id].tsx:592-611`; `WorkoutExecutionStore.swift:706-722`; `getProgramSnapshotForWatch.ts:131-134` |
| A14 | Baixa | Tema: preto puro vs kinevoBg, cyan vs purple no superset, sem branding custom, emoji 🏆, legacy vs v2 dark | `KinevoTheme.swift:33-44`; `WorkoutExecutionView.swift:70,744,944`; `useV2Colors.ts:36-50` |
