import SwiftUI
import Combine
import WatchKit

private enum CrownInputFocus: Hashable {
  case weight
  case reps
}

// MARK: - Round Display Padding Helper
// `.scenePadding()` does NOT work inside `TabView(.page)` because the paged
// TabView gives each child a full-bleed frame with no safe-area information.
// We therefore compute the paddings manually based on the physical screen size.
// Values are derived from Apple's HIG and measured on real hardware.
struct WatchDisplayPadding {
  let horizontal: CGFloat   // left & right inset for the round display edges
  let top: CGFloat           // top inset to clear the system clock overlay

  static var current: WatchDisplayPadding {
    let bounds = WKInterfaceDevice.current().screenBounds
    let w = bounds.width

    // Horizontal padding: proportional to screen width.
    // The round corners clip ~5-6% of the width on each side.
    // Ultra (205pt) → 12pt, 45mm (198pt) → 11pt, 41mm (176pt) → 10pt, 40mm (162pt) → 9pt
    let h = max(9, round(w * 0.055))

    // Top padding: the system clock ("14:27") occupies ~28pt in the top-right
    // corner. We need enough top padding so the first line of text starts below it.
    // Slightly more on larger screens where the clock font is bigger.
    let t: CGFloat = w >= 200 ? 20 : (w >= 180 ? 18 : 16)

    return WatchDisplayPadding(horizontal: h, top: t)
  }
}

private struct RestTimerState: Identifiable {
  let id = UUID()
  let seconds: Int
  let exerciseName: String
  let setNumber: Int
  let startedAt: Date
}

struct WorkoutExecutionView: View {
  @EnvironmentObject private var sessionManager: WatchSessionManager
  @EnvironmentObject private var healthKitManager: HealthKitManager
  @EnvironmentObject private var workoutStore: WorkoutExecutionStore
  @Environment(\.dismiss) private var dismiss
  let workout: WatchWorkoutSnapshot

  @State private var restTimerState: RestTimerState?
  @State private var isFinishingWorkout = false
  @State private var workoutRpe: Double = 5
  @State private var hasFinishedWorkout = false
  @State private var showDiscardConfirmation = false
  @State private var carouselPage: Int = 0
  @State private var checkmarkScale: CGFloat = 0.01
  @State private var autoDismissTask: Task<Void, Never>?

  var body: some View {
    let sm = sessionManager
    let hk = healthKitManager
    let store = workoutStore

    ZStack {
      Color.black.edgesIgnoringSafeArea(.all)

      Group {
        if let state = store.state {
          if !state.hasStarted {
            startView(sm: sm, hk: hk, store: store)
          } else if state.exercises.isEmpty {
            emptyView
          } else {
            workoutContent(state: state, sm: sm, store: store)
          }
        } else {
          emptyView
        }
      }
    }
    .sheet(item: $restTimerState) { timerState in
      RestTimerSheet(timerState: timerState)
    }
    .sheet(isPresented: $isFinishingWorkout) {
      if hasFinishedWorkout {
        successFinishView
      } else {
        pseSelectionView(sm: sm, hk: hk, store: store)
      }
    }
    .confirmationDialog(
      "Abandonar treino?",
      isPresented: $showDiscardConfirmation,
      titleVisibility: .visible
    ) {
      Button("Abandonar", role: .destructive) {
        discardCurrentWorkout()
      }
      Button("Cancelar", role: .cancel) { }
    } message: {
      Text("Seu progresso neste treino será perdido.")
    }
    .onAppear {
      // Load workout into store if not already present
      if store.state == nil || store.state?.workoutId != workout.workoutId {
        store.loadWorkout(from: workout)
      }
      // Sync carousel page with exercise index
      carouselPage = store.state?.exerciseIndex ?? 0
    }
    .navigationBarTitleDisplayMode(.inline)
    .toolbar(.hidden, for: .navigationBar)
    // When SYNC_SUCCESS arrives and clearWorkout() fires, state becomes nil.
    // Dismiss the sheet so the NavigationStack can pop this view.
    .onChange(of: workoutStore.state == nil) { _, isNil in
      if isNil && isFinishingWorkout {
        NSLog("[KinevoWatch] workoutStore.state cleared — dismissing finish sheet")
        isFinishingWorkout = false
        // Small delay to let sheet dismiss before navigation pop
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
          dismiss()
        }
      }
    }
    .onDisappear {
      autoDismissTask?.cancel()
    }
  }

  // MARK: - Workout Content

  private func workoutContent(state: WorkoutExecutionState, sm: WatchSessionManager, store: WorkoutExecutionStore) -> some View {
    let totalCarouselPages = state.exercises.count + workout.cardioItems.count

    let carouselIndexBinding = Binding<Int>(
      get: { carouselPage },
      set: { newValue in
        carouselPage = newValue
        if newValue < state.exercises.count {
          store.setExerciseIndex(newValue)
        }
      }
    )

    return TabView {
      // Page 0: Exercise + Cardio carousel
      TabView(selection: carouselIndexBinding) {
        ForEach(Array(state.exercises.indices), id: \.self) { index in
          ExerciseExecutionPage(
            store: store,
            exerciseIndex: index,
            totalExercises: state.exercises.count,
            totalCarouselPages: totalCarouselPages,
            workoutStartDate: state.startedAt,
            hasCardioAfter: !workout.cardioItems.isEmpty,
            onSetLogged: { setIndex, reps, weight in
              guard index < (store.state?.exercises.count ?? 0) else { return }
              let exerciseId = state.exercises[index].id
              NSLog("[KinevoWatch] onSetLogged: sendSetCompletion — exerciseId=%@, set=%d", exerciseId, setIndex)
              sm.sendSetCompletion(
                workoutId: state.workoutId,
                exerciseIndex: index,
                exerciseId: exerciseId,
                setIndex: setIndex,
                reps: reps,
                weight: weight
              )
            },
            onRestTimerRequested: { setIndex, restTime in
              guard index < (store.state?.exercises.count ?? 0) else { return }
              let exerciseName = state.exercises[index].name
              NSLog("[KinevoWatch] onRestTimerRequested: %ds for %@", restTime, exerciseName)
              restTimerState = RestTimerState(
                seconds: restTime,
                exerciseName: exerciseName,
                setNumber: setIndex + 1,
                startedAt: Date()
              )
            },
            onFinishWorkout: {
              isFinishingWorkout = true
            },
            onDismissRestTimer: {
              restTimerState = nil
            }
          )
          .tag(index)
        }

        // Cardio pages (after exercises)
        ForEach(Array(workout.cardioItems.enumerated()), id: \.element.id) { cardioIdx, item in
          let pageTag = state.exercises.count + cardioIdx
          let isLastPage = pageTag == (totalCarouselPages - 1)
          let isCardioCompleted = state.cardioStates.first(where: { $0.itemId == item.id })?.isCompleted ?? false

          CardioExecutionView(item: item) { elapsedSeconds in
            store.markCardioCompleted(itemId: item.id, elapsedSeconds: elapsedSeconds)
            sm.sendCardioCompletion(
              workoutId: state.workoutId,
              itemId: item.id,
              elapsedSeconds: elapsedSeconds
            )
          }
          .overlay(alignment: .bottom) {
            // Show "Finalizar Treino" when this is the last page and cardio is done
            if isLastPage && isCardioCompleted && state.exercises.allSatisfy({ ex in ex.sets.allSatisfy(\.isCompleted) }) {
              Button {
                isFinishingWorkout = true
              } label: {
                Text("Finalizar Treino")
                  .font(.system(size: 15, weight: .semibold))
                  .frame(maxWidth: .infinity)
              }
              .buttonStyle(.borderedProminent)
              .tint(.green)
              .padding(.horizontal, WatchDisplayPadding.current.horizontal)
              .padding(.bottom, 12)
            }
          }
          .tag(pageTag)
        }
      }
      .tabViewStyle(.page(indexDisplayMode: .never))

      // Page 1: Workout dashboard
      WorkoutDashboardView(
        workoutStartDate: state.startedAt,
        onDiscardWorkout: { showDiscardConfirmation = true }
      )

      // Page 2: Media controls
      KinevoNowPlayingView()
    }
    .tabViewStyle(.verticalPage)
  }

  // MARK: - Start View

  private func startView(sm: WatchSessionManager, hk: HealthKitManager, store: WorkoutExecutionStore) -> some View {
    VStack(spacing: 12) {
      Image(systemName: "figure.run")
        .font(.title2)
        .foregroundStyle(Color.kinevoViolet)
      Text(workout.workoutName)
        .font(.headline)
        .foregroundStyle(.white)
        .multilineTextAlignment(.center)
        .lineLimit(2)
        .minimumScaleFactor(0.75)
      Text(workoutItemsSummary)
        .font(.caption2)
        .foregroundStyle(.secondary)
      Button("Iniciar treino") {
        NSLog("[KinevoWatch] Iniciar treino tapped — workoutId=%@, exercises=%d", workout.workoutId, workout.exercises.count)
        hk.startWorkout()
        sm.sendStartWorkout(workoutId: workout.workoutId)
        store.markStarted()
        WKInterfaceDevice.current().play(.start)
      }
      .buttonStyle(.borderedProminent)
      .tint(Color.kinevoViolet)
    }
    .padding()
  }

  private var workoutItemsSummary: String {
    let exCount = workout.exercises.count
    let cardioCount = workout.cardioItems.count
    if cardioCount > 0 {
      return "\(exCount) exercícios • \(cardioCount) aeróbio\(cardioCount > 1 ? "s" : "")"
    }
    return "\(exCount) exercícios"
  }

  private var emptyView: some View {
    VStack(spacing: 10) {
      Image(systemName: "list.bullet.clipboard")
        .font(.title2)
        .foregroundStyle(.secondary)
      Text("Nenhum exercício encontrado neste treino")
        .font(.footnote)
        .foregroundStyle(.white)
        .multilineTextAlignment(.center)
    }
    .padding()
  }

  // MARK: - Finish Workout

  private func pseSelectionView(sm: WatchSessionManager, hk: HealthKitManager, store: WorkoutExecutionStore) -> some View {
    VStack(spacing: 8) {
      Text("Como foi o treino?")
        .font(.headline)
        .foregroundStyle(.white)

      HStack {
        Text("Leve")
          .font(.caption2)
          .foregroundStyle(.gray)
        Spacer()
        Text("Máximo")
          .font(.caption2)
          .foregroundStyle(.gray)
      }
      .padding(.horizontal, 10)

      Text("\(Int(workoutRpe))")
        .font(.system(size: 40, weight: .bold, design: .rounded))
        .foregroundStyle(.white)
        .focusable(true)
        .digitalCrownRotation(
          $workoutRpe,
          from: 1,
          through: 10,
          by: 1,
          sensitivity: .medium,
          isContinuous: false,
          isHapticFeedbackEnabled: true
        )

      Button("Finalizar Treino") {
        guard let state = store.state else { return }

        let exercisesPayload = state.buildFinishPayload()
        let cardioPayload = state.buildCardioPayload()

        // Mark as pending BEFORE sending — persists so it survives app termination
        store.markFinishPending()

        sm.sendFinishWorkout(
          workoutId: state.workoutId,
          rpe: Int(workoutRpe),
          startedAt: state.startedAt,
          exercises: exercisesPayload,
          cardio: cardioPayload
        )
        hk.endWorkout()
        hasFinishedWorkout = true
        WKInterfaceDevice.current().play(.success)
      }
      .buttonStyle(.borderedProminent)
      .tint(Color.kinevoViolet)
    }
    .padding()
    .background(Color.black.edgesIgnoringSafeArea(.all))
  }

  private var workoutDurationText: String {
    guard let startedAt = workoutStore.state?.startedAt else { return "--" }
    let seconds = Int(Date().timeIntervalSince(startedAt))
    let hours = seconds / 3600
    let minutes = (seconds % 3600) / 60
    if hours > 0 {
      return "\(hours)h \(minutes)m"
    }
    return "\(minutes)m"
  }

  private var successFinishView: some View {
    ScrollView {
      VStack(spacing: 10) {
        Image(systemName: "checkmark.circle.fill")
          .font(.system(size: 44))
          .foregroundStyle(.green)
          .scaleEffect(checkmarkScale)
          .onAppear {
            withAnimation(.spring(response: 0.4, dampingFraction: 0.6)) {
              checkmarkScale = 1.0
            }

            // Auto-dismiss after 4 seconds — covers the case where SYNC_SUCCESS
            // arrives but the sheet doesn't close, or ACK is never delivered.
            autoDismissTask = Task { @MainActor in
              try? await Task.sleep(nanoseconds: 4_000_000_000)
              guard !Task.isCancelled else { return }
              if isFinishingWorkout {
                NSLog("[KinevoWatch] Auto-dismissing finish sheet after timeout")
                isFinishingWorkout = false
                // If state was already cleared by SYNC_SUCCESS, pop navigation
                if workoutStore.state == nil {
                  DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                    dismiss()
                  }
                } else {
                  // Force clear if SYNC_SUCCESS didn't arrive
                  workoutStore.clearWorkout()
                }
              }
            }
          }

        Text("Treino Concluído!")
          .font(.headline)
          .foregroundStyle(.white)

        VStack(spacing: 6) {
          FinishStatRow(icon: "checkmark.circle", label: "Séries", value: "\(workoutStore.totalCompletedSets)")
          FinishStatRow(icon: "scalemass", label: "Volume", value: String(format: "%.0f kg", workoutStore.totalVolume))
          if workoutStore.prCount > 0 {
            FinishStatRow(icon: "trophy", label: "PRs", value: "\(workoutStore.prCount)")
          }
          FinishStatRow(icon: "clock", label: "Duração", value: workoutDurationText)
        }

        // Manual close button — fallback if auto-dismiss doesn't fire
        Button("Fechar") {
          NSLog("[KinevoWatch] Manual close tapped on finish screen")
          isFinishingWorkout = false
          if workoutStore.state != nil {
            workoutStore.clearWorkout()
          }
          DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            dismiss()
          }
        }
        .buttonStyle(.bordered)
        .tint(.gray)
        .padding(.top, 4)

        Text("Sincronizando com o celular...")
          .font(.caption2)
          .foregroundStyle(.secondary)
          .multilineTextAlignment(.center)
      }
      .padding()
    }
    .background(Color.black.edgesIgnoringSafeArea(.all))
  }

  // MARK: - Discard Workout

  private func discardCurrentWorkout() {
    guard let state = workoutStore.state else { return }

    NSLog("[KinevoWatch] Discarding workout %@", state.workoutId)

    // 1. Notify iPhone to clean up the pre-created session
    sessionManager.sendDiscardWorkout(workoutId: state.workoutId)

    // 2. End HealthKit session WITHOUT saving to Apple Health
    healthKitManager.discardWorkout()

    // 3. Clear local workout state (deletes persisted file)
    workoutStore.clearWorkout()

    // 4. Haptic feedback
    WKInterfaceDevice.current().play(.failure)

    // 5. Navigate back to workout list
    dismiss()
  }
}

// MARK: - Exercise Execution Page

private struct ExerciseExecutionPage: View {
  @ObservedObject var store: WorkoutExecutionStore
  let exerciseIndex: Int
  let totalExercises: Int
  let totalCarouselPages: Int
  let workoutStartDate: Date
  let hasCardioAfter: Bool
  let onSetLogged: (_ setIndex: Int, _ reps: Int, _ weight: Double) -> Void
  let onRestTimerRequested: (_ setIndex: Int, _ restTime: Int) -> Void
  let onFinishWorkout: () -> Void
  let onDismissRestTimer: () -> Void

  @State private var showSwipeHint = false
  @State private var undoBannerDismissTask: Task<Void, Never>?
  @State private var showUndoBanner = false
  @State private var showPrBadge = false
  @State private var prBadgeDismissTask: Task<Void, Never>?
  @State private var isWeightChanging = false
  @State private var isRepsChanging = false
  @State private var weightChangeDebounce: Task<Void, Never>?
  @State private var repsChangeDebounce: Task<Void, Never>?
  @State private var pendingRestTimerTask: Task<Void, Never>?
  @FocusState private var focusedInput: CrownInputFocus?

  private var exercise: WorkoutExecutionState.ExerciseState? {
    guard let state = store.state, exerciseIndex < state.exercises.count else { return nil }
    return state.exercises[exerciseIndex]
  }

  private var currentSetIndex: Int {
    exercise?.currentSetIndex ?? 0
  }

  private var compact: Bool {
    WKInterfaceDevice.current().screenBounds.height < 195
  }

  var body: some View {
    Group {
      if let exercise {
        ZStack(alignment: .top) {
          VStack(spacing: 0) {
            headerView(exercise: exercise, compact: compact)

            Spacer(minLength: compact ? 6 : 8)

            HStack(spacing: compact ? 4 : 6) {
              CrownInputCard(
                title: "Carga",
                value: String(format: "%.1f", currentWeight(exercise)),
                unit: "kg",
                isFocused: focusedInput == .weight,
                compact: compact,
                isAbovePrevious: exercise.lastWeight != nil && currentWeight(exercise) > exercise.lastWeight!
              )
              .scaleEffect(isWeightChanging ? 1.05 : 1.0)
              .animation(.spring(response: 0.15, dampingFraction: 0.6), value: isWeightChanging)
              .focusable(true)
              .focused($focusedInput, equals: .weight)
              .digitalCrownRotation(
                store.weightBinding(exerciseIndex: exerciseIndex, setIndex: currentSetIndex),
                from: 0,
                through: 400,
                by: 0.5,
                sensitivity: .medium,
                isContinuous: true,
                isHapticFeedbackEnabled: true
              )
              .onTapGesture {
                focusedInput = .weight
              }
              .onChange(of: currentWeight(exercise)) { _ in
                isWeightChanging = true
                weightChangeDebounce?.cancel()
                weightChangeDebounce = Task { @MainActor in
                  try? await Task.sleep(for: .milliseconds(150))
                  guard !Task.isCancelled else { return }
                  isWeightChanging = false
                }
              }
              .accessibilityLabel("Carga: \(String(format: "%.1f", currentWeight(exercise))) quilos")
              .accessibilityHint("Gire a Digital Crown para ajustar")

              CrownInputCard(
                title: "Reps",
                value: "\(currentReps(exercise))",
                unit: "rep",
                subtitle: exercise.targetReps.map { "Meta: \($0)" },
                isFocused: focusedInput == .reps,
                compact: compact,
                isAbovePrevious: exercise.lastReps != nil && currentReps(exercise) > exercise.lastReps!
              )
              .scaleEffect(isRepsChanging ? 1.05 : 1.0)
              .animation(.spring(response: 0.15, dampingFraction: 0.6), value: isRepsChanging)
              .focusable(true)
              .focused($focusedInput, equals: .reps)
              .digitalCrownRotation(
                store.repsBinding(exerciseIndex: exerciseIndex, setIndex: currentSetIndex),
                from: 0,
                through: 100,
                by: 1,
                sensitivity: .medium,
                isContinuous: true,
                isHapticFeedbackEnabled: true
              )
              .onTapGesture {
                focusedInput = .reps
              }
              .onChange(of: currentReps(exercise)) { _ in
                isRepsChanging = true
                repsChangeDebounce?.cancel()
                repsChangeDebounce = Task { @MainActor in
                  try? await Task.sleep(for: .milliseconds(150))
                  guard !Task.isCancelled else { return }
                  isRepsChanging = false
                }
              }
              .accessibilityLabel("Repetições: \(currentReps(exercise))")
              .accessibilityHint("Gire a Digital Crown para ajustar")
            }
            .id(currentSetIndex)
            .transition(.asymmetric(
              insertion: .move(edge: .bottom).combined(with: .opacity),
              removal: .move(edge: .top).combined(with: .opacity)
            ))

            Spacer(minLength: compact ? 6 : 8)

            // Bottom area: action button or navigation hint
            if isExerciseCompleted(exercise) && isLastExercise {
              Button("Finalizar Treino") {
                onFinishWorkout()
              }
              .font(compact ? .subheadline : .headline)
              .buttonStyle(.borderedProminent)
              .tint(.green)
              .frame(maxWidth: .infinity)
              .frame(minHeight: compact ? 36 : 40)
              .padding(.bottom, 4)
            } else if isExerciseCompleted(exercise) {
              VStack(spacing: 2) {
                if let nextExercise = store.state?.exercises[safe: exerciseIndex + 1] {
                  Text("Próximo: \(nextExercise.name)")
                    .font(.system(size: 10))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                }
                SwipeHintView(isVisible: $showSwipeHint)
              }
              .frame(minHeight: compact ? 36 : 40)
              .padding(.bottom, 4)
            } else {
              Button("Concluir Série") {
                NSLog("[KinevoWatch] Button TAP: Concluir Série — exercise=%@, setIndex=%d", exercise.name, currentSetIndex)
                completeCurrentSet(exercise: exercise)
              }
              .font(compact ? .subheadline : .headline)
              .buttonStyle(.borderedProminent)
              .tint(Color.kinevoViolet)
              .frame(maxWidth: .infinity)
              .frame(minHeight: compact ? 36 : 40)
              .padding(.bottom, 4)
              .accessibilityLabel("Concluir série \(currentSetNumber(exercise)) de \(totalSets(exercise)), \(exercise.name), \(String(format: "%.1f", currentWeight(exercise))) quilos vezes \(currentReps(exercise)) repetições")
            }
          }
          .padding(.horizontal, WatchDisplayPadding.current.horizontal)
          // Push content below the system clock on the round Apple Watch display.
          // The clock occupies ~28pt in the top-right corner even with toolbar hidden.
          // NOTE: .scenePadding() does NOT work inside TabView(.page) — using manual values.
          .padding(.top, WatchDisplayPadding.current.top)

          // PR badge overlay (top)
          if showPrBadge {
            VStack {
              prBadgeView
                .transition(.scale.combined(with: .opacity))
              Spacer()
            }
            .padding(.top, WatchDisplayPadding.current.top)
          }

          // Undo banner overlay (bottom — sits just above the action button area)
          if showUndoBanner, let last = store.lastCompletedSet, last.exerciseIndex == exerciseIndex {
            VStack {
              Spacer()
              undoBannerView(last: last)
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
            .padding(.bottom, compact ? 6 : 8)
            .padding(.horizontal, WatchDisplayPadding.current.horizontal)
          }
        }
      }
    }
    .foregroundStyle(.white)
    .background { Color.black.ignoresSafeArea() }
    .onAppear {
      if focusedInput == nil {
        focusedInput = .reps
      }
    }
  }

  private func headerView(exercise: WorkoutExecutionState.ExerciseState, compact: Bool) -> some View {
    VStack(alignment: .leading, spacing: 3) {
        // Superset label (separate line above name)
        if let idx = exercise.supersetIndex, let total = exercise.supersetTotal {
          HStack(spacing: 4) {
            Circle()
              .fill(Color.cyan)
              .frame(width: 5, height: 5)
            Text("Superset · \(idx + 1) de \(total)")
              .font(.system(size: compact ? 9 : 10, weight: .medium))
              .foregroundStyle(.cyan.opacity(0.9))
          }
          .padding(.trailing, 34) // Avoid system clock in top-right corner
        }

        // Exercise name — trailing padding avoids the system clock in the top-right corner.
        // The clock is ~44pt wide; after the container's horizontal padding we still need
        // ~34pt extra trailing clearance so long names don't render behind it.
        Text(exercise.name)
          .font(compact ? .caption : .subheadline)
          .fontWeight(.bold)
          .lineLimit(1)
          .minimumScaleFactor(0.7)
          .padding(.trailing, 34)

        // Previous performance + progression (hidden in compact mode)
        if !compact, let lw = exercise.lastWeight, let lr = exercise.lastReps {
          HStack(spacing: 4) {
            Text("Anterior \(String(format: "%.0f", lw)) × \(lr)")
              .font(.system(size: compact ? 9 : 10, weight: .medium))
              .foregroundStyle(.gray.opacity(0.7))
              .lineLimit(1)

            if let progressText = progressLabel(exercise: exercise) {
              Text(progressText)
                .font(.system(size: compact ? 9 : 10, weight: .bold))
                .foregroundStyle(.green)
                .lineLimit(1)
            }
          }
          .minimumScaleFactor(0.7)
        }

        // Set counter + dots
        HStack(spacing: 0) {
          Text("Série \(currentSetNumber(exercise))/\(totalSets(exercise))")
            .font(compact ? .system(size: 10, weight: .regular) : .caption2)
            .foregroundStyle(.secondary)
            .lineLimit(1)
            .minimumScaleFactor(0.7)

          Spacer(minLength: 6)

          setProgressDots(exercise: exercise, compact: compact)
        }
      }
  }

  private func completeCurrentSet(exercise: WorkoutExecutionState.ExerciseState) {
    let setIndex = currentSetIndex

    NSLog("[KinevoWatch] completeCurrentSet called — currentSetIndex: %d, exercise: %@", setIndex, exercise.name)

    guard !exercise.sets.isEmpty else { return }
    guard setIndex >= 0 && setIndex < exercise.sets.count else { return }
    guard !exercise.sets[setIndex].isCompleted else { return }

    // Capture values BEFORE mutation
    let reps = exercise.sets[setIndex].reps
    let weight = exercise.sets[setIndex].weight
    let restTime = exercise.restTime
    let hasNextSet = setIndex < (exercise.sets.count - 1)

    // Send set completion to iPhone
    NSLog("[KinevoWatch] onSetLogged SYNC — setIndex=%d, reps=%d, weight=%.1f", setIndex, reps, weight)
    onSetLogged(setIndex, reps, weight)

    // Mutate via store (persists immediately) — animate transition to next set
    withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
      store.completeSet(exerciseIndex: exerciseIndex, setIndex: setIndex)
    }

    // Haptics
    if !hasNextSet {
      WKInterfaceDevice.current().play(.directionUp)
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
        showSwipeHint = true
      }
    } else {
      WKInterfaceDevice.current().play(.success)
    }

    // Rest timer — delayed 1.8s so undo banner is visible first
    if hasNextSet && restTime > 0 {
      NSLog("[KinevoWatch] scheduling rest timer — %ds, delayed 1.8s", restTime)
      pendingRestTimerTask?.cancel()
      pendingRestTimerTask = Task { @MainActor in
        try? await Task.sleep(for: .seconds(1.8))
        guard !Task.isCancelled else { return }
        guard showUndoBanner else { return }
        onRestTimerRequested(setIndex, restTime)
      }
    }

    // Focus reps for next set
    if hasNextSet {
      focusedInput = .reps
    }

    // Show undo banner
    undoBannerDismissTask?.cancel()
    showPrBadge = false
    // Check for PR before showing banner
    if let lw = exercise.lastWeight, weight > lw {
      showPrBadge = true
      prBadgeDismissTask?.cancel()
      prBadgeDismissTask = Task { @MainActor in
        try? await Task.sleep(for: .seconds(2))
        guard !Task.isCancelled else { return }
        withAnimation(.easeOut(duration: 0.25)) {
          showPrBadge = false
        }
      }
    }
    withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
      showUndoBanner = true
    }
    undoBannerDismissTask = Task { @MainActor in
      try? await Task.sleep(for: .seconds(5))
      guard !Task.isCancelled else { return }
      withAnimation(.easeOut(duration: 0.25)) {
        showUndoBanner = false
      }
    }

    NSLog("[KinevoWatch] completeCurrentSet END — new currentSetIndex=%d", store.state?.exercises[exerciseIndex].currentSetIndex ?? -1)
  }

  private func undoBannerView(last: WorkoutExecutionStore.LastCompletedSet) -> some View {
    HStack(spacing: 6) {
      Image(systemName: "checkmark.circle.fill")
        .font(.system(size: 12))
        .foregroundStyle(.green)

      Text("\(String(format: "%.1f", last.weight))kg × \(last.reps)")
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(.white)
        .lineLimit(1)
        .minimumScaleFactor(0.7)

      Spacer()

      Button {
        performUndo()
      } label: {
        Text("Desfazer")
          .font(.system(size: 12, weight: .semibold))
          .foregroundStyle(Color.kinevoViolet)
          .lineLimit(1)
      }
      .buttonStyle(.plain)
    }
    .padding(.horizontal, 12)
    .padding(.vertical, 10)
    .background(
      RoundedRectangle(cornerRadius: 14, style: .continuous)
        .fill(Color.kinevoCard)
    )
  }

  private var prBadgeView: some View {
    HStack(spacing: 4) {
      Text("\u{1F3C6}")
        .font(.system(size: 12))
      Text("Novo recorde!")
        .font(.system(size: 11, weight: .bold))
        .foregroundStyle(.yellow)
        .lineLimit(1)
    }
    .padding(.horizontal, 10)
    .padding(.vertical, 4)
    .background(
      Capsule()
        .fill(Color.yellow.opacity(0.15))
    )
  }

  private func performUndo() {
    undoBannerDismissTask?.cancel()
    prBadgeDismissTask?.cancel()
    pendingRestTimerTask?.cancel()
    withAnimation(.easeOut(duration: 0.25)) {
      showUndoBanner = false
      showSwipeHint = false
      showPrBadge = false
    }
    store.undoLastCompletedSet()
    onDismissRestTimer()
    focusedInput = .reps
    WKInterfaceDevice.current().play(.click)
    NSLog("[KinevoWatch] Undo performed for exercise %d", exerciseIndex)
  }

  // MARK: - Set Progress Dots

  private func setProgressDots(exercise: WorkoutExecutionState.ExerciseState, compact: Bool) -> some View {
    let dotSize: CGFloat = compact ? 5 : 6
    let spacing: CGFloat = compact ? 3 : 4
    let completedCount = exercise.sets.filter(\.isCompleted).count
    return HStack(spacing: spacing) {
      ForEach(0..<exercise.sets.count, id: \.self) { i in
        if exercise.sets[i].isCompleted {
          Circle()
            .fill(Color.kinevoViolet)
            .frame(width: dotSize, height: dotSize)
        } else if i == currentSetIndex {
          Circle()
            .fill(Color.clear)
            .frame(width: dotSize, height: dotSize)
            .overlay(
              Circle()
                .stroke(Color.kinevoViolet, lineWidth: 2)
            )
        } else {
          Circle()
            .fill(Color.clear)
            .frame(width: dotSize, height: dotSize)
            .overlay(
              Circle()
                .stroke(Color.gray.opacity(0.5), lineWidth: 1)
            )
        }
      }
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("\(completedCount) de \(exercise.sets.count) séries concluídas")
  }

  // MARK: - Progress Comparison

  /// Returns a label like "+5 kg" or "+1 rep" when current set values exceed previous performance.
  private func progressLabel(exercise: WorkoutExecutionState.ExerciseState) -> String? {
    let weight = currentWeight(exercise)
    let reps = currentReps(exercise)

    if let lw = exercise.lastWeight, weight > lw {
      let diff = weight - lw
      let formatted = diff.truncatingRemainder(dividingBy: 1) == 0
        ? String(format: "%.0f", diff)
        : String(format: "%.1f", diff)
      return "+\(formatted) kg"
    }

    if let lr = exercise.lastReps, reps > lr {
      let diff = reps - lr
      return "+\(diff) rep"
    }

    return nil
  }

  // MARK: - Computed Helpers

  private func totalSets(_ exercise: WorkoutExecutionState.ExerciseState) -> Int {
    max(exercise.sets.count, 1)
  }

  private func currentSetNumber(_ exercise: WorkoutExecutionState.ExerciseState) -> Int {
    min(currentSetIndex + 1, totalSets(exercise))
  }

  private func isExerciseCompleted(_ exercise: WorkoutExecutionState.ExerciseState) -> Bool {
    exercise.sets.allSatisfy(\.isCompleted)
  }

  /// True when this is the last exercise AND there are no cardio pages after it.
  /// If cardio pages exist, the "Finalizar Treino" button moves to the last cardio page.
  private var isLastExercise: Bool {
    (exerciseIndex + 1) == totalExercises && !hasCardioAfter
  }

  private func currentReps(_ exercise: WorkoutExecutionState.ExerciseState) -> Int {
    guard !exercise.sets.isEmpty else { return 0 }
    let index = min(max(currentSetIndex, 0), exercise.sets.count - 1)
    return exercise.sets[index].reps
  }

  private func currentWeight(_ exercise: WorkoutExecutionState.ExerciseState) -> Double {
    guard !exercise.sets.isEmpty else { return 0 }
    let index = min(max(currentSetIndex, 0), exercise.sets.count - 1)
    return exercise.sets[index].weight
  }
}

// MARK: - Crown Input Card

private struct CrownInputCard: View {
  let title: String
  let value: String
  let unit: String
  var subtitle: String? = nil
  let isFocused: Bool
  let compact: Bool
  var isAbovePrevious: Bool = false

  var body: some View {
    VStack(spacing: compact ? 0 : 2) {
      Text(value)
        .font(.system(size: compact ? 28 : 34, weight: .bold, design: .rounded))
        .foregroundStyle(isAbovePrevious ? .green : .white)
        .lineLimit(1)
        .minimumScaleFactor(0.75)

      if let subtitle, !subtitle.isEmpty {
        Text(subtitle)
          .font(.system(size: compact ? 9 : 10, weight: .medium))
          .foregroundStyle(Color.kinevoViolet.opacity(0.9))
          .lineLimit(1)
          .minimumScaleFactor(0.7)
      } else {
        Text(title.lowercased() == "reps" ? "Repetições" : "\(title) (\(unit))")
          .font(.caption2)
          .foregroundStyle(.gray)
          .lineLimit(1)
          .minimumScaleFactor(0.7)
      }
    }
    .frame(maxWidth: .infinity, minHeight: compact ? 56 : 64)
    .padding(.vertical, compact ? 4 : 6)
    .background(
      RoundedRectangle(cornerRadius: 12, style: .continuous)
        .fill(isFocused
          ? LinearGradient(colors: [Color.kinevoViolet.opacity(0.08), Color.kinevoCard], startPoint: .top, endPoint: .bottom)
          : LinearGradient(colors: [Color.kinevoCard, Color.kinevoCard], startPoint: .top, endPoint: .bottom)
        )
    )
    .overlay(
      RoundedRectangle(cornerRadius: 12, style: .continuous)
        .stroke(isFocused ? Color.kinevoViolet : Color.clear, lineWidth: isFocused ? 3 : 0)
    )
    .overlay(alignment: .topTrailing) {
      if isFocused {
        Image(systemName: "digitalcrown.horizontal.arrow.clockwise")
          .font(.system(size: 9))
          .foregroundStyle(Color.kinevoViolet.opacity(0.6))
          .padding(6)
      }
    }
  }
}

// MARK: - Swipe Hint View

private struct SwipeHintView: View {
  @Binding var isVisible: Bool
  @State private var arrowOffset: CGFloat = 0

  var body: some View {
    HStack(spacing: 6) {
      Text("Próximo exercício")
        .font(.system(size: 13, weight: .semibold))
        .foregroundStyle(.white.opacity(0.85))
        .lineLimit(1)
        .minimumScaleFactor(0.75)

      Image(systemName: "chevron.right")
        .font(.system(size: 12, weight: .bold))
        .foregroundStyle(Color.kinevoViolet)
        .offset(x: arrowOffset)
    }
    .frame(maxWidth: .infinity)
    .opacity(isVisible ? 1 : 0)
    .onAppear {
      withAnimation(
        .easeInOut(duration: 0.8)
        .repeatForever(autoreverses: true)
      ) {
        arrowOffset = 5
      }
    }
  }
}

// MARK: - Finish Stat Row

private struct FinishStatRow: View {
  let icon: String
  let label: String
  let value: String

  var body: some View {
    HStack(spacing: 8) {
      Image(systemName: icon)
        .font(.system(size: 12))
        .foregroundStyle(Color.kinevoViolet)
        .frame(width: 16)
      Text(label)
        .font(.system(size: 12))
        .foregroundStyle(.secondary)
      Spacer()
      Text(value)
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(.white)
    }
    .padding(.horizontal, 10)
  }
}

// MARK: - Progress Mini Ring

private struct ProgressMiniRing: View {
  let progress: Double
  let size: CGFloat

  var body: some View {
    ZStack {
      Circle()
        .stroke(Color.gray.opacity(0.3), lineWidth: 2)
      Circle()
        .trim(from: 0, to: CGFloat(min(max(progress, 0), 1)))
        .stroke(Color.kinevoViolet, style: StrokeStyle(lineWidth: 2, lineCap: .round))
        .rotationEffect(.degrees(-90))
    }
    .frame(width: size, height: size)
  }
}

// MARK: - Rest Timer Sheet

private struct RestTimerSheet: View {
  let timerState: RestTimerState
  @Environment(\.dismiss) private var dismiss

  @State private var remainingSeconds: Int
  private let ticker = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

  init(timerState: RestTimerState) {
    self.timerState = timerState
    _remainingSeconds = State(initialValue: timerState.seconds)
  }

  var body: some View {
    ZStack {
      Color.black.ignoresSafeArea()

      VStack(spacing: 6) {
        Text("Descanso")
          .font(.system(size: 15, weight: .semibold))
          .foregroundStyle(.white)

        Text(timerState.exerciseName)
          .font(.system(size: 11))
          .foregroundStyle(.secondary)
          .multilineTextAlignment(.center)
          .lineLimit(1)
          .minimumScaleFactor(0.7)

        ZStack {
          Circle()
            .stroke(Color.gray.opacity(0.22), lineWidth: 8)
            .frame(width: 96, height: 96)

          Circle()
            .trim(from: 0, to: progressValue)
            .stroke(Color.kinevoViolet, style: StrokeStyle(lineWidth: 8, lineCap: .round))
            .rotationEffect(.degrees(-90))
            .frame(width: 96, height: 96)

          Text("\(remainingSeconds)s")
            .font(.system(size: 28, weight: .bold, design: .rounded))
            .monospacedDigit()
            .foregroundStyle(.white)
        }

        Text("Série \(timerState.setNumber) concluída")
          .font(.system(size: 11))
          .foregroundStyle(.secondary)

        Button("Pular descanso") {
          dismiss()
        }
        .font(.system(size: 14))
        .buttonStyle(.bordered)
        .accessibilityLabel("Pular descanso")
      }
      .padding(.horizontal, 12)
      .padding(.vertical, 6)
    }
    .accessibilityElement(children: .combine)
    .accessibilityValue("\(remainingSeconds) segundos restantes")
    .onReceive(ticker) { _ in
      let elapsed = Int(Date().timeIntervalSince(timerState.startedAt))
      let newRemaining = max(timerState.seconds - elapsed, 0)
      let previousRemaining = remainingSeconds
      remainingSeconds = newRemaining

      // Intermediate haptic at 30s remaining (only when total > 45s)
      if previousRemaining > 30 && newRemaining <= 30 && timerState.seconds > 45 {
        WKInterfaceDevice.current().play(.directionUp)
      }

      // Intermediate haptic at 10s remaining
      if previousRemaining > 10 && newRemaining <= 10 && newRemaining > 0 {
        WKInterfaceDevice.current().play(.click)
      }

      // Double haptic at completion
      if newRemaining == 0 {
        WKInterfaceDevice.current().play(.success)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
          WKInterfaceDevice.current().play(.success)
        }
        dismiss()
      }
    }
  }

  private var progressValue: CGFloat {
    guard timerState.seconds > 0 else { return 1 }
    let elapsed = timerState.seconds - remainingSeconds
    let progress = Double(elapsed) / Double(timerState.seconds)
    return CGFloat(min(max(progress, 0), 1))
  }
}

// MARK: - Safe Array Subscript

private extension Array {
  subscript(safe index: Index) -> Element? {
    indices.contains(index) ? self[index] : nil
  }
}
