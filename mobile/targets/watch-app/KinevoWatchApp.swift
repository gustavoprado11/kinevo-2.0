import SwiftUI

@main
struct KinevoWatchApp: App {
    @StateObject private var sessionManager = WatchSessionManager()
    @StateObject private var healthKitManager = HealthKitManager()
    @StateObject private var workoutStore = WorkoutExecutionStore()

    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            NavigationStack {
                WorkoutListView()
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
