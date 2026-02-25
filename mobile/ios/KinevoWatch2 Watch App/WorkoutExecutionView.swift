import SwiftUI
import Combine
import WatchKit

private enum CrownInputFocus: Hashable {
  case weight
  case reps
}

private struct EditableSet: Identifiable {
  let id = UUID()
  var reps: Int
  var weight: Double
  var isCompleted: Bool
}

private struct EditableExercise: Identifiable {
  let id: String
  let name: String
  let restTime: Int
  let targetReps: String?  // Prescribed rep range, e.g. "8-12"
  var sets: [EditableSet]

  init(snapshot: WatchExerciseSnapshot) {
    self.id = snapshot.id
    self.name = snapshot.name
    self.restTime = snapshot.restTime
    self.targetReps = snapshot.targetReps

    let initialWeight = snapshot.weight ?? 0
    self.sets = (0..<snapshot.sets).map { index in
      EditableSet(
        reps: snapshot.reps,
        weight: initialWeight,
        isCompleted: index < snapshot.completedSets
      )
    }
  }
}

private struct RestTimerState: Identifiable {
  let id = UUID()
  let seconds: Int
  let exerciseName: String
  let setNumber: Int
  let startedAt: Date
}

private enum WatchDateParser {
  static func parseISO8601(_ raw: String?) -> Date? {
    guard let raw, !raw.isEmpty else { return nil }

    let formatterWithFractions = ISO8601DateFormatter()
    formatterWithFractions.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let parsed = formatterWithFractions.date(from: raw) {
      return parsed
    }

    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime]
    return formatter.date(from: raw)
  }
}

private extension Color {
  static let kinevoViolet = Color(red: 124 / 255, green: 58 / 255, blue: 237 / 255)
  static let kinevoCard = Color(red: 20 / 255, green: 20 / 255, blue: 24 / 255)
}

struct WorkoutExecutionView: View {
  @EnvironmentObject private var sessionManager: WatchSessionManager
  @EnvironmentObject private var workoutManager: WorkoutManager
  let workout: WatchWorkoutSnapshot

  @State private var exerciseIndex: Int
  @State private var editableExercises: [EditableExercise]
  @State private var restTimerState: RestTimerState?
  @State private var hasStarted: Bool
  @State private var isFinishingWorkout = false
  @State private var workoutRpe: Double = 5
  @State private var hasFinishedWorkout = false

  private let workoutStartDate: Date

  init(workout: WatchWorkoutSnapshot) {
    self.workout = workout
    let editable = workout.exercises.map { EditableExercise(snapshot: $0) }
    _editableExercises = State(initialValue: editable)
    _hasStarted = State(initialValue: workout.isActive)

    let maxIndex = max(0, editable.count - 1)
    let startIndex = min(max(workout.currentExerciseIndex, 0), maxIndex)
    _exerciseIndex = State(initialValue: startIndex)

    self.workoutStartDate = WatchDateParser.parseISO8601(workout.startedAt)
      ?? WatchDateParser.parseISO8601(workout.updatedAt)
      ?? Date()
  }

  var body: some View {
    ZStack {
      Color.black.edgesIgnoringSafeArea(.all)

      Group {
        if !hasStarted {
          startView
        } else if editableExercises.isEmpty {
          emptyView
        } else {
          TabView {
            // Page 0: Exercise carousel (horizontal swipe between exercises)
            TabView(selection: $exerciseIndex) {
              ForEach(Array(editableExercises.indices), id: \.self) { index in
                ExerciseExecutionPage(
                  exercise: $editableExercises[index],
                  exerciseNumber: index + 1,
                  totalExercises: editableExercises.count,
                  workoutStartDate: workoutStartDate,
                  onSetCompleted: { setIndex, reps, weight, restTime, hasNextSet in
                    sessionManager.sendSetCompletion(
                      workoutId: workout.workoutId,
                      exerciseIndex: index,
                      exerciseId: editableExercises[index].id,
                      setIndex: setIndex,
                      reps: reps,
                      weight: weight
                    )

                    if hasNextSet && restTime > 0 {
                      restTimerState = RestTimerState(
                        seconds: restTime,
                        exerciseName: editableExercises[index].name,
                        setNumber: setIndex + 1,
                        startedAt: Date()
                      )
                    }
                  },
                  onFinishWorkout: {
                    isFinishingWorkout = true
                  }
                )
                .tag(index)
              }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))

            // Page 1: Workout dashboard (elapsed time + heart rate)
            WorkoutDashboardView(workoutStartDate: workoutStartDate)

            // Page 2: Media controls (Now Playing)
            NowPlayingView()
          }
          .tabViewStyle(.verticalPage)
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
        pseSelectionView
      }
    }
    .onChange(of: workout.isActive) { _, isActive in
      hasStarted = isActive
    }
    .onDisappear {
      if workoutManager.isSessionActive {
        workoutManager.endWorkout()
      }
    }
    .navigationBarTitleDisplayMode(.inline)
  }

  private var startView: some View {
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
        workoutManager.startWorkout()
        sessionManager.sendStartWorkout(workoutId: workout.workoutId)
        hasStarted = true
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

  private var pseSelectionView: some View {
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
        sessionManager.sendFinishWorkout(workoutId: workout.workoutId, rpe: Int(workoutRpe))
        workoutManager.endWorkout()
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
  @Binding var exercise: EditableExercise
  let exerciseNumber: Int
  let totalExercises: Int
  let workoutStartDate: Date
  let onSetCompleted: (_ setIndex: Int, _ reps: Int, _ weight: Double, _ restTime: Int, _ hasNextSet: Bool) -> Void
  let onFinishWorkout: () -> Void

  @State private var currentSetIndex: Int
  @State private var showSwipeHint = false
  @FocusState private var focusedInput: CrownInputFocus?

  init(
    exercise: Binding<EditableExercise>,
    exerciseNumber: Int,
    totalExercises: Int,
    workoutStartDate: Date,
    onSetCompleted: @escaping (_ setIndex: Int, _ reps: Int, _ weight: Double, _ restTime: Int, _ hasNextSet: Bool) -> Void,
    onFinishWorkout: @escaping () -> Void
  ) {
    self._exercise = exercise
    self.exerciseNumber = exerciseNumber
    self.totalExercises = totalExercises
    self.workoutStartDate = workoutStartDate
    self.onSetCompleted = onSetCompleted
    self.onFinishWorkout = onFinishWorkout

    let sets = exercise.wrappedValue.sets
    let firstIncomplete = sets.firstIndex(where: { !$0.isCompleted }) ?? max(sets.count - 1, 0)
    _currentSetIndex = State(initialValue: firstIncomplete)
  }

  var body: some View {
    GeometryReader { proxy in
      let compact = proxy.size.height < 170

      VStack(spacing: 0) {
        headerView(compact: compact)

        Spacer(minLength: 4)

        HStack(spacing: compact ? 4 : 6) {
          CrownInputCard(
            title: "Carga",
            value: String(format: "%.1f", currentWeight),
            unit: "kg",
            isFocused: focusedInput == .weight,
            compact: compact
          )
          .focusable(true)
          .focused($focusedInput, equals: .weight)
          .digitalCrownRotation(
            weightBinding,
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
            value: "\(currentReps)",
            unit: "rep",
            subtitle: exercise.targetReps.map { "Meta: \($0)" },
            isFocused: focusedInput == .reps,
            compact: compact
          )
          .focusable(true)
          .focused($focusedInput, equals: .reps)
          .digitalCrownRotation(
            repsBinding,
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
        if isExerciseCompleted && isLastExercise {
          Button("Finalizar Treino") {
            onFinishWorkout()
          }
          .font(compact ? .subheadline : .headline)
          .buttonStyle(.borderedProminent)
          .tint(.green)
          .frame(maxWidth: .infinity)
          .frame(minHeight: compact ? 36 : 40)
          .padding(.bottom, proxy.safeAreaInsets.bottom > 0 ? 0 : 4)
        } else if isExerciseCompleted {
          // Swipe hint — replaces the disabled button
          SwipeHintView(isVisible: $showSwipeHint)
            .frame(minHeight: compact ? 36 : 40)
            .padding(.bottom, proxy.safeAreaInsets.bottom > 0 ? 0 : 4)
        } else {
          Button("Concluir Série") {
            completeCurrentSet()
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
    }
    .foregroundStyle(.white)
    .background(Color.black.edgesIgnoringSafeArea(.all))
    .onAppear {
      if focusedInput == nil {
        focusedInput = .reps
      }
    }
  }

  private func headerView(compact: Bool) -> some View {
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

      Text("Série \(currentSetNumber) de \(totalSets) • Exercício \(exerciseNumber) de \(totalExercises)")
        .font(compact ? .system(size: 10, weight: .regular) : .caption2)
        .foregroundStyle(.secondary)
        .lineLimit(1)
        .minimumScaleFactor(0.7)
    }
  }

  private func completeCurrentSet() {
    guard !exercise.sets.isEmpty else { return }
    guard currentSetIndex >= 0 && currentSetIndex < exercise.sets.count else { return }
    guard !exercise.sets[currentSetIndex].isCompleted else { return }

    let setIndex = currentSetIndex
    let reps = exercise.sets[setIndex].reps
    let weight = exercise.sets[setIndex].weight
    exercise.sets[setIndex].isCompleted = true

    // Replica a carga e as repetições para as próximas séries não concluídas
    for i in (setIndex + 1)..<exercise.sets.count {
      if !exercise.sets[i].isCompleted {
        exercise.sets[i].reps = reps
        exercise.sets[i].weight = weight
      }
    }

    let hasNextSet = setIndex < (exercise.sets.count - 1)
    let justFinishedExercise = !hasNextSet

    if justFinishedExercise {
      // Exercise completed — directional haptic to suggest swiping
      WKInterfaceDevice.current().play(.directionUp)
      // Show the swipe hint with a short delay so the user feels the transition
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
        showSwipeHint = true
      }
    } else {
      WKInterfaceDevice.current().play(.success)
    }

    onSetCompleted(
      setIndex,
      reps,
      weight,
      exercise.restTime,
      hasNextSet
    )

    if hasNextSet {
      currentSetIndex = setIndex + 1
      focusedInput = .reps
    }
  }

  private var totalSets: Int {
    max(exercise.sets.count, 1)
  }

  private var currentSetNumber: Int {
    min(currentSetIndex + 1, totalSets)
  }

  private var isExerciseCompleted: Bool {
    exercise.sets.allSatisfy(\.isCompleted)
  }

  private var isLastExercise: Bool {
    exerciseNumber == totalExercises
  }

  private var currentReps: Int {
    guard !exercise.sets.isEmpty else { return 0 }
    let index = min(max(currentSetIndex, 0), exercise.sets.count - 1)
    return exercise.sets[index].reps
  }

  private var currentWeight: Double {
    guard !exercise.sets.isEmpty else { return 0 }
    let index = min(max(currentSetIndex, 0), exercise.sets.count - 1)
    return exercise.sets[index].weight
  }

  private var repsBinding: Binding<Double> {
    Binding<Double>(
      get: { Double(currentReps) },
      set: { newValue in
        guard !exercise.sets.isEmpty else { return }
        let index = min(max(currentSetIndex, 0), exercise.sets.count - 1)
        exercise.sets[index].reps = max(0, Int(newValue.rounded()))
      }
    )
  }

  private var weightBinding: Binding<Double> {
    Binding<Double>(
      get: { currentWeight },
      set: { newValue in
        guard !exercise.sets.isEmpty else { return }
        let index = min(max(currentSetIndex, 0), exercise.sets.count - 1)
        exercise.sets[index].weight = max(0, newValue)
      }
    )
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
