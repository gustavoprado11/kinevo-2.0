# Kinevo Apple Watch App Analysis

## 1. Executive Summary

O app Apple Watch do Kinevo, no formato atual, é um **companion app dependente do iPhone**. Ele não possui autenticação própria, acesso direto ao backend nem persistência local robusta do treino. O relógio recebe do iPhone um **snapshot do próximo treino pendente**, executa a interface localmente em SwiftUI, coleta sinais de HealthKit durante o treino e devolve eventos operacionais ao iPhone via WatchConnectivity.

Arquiteturalmente, o produto está organizado em três camadas:

1. **React Native / Expo no iPhone**: decide qual treino deve ir para o relógio, envia o snapshot e persiste a execução recebida do Watch.
2. **Bridge nativa iOS**: encapsula `WatchConnectivity`, bufferiza eventos e expõe um módulo Expo para o JavaScript.
3. **watchOS app em SwiftUI**: mostra o treino, permite marcar séries, ajustar carga/repetições, controlar descanso, iniciar/finalizar o treino e exibir métricas de HealthKit.

Na prática, o Watch hoje funciona mais como uma **interface remota especializada para execução** do que como um app autônomo completo.

## 2. Current Product Format

### 2.1 Nature of the Watch app

O formato atual é de um app watchOS companion embutido no app iOS principal:

- O target `KinevoWatch` é injetado manualmente no projeto iOS por um config plugin Expo customizado em [`mobile/plugins/with-watch-app.js`](mobile/plugins/with-watch-app.js#L1-L351).
- O app watchOS usa bundle próprio `com.kinevo.mobile.watchkitapp` e declara explicitamente o companion app `com.kinevo.mobile` em [`mobile/targets/watch-app/Info.plist`](mobile/targets/watch-app/Info.plist).
- O `app.json` registra o target watch como extensão/target adicional de build iOS em [`mobile/app.json`](mobile/app.json).

Isso significa que o Apple Watch app faz parte do pacote iOS do Kinevo, e não de uma aplicação watchOS independente.

### 2.2 UX shape exposed to the user

O fluxo visível para o aluno é:

1. O iPhone sincroniza o próximo treino pendente.
2. O Watch mostra um estado de espera, um estado sem treino pendente, ou um card único de treino pronto para iniciar.
3. Ao iniciar o treino, o Watch abre a execução local do treino.
4. Durante a execução, o aluno ajusta reps e carga com a Digital Crown, conclui séries, acompanha descanso, vê métricas fisiológicas e pode controlar mídia.
5. Ao terminar, informa PSE/RPE no relógio; o iPhone salva a sessão e re-sincroniza o próximo treino.

Esse desenho está implementado principalmente em:

- [`mobile/targets/watch-app/Views/WorkoutListView.swift`](mobile/targets/watch-app/Views/WorkoutListView.swift#L12-L159)
- [`mobile/targets/watch-app/Views/WorkoutExecutionView.swift`](mobile/targets/watch-app/Views/WorkoutExecutionView.swift#L65-L260)
- [`mobile/targets/watch-app/Views/WorkoutDashboardView.swift`](mobile/targets/watch-app/Views/WorkoutDashboardView.swift)
- [`mobile/targets/watch-app/Views/NowPlayingView.swift`](mobile/targets/watch-app/Views/NowPlayingView.swift)

## 3. Application Architecture

### 3.1 iPhone orchestration layer

O centro da orquestração fica em `WatchBridge`, montado globalmente no layout raiz iOS em [`mobile/app/_layout.tsx`](mobile/app/_layout.tsx#L26-L260). Essa bridge:

- escuta mensagens vindas do Watch;
- pré-cria `workout_sessions` em `in_progress` quando o treino começa no relógio;
- finaliza e persiste o treino quando chega `FINISH_WORKOUT`;
- reprocessa workouts pendentes guardados em `SecureStore`;
- sincroniza automaticamente o próximo treino pendente ao abrir o app e ao trocar de conta;
- envia `ACK` (`SYNC_SUCCESS`) de volta ao Watch após salvar o treino.

Isso mostra que o iPhone é o **orquestrador de estado e persistência**.

### 3.2 Native iOS WatchConnectivity bridge

O módulo nativo do iPhone está em [`mobile/modules/watch-connectivity/ios/WatchConnectivityModule.swift`](mobile/modules/watch-connectivity/ios/WatchConnectivityModule.swift#L1-L596). Ele faz quatro coisas importantes:

1. expõe uma API nativa consumível pelo Expo;
2. ativa a `WCSession` e gerencia o envio de `applicationContext`;
3. bufferiza eventos do Watch até o JavaScript anexar listeners;
4. persiste logs e eventos temporários em `UserDefaults`.

Há também um wrapper TypeScript em [`mobile/modules/watch-connectivity/src/WatchConnectivityModule.ts`](mobile/modules/watch-connectivity/src/WatchConnectivityModule.ts#L1-L112) e um hook React em [`mobile/hooks/useWatchConnectivity.ts`](mobile/hooks/useWatchConnectivity.ts#L1-L138).

### 3.3 watchOS runtime layer

O app watchOS sobe em [`mobile/targets/watch-app/KinevoWatchApp.swift`](mobile/targets/watch-app/KinevoWatchApp.swift), injeta dois `EnvironmentObject`s e inicia por `WorkoutListView`:

- `WatchSessionManager`: conectividade com o iPhone.
- `HealthKitManager`: sessão de treino e coleta de métricas.

O `WatchSessionManager` está em [`mobile/targets/watch-app/Services/WatchSessionManager.swift`](mobile/targets/watch-app/Services/WatchSessionManager.swift#L5-L245) e o `HealthKitManager` em [`mobile/targets/watch-app/Services/HealthKitManager.swift`](mobile/targets/watch-app/Services/HealthKitManager.swift).

## 4. Data Model and Contracts

### 4.1 Snapshot contract sent to the Watch

O contrato principal é `WatchWorkoutPayload`, definido em [`mobile/modules/watch-connectivity/src/WatchConnectivityModule.types.ts`](mobile/modules/watch-connectivity/src/WatchConnectivityModule.types.ts). Os campos relevantes são:

- `workoutId`
- `workoutName`
- `studentName`
- `exercises[]`
- `currentExerciseIndex`
- `currentSetIndex`
- `isActive`
- `startedAt`
- `updatedAt`

No lado nativo iOS, esse payload é envelopado como:

- `schemaVersion`
- `syncedAt`
- `hasWorkout`
- `workout`

Esse envelope é criado em [`mobile/modules/watch-connectivity/ios/WatchConnectivityModule.swift`](mobile/modules/watch-connectivity/ios/WatchConnectivityModule.swift#L476-L488) e consumido em [`mobile/targets/watch-app/Views/WorkoutListView.swift`](mobile/targets/watch-app/Views/WorkoutListView.swift#L132-L158).

### 4.2 Watch-side parsed models

O Watch parseia esse snapshot em estruturas Swift definidas em [`mobile/targets/watch-app/WorkoutModels.swift`](mobile/targets/watch-app/WorkoutModels.swift#L5-L171):

- `WatchWorkout`
- `WatchExercise`
- `WatchExerciseSnapshot`
- `WatchWorkoutSnapshot`

Essas estruturas deixam claro que o relógio trabalha com um **snapshot simplificado de treino**, não com o domínio completo do app mobile.

### 4.3 Scope of exercise data available on Watch

No formato atual, o relógio recebe apenas dados mínimos para execução:

- nome do treino;
- nome do exercício;
- número de séries;
- reps-alvo;
- peso inicial opcional;
- descanso;
- quantidade de séries já concluídas;
- faixa textual de reps (`targetReps`).

Ele não recebe, pelo menos nesse contrato:

- vídeos;
- notas do treino;
- supersets explícitos;
- lógica de troca de exercício;
- histórico detalhado;
- IDs de programa ou contexto clínico completo.

## 5. End-to-End Flows

### 5.1 Syncing the next workout to the Watch

O iPhone decide qual treino mandar para o relógio usando [`mobile/lib/getNextWorkoutForWatch.ts`](mobile/lib/getNextWorkoutForWatch.ts#L1-L166). A função:

1. localiza o aluno autenticado;
2. busca o programa ativo;
3. carrega os `assigned_workouts`;
4. descobre o que já foi concluído no dia;
5. respeita `scheduled_days` quando existirem;
6. retorna o primeiro treino pendente do dia, ou `null` em dia de descanso / tudo concluído;
7. transforma itens do treino em `WatchWorkoutPayload`.

O envio acontece por `syncWorkoutToWatch`, que usa `updateApplicationContext` como canal last-write-wins em:

- [`mobile/modules/watch-connectivity/src/WatchConnectivityModule.ts`](mobile/modules/watch-connectivity/src/WatchConnectivityModule.ts#L19-L34)
- [`mobile/modules/watch-connectivity/ios/WatchConnectivityModule.swift`](mobile/modules/watch-connectivity/ios/WatchConnectivityModule.swift#L490-L531)

Na inicialização do app iOS, o `WatchBridge` tenta sincronizar automaticamente o próximo treino com retries em [`mobile/app/_layout.tsx`](mobile/app/_layout.tsx#L236-L260).

### 5.2 Watch idle states

`WorkoutListView` modela três estados de UX em [`mobile/targets/watch-app/Views/WorkoutListView.swift`](mobile/targets/watch-app/Views/WorkoutListView.swift#L4-L159):

- `neverSynced`: ainda aguardando o iPhone sincronizar;
- `noWorkoutPending`: sem treino pendente para hoje;
- `workoutAvailable`: há um treino disponível para iniciar.

Isso confirma que o Watch, hoje, opera sobre **um único treino pendente por vez**.

### 5.3 Starting a workout from the Watch

Quando o aluno toca em “Iniciar treino”:

1. o Watch inicia a sessão de `HealthKit` com `traditionalStrengthTraining`;
2. envia `START_WORKOUT` ao iPhone;
3. muda a UI local para estado ativo.

Esse comportamento está em [`mobile/targets/watch-app/Views/WorkoutExecutionView.swift`](mobile/targets/watch-app/Views/WorkoutExecutionView.swift#L186-L209).

No iPhone, o `WatchBridge` recebe `START_WORKOUT` via hook [`mobile/hooks/useWatchConnectivity.ts`](mobile/hooks/useWatchConnectivity.ts#L74-L83) e:

- tenta pré-criar uma `workout_session` em `in_progress`;
- navega o app para `/workout/[id]`.

Referência: [`mobile/app/_layout.tsx`](mobile/app/_layout.tsx#L42-L119).

### 5.4 Executing exercises on the Watch

O fluxo principal de execução está em [`mobile/targets/watch-app/Views/WorkoutExecutionView.swift`](mobile/targets/watch-app/Views/WorkoutExecutionView.swift#L65-L260) e no restante do mesmo arquivo. O formato atual da tela é:

- um `TabView` vertical com três páginas;
- na primeira página, um carrossel horizontal entre exercícios;
- na segunda, dashboard fisiológico;
- na terceira, `Now Playing`.

Durante a execução:

- reps e carga são editadas por Digital Crown;
- ao concluir a série, o Watch envia `SET_COMPLETE` enriquecido com `workoutId`, `exerciseId`, `setIndex`, `reps` e `weight`;
- o estado local do exercício é atualizado no Watch;
- a carga/reps da série concluída propagam para séries futuras ainda não concluídas;
- se houver descanso, um sheet de timer é aberto;
- ao completar o último set do exercício, a UI incentiva swipe para o próximo exercício;
- no último exercício concluído, aparece “Finalizar Treino”.

Esse é um desenho bem mais sofisticado do que a implementação legada ainda presente em:

- [`mobile/targets/watch-app/Views/ActiveWorkoutView.swift`](mobile/targets/watch-app/Views/ActiveWorkoutView.swift)
- [`mobile/targets/watch-app/Views/SetLoggerView.swift`](mobile/targets/watch-app/Views/SetLoggerView.swift)
- [`mobile/targets/watch-app/Views/RestTimerView.swift`](mobile/targets/watch-app/Views/RestTimerView.swift)

Essas views parecem ser uma geração anterior do fluxo, mais simples e menos alinhada com o snapshot atual.

### 5.5 Receiving set completion on iPhone

O hook React parseia `SET_COMPLETE` em [`mobile/hooks/useWatchConnectivity.ts`](mobile/hooks/useWatchConnectivity.ts#L53-L72). Na tela de treino do mobile, `useWatchConnectivity` é usado para aplicar a conclusão da série no estado local da sessão:

- [`mobile/app/workout/[id].tsx`](mobile/app/workout/[id].tsx)

Além de escutar séries vindas do Watch, a tela iPhone também envia para o relógio o snapshot do treino visível, incluindo `startedAt` e `completedSets`, assim que carrega ou volta ao foreground. Isso reforça que o relógio reflete o estado da sessão ativa do mobile, não um estado soberano próprio.

### 5.6 Finishing a workout

Ao finalizar no Watch:

1. o usuário informa RPE/PSE pela Digital Crown;
2. o Watch serializa todos os exercícios e séries editadas;
3. envia `FINISH_WORKOUT` via `transferUserInfo`;
4. encerra a sessão HealthKit;
5. mostra sucesso local.

Referência:

- [`mobile/targets/watch-app/Views/WorkoutExecutionView.swift`](mobile/targets/watch-app/Views/WorkoutExecutionView.swift#L224-L260)
- [`mobile/targets/watch-app/Services/WatchSessionManager.swift`](mobile/targets/watch-app/Services/WatchSessionManager.swift#L127-L151)

No iPhone, `finishWorkoutFromWatch` em [`mobile/lib/finishWorkoutFromWatch.ts`](mobile/lib/finishWorkoutFromWatch.ts#L118-L340):

- renova token;
- garante usuário autenticado;
- identifica o aluno;
- carrega metadados do treino;
- calcula duração a partir de `startedAt` do Watch;
- reaproveita sessão `in_progress`, ou deduplica sessão recém-completada, ou cria nova sessão;
- faz upsert de `set_logs`;
- marca `watchFinishState` para liberar navegação no app.

Depois disso, o `WatchBridge`:

- emite refresh interno do app;
- envia `SYNC_SUCCESS` ao relógio;
- re-sincroniza o próximo treino pendente;
- mostra alerta de sucesso no iPhone.

Referência: [`mobile/app/_layout.tsx`](mobile/app/_layout.tsx#L121-L188).

## 6. Reliability and State Resilience

### 6.1 Event buffering on iPhone

O projeto já contém uma camada explícita para tolerar problemas de timing entre nativo e React. `WCSessionRelay` persiste qualquer mensagem do Watch em `UserDefaults` antes de tentar encaminhá-la ao módulo Expo em [`mobile/modules/watch-connectivity/ios/WatchConnectivityModule.swift`](mobile/modules/watch-connectivity/ios/WatchConnectivityModule.swift#L56-L208).

Depois, quando o módulo Expo inicializa, ele consome eventos pendentes e bufferiza até haver listeners JS ativos em [`mobile/modules/watch-connectivity/ios/WatchConnectivityModule.swift`](mobile/modules/watch-connectivity/ios/WatchConnectivityModule.swift#L341-L403).

Isso é um ponto forte do desenho atual.

### 6.2 Pending finish queue on iPhone

Se `FINISH_WORKOUT` chegar num momento em que o usuário ainda não esteja autenticado, o payload é salvo no `SecureStore` e reprocessado depois:

- [`mobile/lib/finishWorkoutFromWatch.ts`](mobile/lib/finishWorkoutFromWatch.ts#L44-L110)

Isso protege o caso em que o treino termina, o relógio envia o evento, mas o estado de auth do app iOS ainda não está pronto.

### 6.3 Cached application context on Watch

No lado watchOS, ao ativar a sessão, o app lê `receivedApplicationContext` para evitar ficar preso no estado “Aguardando” quando o contexto já havia chegado antes da ativação:

- [`mobile/targets/watch-app/Services/WatchSessionManager.swift`](mobile/targets/watch-app/Services/WatchSessionManager.swift#L203-L214)

Isso mostra que o desenho atual já leva em conta a semântica específica do `WatchConnectivity`.

## 7. Health and Workout Runtime

O gerenciamento de treino fisiológico está em [`mobile/targets/watch-app/Services/HealthKitManager.swift`](mobile/targets/watch-app/Services/HealthKitManager.swift). O formato atual inclui:

- autorização para leitura de frequência cardíaca e gasto calórico;
- autorização para gravação de `HKWorkout`;
- `HKWorkoutSession` com tipo `traditionalStrengthTraining`;
- `HKLiveWorkoutBuilder` para métricas em tempo real;
- salvamento do treino no Apple Health ao finalizar.

O dashboard do treino no Watch mostra:

- frequência cardíaca;
- calorias ativas;
- tempo decorrido.

Referência: [`mobile/targets/watch-app/Views/WorkoutDashboardView.swift`](mobile/targets/watch-app/Views/WorkoutDashboardView.swift).

Portanto, o Watch não é apenas um controle remoto de sets; ele também executa um runtime local de atividade física.

## 8. Build, Packaging and Platform Shape

### 8.1 Expo integration

O app não usa uma solução pronta para watchOS; ele injeta manualmente o target no Xcode:

- cria `PBXNativeTarget`;
- adiciona build phases;
- cria embed phase “Embed Watch Content” no target principal;
- adiciona o target ao scheme compartilhado para archive/TestFlight;
- injeta HealthKit em entitlements.

Tudo isso está em [`mobile/plugins/with-watch-app.js`](mobile/plugins/with-watch-app.js#L26-L349).

### 8.2 Target type caveat

O plugin usa `productType: "com.apple.product-type.application"` em vez do tipo watch app mais específico em [`mobile/plugins/with-watch-app.js`](mobile/plugins/with-watch-app.js#L190-L207). A documentação interna em [`mobile/APPLE_WATCH.md`](mobile/APPLE_WATCH.md) explica que isso foi uma escolha pragmática para contornar problemas de build/simulador no Xcode 15+.

### 8.3 Entitlements and Info.plist

O target watchOS declara:

- `WKApplication = true`
- `WKCompanionAppBundleIdentifier = com.kinevo.mobile`
- permissões de HealthKit

Arquivos:

- [`mobile/targets/watch-app/Info.plist`](mobile/targets/watch-app/Info.plist)
- [`mobile/targets/watch-app/KinevoWatch.entitlements`](mobile/targets/watch-app/KinevoWatch.entitlements)

## 9. UI and Visual Format on Watch

O visual atual segue um tema escuro próprio definido em [`mobile/targets/watch-app/KinevoTheme.swift`](mobile/targets/watch-app/KinevoTheme.swift), com:

- fundo escuro;
- cards em contraste;
- violeta como cor de ação principal;
- sem dependência de design system compartilhado com React Native.

O formato visual da experiência é:

- home minimalista com card do treino;
- execução em tela cheia;
- interação forte via swipe e Digital Crown;
- feedback háptico para começo, sucesso e transição;
- timer de descanso modal;
- página separada de métricas;
- página separada de mídia (`NowPlaying`).

## 10. Observed Limitations in the Current Format

### 10.1 Single-workout model

O relógio trabalha com o “próximo treino pendente” e não com uma lista real de múltiplos treinos navegáveis. Isso é consequência direta de `getNextWorkoutForWatch` retornar um único payload ou `null` em [`mobile/lib/getNextWorkoutForWatch.ts`](mobile/lib/getNextWorkoutForWatch.ts#L24-L166).

### 10.2 No direct backend access on Watch

Não há cliente Supabase, autenticação nem mutations diretas no watchOS target. Todo salvamento real continua acontecendo no iPhone.

### 10.3 Watch-side persistence is thin

O relógio mantém estado em memória (`editableExercises`, `hasStarted`, etc.) durante a execução, mas não há camada clara de persistência local durável do treino em andamento no próprio watchOS app. Se o app do relógio for reiniciado no meio do treino, a recuperação depende do último snapshot vindo do iPhone.

### 10.4 ACK path appears incomplete on Watch

O iPhone envia `SYNC_SUCCESS` ao relógio em [`mobile/modules/watch-connectivity/ios/WatchConnectivityModule.swift`](mobile/modules/watch-connectivity/ios/WatchConnectivityModule.swift#L548-L572), e o wrapper TS afirma que o Watch persiste `FINISH_WORKOUT` até esse ACK em [`mobile/modules/watch-connectivity/src/WatchConnectivityModule.ts`](mobile/modules/watch-connectivity/src/WatchConnectivityModule.ts#L66-L77).

Mas o `WatchSessionManager` no watchOS, no estado atual, apenas loga mensagens recebidas e não implementa tratamento explícito para `SYNC_SUCCESS`:

- [`mobile/targets/watch-app/Services/WatchSessionManager.swift`](mobile/targets/watch-app/Services/WatchSessionManager.swift#L229-L244)

Ou seja: o canal de ACK existe do lado iPhone, mas a contrapartida de consumo/limpeza no Watch não está evidente no código atual.

### 10.5 Simulator support is partial

A documentação interna deixa claro que o simulador serve mais para validar UI do que conectividade real:

- [`mobile/APPLE_WATCH.md`](mobile/APPLE_WATCH.md)

No watchOS, há inclusive carga de mock data em simulador em [`mobile/targets/watch-app/Services/WatchSessionManager.swift`](mobile/targets/watch-app/Services/WatchSessionManager.swift#L18-L46).

### 10.6 Legacy views still coexist

Há uma camada nova baseada em `WorkoutExecutionView`, mas views antigas como `ActiveWorkoutView`, `SetLoggerView` e `RestTimerView` continuam no target. Isso sugere evolução incremental e alguma dívida de consolidação do fluxo watchOS.

## 11. Overall Assessment

O formato atual do app Apple Watch do Kinevo é tecnicamente consistente para o estágio de companion execution app. Ele já entrega:

- sincronização automática de treino;
- execução local confortável no relógio;
- captura de séries, reps e carga;
- HealthKit em tempo real;
- persistência confiável do lado iPhone;
- mecanismos explícitos de tolerância a race conditions.

Ao mesmo tempo, ele ainda não é um app watchOS autônomo. O centro do sistema continua sendo o iPhone. O relógio atua como uma **camada especializada de interação e coleta**, enquanto:

- seleção de treino,
- persistência oficial,
- reconciliação de sessão,
- autenticação,
- refresh pós-conclusão

continuam centralizados no app mobile principal.

Esse é o melhor resumo do formato atual: **um companion app de execução de treino, sincronizado por snapshot, com runtime local de treino/HealthKit e persistência delegada ao iPhone**.
