# Implementação das correções do Apple Watch — 12/jun/2026

Sessão de correções a partir do `RESUMO-EXECUTIVO.md` (análise de 11/jun). Seguiu a
ordem de ataque sugerida (Frentes 1→6). Tudo no working tree, **sem commit/push** —
aguardando validação local + autorização do Gustavo.

Validação automática feita: `tsc --noEmit` limpo, `vitest` 332/332 verde,
**`xcodebuild` do scheme KinevoWatch BUILD SUCCEEDED** (type-check Swift completo) e
**QA interativo no simulador watchOS** (ver seção abaixo). O que depende de
WatchConnectivity/HealthKit reais ainda precisa de **iPhone+Watch físicos**.

---

## QA no simulador watchOS (12/jun, mesma sessão)

Dirigido via `idb ui tap/swipe` no device "Kinevo Watch Test" (watchOS 26.2), build
real instalada. **Dois problemas reais encontrados e corrigidos:**

1. **`handGestureShortcut` é API watchOS 11+** (deployment target = 10.0) — quebrava o
   build. Corrigido com extension `doubleTapPrimaryAction()` gated por
   `#available(watchOS 11.0, *)`.
2. **O force-clear da tela de sucesso destruía a rede de reenvio** (furo de design da
   Frente 1 v1): o auto-dismiss de 12s e o botão "Fechar" chamavam `clearWorkout()`
   sem ACK, deletando o único estado que o reenvio podia recuperar. **Redesenho:**
   fila de reenvio persistida separada do slot ativo (`pending-finish-<workoutId>.json`,
   um arquivo por treino, espelhando a fila SecureStore do iPhone).
   `releaseFinishPendingToQueue()` move o pendente para a fila ao dispensar a tela
   (UI/navegação intactas); `acknowledgeFinish` deleta da fila; `pendingFinishResends()`
   (agora plural) reenvia ativo + fila, com expiração de 48h.

**Validado no simulador (build real):**
- Rest timer novo: countdown `Text(timerInterval:)` (formato AOD), **+15s/−15s funcionam**
  (1:28 → 1:43 após um tap), "Pular descanso" ok, auto-dismiss ao zerar, rest per-set
  correto (warmup 60s / top 120s / backoff 90s).
- **B-02**: treino só-cardio (mock temporário) abre as páginas de cardio, executa,
  conclui e finaliza — não trava mais no emptyView.
- **B-03**: dashboard com timer wall-clock contando certo (8:13), sem crash; e o estado
  velho de 79h da sessão anterior restaurou sem crash.
- Fluxo finish completo: RPE → `markFinishPending(rpe:)` → tela de sucesso → release
  p/ fila → **relaunch reenvia**: logs `Re-sending finish-pending workout mock-w4` +
  `Sending FINISH_WORKOUT ... RPE 5 ... 1 cardio` (RPE persistido ✓, cardio ✓).
- Diálogo "Abandonar treino?" renderiza e funciona (mesmo construto do diálogo B-01).
- Chip de FC corretamente OCULTO no sim (heartRate=0).
- Discard fim-a-fim: limpa estado, volta à lista sem resume card.

**Não testável no sim** (fica p/ device): transporte WCSession real (reenvio chega no
iPhone, ACK limpa a fila), B-01 interativo (swipe-back não completa via idb — diálogo
validado por construto idêntico + lógica), Double Tap real, FC ao vivo, AOD físico.

**Fix extra (achado pelo Gustavo no sim):** a tela pré-início prendia o usuário — a
navigation bar era escondida incondicionalmente, sem chevron de voltar e com swipe-back
pouco descobrível. Agora a barra (chevron) aparece sempre que o treino DESTA tela não
está rodando (`isThisWorkoutRunning`); fullscreen só durante a execução. Validado no sim:
chevron na pré-início volta à lista; execução segue fullscreen.

**Gotchas novos de QA no sim watchOS:** `idb` funciona no sim do watch (taps E swipes,
ao contrário do cliclick) — coordenadas lógicas pt (tela 208×248 no Watch de teste);
companion frio atrasa o 1º tap em vários segundos (parece tap perdido — aquecer antes
de medir); swipe-back de navegação não completa o pop interativo; diálogo de permissão
do HealthKit bloqueia automação (dispensável com tap no X via idb).

---

## O que mudou

### Frente 1 — Confiabilidade do FINISH_WORKOUT (perda de treino inteiro)
**Decisão:** em vez de reviver o `WCSessionRelay` morto no AppDelegate (frágil), a rede
de reenvio com ACK no Watch torna o F3 recuperável. Um mecanismo robusto > dois frágeis.

- `WorkoutExecutionState.swift`: novo campo persistido `rpe: Int?` (decode back-compat).
- `WorkoutExecutionStore.swift`: `init()` **não deleta mais** um finish-pending stale
  (>10 min); mantém e reenvia (só descarta >48h). `markFinishPending(rpe:)` persiste o
  RPE. Novo `pendingFinishResend()` reconstrói o payload de FINISH do estado.
- `WatchSessionManager.swift`: callback `onSessionActivated` (dispara reenvio quando a
  WCSession ativa — fecha o B-05); `sendFinishWorkout(..., isResend:)`.
- `KinevoWatchApp.swift`: reenvia finish-pendente no launch, na ativação da sessão e no
  foreground (`scenePhase .active`).
- `useWatchConnectivity.ts` / `_layout.tsx`: propaga `isResend`; um reenvio salva+ACK
  **sem** navegar o usuário (evita puxar pra home horas depois).

### Frente 2 — Integridade Watch↔iPhone
- **A1** (`useWorkoutSession.ts` + `app/workout/[id].tsx`): `applyWatchSetCompletion`
  agora resolve o exercício por `exerciseId` (id do `assigned_workout_item`), com
  fallback pro índice. Corrige série gravada no exercício errado após reordenação.
- **A2** (`lib/persistWatchSetLog.ts` novo + `_layout.tsx` + `[id].tsx`): safety net que
  grava no DB as séries do Watch quando a tela de treino está **desmontada** (antes eram
  perdidas ao finalizar no telefone). Idempotente; só roda com a tela fora (registro
  mount/unmount evita escrita dupla).
- **A3** (`lib/finishWorkoutFromWatch.ts`): o upsert do finish só grava séries
  **completas** — nunca escreve `is_completed=false` por cima de uma série que o telefone
  completou (o rehydrate só lê `is_completed=true`, então escrever incompletas era só
  risco). A fila idempotente + sessionId canônico já existiam.
- **A4** (`lib/getProgramSnapshotForWatch.ts`): `rest_seconds ?? 60` (era `|| 60`) em 2
  pontos — preserva descanso 0s intencional (drop-set/cluster). Coluna é nullable sem
  default, então null→60 segue valendo. End-to-end: restTime 0 → Watch não agenda timer.

### Frente 3 — Travas de UX destrutivas (Swift)
- **B-01** (`WorkoutExecutionView.swift`): abrir um treino diferente com outro em
  andamento agora pede confirmação ("Trocar de treino?") antes de descartar; o "Trocar"
  também encerra a HKWorkoutSession antiga e avisa o iPhone.
- **B-02** (`WorkoutExecutionView.swift`): treino só-cardio não fica mais preso em
  `emptyView` — renderiza as páginas de cardio (emptyView só quando não há exercício
  **nem** cardio).
- **B-03** (`WorkoutDashboardView.swift`): `min(workoutStartDate, Date.now)...Date.now`
  no timer — evita o trap do `ClosedRange` quando `startedAt` está no futuro (clock skew).

### Frente 4 — Testes
- `useWorkoutSession.test.tsx`: caso A1 (roteia por exerciseId, não índice).
- `lib/__tests__/finishWorkoutFromWatch.test.ts` (novo): A3 (incompletas filtradas),
  caminho `pending` sem auth, update da sessão canônica.
- `lib/__tests__/persistWatchSetLog.test.ts` (novo): grava is_completed=true; sem sessão
  in_progress → não grava.
- Follow-up: target XCTest para o reducer do `WorkoutExecutionStore` (exige criar target
  no projeto Xcode).

### Frente 5 — Estrutural / limpeza
- Removido `lib/getNextWorkoutForWatch.ts` (pipeline v1 morto, zero imports).
- `mobile/CLAUDE.md`: corrigidas referências a `WatchBridge.tsx` (não existe; é inline em
  `app/_layout.tsx`) e ao arquivo v1 removido.
- **Pendências deixadas (maior risco):** cadeia `syncWorkoutToWatch`/`sendWorkoutState`
  (TS+Swift+módulo nativo) ainda registrada mas sem uso real; migração para
  `@bacons/apple-targets` — avaliar à parte.

### Frente 6 — Quick wins de UX (Swift)
- **Timer Always-On** (`RestTimerSheet`): número central via `Text(timerInterval:)` —
  continua contando com o pulso abaixado (antes congelava).
- **Ajustar descanso**: botões −15s / +15s no sheet (além de "Pular").
- **Double Tap**: `.handGestureShortcut(.primaryAction)` no "Concluir Série" (watchOS 10+).
- **FC inline**: chip de frequência cardíaca no header da página do exercício
  (`@EnvironmentObject HealthKitManager`), sem precisar deslizar pra tela de métricas.

---

## Checklist de validação em device (iPhone + Watch físicos)

Crítico (Frente 1/2 — perda de dados):
- [ ] Finalizar treino no Watch com o iPhone **morto/sem app** → reabrir iPhone depois:
      o treino chega via reenvio e é salvo (checar `set_logs` no Supabase).
- [ ] Finalizar no Watch com iPhone offline → reconectar: reenvio na ativação da WCSession.
- [ ] Reenvio NÃO navega o usuário pra home quando ele está em outra tela (`isResend`).
- [ ] A1: treinador reordena exercícios mid-treino; concluir série no Watch grava no
      exercício certo.
- [ ] A2: completar séries no Watch com a tela de treino do iPhone **fechada**; finalizar
      no iPhone → as séries do Watch aparecem (não somem).
- [ ] A3: completar uma série no iPhone e a mesma incompleta no Watch; finalizar no Watch
      → a série NÃO volta a incompleta.
- [ ] A4: drop-set/cluster com descanso 0s → Watch não dispara timer de 60s.

Frente 3:
- [ ] B-01: com treino em andamento, tocar outro treino → diálogo de confirmação; "Trocar"
      descarta o antigo (HK encerrada, iPhone avisado) e abre o novo.
- [ ] B-02: treino só-cardio → "Iniciar" abre as páginas de cardio e permite finalizar.
- [ ] B-03: forçar clock skew (startedAt futuro) → dashboard não crasha.

Frente 6:
- [ ] Timer de descanso continua contando com o pulso abaixado (AOD).
- [ ] −15s/+15s ajustam o descanso; anel e hápticos seguem o total ajustado.
- [ ] Double Tap (Series 9/Ultra 2+) conclui a série.
- [ ] Chip de FC aparece no header durante o treino (HKWorkoutSession ativa).
