import SwiftUI
import Combine

struct WorkoutListView: View {
    @EnvironmentObject var sessionManager: WatchSessionManager
    @EnvironmentObject var healthKitManager: HealthKitManager
    @State private var parsedWorkout: WatchWorkout?

    var body: some View {
        VStack(spacing: 20) {
            if let workout = parsedWorkout {
                // Workout loaded - show start button
                VStack(spacing: 16) {
                    Image(systemName: "dumbbell.fill")
                        .font(.system(size: 36))
                        .foregroundColor(.kinevoViolet)

                    Text(workout.studentName)
                        .font(.headline)
                        .foregroundColor(.kinevoTextPrimary)

                    Text("\(workout.exercises.count) exercícios")
                        .font(.caption)
                        .foregroundColor(.kinevoTextSecondary)

                    NavigationLink(destination: ActiveWorkoutView(workout: workout)) {
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
            } else {
                // No workout - waiting for iPhone
                VStack(spacing: 16) {
                    Image(systemName: "iphone")
                        .font(.system(size: 40))
                        .foregroundColor(.kinevoTextSecondary)

                    Text("Aguardando")
                        .font(.headline)
                        .foregroundColor(.kinevoTextPrimary)

                    Text("Abra o Kinevo no celular para carregar o treino")
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
            parsedWorkout = nil
            return
        }

        parsedWorkout = WatchWorkout.parse(from: dict)
    }
}
