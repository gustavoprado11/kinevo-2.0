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

        // Item type: "exercise" | "warmup" | "cardio"
        let currentItemType: String?

        // Timer fields (warmup & cardio active timers)
        let timerEndTimestamp: Double?      // Unix ms — target end for native countdown
        let timerTotalSeconds: Int?

        // Warmup-specific
        let warmupType: String?            // "Mobilidade", "Livre", etc.

        // Cardio-specific
        let cardioEquipment: String?       // "Bicicleta", "Esteira", etc.
        let cardioIntensity: String?       // "Zona 2", "RPE 6", etc.
        let cardioMode: String?            // "continuous" | "interval"
        let intervalPhase: String?         // "work" | "rest"
        let intervalCurrentRound: Int?
        let intervalTotalRounds: Int?

        // Unique ID per update — forces SwiftUI to recreate timer Text views
        let updateId: String?
    }
}
