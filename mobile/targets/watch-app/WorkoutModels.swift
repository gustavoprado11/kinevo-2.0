import Foundation

// MARK: - Workout Models

struct WatchWorkout {
    let workoutId: String
    let studentName: String
    let exercises: [WatchExercise]
    var currentExerciseIndex: Int
    var currentSetIndex: Int
    let isActive: Bool

    /// Parse from Dictionary (received from iPhone via WCSession)
    static func parse(from dict: [String: Any]) -> WatchWorkout? {
        guard
            let workoutId = dict["workoutId"] as? String,
            let studentName = dict["studentName"] as? String,
            let exercisesArray = dict["exercises"] as? [[String: Any]],
            let currentExerciseIndex = dict["currentExerciseIndex"] as? Int,
            let currentSetIndex = dict["currentSetIndex"] as? Int,
            let isActive = dict["isActive"] as? Bool
        else {
            print("[WorkoutModels] Failed to parse WatchWorkout from dict: \(dict)")
            return nil
        }

        let exercises = exercisesArray.compactMap { WatchExercise.parse(from: $0) }

        return WatchWorkout(
            workoutId: workoutId,
            studentName: studentName,
            exercises: exercises,
            currentExerciseIndex: currentExerciseIndex,
            currentSetIndex: currentSetIndex,
            isActive: isActive
        )
    }
}

struct WatchExercise {
    let id: String
    let name: String
    let sets: Int
    let reps: Int
    let weight: Double?
    let restTime: Int
    var completedSets: Int

    /// Parse from Dictionary
    static func parse(from dict: [String: Any]) -> WatchExercise? {
        guard
            let id = dict["id"] as? String,
            let name = dict["name"] as? String,
            let sets = dict["sets"] as? Int,
            let reps = dict["reps"] as? Int,
            let restTime = dict["restTime"] as? Int,
            let completedSets = dict["completedSets"] as? Int
        else {
            print("[WorkoutModels] Failed to parse WatchExercise from dict: \(dict)")
            return nil
        }

        let weight = dict["weight"] as? Double

        return WatchExercise(
            id: id,
            name: name,
            sets: sets,
            reps: reps,
            weight: weight,
            restTime: restTime,
            completedSets: completedSets
        )
    }
}
