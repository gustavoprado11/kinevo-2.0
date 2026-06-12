# Análise Watch — Fase 1: Mapa do fluxo de dados (Watch ↔ iPhone ↔ Supabase)

> Análise somente-leitura realizada em 2026-06-11. Todos os trechos citados foram lidos integralmente nos arquivos indicados. Onde a conclusão depende de comportamento de runtime (WatchConnectivity, background launch do iOS), está marcado explicitamente como **hipótese que precisa de teste em device**.

## Sumário

O fluxo é: o iPhone monta um **snapshot completo do programa** (`getProgramSnapshotForWatch`, schemaVersion 2) a partir de 6+ queries no Supabase e o envia ao Watch via `updateApplicationContext` (canal last-write-wins). O Watch decodifica com parsing manual de dicionários (tolerante a campos faltantes nos tipos v2, mas estrito nos tipos v1), executa o treino em um `WorkoutExecutionStore` com persistência atômica em JSON a cada mutação, e ao finalizar envia `FINISH_WORKOUT` via `sendMessage` (com fallback `transferUserInfo`), junto com `WORKOUT_HEALTH_SAMPLES` (sempre `transferUserInfo`). No iPhone, `finishWorkoutFromWatch` grava `workout_sessions` + `set_logs` no Supabase com idempotência via upsert e fila de retry em SecureStore, e devolve um ACK `SYNC_SUCCESS` que libera o estado pendente no Watch. A arquitetura é em geral defensiva (persist-first, dedup, upsert, ACK), mas tem pontos frágeis reais: a camada "persist-first" nativa do iPhone (`WCSessionRelay`) está **efetivamente morta** porque nunca é ativada no AppDelegate; eventos recebidos entre o load do módulo nativo e o attach do listener JS ficam só em memória; falhas "permanentes" no save descartam o treino sem fila; o Watch nunca reenvia um `FINISH_WORKOUT` pendente e limpa o estado pendente após 10 minutos no relaunch; e amostras de saúde não têm retry.

---

## 1. Como o iPhone monta o payload do treino

### 1.1 Caminhos de montagem

Existem **dois geradores de payload**, mas só um está vivo:

- **`mobile/lib/getProgramSnapshotForWatch.ts` (vivo — schemaVersion 2).** Chamado em 4 pontos, todos dentro de `WatchBridge` em `mobile/app/_layout.tsx`:
  1. Auto-sync no launch do app, com retries em 0s/3s/8s/15s (`_layout.tsx:355-378`) — cobre auth ainda carregando no cold start.
  2. Re-sync após `SIGNED_IN` (troca de conta) (`_layout.tsx:382-396`).
  3. Re-sync imediato quando o Watch pede `START_WORKOUT` (`_layout.tsx:78-93`), seguido de `UPDATE_EXERCISE_ORDER` via `sendReliableToWatch` (porque o applicationContext "é eventual e chega tarde demais" — comentário no próprio código).
  4. Re-sync após finalização vinda do Watch, para atualizar `isCompletedToday` (`_layout.tsx:227-237`).

- **`mobile/lib/getNextWorkoutForWatch.ts` (CÓDIGO MORTO — v1).** `grep` em todo o `mobile/` não encontra nenhum import/chamada fora do próprio arquivo. O caminho v1 (`syncWorkoutToWatch`/`sendWorkoutToWatch` em `useWatchConnectivity.ts:197-204`) também não tem nenhum chamador — o hook expõe `sendWorkoutToWatch` mas nenhuma tela o usa. Todo o suporte v1 no Watch (`WatchProgramSnapshot.fromLegacy`, `WatchWorkout.parse`) é retrocompatibilidade para builds antigos do iPhone.

> Nota: o prompt menciona `mobile/components/WatchBridge.tsx` — esse arquivo **não existe**. O `WatchBridge` é uma função-componente definida inline em `mobile/app/_layout.tsx:44-399` (o CLAUDE.md do mobile está desatualizado nesse ponto).

### 1.2 Queries que alimentam o snapshot (getProgramSnapshotForWatch.ts)

1. `students` (id por `auth_user_id`) — linha 36.
2. `assigned_programs` ativo (`id, name, current_week, duration_weeks, started_at`) — linha 49.
3. `assigned_workouts` + `assigned_workout_items` aninhado (`id, item_type, parent_item_id, exercise_id, exercise_name, exercise_muscle_group, sets, reps, rest_seconds, order_index, item_config, method_key, rounds, notes`) — linhas 63-72.
4. `workout_sessions` de hoje (para `isCompletedToday`) — linhas 85-95.
5. `workout_sessions` completed (última por treino → `lastCompletedAt`) — linhas 99-112.
6. `set_logs` completos por item (último peso/reps usados → `lastWeight`/`lastReps`) — linhas 124-139. **Sem LIMIT** — ordena tudo por `completed_at desc` e pega o primeiro por item em JS; com histórico longo isso retorna a tabela inteira filtrada por item ids (custo cresce com o tempo de uso — F11).
7. `assigned_workout_item_sets` (prescrição por série dos métodos avançados) — linhas 146-169, hidratado por `hydrateSetPrescriptions` em fallback uniforme.

### 1.3 Campos que VÃO no payload (por exercício)

`id` (= assigned_workout_item_id), `name`, `muscleGroup`, `sets` (= `setDetails.length` quando há prescrição por série), `reps` (**numérico**, ver F10), `weight`/`lastWeight` (último peso usado), `restTime`, `targetReps` (string crua), `lastReps`, `methodKey`, `methodLabel`, `setDetails[]` (setNumber, setType, setTypeLabel, repsTarget, restSeconds, weightTargetKg, weightTargetPct1rm, roundNumber, notes), `notes` (nota do exercício), `supersetIndex`/`supersetTotal`. Por treino: `workoutId`, `workoutName`, `orderIndex`, `scheduledDays`, `isCompletedToday`, `lastCompletedAt`, `cardioItems[]` (mode, equipment+label, objective, durationMinutes, distanceKm, intensity, workSeconds, restSeconds, rounds), `notes[]` (blocos de recado do dia, `item_type='note'`). Por programa: `programId`, `programName`, `currentWeek` (projetado de `started_at` via `getProgramWeek`), `totalWeeks`, `scheduleMode`.

### 1.4 Campos do treino prescrito que NÃO vão

- **`tempo` e `rir`** de `assigned_workout_item_sets`: são lidos na query (linha 148) e até entram no objeto `WorkoutSet` intermediário (linhas 163-164), mas `buildSetDetails` (linhas 180-190) **não os mapeia** para `WatchSetDetail` — o Watch nunca vê tempo/RIR.
- **`rounds`** do item (lido na query, linha 68) — não vai como campo; só indiretamente via expansão de `setDetails`.
- **`exercise_id`** (id do exercício de catálogo) — só o id do item vai; sem vídeo/instrução do exercício no Watch.
- **Itens `item_type` desconhecidos** (qualquer coisa que não seja `exercise`, `cardio`, `superset` ou `note`) são filtrados fora (linhas 211-214).
- **`weight_target_pct1rm` vai**, mas o Watch não tem 1RM para resolver a porcentagem — vai como número cru.
- **`feedback`/observações do aluno**, fotos, vídeos: fora de escopo do payload.
- No caminho v1 morto (`getNextWorkoutForWatch`), nem `weight`, `lastWeight`, `setDetails`, `notes`, `cardio` iam — só `sets/reps/restTime`.

---

## 2. Como o payload trafega (iPhone → Watch e Watch → iPhone)

### 2.1 APIs WatchConnectivity por tipo de dado

| Dado | Direção | API | Comportamento se !reachable |
|---|---|---|---|
| Snapshot do programa (v2) / treino (v1) | iPhone→Watch | `updateApplicationContext` (`WatchConnectivityModule.swift:560-587`) | **Independe de reachable** — last-write-wins, entregue na próxima oportunidade. Se a sessão WC não está ativada, guarda em `pendingApplicationContext` e dá flush na ativação (linhas 574-577, 589-607). Se `updateApplicationContext` lançar erro com sessão ativada, o erro é **logado e descartado** (linha 584-585, F2). |
| `UPDATE_EXERCISE_ORDER`, `SESSION_SYNC`, `START_WORKOUT_FROM_PHONE`, `WORKOUT_FINISHED_FROM_PHONE`, `WORKOUT_DISCARDED_FROM_PHONE`, `SET_COMPLETE_FROM_PHONE` | iPhone→Watch | `sendReliableToWatch` (`WatchConnectivityModule.swift:650-668`): `sendMessage` se reachable, senão `transferUserInfo` (fila garantida); fallback para `transferUserInfo` também em erro do `sendMessage` | **Enfileirado** via `transferUserInfo`. Exceção: se a sessão não está ativada, log + **descarte silencioso** (linha 651-654, F6). E se o wrapper JS cair no fallback legado (`WatchConnectivityModule.ts:99-108`), usa `sendMessage` com `.catch(() => {})` — **descarte silencioso** quando inreachable. |
| ACK `SYNC_SUCCESS` | iPhone→Watch | `sendAckToWatch` (`WatchConnectivityModule.swift:624-648`): mesma estratégia reliable | Enfileirado via `transferUserInfo`. |
| `sendMessage` genérico (export JS `sendMessage`) | iPhone→Watch | `sendMessage` puro (`WatchConnectivityModule.swift:609-620`) | **Rejeita** a Promise com `WATCH_UNREACHABLE` — sem fila. (Hoje sem chamador crítico no app.) |
| `SET_COMPLETE`, `START_WORKOUT`, `FINISH_WORKOUT`, `CARDIO_COMPLETE`, `DISCARD_WORKOUT` | Watch→iPhone | `sendReliable` (`WatchSessionManager.swift:287-304`): `sendMessage` se reachable, senão/em erro `transferUserInfo` | **Enfileirado**. Exceção: sessão não ativada → log + descarte (linha 288-291). |
| `WORKOUT_HEALTH_SAMPLES` | Watch→iPhone | **Sempre** `transferUserInfo` (`WatchSessionManager.swift:228-248`) | Enfileirado por design ("tolera iPhone offline"). |

### 2.2 Recepção no iPhone — a cadeia de três camadas e seus buracos

O lado iOS tem duas camadas de delegate:

1. **`WCSessionRelay`** (`WatchConnectivityModule.swift:65-208`) — desenhado para ser ativado no `AppDelegate.didFinishLaunching` com filosofia "PERSIST FIRST, FORWARD SECOND" (grava todo evento em UserDefaults antes de encaminhar). **Porém `grep` em `ios/Kinevo/AppDelegate.swift` e em `plugins/` não encontra nenhuma chamada a `WCSessionRelay.activate()`** — o próprio módulo admite isso no comentário das linhas 358-361 ("Expo's auto-generated AppDelegate doesn't include it"). Resultado: o relay **nunca vira delegate da WCSession**; o caminho de persistência em UserDefaults é código morto em produção (F1).
2. **`SessionDelegate`** (`WatchConnectivityModule.swift:225-319`) — vira delegate no `OnCreate` do módulo Expo (linha 353) e ativa a sessão (linha 362-367). Encaminha eventos para `emitWatchMessageEvent`, que: se há listener JS, emite; senão **bufferiza em memória** (`bufferedWatchEvents`, linhas 670-691) e dá flush no `OnStartObserving`. **Não persiste em disco** — se o app morrer entre receber o `transferUserInfo` (já consumido da fila do WC daemon) e o attach do listener JS, o evento é perdido (F3).
3. **JS** — `useWatchConnectivity.ts` (montado uma vez no `WatchBridge`, fora do AuthProvider justamente para montar cedo) parseia e despacha para os handlers de `_layout.tsx`.

**App iPhone morto/background quando o Watch finaliza:** `sendMessage` do Watch acorda o app iOS em background (comportamento documentado do WC), e `transferUserInfo` entrega quando o app rodar de novo. O comentário em `WatchSessionManager.swift:196-198` ("transferUserInfo alone may not wake the JS runtime") indica que o time já observou que a entrega nativa acontece mas o salvamento JS pode não rodar a tempo na janela de background. **Hipótese que precisa de teste em device:** com o app morto, o ciclo completo (acordar → módulo OnCreate → listener JS → queries Supabase → ACK) dentro da janela de execução em background concedida pelo iOS. As mitigações existentes (pré-criação de sessão `in_progress` no START, fila SecureStore, ACK + estado pendente no Watch) sugerem que esse caminho falha com frequência suficiente para ter sido blindado.

---

## 3. Como o Watch decodifica (WorkoutModels.swift — 690 linhas, lido por inteiro)

Tudo é **parsing manual de `[String: Any]`** (sem `Codable` para o payload do iPhone — `Codable` só é usado na persistência local e em `WatchCardioItem`). Recepção em `WatchSessionManager.didReceiveApplicationContext` → `parseApplicationContext` (linhas 354-385): `schemaVersion >= 2` → `WatchProgramSnapshot.parse`; senão caminho legado v1.

### 3.1 Estrito vs tolerante

- **Estritos (guard → nil e descarta):**
  - `WatchProgramSnapshot.parse` exige `programId`, `programName`, `workouts[]` (linhas 326-333). Falha ⇒ `programSnapshot = nil` ⇒ Watch mostra estado vazio mesmo com hasProgram=true (F7).
  - `WatchProgramWorkoutSummary.parse` exige `workoutId` + `workoutName` (530-535) — treino sem nome some da lista silenciosamente (`compactMap`).
  - `WatchProgramExerciseSummary.parse` exige só `id` + `name` (455-461); resto tem default (`sets: 3`, `reps: 0`, `restTime: 60`).
  - **v1**: `WatchWorkout.parse`/`WatchExercise.parse` exigem quase tudo, inclusive `completedSets` (linhas 14-37, 50-74) — qualquer campo faltante mata o exercício inteiro. Relevante só para retrocompat.
- **Tolerantes (default):** `currentWeek ?? 1`, `totalWeeks ?? 0`, `scheduleMode ?? .flexible`, `scheduledDays ?? []`, `setDetails ?? []`, `notes ?? []`, cardio com defaults (`mode ?? "continuous"`, `orderIndex ?? 999`).
- **Tipos numéricos:** mistura `as? Int` direto (ex.: `sets`, `restTime`, `durationMinutes`) com `(as? NSNumber)?.intValue` (ex.: `lastReps`, `supersetIndex`, todos os campos de `WatchSetDetail`). Como o payload chega de `JSONSerialization` (NSNumber), `as? Int`/`as? Double` funcionam via bridging Obj-C — mas `as? Double` em um NSNumber inteiro (`weight: 80` sem casa decimal serializado pelo JS como `80`) funciona em bridging Foundation; **hipótese de baixo risco**, o padrão NSNumber usado nos campos novos é o correto e o histórico do código sugere que os campos antigos nunca quebraram em device.
- **Forward-compat:** `case 2...:` em `parseApplicationContext` e em `reconcile` — schema 3+ será tratado como v2 em vez de cair no caminho v1 (que limparia o programa). Bom design.

### 3.2 O que quebra se o payload mudar de formato

- Renomear/remover `programId`, `programName`, `workouts`, `workoutId`, `workoutName`, `id`, `name` (exercício) ⇒ item/programa silenciosamente descartado (apenas `print`).
- `NSNull` no payload: o iPhone sanitiza recursivamente antes de enviar (`sanitizeForPropertyList`, `WatchConnectivityModule.swift:543-558`) porque WC rejeita NSNull — campos `null` do JS **desaparecem** do dicionário, e os parsers tratam ausência como nil/default. Coerente.
- Persistência local: `WorkoutExecutionState`/`ExerciseState`/`SetState` têm `init(from decoder:)` manual com `decodeIfPresent` + defaults para todo campo novo (`WorkoutExecutionState.swift:41-55, 138-150, 154-169`) — estado antigo em disco decodifica limpo após updates. Se a decodificação falhar mesmo assim, `WorkoutStatePersistence.load()` retorna nil (treino em andamento perdido no relaunch — F9 residual).

---

## 4. Estado de execução no Watch

### 4.1 Ciclo de vida (`WorkoutExecutionStore.swift`, 732 linhas)

- `loadWorkout` (pré-início) / `startWorkout` (marca `hasStarted`, `startedAt`, aplica `sessionId` cacheado de `SESSION_SYNC`). `startWorkout` com outro treino ativo é **ignorado silenciosamente** (linhas 56-60) — inclusive remote start (F8 menor).
- Mutações: `completeSet` (persistência imediata; faz carry-forward de carga/reps para séries futuras, com exceção para métodos avançados que têm carga própria — linhas 397-446), `updateReps`/`updateWeight` (debounce 500ms — janela de perda de até 500ms num crash, mitigada pelo flush em `scenePhase` background/inactive em `KinevoWatchApp.swift:121-126`), `undoLastCompletedSet`, `markCardioCompleted`, `setExerciseIndex`.
- Reconciliação: `reconcileProgram` (novo applicationContext) faz merge preservando progresso, adiciona exercícios inseridos pelo trainer mid-session, **nunca destrói treino iniciado** (linhas 257-333, 573-590); `updateExerciseOrder` reordena por id preservando progresso (339-392); `applyRemoteSetComplete` espelha séries logadas no iPhone (189-210).
- Finalização: `markFinishPending` é persistido **ANTES** do envio do `FINISH_WORKOUT` (`WorkoutExecutionView.swift:374-376`); `acknowledgeFinish` (via `SYNC_SUCCESS`) limpa o estado **somente** se workoutId bate e finishState == .pending (123-141).
- **Restauração no init (linhas 29-50):** estado `.pending` com `lastPersistedAt` mais velho que **10 minutos** é **deletado** assumindo "ACK provavelmente recebido com o app morto" (F5). Se na verdade o save no iPhone nunca aconteceu (ex.: F3/F4), os dados do treino somem do Watch — e como o `FINISH_WORKOUT` **nunca é reenviado pelo Watch** (nenhum código de re-send; só `transferUserInfo` do WC garante a entrega original), a única cópia restante seria a fila SecureStore do iPhone *se* o payload chegou lá.

### 4.2 Persistência (`WorkoutStatePersistence.swift`, 74 linhas)

Arquivo único `active-workout-state.json` em Application Support; escrita atômica (temp + `replaceItemAt`); `load()` retorna nil em erro de decode (sem backup/recovery); JSON ISO8601. Sólido para o propósito.

### 4.3 Recepção/envio no Watch (`WatchSessionManager.swift`, 535 linhas)

- Ativa WCSession no init do `@StateObject` (app launch). No `activationDidComplete` lê `session.receivedApplicationContext` cacheado (linhas 321-337) — sem isso o Watch ficaria "Aguardando" para contexts entregues antes da ativação. 
- Roteia mensagens do iPhone (`SYNC_SUCCESS`, `SESSION_SYNC`, `START/FINISH/DISCARD/SET_COMPLETE_FROM_PHONE`, `UPDATE_EXERCISE_ORDER`) para callbacks fechados em `KinevoWatchApp.onAppear` (linhas 24-93 de `KinevoWatchApp.swift`). **Os callbacks só são instalados no `onAppear` da WindowGroup** — mensagens processadas entre `init` dos StateObjects e o primeiro `onAppear` chamariam callbacks nil (janela de milissegundos; o dispatch para main queue provavelmente cobre — **hipótese, risco baixo**).
- Simulador: mock data após 2s (apenas `#if targetEnvironment(simulator)`).

---

## 5. Conclusão: Watch → iPhone → Supabase (`finishWorkoutFromWatch.ts`, 502 linhas)

### 5.1 Pipeline (handler `onWatchFinishWorkout` em `_layout.tsx:184-255`)

1. **Dedup** de eventos duplicados (mesmo workoutId em <5s) — necessário porque o fallback do `sendReliable` pode duplicar (sendMessage entregue + erro tardio → transferUserInfo do mesmo payload).
2. `finishWorkoutFromWatch(payload)`:
   - **Step 1:** `refreshSession()` (token pode ter expirado num treino longo) — falha tolerada.
   - **Step 2:** sem usuário autenticado → `savePendingWorkout` (fila em **SecureStore**, chave `kinevo_pending_finish_workouts`, idempotente por workoutId — substitui em vez de empilhar, linhas 60-73) e retorna `'pending'`.
   - **Steps 3-4:** busca `students` e `assigned_workouts`. Erro de query (transiente) → fila + `'pending'`. **Linha não encontrada (permanente) → `return null` — payload DESCARTADO sem fila** (linhas 178-181, 197-200; F4).
   - **Step 5:** duração = now − startedAt do Watch, com teto de segurança de 6h (descarta duração acima disso).
   - **Step 6:** resolução da sessão, em ordem de preferência:
     - (a) `sessionId` canônico ecoado pelo Watch (`SESSION_SYNC`) → UPDATE direto para `completed` (linhas 231-250);
     - (b) sessão `in_progress` existente do mesmo workout+student → UPDATE (253-285);
     - (c) **idempotência**: sessão `completed` nos últimos 5 min → reusa (287-302);
     - (d) INSERT de sessão nova já `completed` com `program_week` calculado (303-335).
   - **Step 7:** grava **`set_logs`** (todas as séries, completas e incompletas) via **`upsert` com `onConflict: 'workout_session_id,assigned_workout_item_id,set_number'`** — idempotente para retries. Se o upsert falhar, **reverte a sessão para `in_progress`** (best-effort) e re-enfileira (correção A3, linhas 394-409) — evita "treino concluído com 0 séries".
   - **Step 8:** mesmo padrão para cardio (`set_logs` com `notes` JSON contendo config + `actual_duration_seconds`).
   - Tabelas tocadas: **`workout_sessions`** (insert/update) e **`set_logs`** (upsert). `workout_health_samples` é gravada por outro caminho (5.3).
3. Sucesso → `sendAckToWatch(workoutId)` (`SYNC_SUCCESS`) + re-sync do snapshot do programa. `'pending'`/null → **sem ACK** (Watch fica em finishState=.pending).
4. **Sempre** emite `WORKOUT_COMPLETED`/`WATCH_WORKOUT_FINISHED` e navega para home — mesmo em falha (o retry fica por conta da fila).

### 5.2 Fila de retry (`processPendingWatchWorkouts`, linhas 79-127)

Reprocessada no mount do `WatchBridge` + retry após 5s (`_layout.tsx:347-351`). Para cada entrada: sucesso real (id de sessão) remove; `'pending'`/null/exceção mantém. **Nota:** `null` (falha "permanente", ex. treino deletado) mantém a entrada na fila para sempre nesse caminho — inconsistente com o descarte imediato do caminho direto (a fila só é alimentada por falhas transientes, então um null no retry vira entrada zumbi reprocessada a cada launch; volume baixo, F4b).

### 5.3 Amostras de saúde

Watch envia `WORKOUT_HEALTH_SAMPLES` sempre por `transferUserInfo` após o FINISH (`WorkoutExecutionView.swift:386-390`). iPhone (`useWorkoutHealthUpload.ts`) resolve a sessão: `sessionId` canônico do payload, ou **heurística** assigned_workout_id + janela de 15 min (`completed` recente, fallback `in_progress`) — ambígua se o mesmo treino for completado 2x em 15 min (warn de monitoramento, linhas 40-46). Upsert em **`workout_health_samples`** com `onConflict: 'workout_session_id'`. **Falha de upload = perda silenciosa** — `onWatchHealthSamples` só loga warn (`_layout.tsx:294-304`); não há fila/retry (F12).

### 5.4 App iPhone morto/background quando o Watch finaliza

Cadeia de proteção: (i) `transferUserInfo` persiste no daemon do WC até o app rodar; (ii) `SET_COMPLETE` por série já foi espelhado durante o treino quando possível; (iii) sessão `in_progress` pré-criada no START (com `SESSION_SYNC` devolvendo o id canônico, `_layout.tsx:99-167`) garante que existe um registro mesmo sem o FINISH; (iv) cleanup marca `in_progress` >24h como `abandoned` (`_layout.tsx:316-343`) — se o FINISH chegar depois disso pelo caminho do sessionId canônico, o UPDATE direto ainda promove para `completed` (o update por id não filtra status). O elo fraco é (F3): a entrega nativa consome o userInfo da fila do WC e o bufferiza **em memória** até o JS attachar; morte do app nessa janela perde o evento — e o Watch, achando que enviou, eventualmente limpa o pending (F5). **Hipótese que precisa de teste em device:** frequência real dessa janela num cold start em background.

---

## 6. Diagrama de sequência com pontos de falha

```mermaid
sequenceDiagram
    autonumber
    participant SB as Supabase
    participant IP as iPhone (RN/JS)
    participant NM as iPhone (módulo nativo WC)
    participant W as Watch (WatchSessionManager)
    participant ST as Watch (WorkoutExecutionStore + disco)

    Note over IP: Launch / SIGNED_IN / pós-finish
    IP->>SB: 6-7 queries (programa, treinos, itens, sessões, set_logs, item_sets)
    Note right of IP: F11: query set_logs sem LIMIT
    IP->>NM: syncProgramToWatch(JSON v2)
    NM->>W: updateApplicationContext (last-write-wins)
    Note right of NM: F2: erro do updateApplicationContext<br/>com sessão ativada é só logado
    W->>W: parseApplicationContext → WatchProgramSnapshot.parse
    Note right of W: F7: payload inválido ⇒ programa nil<br/>silencioso (compactMap descarta itens)

    Note over W: Usuário toca "Iniciar treino"
    W->>ST: loadWorkout + markStarted (persist imediato)
    W->>NM: START_WORKOUT (sendReliable)
    Note right of W: F6: sessão WC não ativada ⇒ descarte silencioso
    NM->>IP: onWatchMessage
    Note right of NM: F1: WCSessionRelay.activate() nunca chamado<br/>⇒ persist-first em UserDefaults morto<br/>F3: buffer só em memória até listener JS
    IP->>SB: pré-cria workout_session (in_progress)
    IP->>NM: SESSION_SYNC {sessionId} + UPDATE_EXERCISE_ORDER (reliable)
    NM->>W: sendMessage / transferUserInfo
    W->>ST: setSessionId / updateExerciseOrder

    loop Cada série
        W->>ST: completeSet (persist imediato; crown = debounce 500ms)
        W->>NM: SET_COMPLETE (sendReliable)
        NM->>IP: espelha na tela de treino (se montada)
    end

    Note over W: Usuário finaliza (RPE)
    W->>ST: markFinishPending (persiste ANTES do envio)
    W->>NM: FINISH_WORKOUT {sessionId, rpe, startedAt, exercises, cardio}
    Note right of W: F5: Watch NÃO reenvia; relaunch com pending<br/>>10min ⇒ estado deletado sem confirmação
    W->>NM: WORKOUT_HEALTH_SAMPLES (transferUserInfo)
    NM->>IP: onWatchMessage FINISH_WORKOUT
    IP->>IP: dedup 5s
    IP->>SB: refreshSession → students → assigned_workouts
    Note right of IP: F4: linha não encontrada ⇒ return null<br/>payload DESCARTADO sem fila
    alt sessionId canônico
        IP->>SB: UPDATE workout_sessions → completed
    else heurística
        IP->>SB: in_progress? UPDATE / completed <5min? reusa / INSERT
    end
    IP->>SB: UPSERT set_logs (exercícios + cardio)
    Note right of IP: falha ⇒ reverte sessão p/ in_progress + fila SecureStore (A3 ok)
    alt sucesso
        IP->>NM: sendAckToWatch SYNC_SUCCESS
        NM->>W: sendMessage/transferUserInfo
        W->>ST: acknowledgeFinish ⇒ clearWorkout (apaga arquivo)
        IP->>SB: re-fetch snapshot
        IP->>NM: syncProgramToWatch (isCompletedToday)
    else auth/transiente
        IP->>IP: fila SecureStore (retry no próximo launch +5s)
        Note right of IP: F4b: entradas com falha "permanente"<br/>ficam zumbis na fila
    end
    IP->>SB: UPSERT workout_health_samples
    Note right of IP: F12: falha no upload de HR ⇒ perda silenciosa, sem fila<br/>F13: builds antigos: mapeamento por janela de 15min ambíguo
```

### Tabela consolidada de pontos de falha

| ID | Sev. | Descrição | Evidência | Status |
|---|---|---|---|---|
| **F1** | **Alto** | `WCSessionRelay.activate()` nunca é chamado (não está em `ios/Kinevo/AppDelegate.swift` nem injetado por plugin) ⇒ a camada "persist first" em UserDefaults para eventos Watch→iPhone é código morto; toda a recepção depende do `SessionDelegate` do módulo Expo. | `WatchConnectivityModule.swift:356-361` ("Expo's auto-generated AppDelegate doesn't include it"); grep negativo em `AppDelegate.swift` e `plugins/` | Confirmado por leitura |
| **F2** | Médio | `updateApplicationContext` que lança erro com sessão já ativada é apenas logado — snapshot do programa perdido até o próximo trigger de sync. Inclui o cenário de payload acima do limite de tamanho do WC (programa grande com muitos setDetails/notas). | `WatchConnectivityModule.swift:580-586` (`catch { NSLog … }`) | Confirmado (descarte); estouro de tamanho = hipótese p/ device |
| **F3** | **Alto** | Eventos do Watch recebidos pelo `SessionDelegate` antes do listener JS attachar ficam só em `bufferedWatchEvents` (memória). `transferUserInfo` já foi consumido da fila do WC; morte do app nessa janela perde FINISH_WORKOUT/HEALTH_SAMPLES definitivamente. | `WatchConnectivityModule.swift:670-691` (buffer em array), `:331-334` | Confirmado por leitura; frequência = hipótese p/ device |
| **F4** | **Alto** | `finishWorkoutFromWatch` retorna `null` (sem fila) quando `students` ou `assigned_workouts` não retornam linha ("permanente") — ex.: trainer deletou o treino durante a sessão. Dados do treino descartados; sem ACK o Watch fica pending e F5 termina o serviço. | `finishWorkoutFromWatch.ts:178-181, 197-200` | Confirmado |
| F4b | Baixo | No retry da fila, `null` mantém a entrada para sempre (zumbi reprocessado a cada launch) — inconsistente com o descarte do caminho direto. | `finishWorkoutFromWatch.ts:106-110` | Confirmado |
| **F5** | **Alto** | Watch nunca reenvia FINISH_WORKOUT; no relaunch, estado `.pending` com >10 min é deletado presumindo "ACK perdido". Se o save nunca ocorreu (F3/F4), a última cópia dos dados morre. | `WorkoutExecutionStore.swift:34-42`; ausência de qualquer re-send (grep `sendFinishWorkout` só em `WorkoutExecutionView.swift:376`) | Confirmado |
| F6 | Médio | `sendReliable`/`sendReliableToWatch` descartam silenciosamente quando a WCSession não está `.activated` (só NSLog). Janela curta no launch, mas atinge START_WORKOUT/SET_COMPLETE/SESSION_SYNC. | `WatchSessionManager.swift:288-291`; `WatchConnectivityModule.swift:651-654`; fallback JS `WatchConnectivityModule.ts:99-108` (`.catch(() => {})`) | Confirmado |
| F7 | Médio | Parsers do Watch usam `guard`+`compactMap` sem telemetria: programa/treino/exercício com campo obrigatório ausente some silenciosamente da UI (apenas `print`). Mudança de contrato no iPhone não é detectável pelo usuário. | `WorkoutModels.swift:320-350, 530-535, 14-37` | Confirmado |
| F8 | Médio | `startWorkout`/`handleRemoteStart` com outro treino ativo são ignorados sem feedback ao usuário/iPhone — o iPhone acha que iniciou, o Watch continua no treino antigo (estados divergem até um finish). | `WorkoutExecutionStore.swift:56-60, 216-225` | Confirmado |
| F9 | Baixo | `WorkoutStatePersistence.load()` retorna nil em erro de decode sem backup — treino em andamento perdido no relaunch. Mitigado pelos `decodeIfPresent` + defaults em todos os campos novos. | `WorkoutStatePersistence.swift:50-61`; `WorkoutExecutionState.swift:41-55` | Confirmado (risco residual) |
| F10 | Baixo | `reps: parseInt(item.reps)` degrada faixas: "8-12" → 8, "AMRAP" → 0. O Watch usa `targetReps`/`setDetails` quando presentes, mas o fallback uniforme (`makeExercise` sem setDetails) inicializa reps do valor degradado. | `getProgramSnapshotForWatch.ts:246`; `getNextWorkoutForWatch.ts:187`; `WorkoutExecutionState.swift:233-241` | Confirmado |
| F11 | Médio | Query de últimos pesos busca **todos** os `set_logs` completos dos itens do programa sem LIMIT, ordenados por data — payload e latência do sync crescem com o histórico do aluno (roda em todo launch + todo finish). | `getProgramSnapshotForWatch.ts:124-129` | Confirmado (impacto = hipótese de escala) |
| F12 | Médio | Upload de `workout_health_samples` sem fila/retry: erro de rede/RLS = perda silenciosa dos dados de FC/calorias (handler só faz `console.warn`). | `useWorkoutHealthUpload.ts:92-95`; `_layout.tsx:294-304` | Confirmado |
| F13 | Baixo | Mapeamento de health samples por `assigned_workout_id` + janela de 15 min (builds de Watch sem `sessionId`) é ambíguo para treinos repetidos — pode anexar FC à sessão errada. | `useWorkoutHealthUpload.ts:14-63` (warn de ambiguidade nas linhas 40-46) | Confirmado (caminho legado) |
| F14 | Baixo | Código morto/contrato fantasma: `getNextWorkoutForWatch.ts` e o caminho v1 (`syncWorkoutToWatch`/`sendWorkoutToWatch`) não têm chamadores; `WatchBridge` não é `components/WatchBridge.tsx` (CLAUDE.md desatualizado). Custo de manutenção e risco de reativação acidental do v1 (payload sem pesos/setDetails). | grep negativo de chamadores; `useWatchConnectivity.ts:197-204` | Confirmado |
