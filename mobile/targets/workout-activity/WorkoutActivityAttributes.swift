import ActivityKit
import Foundation

struct WorkoutActivityAttributes: ActivityAttributes {
    // Static data — set once when activity starts
    let workoutName: String
    let workoutId: String
    let totalExercises: Int
    let studentName: String

    // Dynamic data — updated throughout the workout
    struct ContentState: Codable, Hashable {
        let currentExerciseIndex: Int
        let currentExerciseName: String
        let setsCompleted: Int
        let totalSets: Int
        let isResting: Bool
        let restEndTimestamp: Double?      // Unix ms — converted to Date in views
        let totalSetsCompleted: Int
        let totalSetsOverall: Int
        let workoutStartTimestamp: Double   // Unix ms — for elapsed timer
    }
}
