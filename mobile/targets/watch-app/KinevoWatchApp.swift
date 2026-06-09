import SwiftUI

@main
struct KinevoWatchApp: App {
    @StateObject private var sessionManager = WatchSessionManager()
    @StateObject private var healthKitManager = HealthKitManager()
    @StateObject private var workoutStore = WorkoutExecutionStore()

    @Environment(\.scenePhase) private var scenePhase
    @State private var navigationPath = NavigationPath()
    @State private var didAutoResumeNav = false

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
                sessionManager.onRemoteFinish = { [weak workoutStore, weak healthKitManager] workoutId in
                    let cleared = workoutStore?.handleRemoteFinish(workoutId: workoutId) ?? false
                    // End & save the mirrored HealthKit session so the workout is
                    // recorded in Apple Activity. No-op if the Watch wasn't running one.
                    if cleared {
                        healthKitManager?.endWorkout()
                    }
                }

                // Wire WORKOUT_DISCARDED_FROM_PHONE — iPhone abandoned the workout,
                // discard the mirrored HK session WITHOUT saving (no Activity credit).
                sessionManager.onRemoteDiscard = { [weak workoutStore, weak healthKitManager] workoutId in
                    let cleared = workoutStore?.handleRemoteDiscard(workoutId: workoutId) ?? false
                    if cleared {
                        healthKitManager?.discardWorkout()
                    }
                }

                // Wire START_WORKOUT_FROM_PHONE — iPhone started a workout,
                // find it in the program cache and auto-start on Watch.
                sessionManager.onRemoteStartWorkout = { [weak workoutStore, weak sessionManager, weak healthKitManager] workoutId in
                    let started = workoutStore?.handleRemoteStart(
                        workoutId: workoutId,
                        programSnapshot: sessionManager?.programSnapshot
                    ) ?? false
                    // When the iPhone starts the workout and the Watch app is active,
                    // mirror it with a live HealthKit workout session so the Watch shows
                    // real-time time/calories/HR and credits the Apple Activity rings —
                    // just like starting "Iniciar treino" on the Watch itself.
                    if started {
                        healthKitManager?.startWorkout()
                    }
                }

                // Wire program updates — when new applicationContext arrives,
                // update exercise order for the active workout (if any).
                sessionManager.onProgramUpdated = { [weak workoutStore] snapshot in
                    workoutStore?.reconcileProgram(snapshot)
                }

                // Wire SESSION_SYNC — iPhone tells the Watch the canonical session id
                // so FINISH/health payloads can carry it back (no mapping heuristic).
                sessionManager.onSessionSync = { [weak workoutStore] workoutId, sessionId in
                    workoutStore?.setSessionId(workoutId: workoutId, sessionId: sessionId)
                }

                // Wire direct exercise order updates from iPhone (immediate delivery via sendMessage).
                sessionManager.onExerciseOrderUpdate = { [weak workoutStore] workoutId, exerciseIds in
                    guard let store = workoutStore,
                          let current = store.state,
                          current.workoutId == workoutId
                    else { return }
                    store.updateExerciseOrder(from: exerciseIds)
                }

                // Wire SET_COMPLETE_FROM_PHONE — mirror set completions logged on the
                // iPhone so the Watch advances in step instead of staying on set 1.
                sessionManager.onRemoteSetComplete = { [weak workoutStore] workoutId, exerciseId, setIndex, reps, weight in
                    workoutStore?.applyRemoteSetComplete(workoutId: workoutId, exerciseId: exerciseId, setIndex: setIndex, reps: reps, weight: weight)
                }

                resumeNavigationIfNeeded()
            }
            // When the program snapshot arrives (cached applicationContext read on
            // launch), restore navigation into an active workout — the NavigationPath
            // @State is reset whenever watchOS relaunches the app, which was kicking
            // the user out of the workout screen mid-session.
            .onReceive(sessionManager.$programSnapshot) { _ in
                resumeNavigationIfNeeded()
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

    /// Re-enter the active workout's execution screen after a cold launch/relaunch.
    /// watchOS resets the NavigationPath @State when it relaunches the app, which
    /// dropped the user back to the list mid-workout. Runs once per launch; manual
    /// back-navigation afterwards is preserved (didAutoResumeNav stays true).
    private func resumeNavigationIfNeeded() {
        guard !didAutoResumeNav, navigationPath.isEmpty else { return }
        guard let active = workoutStore.state, active.hasStarted else { return }
        didAutoResumeNav = true
        // Rebuild from the persisted state — no dependency on the iPhone re-syncing.
        navigationPath.append(active.toResumeSnapshot())
        print("[KinevoWatchApp] Restored navigation into active workout \(active.workoutId)")
    }
}
