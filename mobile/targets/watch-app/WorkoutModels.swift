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
struct WatchExerciseSnapshot: Identifiable, Hashable {
    let id: String
    let name: String
    let sets: Int
    let reps: Int
    let weight: Double?
    let restTime: Int
    var completedSets: Int
    let targetReps: String?
    let lastWeight: Double?
    let lastReps: Int?

    static func from(_ exercise: WatchExercise) -> WatchExerciseSnapshot {
        WatchExerciseSnapshot(
            id: exercise.id,
            name: exercise.name,
            sets: exercise.sets,
            reps: exercise.reps,
            weight: exercise.weight,
            restTime: exercise.restTime,
            completedSets: exercise.completedSets,
            targetReps: nil,
            lastWeight: nil,
            lastReps: nil
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
            targetReps: targetReps,
            lastWeight: dict["lastWeight"] as? Double,
            lastReps: (dict["lastReps"] as? NSNumber)?.intValue
        )
    }
}

/// Extended workout model with timestamps for the execution UI.
struct WatchWorkoutSnapshot: Hashable {
    let workoutId: String
    let workoutName: String
    let studentName: String
    let exercises: [WatchExerciseSnapshot]
    let cardioItems: [WatchCardioItem]
    var currentExerciseIndex: Int
    let isActive: Bool
    let startedAt: String?
    let updatedAt: String?

    func hash(into hasher: inout Hasher) {
        hasher.combine(workoutId)
    }

    static func == (lhs: WatchWorkoutSnapshot, rhs: WatchWorkoutSnapshot) -> Bool {
        lhs.workoutId == rhs.workoutId
    }

    static func from(_ workout: WatchWorkout) -> WatchWorkoutSnapshot {
        WatchWorkoutSnapshot(
            workoutId: workout.workoutId,
            workoutName: "",
            studentName: workout.studentName,
            exercises: workout.exercises.map { WatchExerciseSnapshot.from($0) },
            cardioItems: [],
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
        let cardioArray = dict["cardioItems"] as? [[String: Any]] ?? []
        let cardioItems = cardioArray.compactMap { WatchCardioItem.parse(from: $0) }
        let studentName = dict["studentName"] as? String ?? ""
        let workoutName = dict["workoutName"] as? String ?? ""
        let startedAt = dict["startedAt"] as? String
        let updatedAt = dict["updatedAt"] as? String

        return WatchWorkoutSnapshot(
            workoutId: workoutId,
            workoutName: workoutName,
            studentName: studentName,
            exercises: exercises,
            cardioItems: cardioItems,
            currentExerciseIndex: currentExerciseIndex,
            isActive: isActive,
            startedAt: startedAt,
            updatedAt: updatedAt
        )
    }
}

// MARK: - Program Snapshot (schemaVersion 2)

/// Full program received from iPhone — contains multiple workouts.
struct WatchProgramSnapshot {
    let programId: String
    let programName: String
    let currentWeek: Int
    let totalWeeks: Int
    let scheduleMode: ScheduleMode
    let workouts: [WatchProgramWorkoutSummary]

    enum ScheduleMode: String {
        case scheduled
        case flexible
    }

    static func parse(from dict: [String: Any]) -> WatchProgramSnapshot? {
        guard let programDict = dict["program"] as? [String: Any] else {
            // hasProgram was false or program key missing
            return nil
        }

        guard
            let programId = programDict["programId"] as? String,
            let programName = programDict["programName"] as? String,
            let workoutsArray = programDict["workouts"] as? [[String: Any]]
        else {
            print("[WorkoutModels] Failed to parse WatchProgramSnapshot from dict")
            return nil
        }

        let currentWeek = programDict["currentWeek"] as? Int ?? 1
        let totalWeeks = programDict["totalWeeks"] as? Int ?? 0
        let scheduleModeRaw = programDict["scheduleMode"] as? String ?? "flexible"
        let scheduleMode = ScheduleMode(rawValue: scheduleModeRaw) ?? .flexible

        let workouts = workoutsArray.compactMap { WatchProgramWorkoutSummary.parse(from: $0) }

        return WatchProgramSnapshot(
            programId: programId,
            programName: programName,
            currentWeek: currentWeek,
            totalWeeks: totalWeeks,
            scheduleMode: scheduleMode,
            workouts: workouts
        )
    }

    /// Create a synthetic program from a legacy v1 single-workout context.
    static func fromLegacy(_ dict: [String: Any]) -> WatchProgramSnapshot? {
        guard let hasWorkout = dict["hasWorkout"] as? Bool, hasWorkout,
              let workoutDict = dict["workout"] as? [String: Any],
              let snapshot = WatchWorkoutSnapshot.parse(from: workoutDict)
        else {
            return nil
        }

        let exercises = snapshot.exercises.map { ex in
            WatchProgramExerciseSummary(
                id: ex.id,
                name: ex.name,
                muscleGroup: nil,
                sets: ex.sets,
                reps: ex.reps,
                weight: ex.weight,
                restTime: ex.restTime,
                targetReps: ex.targetReps,
                lastWeight: nil,
                lastReps: nil
            )
        }

        let workout = WatchProgramWorkoutSummary(
            workoutId: snapshot.workoutId,
            workoutName: snapshot.workoutName,
            orderIndex: 0,
            scheduledDays: [],
            isCompletedToday: false,
            lastCompletedAt: nil,
            exercises: exercises,
            cardioItems: []
        )

        return WatchProgramSnapshot(
            programId: "legacy",
            programName: "",
            currentWeek: 1,
            totalWeeks: 0,
            scheduleMode: .flexible,
            workouts: [workout]
        )
    }
}

/// Exercise info within a program workout summary.
struct WatchProgramExerciseSummary {
    let id: String
    let name: String
    let muscleGroup: String?
    let sets: Int
    let reps: Int
    let weight: Double?
    let restTime: Int
    let targetReps: String?
    let lastWeight: Double?
    let lastReps: Int?

    static func parse(from dict: [String: Any]) -> WatchProgramExerciseSummary? {
        guard
            let id = dict["id"] as? String,
            let name = dict["name"] as? String
        else {
            return nil
        }

        return WatchProgramExerciseSummary(
            id: id,
            name: name,
            muscleGroup: dict["muscleGroup"] as? String,
            sets: dict["sets"] as? Int ?? 3,
            reps: dict["reps"] as? Int ?? 0,
            weight: dict["weight"] as? Double,
            restTime: dict["restTime"] as? Int ?? 60,
            targetReps: dict["targetReps"] as? String,
            lastWeight: dict["lastWeight"] as? Double,
            lastReps: (dict["lastReps"] as? NSNumber)?.intValue
        )
    }
}

/// Single workout within a program snapshot.
struct WatchProgramWorkoutSummary: Identifiable {
    var id: String { workoutId }

    let workoutId: String
    let workoutName: String
    let orderIndex: Int
    let scheduledDays: [Int]
    let isCompletedToday: Bool
    let lastCompletedAt: Date?
    let exercises: [WatchProgramExerciseSummary]
    let cardioItems: [WatchCardioItem]

    /// Whether this workout is scheduled for today.
    var isScheduledToday: Bool {
        guard !scheduledDays.isEmpty else { return false }
        let todayDow = Calendar.current.component(.weekday, from: Date()) - 1 // 1=Sun → 0
        return scheduledDays.contains(todayDow)
    }

    static func parse(from dict: [String: Any]) -> WatchProgramWorkoutSummary? {
        guard
            let workoutId = dict["workoutId"] as? String,
            let workoutName = dict["workoutName"] as? String
        else {
            return nil
        }

        let exercisesArray = dict["exercises"] as? [[String: Any]] ?? []
        let exercises = exercisesArray.compactMap { WatchProgramExerciseSummary.parse(from: $0) }
        let cardioArray = dict["cardioItems"] as? [[String: Any]] ?? []
        let cardioItems = cardioArray.compactMap { WatchCardioItem.parse(from: $0) }

        let scheduledDays = (dict["scheduledDays"] as? [Any])?.compactMap { ($0 as? NSNumber)?.intValue } ?? []
        let isCompletedToday = dict["isCompletedToday"] as? Bool ?? false
        let lastCompletedAtStr = dict["lastCompletedAt"] as? String
        let lastCompletedAt = lastCompletedAtStr.flatMap { WatchDateParser.parseISO8601($0) }

        return WatchProgramWorkoutSummary(
            workoutId: workoutId,
            workoutName: workoutName,
            orderIndex: dict["orderIndex"] as? Int ?? 0,
            scheduledDays: scheduledDays,
            isCompletedToday: isCompletedToday,
            lastCompletedAt: lastCompletedAt,
            exercises: exercises,
            cardioItems: cardioItems
        )
    }

    /// Convert to WatchWorkoutSnapshot for WorkoutExecutionView.
    /// Each execution starts fresh (completedSets = 0).
    func toWorkoutSnapshot() -> WatchWorkoutSnapshot {
        let snapshotExercises = exercises.map { ex in
            WatchExerciseSnapshot(
                id: ex.id,
                name: ex.name,
                sets: ex.sets,
                reps: ex.reps,
                weight: ex.weight,
                restTime: ex.restTime,
                completedSets: 0,
                targetReps: ex.targetReps,
                lastWeight: ex.lastWeight,
                lastReps: ex.lastReps
            )
        }

        return WatchWorkoutSnapshot(
            workoutId: workoutId,
            workoutName: workoutName,
            studentName: "",
            exercises: snapshotExercises,
            cardioItems: cardioItems,
            currentExerciseIndex: 0,
            isActive: false,
            startedAt: nil,
            updatedAt: nil
        )
    }
}

// MARK: - Cardio Item (Watch)

struct WatchCardioItem: Codable, Identifiable, Hashable {
    let id: String
    let orderIndex: Int
    let config: CardioConfig

    struct CardioConfig: Codable, Hashable {
        let mode: String        // "continuous" | "interval"
        let equipment: String?
        let equipmentLabel: String?
        // Continuous
        let objective: String?  // "time" | "distance"
        let durationMinutes: Int?
        let distanceKm: Double?
        let intensity: String?
        // Interval
        let workSeconds: Int?
        let restSeconds: Int?
        let rounds: Int?
    }

    var isInterval: Bool { config.mode == "interval" }
    var isContinuous: Bool { config.mode == "continuous" }

    var equipmentIcon: String {
        switch config.equipment {
        case "treadmill": return "figure.run"
        case "bike", "outdoor_bike": return "bicycle"
        case "elliptical": return "ellipsis.circle"
        case "rower": return "oar.2.crossed"
        case "stairmaster": return "stairs"
        case "jump_rope": return "bolt"
        case "outdoor_run": return "figure.run"
        case "swimming": return "figure.pool.swim"
        default: return "heart.circle"
        }
    }

    var summaryText: String {
        if isInterval {
            let w = config.workSeconds ?? 30
            let r = config.restSeconds ?? 15
            let rounds = config.rounds ?? 8
            return "\(rounds)x (\(w)s/\(r)s)"
        } else {
            if config.objective == "distance", let km = config.distanceKm {
                return String(format: "%.1f km", km)
            } else if let min = config.durationMinutes {
                return "\(min) min"
            }
            return config.equipmentLabel ?? "Aeróbio"
        }
    }

    var totalDurationSeconds: Int {
        if isInterval {
            let w = config.workSeconds ?? 30
            let r = config.restSeconds ?? 15
            let rounds = config.rounds ?? 8
            return (w * rounds) + (r * max(rounds - 1, 0))
        } else {
            return (config.durationMinutes ?? 20) * 60
        }
    }

    static func parse(from dict: [String: Any]) -> WatchCardioItem? {
        guard let id = dict["id"] as? String else { return nil }

        let configDict = dict["config"] as? [String: Any] ?? [:]
        let config = CardioConfig(
            mode: configDict["mode"] as? String ?? "continuous",
            equipment: configDict["equipment"] as? String,
            equipmentLabel: configDict["equipmentLabel"] as? String,
            objective: configDict["objective"] as? String,
            durationMinutes: configDict["durationMinutes"] as? Int,
            distanceKm: configDict["distanceKm"] as? Double,
            intensity: configDict["intensity"] as? String,
            workSeconds: configDict["workSeconds"] as? Int,
            restSeconds: configDict["restSeconds"] as? Int,
            rounds: configDict["rounds"] as? Int
        )

        return WatchCardioItem(
            id: id,
            orderIndex: dict["orderIndex"] as? Int ?? 999,
            config: config
        )
    }
}
