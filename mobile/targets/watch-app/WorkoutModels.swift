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

// MARK: - Snapshot Types (used by WorkoutExecutionView)

/// Extended exercise model with targetReps for the execution UI.
struct WatchExerciseSnapshot: Identifiable {
    let id: String
    let name: String
    let sets: Int
    let reps: Int
    let weight: Double?
    let restTime: Int
    var completedSets: Int
    let targetReps: String?

    static func from(_ exercise: WatchExercise) -> WatchExerciseSnapshot {
        WatchExerciseSnapshot(
            id: exercise.id,
            name: exercise.name,
            sets: exercise.sets,
            reps: exercise.reps,
            weight: exercise.weight,
            restTime: exercise.restTime,
            completedSets: exercise.completedSets,
            targetReps: nil
        )
    }

    static func parse(from dict: [String: Any]) -> WatchExerciseSnapshot? {
        guard let exercise = WatchExercise.parse(from: dict) else { return nil }
        let targetReps = dict["targetReps"] as? String
        return WatchExerciseSnapshot(
            id: exercise.id,
            name: exercise.name,
            sets: exercise.sets,
            reps: exercise.reps,
            weight: exercise.weight,
            restTime: exercise.restTime,
            completedSets: exercise.completedSets,
            targetReps: targetReps
        )
    }
}

/// Extended workout model with timestamps for the execution UI.
struct WatchWorkoutSnapshot {
    let workoutId: String
    let workoutName: String
    let studentName: String
    let exercises: [WatchExerciseSnapshot]
    var currentExerciseIndex: Int
    let isActive: Bool
    let startedAt: String?
    let updatedAt: String?

    static func from(_ workout: WatchWorkout) -> WatchWorkoutSnapshot {
        WatchWorkoutSnapshot(
            workoutId: workout.workoutId,
            workoutName: "",
            studentName: workout.studentName,
            exercises: workout.exercises.map { WatchExerciseSnapshot.from($0) },
            currentExerciseIndex: workout.currentExerciseIndex,
            isActive: workout.isActive,
            startedAt: nil,
            updatedAt: nil
        )
    }

    static func parse(from dict: [String: Any]) -> WatchWorkoutSnapshot? {
        guard
            let workoutId = dict["workoutId"] as? String,
            let exercisesArray = dict["exercises"] as? [[String: Any]],
            let currentExerciseIndex = dict["currentExerciseIndex"] as? Int,
            let isActive = dict["isActive"] as? Bool
        else {
            print("[WorkoutModels] Failed to parse WatchWorkoutSnapshot from dict: \(dict)")
            return nil
        }

        let exercises = exercisesArray.compactMap { WatchExerciseSnapshot.parse(from: $0) }
        let studentName = dict["studentName"] as? String ?? ""
        let workoutName = dict["workoutName"] as? String ?? ""
        let startedAt = dict["startedAt"] as? String
        let updatedAt = dict["updatedAt"] as? String

        return WatchWorkoutSnapshot(
            workoutId: workoutId,
            workoutName: workoutName,
            studentName: studentName,
            exercises: exercises,
            currentExerciseIndex: currentExerciseIndex,
            isActive: isActive,
            startedAt: startedAt,
            updatedAt: updatedAt
        )
    }
}
