import SwiftUI
import Combine

/// Tracks whether the Watch has ever received data from the iPhone,
/// and if so, whether there's a pending workout or not.
private enum WatchWorkoutState {
    case neverSynced           // No applicationContext received yet
    case noWorkoutPending      // Received data with hasWorkout: false (all done / rest day)
    case workoutAvailable(WatchWorkoutSnapshot) // Ready to start
}

struct WorkoutListView: View {
    @EnvironmentObject var sessionManager: WatchSessionManager
    @EnvironmentObject var healthKitManager: HealthKitManager
    @State private var workoutState: WatchWorkoutState = .neverSynced

    var body: some View {
        VStack(spacing: 20) {
            switch workoutState {
            case .workoutAvailable(let workout):
                // Workout loaded - show start button
                VStack(spacing: 16) {
                    Image(systemName: "dumbbell.fill")
                        .font(.system(size: 36))
                        .foregroundColor(.kinevoViolet)

                    Text(workout.workoutName.isEmpty ? workout.studentName : workout.workoutName)
                        .font(.headline)
                        .foregroundColor(.kinevoTextPrimary)
                        .multilineTextAlignment(.center)

                    Text("\(workout.exercises.count) exercícios")
                        .font(.caption)
                        .foregroundColor(.kinevoTextSecondary)

                    NavigationLink(destination: WorkoutExecutionView(workout: workout)) {
                        HStack {
                            Image(systemName: "play.fill")
                                .font(.system(size: 18))
                            Text("Iniciar")
                                .font(.headline)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(Color.kinevoViolet)
                        .foregroundColor(.white)
                        .cornerRadius(12)
                    }
                    .buttonStyle(.plain)
                }
                .padding()
                .background(Color.kinevoCard)
                .cornerRadius(16)
                .padding(.horizontal)

            case .noWorkoutPending:
                // All workouts completed or rest day
                VStack(spacing: 16) {
                    Image(systemName: "checkmark.seal.fill")
                        .font(.system(size: 40))
                        .foregroundColor(.kinevoSuccess)

                    Text("Tudo feito!")
                        .font(.headline)
                        .foregroundColor(.kinevoTextPrimary)

                    Text("Nenhum treino pendente para hoje. Descanse e volte mais forte!")
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

            case .neverSynced:
                // No data received yet - waiting for iPhone
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
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.kinevoBg)
        .onReceive(sessionManager.$currentWorkout) { newValue in
            parseWorkout(newValue)
        }
        .onAppear {
            parseWorkout(sessionManager.currentWorkout)
            healthKitManager.requestAuthorization()
        }
    }

    private func parseWorkout(_ dict: [String: Any]?) {
        guard let dict = dict else {
            // No data at all — keep current state (don't reset to neverSynced
            // if we previously had data, as this could be a transient nil).
            // Only set neverSynced if we've truly never received anything.
            return
        }

        // Parse the envelope format: { schemaVersion, syncedAt, hasWorkout, workout: {...} }
        if let hasWorkout = dict["hasWorkout"] as? Bool {
            // We have the envelope — iPhone has synced
            if hasWorkout, let workoutDict = dict["workout"] as? [String: Any],
               let snapshot = WatchWorkoutSnapshot.parse(from: workoutDict) {
                workoutState = .workoutAvailable(snapshot)
            } else {
                // hasWorkout is false, or workout data is invalid
                workoutState = .noWorkoutPending
            }
        } else {
            // Legacy format (no envelope) — try direct parse
            if let snapshot = WatchWorkoutSnapshot.parse(from: dict) {
                workoutState = .workoutAvailable(snapshot)
            } else {
                workoutState = .noWorkoutPending
            }
        }
    }
}
