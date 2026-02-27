import SwiftUI

@main
struct KinevoWatchApp: App {
    @StateObject private var sessionManager = WatchSessionManager()
    @StateObject private var healthKitManager = HealthKitManager()

    var body: some Scene {
        WindowGroup {
            NavigationStack {
                WorkoutListView()
            }
            .environmentObject(sessionManager)
            .environmentObject(healthKitManager)
        }
    }
}
