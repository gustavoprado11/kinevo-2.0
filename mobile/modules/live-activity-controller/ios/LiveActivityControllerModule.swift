import ExpoModulesCore
import ActivityKit
import Foundation

// WorkoutActivityAttributes is defined here for the main app target.
// The widget target has its own identical copy in targets/workout-activity/.
// Both must have the same Codable structure for ActivityKit serialization.
@available(iOS 16.2, *)
struct WorkoutActivityAttributes: ActivityAttributes {
    let workoutName: String
    let workoutId: String
    let totalExercises: Int
    let studentName: String

    struct ContentState: Codable, Hashable {
        let currentExerciseIndex: Int
        let currentExerciseName: String
        let setsCompleted: Int
        let totalSets: Int
        let isResting: Bool
        let restEndTimestamp: Double?
        let totalSetsCompleted: Int
        let totalSetsOverall: Int
        let workoutStartTimestamp: Double
    }
}

public class LiveActivityControllerModule: Module {
    // Hold reference to the current activity
    private var currentActivity: Any? = nil

    public func definition() -> ModuleDefinition {
        Name("LiveActivityController")

        // Check if Live Activities are supported (iOS 16.2+)
        Function("isLiveActivitySupported") { () -> Bool in
            if #available(iOS 16.2, *) {
                return ActivityAuthorizationInfo().areActivitiesEnabled
            }
            return false
        }

        // Start a new Live Activity
        AsyncFunction("startWorkoutActivity") { (params: [String: Any]) -> String in
            guard #available(iOS 16.2, *) else {
                throw NSError(domain: "LiveActivity", code: 1, userInfo: [NSLocalizedDescriptionKey: "Live Activities require iOS 16.2+"])
            }

            guard ActivityAuthorizationInfo().areActivitiesEnabled else {
                throw NSError(domain: "LiveActivity", code: 2, userInfo: [NSLocalizedDescriptionKey: "Live Activities are disabled by the user"])
            }

            // End any existing activity first
            await self.endAllActivities()

            // Parse params
            let workoutName = params["workoutName"] as? String ?? "Treino"
            let workoutId = params["workoutId"] as? String ?? ""
            let totalExercises = params["totalExercises"] as? Int ?? 0
            let studentName = params["studentName"] as? String ?? ""
            let workoutStartTimestamp = params["workoutStartTimestamp"] as? Double ?? Date().timeIntervalSince1970 * 1000

            let attributes = WorkoutActivityAttributes(
                workoutName: workoutName,
                workoutId: workoutId,
                totalExercises: totalExercises,
                studentName: studentName
            )

            let initialState = WorkoutActivityAttributes.ContentState(
                currentExerciseIndex: 0,
                currentExerciseName: params["firstExerciseName"] as? String ?? "Exerc\u{00ED}cio 1",
                setsCompleted: 0,
                totalSets: params["firstExerciseTotalSets"] as? Int ?? 0,
                isResting: false,
                restEndTimestamp: nil,
                totalSetsCompleted: 0,
                totalSetsOverall: params["totalSetsOverall"] as? Int ?? 0,
                workoutStartTimestamp: workoutStartTimestamp
            )

            let content = ActivityContent(state: initialState, staleDate: nil)

            do {
                let activity = try Activity.request(
                    attributes: attributes,
                    content: content,
                    pushType: nil
                )
                self.currentActivity = activity
                return activity.id
            } catch {
                throw NSError(domain: "LiveActivity", code: 3, userInfo: [NSLocalizedDescriptionKey: "Failed to start Live Activity: \(error.localizedDescription)"])
            }
        }

        // Update the current Live Activity
        AsyncFunction("updateWorkoutActivity") { (state: [String: Any]) in
            guard #available(iOS 16.2, *) else { return }

            let contentState = WorkoutActivityAttributes.ContentState(
                currentExerciseIndex: state["currentExerciseIndex"] as? Int ?? 0,
                currentExerciseName: state["currentExerciseName"] as? String ?? "",
                setsCompleted: state["setsCompleted"] as? Int ?? 0,
                totalSets: state["totalSets"] as? Int ?? 0,
                isResting: state["isResting"] as? Bool ?? false,
                restEndTimestamp: state["restEndTimestamp"] as? Double,
                totalSetsCompleted: state["totalSetsCompleted"] as? Int ?? 0,
                totalSetsOverall: state["totalSetsOverall"] as? Int ?? 0,
                workoutStartTimestamp: state["workoutStartTimestamp"] as? Double ?? Date().timeIntervalSince1970 * 1000
            )

            let content = ActivityContent(state: contentState, staleDate: nil)

            if let activity = self.currentActivity as? Activity<WorkoutActivityAttributes> {
                await activity.update(content)
            } else {
                // Try to find active activity if reference was lost
                for activity in Activity<WorkoutActivityAttributes>.activities {
                    await activity.update(content)
                    self.currentActivity = activity
                    break
                }
            }
        }

        // Stop the current Live Activity
        AsyncFunction("stopWorkoutActivity") { () in
            guard #available(iOS 16.2, *) else { return }
            await self.endAllActivities()
        }
    }

    @available(iOS 16.2, *)
    private func endAllActivities() async {
        for activity in Activity<WorkoutActivityAttributes>.activities {
            await activity.end(nil, dismissalPolicy: .immediate)
        }
        self.currentActivity = nil
    }
}
