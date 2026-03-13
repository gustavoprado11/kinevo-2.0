import SwiftUI
import Combine

/// Tracks the state of program data from iPhone.
private enum WatchProgramState {
    case neverSynced
    case noProgram
    case programLoaded(WatchProgramSnapshot)
}

struct WorkoutListView: View {
    @EnvironmentObject var sessionManager: WatchSessionManager
    @EnvironmentObject var healthKitManager: HealthKitManager
    @EnvironmentObject var workoutStore: WorkoutExecutionStore
    @State private var programState: WatchProgramState = .neverSynced

    var body: some View {
        VStack(spacing: 0) {
            switch programState {
            case .programLoaded(let snapshot):
                programView(snapshot: snapshot)
            case .noProgram:
                noWorkoutView
            case .neverSynced:
                neverSyncedView
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.kinevoBg)
        .onReceive(sessionManager.$programSnapshot) { newValue in
            updateProgramState(newValue)
        }
        .onReceive(sessionManager.$currentWorkout) { newValue in
            workoutStore.reconcile(with: newValue)
        }
        .onAppear {
            updateProgramState(sessionManager.programSnapshot)
            healthKitManager.requestAuthorization()
        }
    }

    // MARK: - Program View

    private func programView(snapshot: WatchProgramSnapshot) -> some View {
        ScrollView {
            VStack(spacing: 12) {
                // Resume card at the top when a workout is in progress
                if let activeState = workoutStore.state, activeState.hasStarted {
                    inlineResumeCard(state: activeState)
                }

                programHeader(snapshot: snapshot)

                ForEach(sortedWorkouts(snapshot)) { workout in
                    workoutRow(workout: workout, snapshot: snapshot)
                }
            }
            .padding(.horizontal, 4)
            .padding(.bottom, 16)
        }
    }

    private func programHeader(snapshot: WatchProgramSnapshot) -> some View {
        VStack(spacing: 4) {
            if !snapshot.programName.isEmpty {
                Text(snapshot.programName)
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(.kinevoTextPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }

            if snapshot.totalWeeks > 0 {
                Text("Semana \(snapshot.currentWeek) de \(snapshot.totalWeeks)")
                    .font(.system(size: 11))
                    .foregroundColor(.kinevoTextSecondary)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 6)
    }

    private func workoutRow(workout: WatchProgramWorkoutSummary, snapshot: WatchProgramSnapshot) -> some View {
        let isToday = workout.isScheduledToday || snapshot.scheduleMode == .flexible
        let isCompleted = workout.isCompletedToday

        return NavigationLink(value: workout.toWorkoutSnapshot()) {
            HStack(spacing: 10) {
                // Status icon
                ZStack {
                    Circle()
                        .fill(statusColor(isToday: isToday, isCompleted: isCompleted).opacity(0.15))
                        .frame(width: 32, height: 32)

                    Image(systemName: statusIcon(isCompleted: isCompleted))
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(statusColor(isToday: isToday, isCompleted: isCompleted))
                }

                VStack(alignment: .leading, spacing: 3) {
                    Text(workout.workoutName)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(isCompleted ? .kinevoTextSecondary : .kinevoTextPrimary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)

                    HStack(spacing: 6) {
                        Text(workoutItemsLabel(workout))
                            .font(.system(size: 11))
                            .foregroundColor(.kinevoTextSecondary)

                        if isCompleted {
                            Text("Feito")
                                .font(.system(size: 10, weight: .medium))
                                .foregroundColor(.kinevoSuccess)
                        } else if let subtitle = workoutSubtitle(workout: workout, snapshot: snapshot) {
                            Text(subtitle)
                                .font(.system(size: 10))
                                .foregroundColor(.kinevoTextSecondary)
                        }
                    }
                }

                Spacer()
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 10)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(isToday && !isCompleted ? Color.kinevoViolet.opacity(0.1) : Color.kinevoCard)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(isToday && !isCompleted ? Color.kinevoViolet.opacity(0.3) : Color.clear, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .opacity(isCompleted ? 0.6 : 1.0)
    }

    // MARK: - Inline Resume Card

    private func inlineResumeCard(state: WorkoutExecutionState) -> some View {
        let completedSets = state.exercises.reduce(0) { $0 + $1.sets.filter(\.isCompleted).count }
        let totalSets = state.exercises.reduce(0) { $0 + $1.sets.count }
        let snapshot = buildSnapshotForResume(state: state)

        return NavigationLink(value: snapshot) {
            HStack(spacing: 10) {
                ZStack {
                    Circle()
                        .fill(Color.kinevoViolet.opacity(0.15))
                        .frame(width: 32, height: 32)

                    Image(systemName: "play.fill")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(.kinevoViolet)
                }

                VStack(alignment: .leading, spacing: 3) {
                    Text(state.workoutName.isEmpty ? "Treino em andamento" : state.workoutName)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(.kinevoTextPrimary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)

                    Text("\(completedSets)/\(totalSets) séries • Retomar")
                        .font(.system(size: 11))
                        .foregroundColor(.kinevoViolet)
                }

                Spacer()
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 10)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(Color.kinevoViolet.opacity(0.1))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(Color.kinevoViolet.opacity(0.3), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Empty States

    private var noWorkoutView: some View {
        VStack(spacing: 16) {
            Image(systemName: "checkmark.seal.fill")
                .font(.system(size: 40))
                .foregroundColor(.kinevoSuccess)

            Text("Tudo feito!")
                .font(.headline)
                .foregroundColor(.kinevoTextPrimary)

            Text("Nenhum programa ativo. Abra o Kinevo no celular.")
                .font(.caption2)
                .foregroundColor(.kinevoTextSecondary)
                .multilineTextAlignment(.center)

            if sessionManager.isConnected {
                HStack(spacing: 4) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 10))
                    Text("Conectado")
                        .font(.caption2)
                }
                .foregroundColor(.kinevoSuccess)
            }
        }
        .padding()
    }

    private var neverSyncedView: some View {
        VStack(spacing: 16) {
            Image(systemName: "iphone")
                .font(.system(size: 40))
                .foregroundColor(.kinevoTextSecondary)

            Text("Aguardando")
                .font(.headline)
                .foregroundColor(.kinevoTextPrimary)

            Text("Abra o Kinevo no celular para sincronizar")
                .font(.caption2)
                .foregroundColor(.kinevoTextSecondary)
                .multilineTextAlignment(.center)

            if sessionManager.isConnected {
                HStack(spacing: 4) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 10))
                    Text("Conectado")
                        .font(.caption2)
                }
                .foregroundColor(.kinevoSuccess)
            } else {
                HStack(spacing: 4) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.system(size: 10))
                    Text("Desconectado")
                        .font(.caption2)
                }
                .foregroundColor(.orange)
            }
        }
        .padding()
    }

    // MARK: - Helpers

    private func updateProgramState(_ snapshot: WatchProgramSnapshot?) {
        if let snapshot {
            programState = .programLoaded(snapshot)
        } else if sessionManager.currentWorkout != nil {
            // Received data but no program parsed → no active program
            programState = .noProgram
        }
        // If currentWorkout is nil, keep .neverSynced
    }

    private func sortedWorkouts(_ snapshot: WatchProgramSnapshot) -> [WatchProgramWorkoutSummary] {
        snapshot.workouts.sorted { a, b in
            // 1. Scheduled today + not completed first
            let aToday = (a.isScheduledToday || snapshot.scheduleMode == .flexible) && !a.isCompletedToday
            let bToday = (b.isScheduledToday || snapshot.scheduleMode == .flexible) && !b.isCompletedToday
            if aToday != bToday { return aToday }

            // 2. Not completed before completed
            if a.isCompletedToday != b.isCompletedToday { return !a.isCompletedToday }

            // 3. Order index
            return a.orderIndex < b.orderIndex
        }
    }

    private func statusIcon(isCompleted: Bool) -> String {
        isCompleted ? "checkmark" : "dumbbell.fill"
    }

    private func statusColor(isToday: Bool, isCompleted: Bool) -> Color {
        if isCompleted { return .kinevoSuccess }
        if isToday { return .kinevoViolet }
        return .kinevoTextSecondary
    }

    private func workoutItemsLabel(_ workout: WatchProgramWorkoutSummary) -> String {
        let exCount = workout.exercises.count
        let cardioCount = workout.cardioItems.count
        if cardioCount > 0 {
            return "\(exCount) exercícios • \(cardioCount) aeróbio\(cardioCount > 1 ? "s" : "")"
        }
        return "\(exCount) exercícios"
    }

    private func workoutSubtitle(workout: WatchProgramWorkoutSummary, snapshot: WatchProgramSnapshot) -> String? {
        if snapshot.scheduleMode == .scheduled {
            let dayNames = workout.scheduledDays.compactMap { shortDayName($0) }
            if !dayNames.isEmpty {
                return dayNames.joined(separator: "/")
            }
        }

        if let lastDone = workout.lastCompletedAt {
            let days = Calendar.current.dateComponents([.day], from: lastDone, to: Date()).day ?? 0
            if days == 0 { return "Hoje" }
            if days == 1 { return "Ontem" }
            return "\(days)d atrás"
        }

        return nil
    }

    private func shortDayName(_ dow: Int) -> String? {
        switch dow {
        case 0: return "Dom"
        case 1: return "Seg"
        case 2: return "Ter"
        case 3: return "Qua"
        case 4: return "Qui"
        case 5: return "Sex"
        case 6: return "Sáb"
        default: return nil
        }
    }

    /// Build a minimal WatchWorkoutSnapshot from persisted state for NavigationLink destination.
    private func buildSnapshotForResume(state: WorkoutExecutionState) -> WatchWorkoutSnapshot {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        let exercises = state.exercises.map { ex in
            let completedCount = ex.sets.filter(\.isCompleted).count
            return WatchExerciseSnapshot(
                id: ex.id,
                name: ex.name,
                sets: ex.sets.count,
                reps: ex.sets.first?.reps ?? 0,
                weight: ex.sets.first?.weight,
                restTime: ex.restTime,
                completedSets: completedCount,
                targetReps: ex.targetReps,
                lastWeight: ex.lastWeight,
                lastReps: ex.lastReps
            )
        }

        return WatchWorkoutSnapshot(
            workoutId: state.workoutId,
            workoutName: state.workoutName,
            studentName: "",
            exercises: exercises,
            cardioItems: [],
            currentExerciseIndex: state.exerciseIndex,
            isActive: state.hasStarted,
            startedAt: formatter.string(from: state.startedAt),
            updatedAt: nil
        )
    }
}
