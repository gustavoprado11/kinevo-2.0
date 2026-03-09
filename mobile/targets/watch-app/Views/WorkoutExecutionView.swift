import SwiftUI
import Combine
import WatchKit

private enum CrownInputFocus: Hashable {
  case weight
  case reps
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
  let workout: WatchWorkoutSnapshot

  @State private var restTimerState: RestTimerState?
  @State private var isFinishingWorkout = false
  @State private var workoutRpe: Double = 5
  @State private var hasFinishedWorkout = false

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
    .onAppear {
      // Load workout into store if not already present
      if store.state == nil || store.state?.workoutId != workout.workoutId {
        store.loadWorkout(from: workout)
      }
    }
    .navigationBarTitleDisplayMode(.inline)
  }

  // MARK: - Workout Content

  private func workoutContent(state: WorkoutExecutionState, sm: WatchSessionManager, store: WorkoutExecutionStore) -> some View {
    let exerciseIndexBinding = Binding<Int>(
      get: { state.exerciseIndex },
      set: { store.setExerciseIndex($0) }
    )

    return TabView {
      // Page 0: Exercise carousel
      TabView(selection: exerciseIndexBinding) {
        ForEach(Array(state.exercises.indices), id: \.self) { index in
          ExerciseExecutionPage(
            store: store,
            exerciseIndex: index,
            totalExercises: state.exercises.count,
            workoutStartDate: state.startedAt,
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
      }
      .tabViewStyle(.page(indexDisplayMode: .never))

      // Page 1: Workout dashboard
      WorkoutDashboardView(workoutStartDate: state.startedAt)

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
      Text("\(workout.exercises.count) exercícios")
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

        // Mark as pending BEFORE sending — persists so it survives app termination
        store.markFinishPending()

        sm.sendFinishWorkout(
          workoutId: state.workoutId,
          rpe: Int(workoutRpe),
          startedAt: state.startedAt,
          exercises: exercisesPayload
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

  private var successFinishView: some View {
    VStack(spacing: 12) {
      Image(systemName: "checkmark.circle.fill")
        .font(.system(size: 44))
        .foregroundStyle(.green)
      Text("Treino Concluído!")
        .font(.headline)
        .foregroundStyle(.white)
        .multilineTextAlignment(.center)
      Text("Seu resultado já está no celular.")
        .font(.footnote)
        .foregroundStyle(.secondary)
        .multilineTextAlignment(.center)
    }
    .padding()
    .background(Color.black.edgesIgnoringSafeArea(.all))
  }
}

// MARK: - Exercise Execution Page

private struct ExerciseExecutionPage: View {
  @ObservedObject var store: WorkoutExecutionStore
  let exerciseIndex: Int
  let totalExercises: Int
  let workoutStartDate: Date
  let onSetLogged: (_ setIndex: Int, _ reps: Int, _ weight: Double) -> Void
  let onRestTimerRequested: (_ setIndex: Int, _ restTime: Int) -> Void
  let onFinishWorkout: () -> Void
  let onDismissRestTimer: () -> Void

  @State private var showSwipeHint = false
  @State private var undoBannerDismissTask: Task<Void, Never>?
  @State private var showUndoBanner = false
  @State private var showPrBadge = false
  @State private var prBadgeDismissTask: Task<Void, Never>?
  @FocusState private var focusedInput: CrownInputFocus?

  private var exercise: WorkoutExecutionState.ExerciseState? {
    guard let state = store.state, exerciseIndex < state.exercises.count else { return nil }
    return state.exercises[exerciseIndex]
  }

  private var currentSetIndex: Int {
    exercise?.currentSetIndex ?? 0
  }

  var body: some View {
    GeometryReader { proxy in
      let compact = proxy.size.height < 170

      if let exercise {
        ZStack(alignment: .top) {
          VStack(spacing: 0) {
            headerView(exercise: exercise, compact: compact)

            Spacer(minLength: 4)

            HStack(spacing: compact ? 4 : 6) {
              CrownInputCard(
                title: "Carga",
                value: String(format: "%.1f", currentWeight(exercise)),
                unit: "kg",
                isFocused: focusedInput == .weight,
                compact: compact
              )
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

              CrownInputCard(
                title: "Reps",
                value: "\(currentReps(exercise))",
                unit: "rep",
                subtitle: exercise.targetReps.map { "Meta: \($0)" },
                isFocused: focusedInput == .reps,
                compact: compact
              )
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
            }

            Spacer(minLength: 4)

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
              .padding(.bottom, proxy.safeAreaInsets.bottom > 0 ? 0 : 4)
            } else if isExerciseCompleted(exercise) {
              SwipeHintView(isVisible: $showSwipeHint)
                .frame(minHeight: compact ? 36 : 40)
                .padding(.bottom, proxy.safeAreaInsets.bottom > 0 ? 0 : 4)
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
              .padding(.bottom, proxy.safeAreaInsets.bottom > 0 ? 0 : 4)
            }
          }
          .padding(.horizontal, 8)
          .padding(.top, proxy.safeAreaInsets.top > 0 ? 0 : 4)

          // Undo banner + PR badge overlay
          VStack(spacing: 4) {
            if showPrBadge {
              prBadgeView
                .transition(.scale.combined(with: .opacity))
            }
            if showUndoBanner, let last = store.lastCompletedSet, last.exerciseIndex == exerciseIndex {
              undoBannerView(last: last)
                .transition(.move(edge: .top).combined(with: .opacity))
            }
          }
        }
      }
    }
    .foregroundStyle(.white)
    .background(Color.black.edgesIgnoringSafeArea(.all))
    .onAppear {
      if focusedInput == nil {
        focusedInput = .reps
      }
    }
  }

  private func headerView(exercise: WorkoutExecutionState.ExerciseState, compact: Bool) -> some View {
    VStack(alignment: .leading, spacing: 3) {
      HStack {
        HStack(spacing: 4) {
          Image(systemName: "clock")
          Text(
            timerInterval: workoutStartDate...Date.now,
            pauseTime: nil,
            countsDown: false,
            showsHours: true
          )
          .monospacedDigit()
        }
        .font(compact ? .system(size: 10, weight: .regular) : .caption2)
        .foregroundStyle(.gray)

        Spacer()

        Text(Date(), style: .time)
          .font(.system(size: compact ? 9 : 10, weight: .regular))
          .foregroundStyle(.gray.opacity(0.8))
      }

      Text(exercise.name)
        .font(compact ? .caption : .subheadline)
        .fontWeight(.bold)
        .lineLimit(1)
        .minimumScaleFactor(0.8)

      if let lw = exercise.lastWeight, let lr = exercise.lastReps {
        HStack(spacing: 4) {
          Text("Anterior \(String(format: "%.0f", lw)) × \(lr)")
            .font(.system(size: compact ? 9 : 10, weight: .medium))
            .foregroundStyle(.gray.opacity(0.7))

          if let progressText = progressLabel(exercise: exercise) {
            Text(progressText)
              .font(.system(size: compact ? 9 : 10, weight: .bold))
              .foregroundStyle(.green)
          }
        }
      }

      HStack(spacing: 0) {
        Text("Série \(currentSetNumber(exercise)) de \(totalSets(exercise)) • Exercício \(exerciseIndex + 1) de \(totalExercises)")
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

    // Mutate via store (persists immediately)
    store.completeSet(exerciseIndex: exerciseIndex, setIndex: setIndex)

    // Haptics
    if !hasNextSet {
      WKInterfaceDevice.current().play(.directionUp)
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
        showSwipeHint = true
      }
    } else {
      WKInterfaceDevice.current().play(.success)
    }

    // Rest timer
    if hasNextSet && restTime > 0 {
      NSLog("[KinevoWatch] scheduling rest timer — %ds, asyncAfter 0.15s", restTime)
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
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
      try? await Task.sleep(for: .seconds(3))
      guard !Task.isCancelled else { return }
      withAnimation(.easeOut(duration: 0.25)) {
        showUndoBanner = false
      }
    }

    NSLog("[KinevoWatch] completeCurrentSet END — new currentSetIndex=%d", store.state?.exercises[exerciseIndex].currentSetIndex ?? -1)
  }

  private func undoBannerView(last: WorkoutExecutionStore.LastCompletedSet) -> some View {
    HStack(spacing: 8) {
      VStack(alignment: .leading, spacing: 1) {
        HStack(spacing: 4) {
          Image(systemName: "checkmark.circle.fill")
            .font(.system(size: 11))
            .foregroundStyle(.green)
          Text("Série concluída")
            .font(.system(size: 11, weight: .semibold))
        }
        Text("\(String(format: "%.1f", last.weight))kg × \(last.reps)")
          .font(.system(size: 10))
          .foregroundStyle(.secondary)
      }

      Spacer()

      Button {
        performUndo()
      } label: {
        Text("Desfazer")
          .font(.system(size: 11, weight: .semibold))
          .foregroundStyle(Color.kinevoViolet)
      }
      .buttonStyle(.plain)
    }
    .padding(.horizontal, 10)
    .padding(.vertical, 6)
    .background(
      RoundedRectangle(cornerRadius: 10, style: .continuous)
        .fill(Color.gray.opacity(0.2))
    )
    .padding(.horizontal, 8)
    .padding(.top, 2)
  }

  private var prBadgeView: some View {
    HStack(spacing: 4) {
      Text("\u{1F3C6}")
        .font(.system(size: 12))
      Text("Novo recorde!")
        .font(.system(size: 11, weight: .bold))
        .foregroundStyle(.yellow)
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
    return HStack(spacing: spacing) {
      ForEach(0..<exercise.sets.count, id: \.self) { i in
        if exercise.sets[i].isCompleted {
          // Completed: filled violet
          Circle()
            .fill(Color.kinevoViolet)
            .frame(width: dotSize, height: dotSize)
        } else if i == currentSetIndex {
          // Current: hollow with thick violet stroke
          Circle()
            .fill(Color.clear)
            .frame(width: dotSize, height: dotSize)
            .overlay(
              Circle()
                .stroke(Color.kinevoViolet, lineWidth: 2)
            )
        } else {
          // Future: hollow with thin gray stroke
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

  private var isLastExercise: Bool {
    (exerciseIndex + 1) == totalExercises
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

  var body: some View {
    VStack(spacing: compact ? 0 : 2) {
      Text(value)
        .font(.system(size: compact ? 26 : 32, weight: .bold, design: .rounded))
        .foregroundStyle(.white)
        .lineLimit(1)
        .minimumScaleFactor(0.75)

      if let subtitle, !subtitle.isEmpty {
        Text(subtitle)
          .font(.system(size: compact ? 9 : 10, weight: .medium))
          .foregroundStyle(Color.kinevoViolet.opacity(0.9))
      } else {
        Text(title.lowercased() == "reps" ? "Repetições" : "\(title) (\(unit))")
          .font(.caption2)
          .foregroundStyle(.gray)
      }
    }
    .frame(maxWidth: .infinity, minHeight: compact ? 60 : 70)
    .padding(.vertical, compact ? 6 : 8)
    .background(
      RoundedRectangle(cornerRadius: 12, style: .continuous)
        .fill(isFocused ? Color.gray.opacity(0.2) : Color.kinevoCard)
    )
    .overlay(
      RoundedRectangle(cornerRadius: 12, style: .continuous)
        .stroke(isFocused ? Color.kinevoViolet : Color.clear, lineWidth: isFocused ? 2 : 0)
    )
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

      VStack(spacing: 10) {
        Text("Descanso")
          .font(.headline)
          .foregroundStyle(.white)

        Text(timerState.exerciseName)
          .font(.caption2)
          .foregroundStyle(.secondary)
          .multilineTextAlignment(.center)

        ZStack {
          Circle()
            .stroke(Color.gray.opacity(0.22), lineWidth: 10)
            .frame(width: 108, height: 108)

          Circle()
            .trim(from: 0, to: progressValue)
            .stroke(Color.kinevoViolet, style: StrokeStyle(lineWidth: 10, lineCap: .round))
            .rotationEffect(.degrees(-90))
            .frame(width: 108, height: 108)

          Text("\(remainingSeconds)s")
            .font(.system(size: 30, weight: .bold, design: .rounded))
            .monospacedDigit()
            .foregroundStyle(.white)
        }

        Text("Série \(timerState.setNumber) concluída")
          .font(.caption2)
          .foregroundStyle(.secondary)

        Button("Pular descanso") {
          dismiss()
        }
        .buttonStyle(.bordered)
      }
      .padding()
    }
    .onReceive(ticker) { _ in
      let elapsed = Int(Date().timeIntervalSince(timerState.startedAt))
      let newRemaining = max(timerState.seconds - elapsed, 0)
      remainingSeconds = newRemaining

      if newRemaining == 0 {
        WKInterfaceDevice.current().play(.success)
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
