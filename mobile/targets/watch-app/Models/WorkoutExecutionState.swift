import Foundation

/// Tracks whether a finished workout has been acknowledged by the iPhone.
enum FinishState: String, Codable {
    case none           // Workout in progress (not finished)
    case pending        // FINISH_WORKOUT sent, waiting for SYNC_SUCCESS
    case acknowledged   // iPhone confirmed save via SYNC_SUCCESS
}

/// Persistent model for in-progress workout execution on the Watch.
/// Serialized to JSON after every meaningful mutation.
struct WorkoutExecutionState: Codable, Equatable {
    let workoutId: String
    let workoutName: String
    var startedAt: Date
    var hasStarted: Bool
    var exerciseIndex: Int
    var exercises: [ExerciseState]
    var lastPersistedAt: Date
    var finishState: FinishState

    /// Custom decoding to support older persisted state that lacks finishState.
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        workoutId = try container.decode(String.self, forKey: .workoutId)
        workoutName = try container.decode(String.self, forKey: .workoutName)
        startedAt = try container.decode(Date.self, forKey: .startedAt)
        hasStarted = try container.decode(Bool.self, forKey: .hasStarted)
        exerciseIndex = try container.decode(Int.self, forKey: .exerciseIndex)
        exercises = try container.decode([ExerciseState].self, forKey: .exercises)
        lastPersistedAt = try container.decode(Date.self, forKey: .lastPersistedAt)
        finishState = try container.decodeIfPresent(FinishState.self, forKey: .finishState) ?? .none
    }

    init(
        workoutId: String,
        workoutName: String,
        startedAt: Date,
        hasStarted: Bool,
        exerciseIndex: Int,
        exercises: [ExerciseState],
        lastPersistedAt: Date,
        finishState: FinishState = .none
    ) {
        self.workoutId = workoutId
        self.workoutName = workoutName
        self.startedAt = startedAt
        self.hasStarted = hasStarted
        self.exerciseIndex = exerciseIndex
        self.exercises = exercises
        self.lastPersistedAt = lastPersistedAt
        self.finishState = finishState
    }

    struct ExerciseState: Codable, Equatable, Identifiable {
        let id: String
        let name: String
        let restTime: Int
        let targetReps: String?
        let lastWeight: Double?
        let lastReps: Int?
        var sets: [SetState]
        var currentSetIndex: Int

        struct SetState: Codable, Equatable {
            var reps: Int
            var weight: Double
            var isCompleted: Bool
        }

        /// Custom decoding to support persisted state that lacks lastWeight/lastReps.
        init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            id = try container.decode(String.self, forKey: .id)
            name = try container.decode(String.self, forKey: .name)
            restTime = try container.decode(Int.self, forKey: .restTime)
            targetReps = try container.decodeIfPresent(String.self, forKey: .targetReps)
            lastWeight = try container.decodeIfPresent(Double.self, forKey: .lastWeight)
            lastReps = try container.decodeIfPresent(Int.self, forKey: .lastReps)
            sets = try container.decode([SetState].self, forKey: .sets)
            currentSetIndex = try container.decode(Int.self, forKey: .currentSetIndex)
        }

        init(
            id: String,
            name: String,
            restTime: Int,
            targetReps: String?,
            lastWeight: Double?,
            lastReps: Int?,
            sets: [SetState],
            currentSetIndex: Int
        ) {
            self.id = id
            self.name = name
            self.restTime = restTime
            self.targetReps = targetReps
            self.lastWeight = lastWeight
            self.lastReps = lastReps
            self.sets = sets
            self.currentSetIndex = currentSetIndex
        }
    }

    /// Create execution state from an iPhone-provided snapshot.
    static func from(snapshot: WatchWorkoutSnapshot) -> WorkoutExecutionState {
        let exercises = snapshot.exercises.map { ex in
            let initialWeight = ex.weight ?? 0
            let sets = (0..<ex.sets).map { index in
                ExerciseState.SetState(
                    reps: ex.reps,
                    weight: initialWeight,
                    isCompleted: index < ex.completedSets
                )
            }
            let firstIncomplete = sets.firstIndex(where: { !$0.isCompleted }) ?? max(sets.count - 1, 0)
            return ExerciseState(
                id: ex.id,
                name: ex.name,
                restTime: ex.restTime,
                targetReps: ex.targetReps,
                lastWeight: ex.lastWeight,
                lastReps: ex.lastReps,
                sets: sets,
                currentSetIndex: firstIncomplete
            )
        }

        let startDate = WatchDateParser.parseISO8601(snapshot.startedAt)
            ?? WatchDateParser.parseISO8601(snapshot.updatedAt)
            ?? Date()

        let maxIndex = max(0, exercises.count - 1)
        let startIndex = min(max(snapshot.currentExerciseIndex, 0), maxIndex)

        return WorkoutExecutionState(
            workoutId: snapshot.workoutId,
            workoutName: snapshot.workoutName,
            startedAt: startDate,
            hasStarted: snapshot.isActive,
            exerciseIndex: startIndex,
            exercises: exercises,
            lastPersistedAt: Date()
        )
    }

    /// Build the exercises payload for sendFinishWorkout.
    func buildFinishPayload() -> [[String: Any]] {
        exercises.map { ex in
            let setsPayload: [[String: Any]] = ex.sets.enumerated().map { idx, set in
                [
                    "setIndex": idx,
                    "reps": set.reps,
                    "weight": set.weight,
                    "completed": set.isCompleted,
                ]
            }
            return [
                "id": ex.id,
                "sets": setsPayload,
            ]
        }
    }
}

// MARK: - ISO 8601 Date Parser (shared utility)

enum WatchDateParser {
    static func parseISO8601(_ raw: String?) -> Date? {
        guard let raw, !raw.isEmpty else { return nil }

        let formatterWithFractions = ISO8601DateFormatter()
        formatterWithFractions.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let parsed = formatterWithFractions.date(from: raw) {
            return parsed
        }

        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: raw)
    }
}
