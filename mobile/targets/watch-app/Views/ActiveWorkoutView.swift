import SwiftUI

struct ActiveWorkoutView: View {
    @EnvironmentObject var sessionManager: WatchSessionManager
    @EnvironmentObject var healthKitManager: HealthKitManager
    let workout: WatchWorkout

    @State private var currentPageIndex: Int = 0

    var body: some View {
        TabView(selection: $currentPageIndex) {
            ForEach(Array(workout.exercises.enumerated()), id: \.offset) { index, exercise in
                SetLoggerView(
                    exercise: exercise,
                    exerciseIndex: index,
                    totalExercises: workout.exercises.count
                )
                .tag(index)
            }
        }
        .tabViewStyle(.page)
        .background(Color.kinevoBg)
        .navigationBarTitleDisplayMode(.inline)
        .navigationTitle("Exercício \(currentPageIndex + 1)/\(workout.exercises.count)")
        .onAppear {
            currentPageIndex = workout.currentExerciseIndex
            healthKitManager.startWorkout()
        }
        .onDisappear {
            healthKitManager.endWorkout()
        }
    }
}
