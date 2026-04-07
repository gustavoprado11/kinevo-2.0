import SwiftUI

@main
struct KinevoWatchApp: App {
    @StateObject private var sessionManager = WatchSessionManager()
    @StateObject private var healthKitManager = HealthKitManager()
    @StateObject private var workoutStore = WorkoutExecutionStore()

    @Environment(\.scenePhase) private var scenePhase
    @State private var navigationPath = NavigationPath()

    var body: some Scene {
        WindowGroup {
            NavigationStack(path: $navigationPath) {
                WorkoutListView()
                    .navigationDestination(for: WatchWorkoutSnapshot.self) { snapshot in
                        WorkoutExecutionView(workout: snapshot)
                    }
            }
            .environmentObject(sessionManager)
            .environmentObject(healthKitManager)
            .environmentObject(workoutStore)
            .onAppear {
                // Wire SYNC_SUCCESS from WatchSessionManager to WorkoutExecutionStore.
                // Uses a callback to avoid the store directly depending on the session manager.
                sessionManager.onSyncSuccess = { [weak workoutStore] workoutId in
                    workoutStore?.acknowledgeFinish(workoutId: workoutId)
                }

                // Wire WORKOUT_FINISHED_FROM_PHONE — iPhone finished the workout,
                // clear Watch state if the same workout is active.
                sessionManager.onRemoteFinish = { [weak workoutStore] workoutId in
                    workoutStore?.handleRemoteFinish(workoutId: workoutId)
                }

                // Wire START_WORKOUT_FROM_PHONE — iPhone started a workout,
                // find it in the program cache and auto-start on Watch.
                sessionManager.onRemoteStartWorkout = { [weak workoutStore, weak sessionManager] workoutId in
                    workoutStore?.handleRemoteStart(
                        workoutId: workoutId,
                        programSnapshot: sessionManager?.programSnapshot
                    )
                }

                // Wire program updates — when new applicationContext arrives,
                // update exercise order for the active workout (if any).
                sessionManager.onProgramUpdated = { [weak workoutStore] snapshot in
                    workoutStore?.reconcileProgram(snapshot)
                }

                // Wire direct exercise order updates from iPhone (immediate delivery via sendMessage).
                sessionManager.onExerciseOrderUpdate = { [weak workoutStore] workoutId, exerciseIds in
                    guard let store = workoutStore,
                          let current = store.state,
                          current.workoutId == workoutId
                    else { return }
                    store.updateExerciseOrder(from: exerciseIds)
                }
            }
        }
        .onChange(of: workoutStore.remoteStartWorkoutId) { _, newId in
            guard let workoutId = newId else { return }
            workoutStore.remoteStartWorkoutId = nil

            // Find workout snapshot and push onto navigation stack
            if let snapshot = sessionManager.programSnapshot,
               let workout = snapshot.workouts.first(where: { $0.workoutId == workoutId }) {
                navigationPath.append(workout.toWorkoutSnapshot())
                print("[KinevoWatchApp] Programmatic navigation to workout \(workoutId)")
            }
        }
        .onChange(of: workoutStore.state == nil) { _, isNil in
            if isNil && !navigationPath.isEmpty {
                navigationPath.removeLast()
                print("[KinevoWatchApp] Workout state cleared — navigating back to workout list")
            }
        }
        .onChange(of: scenePhase) { _, newPhase in
            if newPhase == .background || newPhase == .inactive {
                workoutStore.persistImmediate()
                print("[KinevoWatchApp] Scene phase → \(newPhase) — flushed workout state")
            }
        }
    }
}
