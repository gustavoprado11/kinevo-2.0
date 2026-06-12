# Investigação B — Robustez e Edge Cases do App Apple Watch

> Análise somente-leitura (jun/2026) de `mobile/targets/watch-app/**` e `mobile/modules/watch-connectivity/ios/WatchConnectivityModule.swift`. Todos os arquivos Swift foram lidos por inteiro; o inventário do item 7 foi varrido com grep e confirmado lendo o contexto de cada ocorrência.

## Sumário

A arquitetura de robustez do watch app é, no geral, bem pensada: persistência atômica em disco a cada mutação relevante (não só em background), restauração de estado + navegação + sessão HealthKit pós-crash, fila garantida (`transferUserInfo`) para a conclusão do treino quando o iPhone está fora de alcance, e parsing defensivo com `compactMap`/defaults em quase todos os payloads. Não existe nenhum `try!`, `fatalError` ou `as!` no código, e os quatro force-unwraps encontrados são todos protegidos ou de risco desprezível. Os problemas reais estão nas bordas: **(B-01)** tocar em outro treino da lista enquanto um treino está em andamento substitui o estado e apaga o progresso silenciosamente; **(B-02)** um treino só de cardio (sem exercícios de força) fica preso numa tela vazia após "Iniciar treino", sem como concluir ou abandonar, com a HKWorkoutSession rodando; **(B-03)** um `startedAt` no futuro (skew de relógio entre iPhone e Watch) crasha o dashboard via `ClosedRange<Date>` inválido; **(B-04)** os agregados de FC são mutados em thread de background do HealthKit sem sincronização; e **(B-05)** o `sendReliable` descarta mensagens — inclusive `FINISH_WORKOUT` — em silêncio se a WCSession ainda não ativou.

---

## Cenário 1 — Watch fecha o app / sem bateria no meio do treino

**Veredito: OK** (confirmado por leitura; teste em device recomendado para o caminho de bateria)

Quando salva:
- **A cada mutação crítica, imediatamente** — não apenas em background. `completeSet` → `persistImmediate()` (`WorkoutExecutionStore.swift:445`), assim como `startWorkout` (:69), `loadWorkout` (:87), `markStarted` (:107), `markFinishPending` (:117), `applyRemoteSetComplete` (:208), `markCardioCompleted` (:500), `setExerciseIndex` (:511), `undoLastCompletedSet` (:462), `updateExerciseOrder` (:390), `mergeProgramExercises` (:331), `setSessionId` (:97).
- **Debounce de 500 ms apenas para giros da Crown** (`updateReps`/`updateWeight` → `persistDebounced()`, `WorkoutExecutionStore.swift:475/487/678-685`).
- **Flush em transição de cena**: `KinevoWatchApp.swift:121-126` — `scenePhase` → `.background`/`.inactive` chama `workoutStore.persistImmediate()`.

Como salva: escrita atômica com temp file + `replaceItemAt` (`WorkoutStatePersistence.swift:26-35`), em Application Support. Crash no meio da escrita não corrompe o arquivo anterior.

Como restaura:
- `WorkoutExecutionStore.init` (`WorkoutExecutionStore.swift:29-50`) carrega do disco no launch. Estado finish-pendente com mais de 10 min é descartado (:34-42).
- Navegação: `resumeNavigationIfNeeded` (`KinevoWatchApp.swift:133-140`) re-empurra a tela de execução a partir de `toResumeSnapshot()` — sem depender do iPhone re-sincronizar. Cardio é persistido em `cardioItems` justamente para isso (`WorkoutExecutionState.swift:38`).
- HealthKit: `recoverActiveWorkoutSession` no `init` do `HealthKitManager` (`HealthKitManager.swift:72-103`) reclama a HKWorkoutSession viva (o watchOS a mantém mesmo com o app morto) e `restoreHealthBuffers` (:300-317) restaura os agregados de FC salvos em UserDefaults a cada ~60 s (:368-369).

Ressalvas (Baixo):
- **B-14**: ajustes de Crown feitos nos últimos 500 ms antes de morte súbita (bateria) se perdem — a série em si não, só o valor não confirmado. Mitigado pelo flush de scenePhase em fechamento normal.
- **B-15**: restauração com finish-pendente < 10 min reabre a tela de execução (`resumeNavigationIfNeeded` só checa `hasStarted`), permitindo um segundo "Finalizar" — ver B-09 no Cenário 7.

---

## Cenário 2 — iPhone fora de alcance durante TODO o treino

**Veredito: OK** (com uma ressalva Médio — B-05)

Rastreio de cada envio (`WatchSessionManager.swift`):
- `SET_COMPLETE`, `START_WORKOUT`, `FINISH_WORKOUT`, `CARDIO_COMPLETE`, `DISCARD_WORKOUT` → todos passam por `sendReliable` (:287-304): se `isReachable`, `sendMessage` com fallback para `transferUserInfo` no `errorHandler`; se **não** reachable, vai direto para `transferUserInfo` — fila persistente do WatchConnectivity, entregue quando os aparelhos reconectam (sobrevive a reboot).
- `WORKOUT_HEALTH_SAMPLES` → **sempre** `transferUserInfo` (:240-247), por design ("tolera iPhone offline").
- O `sendMessage` "cru" (:274-283) descarta quando não reachable, mas só é usado para mensagens genéricas — nenhum dos fluxos críticos o usa.

No lado do iPhone, o `WCSessionRelay` persiste TODO evento recebido em UserDefaults **antes** de encaminhar ("PERSIST FIRST, FORWARD SECOND", `WatchConnectivityModule.swift:65-208`), então o `FINISH_WORKOUT` entregue com o app RN morto não se perde — é consumido em `OnCreate`/`OnStartObserving` (:370-397).

Fluxo de conclusão offline: o usuário finaliza → `markFinishPending` persiste → `FINISH_WORKOUT` enfileirado → a tela de sucesso espera SYNC_SUCCESS por 12 s e então força `clearWorkout()` local (`WorkoutExecutionView.swift:430-446`). O FINISH continua na fila do `transferUserInfo` e chega ao telefone depois; o SYNC_SUCCESS tardio é ignorado com log (`acknowledgeFinish ignored — no active state`, `WorkoutExecutionStore.swift:124-127`). Nenhum dado se perde.

**Achado B-05 (Médio, confirmado por leitura)** — `WatchSessionManager.swift:287-291`:
```swift
private func sendReliable(_ message: [String: Any], label: String) {
    guard let session = wcSession, session.activationState == .activated else {
      print("[WatchSessionManager] ❌ Session not activated for \(label)")
      return
    }
```
Se a WCSession ainda não completou a ativação (janela curta após cold launch — ex.: usuário retoma treino pós-crash e finaliza imediatamente), a mensagem é **descartada em silêncio**, inclusive `FINISH_WORKOUT`. O estado local fica finish-pendente e é limpo pelo timeout de 12 s ou pela regra dos 10 min — o treino nunca chega ao telefone. Impacto: perda da sessão inteira nesse cenário raro. Correção sugerida: enfileirar a mensagem num buffer interno e despachá-la em `activationDidCompleteWith` (mesma técnica do `pendingApplicationContext` do módulo iPhone, `WatchConnectivityModule.swift:574-607`). *Hipótese quanto à frequência real — precisa de teste em device para medir a janela.*

---

## Cenário 3 — Payloads degenerados

**Veredito: QUEBRA para treino só-cardio (B-02); OK/INCERTO nos demais**

- **Treino sem exercícios (mas com cardio)** — **QUEBRA, Alto (B-02)**. `WorkoutExecutionView.swift:72-84`:
```swift
if !state.hasStarted {
  startView(...)
} else if state.exercises.isEmpty {
  emptyView
} else {
  workoutContent(...)
}
```
A tela pré-início mostra "0 exercícios • 1 aeróbio" e o botão "Iniciar treino" funciona (`hk.startWorkout()` + `markStarted`). Após iniciar, `exercises.isEmpty` → `emptyView` ("Nenhum exercício encontrado") — o carrossel com as páginas de cardio, o dashboard (com "Abandonar Treino") e o fluxo de finalizar **nunca são montados** (`workoutContent` é o único lugar onde `CardioExecutionView` e `WorkoutDashboardView` aparecem, :206-251). Com `.toolbar(.hidden, for: .navigationBar)` (:127), não há botão de voltar; a HKWorkoutSession fica rodando. Único escape: o iPhone finalizar/descartar remotamente. Impacto: prescrição só de aeróbio fica inutilizável e prende o usuário com sessão de treino ativa. Correção sugerida: tratar `exercises.isEmpty && !cardioItems.isEmpty` exibindo o carrossel de cardio + dashboard; e/ou dar saída (abandonar) no `emptyView`. *Confirmado por leitura; reproduzir em device para validar se o swipe-back do watchOS ainda funciona com toolbar oculta.*

- **Treino sem exercícios e sem cardio** — OK (UX pobre): mesmo `emptyView`, mas não há o que executar. Antes de iniciar, o `reconcile`/`clearIfNotPending` pode limpar (não iniciado).

- **Exercício sem séries (`sets: 0`)** — OK. `makeExercise` gera `sets = []` (`WorkoutExecutionState.swift:233`), `firstIncomplete ?? max(count-1,0)` → `currentSetIndex = 0` (:244). A UI guarda tudo com `!exercise.sets.isEmpty` (`WorkoutExecutionView.swift:832, 1054, 1060, 1068, 1076, 1084, 1092`) e `totalSets` usa `max(count,1)` (:1036). `isExerciseCompleted` em array vazio = `true` → o exercício aparece como concluído e o fluxo segue. Sem crash.

- **`sets` negativo** — **crash teórico (B-08, Baixo/Médio)**. `WorkoutExecutionState.swift:233`: `(0..<ex.sets).map` — `0..<(-1)` é trap em runtime ("Range requires lowerBound <= upperBound"). `WatchExercise.parse` só exige `Int` (`WorkoutModels.swift:54`), não valida sinal; no caminho v2, `WatchProgramExerciseSummary.parse` usa `?? 3` mas aceita negativo vindo do telefone. Só alcançável se o iPhone enviar valor negativo — não verificado no lado RN nesta investigação. Correção: `max(0, ex.sets)`.

- **Peso nulo** — OK. `weight` é opcional em todo o pipeline (`WorkoutModels.swift:63`, `WorkoutExecutionState.swift:206` usa `ex.weight ?? 0`); volume ignora peso 0 (`WorkoutExecutionStore.swift:706-713`).

- **Reps em faixa ("8-12")** — OK. A faixa viaja como string em `targetReps`/`repsTarget`; `startingReps` extrai o primeiro inteiro com fallback (`WorkoutExecutionState.swift:334-345`): "8-12"→8, "AMRAP"→fallback. Se o telefone mandasse "8-12" no campo `reps` (Int), o parse v1 dropa o exercício via `compactMap` (degradação silenciosa, sem crash) e o v2 cai no default `?? 0` → fallback 10.

- **Cardio degenerado** — OK. Todos os campos do config têm default (`WatchCardioItem.parse`, `WorkoutModels.swift:667-689`): `rounds ?? 8`, `workSeconds ?? 30`, `restSeconds ?? 15`, `durationMinutes ?? 20`. `rounds = 0` → `advancePhase` finaliza no primeiro tick (`CardioExecutionView.swift:427-429`, `1 >= 0`); `workSeconds = 0` não gera loop infinito (o `while` de catch-up em `tick()` avança fase a fase até `completed`, :392-394). `mode` desconhecido vira contínuo. **Exceção teórica (B-13, Baixo)**: `rounds` negativo → `roundDots` faz `ForEach(0..<min(total,12))` com `total = -1` → range trap (`CardioExecutionView.swift:299-305`). Mesma classe do B-08.

- **Decodificação do estado persistido** — OK. Decoders custom com `decodeIfPresent` + defaults para todos os campos novos (`WorkoutExecutionState.swift:41-55, 138-150, 154-169`); falha de decode → `load()` retorna nil e o app abre limpo (`WorkoutStatePersistence.swift:57-60`) — sem crash, com perda de progresso (ver B-06).

---

## Cenário 4 — Permissão de HealthKit negada

**Veredito: OK (degrada bem, sem crash; UX silenciosa)**

- `requestAuthorization` (`HealthKitManager.swift:40-65`) só loga o resultado; é chamada no `onAppear` da lista (`WorkoutListView.swift:38`) e defensivamente em `startWorkout` (:122).
- Com leitura de FC negada, a `HKWorkoutSession` ainda inicia (criar/iniciar sessão não exige autorização de leitura); `didCollectDataOf` simplesmente nunca entrega amostras → `heartRate` fica 0 → o dashboard mostra `"--"` (`WorkoutDashboardView.swift:32-35`) e calorias ficam em 0. Nenhuma view força-desembrulha dados de FC.
- Com escrita (`workoutType`) negada, `finishWorkout()` falha e cai no `catch` que só loga (`HealthKitManager.swift:224-226`); `isWorkoutActive` é resetado no `MainActor.run` (:228-232) em ambos os caminhos. O treino em si (séries, FINISH para o iPhone) não depende do HealthKit.
- `exportHealthSamples()` retorna nil sem amostras (`HealthKitManager.swift:246`) e o chamador pula o envio (`WorkoutExecutionView.swift:388-390`).
- Se `isHealthDataAvailable()` for falso, tudo vira no-op (:41-44, :73, :108-111).

Ressalva (Baixo, UX): nenhuma tela informa que a permissão está negada — o usuário só vê "--" para sempre. Correção sugerida: checar `authorizationStatus(for:)` e mostrar um aviso no dashboard.

---

## Cenário 5 — HKWorkoutSession encerrada em todos os caminhos?

**Veredito: OK** (com uma hipótese Médio — B-06)

Inventário completo de start/end:

| Caminho | Chamada | Arquivo:linha |
|---|---|---|
| Start local ("Iniciar treino") | `hk.startWorkout()` | `WorkoutExecutionView.swift:297` |
| Start remoto (iPhone iniciou) | `healthKitManager?.startWorkout()` | `KinevoWatchApp.swift:63` |
| Recuperação pós-crash | `recoverActiveWorkoutSession()` | `HealthKitManager.swift:35, 72-103` |
| Finalizar no Watch | `hk.endWorkout()` | `WorkoutExecutionView.swift:392` |
| Finalizar no iPhone | `healthKitManager?.endWorkout()` | `KinevoWatchApp.swift:38` |
| Abandonar no Watch | `healthKitManager.discardWorkout()` | `WorkoutExecutionView.swift:498` |
| Descartar no iPhone | `healthKitManager?.discardWorkout()` | `KinevoWatchApp.swift:47` |

Análise dos caminhos de limpeza que **não** tocam o HealthKit:
- `acknowledgeFinish` (SYNC_SUCCESS) e o auto-dismiss/"Fechar" da tela de sucesso chamam só `clearWorkout()` — mas `endWorkout()` já foi chamado no botão "Finalizar Treino" (:392) antes de qualquer um deles. Sem órfã.
- `clearIfNotPending`/`reconcile` só limpam treino **não iniciado** (`hasStarted == false`), e a HK session só inicia junto com o start. Sem órfã.
- Crash/terminate: a HKWorkoutSession sobrevive ao processo; `recoverActiveWorkoutSession` no próximo launch reclama sessão + builder + delegates e restaura os buffers de FC. Confirmado por leitura.
- `startWorkout` é idempotente (`workoutSession != nil` → skip, :114-117); `HKWorkoutSession(...)` que lança é capturado (:159-161).
- Em `endWorkout`/`discardWorkout`, `workoutSession = nil` é setado de forma síncrona após `session.end()` (:194-195, :236-237); mesmo se `endCollection`/`finishWorkout` falharem, a sessão já foi encerrada e `isWorkoutActive` é resetado no `MainActor.run` de ambos os branches.

**Achado B-06 (Médio, hipótese — precisa de teste em device)** — `KinevoWatchApp.swift:33-40` + `WorkoutExecutionStore.swift:147-162`: se o Watch tem uma HK session ativa **recuperada** mas o estado do treino não restaurou (arquivo corrompido/decode falhou → `load()` nil), um `WORKOUT_FINISHED_FROM_PHONE` posterior retorna `cleared == false` e `endWorkout()` **não é chamado** — a sessão fica órfã (indicador verde de treino permanente, sem UI para encerrar). Cadeia improvável (exige falha de persistência + treino espelhado), mas o custo do fix é baixo: no callback, encerrar a HK session incondicionalmente quando não há estado ativo (`if workoutStore?.state == nil && healthKitManager?.isWorkoutActive == true { endWorkout() }`).

---

## Cenário 6 — Treino mudou no iPhone durante execução no Watch

**Veredito: OK para sync remoto; QUEBRA via navegação manual (B-01)**

Caminhos remotos (todos preservam progresso — confirmado por leitura):
- Novo `applicationContext` → `parseApplicationContext` → `onProgramUpdated` → `reconcileProgram` (`WorkoutExecutionStore.swift:257-283`): treino ativo que sumiu do programa é **mantido** se `hasStarted` (:272-274); se ainda está no programa, `mergeProgramExercises` (:290-333) preserva progresso por id, reordena, **adiciona** exercícios novos com per-set data e **nunca dropa** exercícios com trabalho feito (:317-319). `exerciseIndex` segue o exercício que o usuário estava vendo (:323-327).
- `reconcile(with:)` v2 via `WorkoutListView.onReceive($currentWorkout)` (`WorkoutListView.swift:33-35` → `WorkoutExecutionStore.swift:519-571`): só reordena (`updateExerciseOrder`); `clearIfNotPending` (:573-590) nunca destrói treino iniciado nem finish-pendente.
- `UPDATE_EXERCISE_ORDER` direto (sendMessage): só aplica se `current.workoutId == workoutId` (`KinevoWatchApp.swift:80-86`).
- `handleRemoteStart` com treino ativo → ignorado (:217-225). `startWorkout` com estado existente → ignorado (:56-60).
- v1 `reconcileWithSnapshot` (:592-629): mesmo treino → merge aditivo de conclusões; treino diferente → só substitui se `!hasStarted`.

**Achado B-01 (Alto, confirmado por leitura)** — o caminho NÃO protegido é a navegação manual do próprio usuário. `WorkoutExecutionView.swift:108-112`:
```swift
.onAppear {
  if store.state == nil || store.state?.workoutId != workout.workoutId {
    store.loadWorkout(from: workout)
  }
```
e `WorkoutExecutionStore.swift:80-87`:
```swift
if let existing = state {
    print("[WorkoutStore] WARNING: loadWorkout replacing active workout ...")
}
var newState = WorkoutExecutionState.from(snapshot: snapshot)
...
state = newState
persistImmediate()
```
Cenário: usuário está no Treino A com 10 séries feitas, volta à lista (o resume card aparece, mas as outras linhas continuam clicáveis — `WorkoutListView.swift:88`), toca no Treino B "só para ver" → `loadWorkout(B)` substitui o estado e **sobrescreve o arquivo persistido**; todo o progresso de A é destruído sem confirmação, e a HK session de A continua rodando agora "pertencendo" a B. Impacto concreto: perda real de dados de treino por um toque acidental. Correção sugerida: quando `store.state?.hasStarted == true` e o `workoutId` difere, não chamar `loadWorkout` — exibir tela "Você tem um treino em andamento" com opções Retomar/Abandonar (ou desabilitar as outras linhas da lista durante treino ativo).

Ressalva menor (Baixo): após um merge que reordena/insere exercícios, o `carouselPage` (`@State`) não é re-sincronizado com `store.state.exerciseIndex` (só no `onAppear`, `WorkoutExecutionView.swift:114`) — o usuário pode ficar vendo uma página que agora corresponde a outro exercício. Sem perda de dados (toda mutação usa o índice da própria página).

---

## Cenário 7 — Inventário: force-unwraps, `try!`, `fatalError`, índices sem bounds-check

Varredura: `grep -rn` por `try!`, `fatalError`, `as!`, `!` pós-fixado e subscripts em todo `targets/watch-app/**.swift` + `modules/watch-connectivity/ios/*.swift`, com confirmação lendo o contexto de cada hit.

**Resultado global: zero `try!`, zero `fatalError`, zero `as!` em todo o código analisado.**

| # | Arquivo:linha | Trecho | Tipo | Alcançável com dados reais? | Severidade |
|---|---|---|---|---|---|
| 1 | `Services/WorkoutStatePersistence.swift:9` | `.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!` | force-unwrap | Praticamente não — esse diretório sempre existe no sandbox watchOS | Baixo |
| 2 | `Services/HealthKitManager.swift:365` | `now.timeIntervalSince(lastSeriesSampleAt!)` | force-unwrap | Não — protegido por short-circuit `lastSeriesSampleAt == nil \|\|` na mesma linha | Baixo (estilo) |
| 3 | `Views/WorkoutExecutionView.swift:567` | `exercise.lastWeight != nil && ... > exercise.lastWeight!` | force-unwrap | Não — protegido por short-circuit | Baixo (estilo) |
| 4 | `Views/WorkoutExecutionView.swift:604` | `exercise.lastReps != nil && ... > exercise.lastReps!` | force-unwrap | Não — protegido por short-circuit | Baixo (estilo) |
| 5 | `Views/WorkoutExecutionView.swift:907` | `store.state?.exercises[exerciseIndex].currentSetIndex ?? -1` (dentro de NSLog) | subscript sem bounds-check | Hoje não: o array de exercícios nunca encolhe durante treino ativo (merge/reorder só adicionam ou mantêm) e `clearWorkout` zera `state` (optional chain corta). Vira crash se alguém introduzir remoção de exercício no futuro | Baixo |
| 6 | `Models/WorkoutExecutionState.swift:233` | `(0..<ex.sets).map` | range trap se `sets < 0` | Só se o iPhone enviar `sets` negativo (parse aceita qualquer Int — `WorkoutModels.swift:54` e `:469`) | Baixo/Médio (B-08) |
| 7 | `Views/WorkoutDashboardView.swift:54` | `Text(timerInterval: workoutStartDate...Date.now, ...)` | `ClosedRange<Date>` trap se `startedAt > now` | **Sim** — `startedAt` pode vir do iPhone (`WorkoutExecutionState.from`, :266-268 usa `snapshot.startedAt` do telefone); skew de relógio entre os dois aparelhos coloca a data no futuro → crash ao abrir a página de métricas | **Médio (B-03)** |
| 8 | `Views/CardioExecutionView.swift:305` | `ForEach(0..<maxVisible)` com `maxVisible = min(total, 12)` | range trap se `rounds < 0` | Só com payload malformado (`rounds` negativo) | Baixo (B-13) |
| 9 | `Services/WorkoutExecutionStore.swift:297-299, 349-351` | `s.exerciseIndex < s.exercises.count ? s.exercises[s.exerciseIndex].id : nil` | subscript checa upper bound mas não negativo | Não — todos os escritores de `exerciseIndex` clampam para ≥ 0 (`setExerciseIndex` :507, `from(snapshot:)` :275, merges :326/:386) | Baixo |
| 10 | `Services/WorkoutExecutionStore.swift:397-402, 467-472, 479-484, 633-660` | guards `exerciseIndex < count` sem `>= 0` | idem #9 | Não — índices vêm de `ForEach` (≥ 0) ou de `currentSetIndex` clampado | Baixo |
| 11 | `KinevoTheme.swift:9-10` | `Scanner(string: hex).scanHexInt64(&int)` com default `(255,0,0,0)` | n/a | Defensivo, sem unwrap | OK |

Demais subscripts encontrados no grep (`WorkoutExecutionStore.swift:192-201, 404-435, 453-458, 494-495, 609-611`; `WorkoutExecutionView.swift:173, 186, 540, 834-841, 983, 1056-1094`) foram lidos um a um: todos protegidos por guard de bounds, `min/max` clamp, `firstIndex`, range do `ForEach` ou pelo subscript `safe` definido em `WorkoutExecutionView.swift:1398-1402`. O módulo nativo do iPhone (`WatchConnectivityModule.swift`) não tem nenhum unwrap nem subscript numérico — tudo `as?`/`try?`/`compactMap`.

**Detalhe do B-03 (Médio, confirmado por leitura; reproduzível forçando data futura)** — `WorkoutDashboardView.swift:53-58`:
```swift
Text(
  timerInterval: workoutStartDate...Date.now,
  pauseTime: nil, countsDown: false, showsHours: true
)
```
`ClosedRange` exige `lowerBound <= upperBound`; violado → trap. Correção: `min(workoutStartDate, Date.now)...Date.now`.

**Achado relacionado B-09 (Baixo, confirmado)** — o botão "Finalizar Treino" (`WorkoutExecutionView.swift:367-395`) não checa `finishState`: `markFinishPending` é no-op quando já pendente (`guard s.finishState == .none`, `WorkoutExecutionStore.swift:114`), mas `sendFinishWorkout` executa de novo. Combinado com B-15 (restauração pendente reabre a tela), um FINISH duplicado pode chegar ao iPhone. *Se o lado RN faz upsert por sessionId, é inócuo — não verificado nesta investigação (fora do escopo Swift).* Correção: guard `state.finishState == .none` no botão.

---

## Cenário 8 — Retain cycles e threading

**Veredito: sem retain cycles confirmados; WCSession bem disciplinado; duas races reais no HealthKit e uma provável no módulo Expo**

### Retain cycles — auditoria closure a closure

| Local | Avaliação |
|---|---|
| `KinevoWatchApp.swift:27-92` — todos os 8 callbacks do sessionManager | `[weak workoutStore]`, `[weak healthKitManager]`, `[weak sessionManager]` — OK |
| `WorkoutExecutionStore.swift:635-660` — bindings da Crown | `[weak self]` em get e set — OK |
| `WorkoutExecutionStore.swift:680` — `persistDebounceTask` | `Task { @MainActor [weak self] ... }` — OK |
| `HealthKitManager.swift:75, 175, 210` — `recoverActiveWorkoutSession`, `endCollection` (x2) | `[weak self]`; o `builder` é capturado forte dentro do `Task` interno propositalmente (precisa viver até `finishWorkout`/`discardWorkout`) e não retém o manager — OK |
| `WatchSessionManager.swift:294-299` — closures do `sendReliable` | capturam `session`, não `self` — OK |
| `WatchSessionManager.swift:30-34` — `asyncAfter` do simulador | captura `self` **forte**, mas é one-shot de 2 s e `#if targetEnvironment(simulator)` — Baixo (B-16) |
| Delegates | `WCSession.delegate` é `weak` (API); `SessionDelegate.module` é `weak var` (`WatchConnectivityModule.swift:226`); forwarder do relay usa `[weak self]` (:347-349) — sem ciclos |
| `CardioExecutionView` / `RestTimerSheet` | são structs; `timerCancellable` cancelado em `onDisappear` (:53-55) e em `finalizeCompleted` — OK |

### Threading — quem toca estado observado e de que thread

Disciplinado (confirmado):
- **Todos** os delegates de WCSession no Watch (`WatchSessionManager.swift:321, 346, 431, 444, 457, 470, 483, 498, 527`) fazem `DispatchQueue.main.async` antes de tocar `@Published` ou invocar callbacks que mutam o `WorkoutExecutionStore`. `parseApplicationContext` (que escreve `programSnapshot` e dispara `onProgramUpdated`) roda sempre dentro do bloco main (:332, :348).
- `HealthKitManager`: `heartRate`, `activeCalories`, `isWorkoutActive` sempre via `DispatchQueue.main.async`/`MainActor.run` (:152-156, :186-190, :228-232, :331-333, :339-341, :373-375, :385-388).
- Módulo iPhone: `SessionDelegate` e `WCSessionRelay` despacham o forward para main (:179, :263, :282, :310); `DebugLogger` e o storage do relay são serializados por `DispatchQueue` próprias.

Ocorrências suspeitas:

**B-04 (Médio, confirmado por leitura)** — `HealthKitManager.swift:348-371`: `workoutBuilder(_:didCollectDataOf:)` chega em thread de background do HealthKit e muta **sem lock** os vars `heartRateSum`, `heartRateSampleCount`, `minHeartRate`, `maxHeartRate`, `heartRateSeriesBuffer`, `lastSeriesSampleAt` (:359-367). `exportHealthSamples()` (:245-271) lê esses mesmos vars da main thread (botão Finalizar), e `resetHealthBuffers()` (:273-281) escreve da main em `startWorkout`. Data race real (Swift não garante atomicidade nem visibilidade; `heartRateSeriesBuffer` é Array — mutação concorrente pode corromper/crashar em teoria). Impacto prático: agregados de FC inconsistentes no export; crash improvável mas possível. Correção: serializar acesso (fila dedicada, `OSAllocatedUnfairLock`, ou marcar o manager `@MainActor` e despachar o callback).

**B-17 (Baixo, confirmado)** — `HealthKitManager.swift:90-94`: o callback de `recoverActiveWorkoutSession` escreve `self.workoutSession`/`self.builder` na thread do HealthKit, enquanto `startWorkout()` lê `workoutSession != nil` na main (:114). Janela minúscula no launch; pior caso é uma segunda sessão tentada e o `try` falhar. Mesmo fix do B-04.

**B-07 (Médio, hipótese — depende da thread em que o Expo executa os blocos)** — `WatchConnectivityModule.swift:333-334, 385-397, 670-691`: `bufferedWatchEvents` e `hasJSListeners` são acessados de `OnStartObserving`/`OnStopObserving`/`OnCreate` (que o Expo Modules pode rodar fora da main) e de `emitWatchMessageEvent` (despachado para main pelos delegates). Se `OnStartObserving` rodar fora da main durante um flush concorrente, há race no Array (perda de evento ou crash). Precisa de teste/verificação da thread real do Expo runtime. Correção barata: confinar ambos à main (`DispatchQueue.main.async` nos blocos On*) ou usar a mesma fila serial do relay.

Nota: a troca de delegate `WCSessionRelay` → `SessionDelegate` em `OnCreate` (:353) é uma janela de corrida assumida pelo design ("In the worst case an event is processed twice — safe because all downstream DB operations use upsert", :62-64) — mitigada pelo persist-first.

---

## Lista consolidada de achados

| ID | Severidade | Status | Achado | Local |
|---|---|---|---|---|
| B-01 | Alto | Confirmado por leitura | Tocar em outro treino na lista substitui treino ativo e apaga progresso sem confirmação | `WorkoutExecutionView.swift:110` + `WorkoutExecutionStore.swift:80-87` |
| B-02 | Alto | Confirmado por leitura (reproduzir em device) | Treino só-cardio fica preso em `emptyView` após iniciar: sem cardio, sem finalizar, sem abandonar, HK session rodando | `WorkoutExecutionView.swift:72-84` |
| B-03 | Médio | Confirmado por leitura | Crash (`ClosedRange<Date>`) no dashboard se `startedAt` vier no futuro (skew de relógio iPhone→Watch) | `WorkoutDashboardView.swift:54` |
| B-04 | Médio | Confirmado por leitura | Data race: agregados de FC mutados em thread BG do HealthKit, lidos/zerados na main | `HealthKitManager.swift:348-371, 245-281` |
| B-05 | Médio | Confirmado por leitura (janela a medir em device) | `sendReliable` descarta mensagem (inclusive FINISH_WORKOUT) se WCSession ainda não ativou | `WatchSessionManager.swift:287-291` |
| B-06 | Médio | Hipótese (teste em device) | HK session órfã se estado não restaurar e WORKOUT_FINISHED chegar com `state == nil` (endWorkout não chamado) | `KinevoWatchApp.swift:33-40` |
| B-07 | Médio | Hipótese (verificar thread do Expo) | Race em `bufferedWatchEvents`/`hasJSListeners` entre OnStartObserving e main | `WatchConnectivityModule.swift:385-397, 670-691` |
| B-08 | Baixo/Médio | Confirmado por leitura (depende do payload) | `(0..<ex.sets)` trap com `sets` negativo do iPhone | `WorkoutExecutionState.swift:233` |
| B-09 | Baixo | Confirmado por leitura | Botão Finalizar não checa `finishState` → FINISH duplicado possível (re-tap / restauração pendente) | `WorkoutExecutionView.swift:367-395` |
| B-10 | Baixo | Confirmado por leitura | `.first!` em Application Support (na prática seguro) | `WorkoutStatePersistence.swift:9` |
| B-11 | Baixo | Confirmado por leitura | 3 force-unwraps protegidos por short-circuit (estilo) | `HealthKitManager.swift:365`, `WorkoutExecutionView.swift:567, 604` |
| B-12 | Baixo | Confirmado por leitura | Subscript sem bounds em NSLog (hoje inalcançável) | `WorkoutExecutionView.swift:907` |
| B-13 | Baixo | Confirmado por leitura (teórico) | `rounds` negativo → range trap nos round dots | `CardioExecutionView.swift:299-305` |
| B-14 | Baixo | Confirmado por leitura | Edits de Crown nos últimos 500 ms antes de morte súbita se perdem (debounce) | `WorkoutExecutionStore.swift:678-685` |
| B-15 | Baixo | Confirmado por leitura | Restauração finish-pendente (<10 min) reabre execução e permite segundo finish (alimenta B-09) | `WorkoutExecutionStore.swift:34-42` + `KinevoWatchApp.swift:133-140` |
| B-16 | Baixo | Confirmado por leitura | `asyncAfter` captura `self` forte (simulador apenas) | `WatchSessionManager.swift:30-34` |
| B-17 | Baixo | Confirmado por leitura | Recovery do HK escreve `workoutSession`/`builder` fora da main | `HealthKitManager.swift:90-94` |
