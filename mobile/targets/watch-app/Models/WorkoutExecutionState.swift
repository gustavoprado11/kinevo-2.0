import Foundation

/// Tracks whether a finished workout has been acknowledged by the iPhone.
enum FinishState: String, Codable {
    case none           // Workout in progress (not finished)
    case pending        // FINISH_WORKOUT sent, waiting for SYNC_SUCCESS
    case acknowledged   // iPhone confirmed save via SYNC_SUCCESS
}

/// Execution state for a cardio item.
struct CardioExecutionState: Codable, Equatable {
    let itemId: String
    var isCompleted: Bool = false
    var elapsedSeconds: Int = 0
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
    var cardioStates: [CardioExecutionState]
    /// Canonical workout_session_id provided by the iPhone via SESSION_SYNC.
    /// Echoed back in FINISH/health payloads so the phone maps to the exact
    /// session instead of guessing by assigned_workout_id + time window.
    var sessionId: String?
    /// True when the workout was started from the iPhone (the Watch is mirroring it
    /// for activity tracking). Drives opening on the metrics page instead of the cards.
    var startedRemotely: Bool = false
    /// Cardio item configs, persisted so a workout with cardio can be fully resumed
    /// after the app is relaunched (without depending on the iPhone re-syncing).
    var cardioItems: [WatchCardioItem] = []

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
        cardioStates = try container.decodeIfPresent([CardioExecutionState].self, forKey: .cardioStates) ?? []
        sessionId = try container.decodeIfPresent(String.self, forKey: .sessionId)
        startedRemotely = try container.decodeIfPresent(Bool.self, forKey: .startedRemotely) ?? false
        cardioItems = try container.decodeIfPresent([WatchCardioItem].self, forKey: .cardioItems) ?? []
    }

    init(
        workoutId: String,
        workoutName: String,
        startedAt: Date,
        hasStarted: Bool,
        exerciseIndex: Int,
        exercises: [ExerciseState],
        lastPersistedAt: Date,
        finishState: FinishState = .none,
        cardioStates: [CardioExecutionState] = [],
        sessionId: String? = nil,
        startedRemotely: Bool = false,
        cardioItems: [WatchCardioItem] = []
    ) {
        self.workoutId = workoutId
        self.workoutName = workoutName
        self.startedAt = startedAt
        self.hasStarted = hasStarted
        self.exerciseIndex = exerciseIndex
        self.exercises = exercises
        self.lastPersistedAt = lastPersistedAt
        self.finishState = finishState
        self.cardioStates = cardioStates
        self.sessionId = sessionId
        self.startedRemotely = startedRemotely
        self.cardioItems = cardioItems
    }

    struct ExerciseState: Codable, Equatable, Identifiable {
        let id: String
        let name: String
        let restTime: Int
        let targetReps: String?
        let lastWeight: Double?
        let lastReps: Int?
        let supersetIndex: Int?   // 0-based position within superset group
        let supersetTotal: Int?   // total exercises in superset group
        let methodKey: String?    // advanced method (pyramid_down, drop_set…) or nil
        let methodLabel: String?  // pt-BR method chip label, nil when standard/none
        let notes: String?        // trainer note for this exercise (technique cues)
        var sets: [SetState]
        var currentSetIndex: Int

        struct SetState: Codable, Equatable {
            var reps: Int
            var weight: Double
            var isCompleted: Bool
            // Advanced-method fields. Defaulted so older persisted state (which
            // lacks them) decodes cleanly into a plain "normal" set.
            var setType: String = "normal"
            var setTypeLabel: String = ""       // pt-BR badge ("Drop", "Top"…), empty = none
            var repsTarget: String? = nil       // e.g. "8-12", "AMRAP", "8+4+2"
            var restSeconds: Int = 0            // rest AFTER this set; 0 → use exercise restTime
            var weightTargetKg: Double? = nil   // suggested load hint
            var roundNumber: Int? = nil         // 1-based round for drop-set/cluster
            var notes: String? = nil            // trainer note for this set

            init(
                reps: Int,
                weight: Double,
                isCompleted: Bool,
                setType: String = "normal",
                setTypeLabel: String = "",
                repsTarget: String? = nil,
                restSeconds: Int = 0,
                weightTargetKg: Double? = nil,
                roundNumber: Int? = nil,
                notes: String? = nil
            ) {
                self.reps = reps
                self.weight = weight
                self.isCompleted = isCompleted
                self.setType = setType
                self.setTypeLabel = setTypeLabel
                self.repsTarget = repsTarget
                self.restSeconds = restSeconds
                self.weightTargetKg = weightTargetKg
                self.roundNumber = roundNumber
                self.notes = notes
            }

            init(from decoder: Decoder) throws {
                let c = try decoder.container(keyedBy: CodingKeys.self)
                reps = try c.decode(Int.self, forKey: .reps)
                weight = try c.decode(Double.self, forKey: .weight)
                isCompleted = try c.decode(Bool.self, forKey: .isCompleted)
                setType = try c.decodeIfPresent(String.self, forKey: .setType) ?? "normal"
                setTypeLabel = try c.decodeIfPresent(String.self, forKey: .setTypeLabel) ?? ""
                repsTarget = try c.decodeIfPresent(String.self, forKey: .repsTarget)
                restSeconds = try c.decodeIfPresent(Int.self, forKey: .restSeconds) ?? 0
                weightTargetKg = try c.decodeIfPresent(Double.self, forKey: .weightTargetKg)
                roundNumber = try c.decodeIfPresent(Int.self, forKey: .roundNumber)
                notes = try c.decodeIfPresent(String.self, forKey: .notes)
            }
        }

        /// Custom decoding to support persisted state that lacks lastWeight/lastReps/superset fields.
        init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            id = try container.decode(String.self, forKey: .id)
            name = try container.decode(String.self, forKey: .name)
            restTime = try container.decode(Int.self, forKey: .restTime)
            targetReps = try container.decodeIfPresent(String.self, forKey: .targetReps)
            lastWeight = try container.decodeIfPresent(Double.self, forKey: .lastWeight)
            lastReps = try container.decodeIfPresent(Int.self, forKey: .lastReps)
            supersetIndex = try container.decodeIfPresent(Int.self, forKey: .supersetIndex)
            supersetTotal = try container.decodeIfPresent(Int.self, forKey: .supersetTotal)
            methodKey = try container.decodeIfPresent(String.self, forKey: .methodKey)
            methodLabel = try container.decodeIfPresent(String.self, forKey: .methodLabel)
            notes = try container.decodeIfPresent(String.self, forKey: .notes)
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
            supersetIndex: Int? = nil,
            supersetTotal: Int? = nil,
            methodKey: String? = nil,
            methodLabel: String? = nil,
            notes: String? = nil,
            sets: [SetState],
            currentSetIndex: Int
        ) {
            self.id = id
            self.name = name
            self.restTime = restTime
            self.targetReps = targetReps
            self.lastWeight = lastWeight
            self.lastReps = lastReps
            self.supersetIndex = supersetIndex
            self.supersetTotal = supersetTotal
            self.methodKey = methodKey
            self.methodLabel = methodLabel
            self.notes = notes
            self.sets = sets
            self.currentSetIndex = currentSetIndex
        }
    }

    /// Build one ExerciseState from a snapshot exercise — per-set aware (advanced
    /// methods) with a uniform-sets fallback. Shared by `from(snapshot:)` and the
    /// program reconcile path (so exercises added mid-workout get correct state).
    static func makeExercise(from ex: WatchExerciseSnapshot) -> ExerciseState {
        let initialWeight = ex.weight ?? 0
        let sets: [ExerciseState.SetState]

        if !ex.setDetails.isEmpty {
            // Advanced method — one set per prescribed detail, each with its own
            // reps target, rest, type and suggested load.
            sets = ex.setDetails.enumerated().map { index, detail in
                let startReps = WorkoutExecutionState.startingReps(
                    from: detail.repsTarget,
                    fallback: ex.lastReps ?? (ex.reps > 0 ? ex.reps : 10)
                )
                let startWeight = detail.weightTargetKg ?? ex.lastWeight ?? initialWeight
                return ExerciseState.SetState(
                    reps: startReps,
                    weight: startWeight,
                    isCompleted: index < ex.completedSets,
                    setType: detail.setType,
                    setTypeLabel: detail.setTypeLabel,
                    repsTarget: detail.repsTarget.isEmpty ? nil : detail.repsTarget,
                    restSeconds: detail.restSeconds,
                    weightTargetKg: detail.weightTargetKg,
                    roundNumber: detail.roundNumber,
                    notes: detail.notes
                )
            }
        } else {
            // Legacy / standard — N uniform sets.
            sets = (0..<ex.sets).map { index in
                ExerciseState.SetState(
                    reps: ex.reps,
                    weight: initialWeight,
                    isCompleted: index < ex.completedSets,
                    repsTarget: ex.targetReps,
                    restSeconds: ex.restTime
                )
            }
        }

        let firstIncomplete = sets.firstIndex(where: { !$0.isCompleted }) ?? max(sets.count - 1, 0)
        return ExerciseState(
            id: ex.id,
            name: ex.name,
            restTime: ex.restTime,
            targetReps: ex.targetReps,
            lastWeight: ex.lastWeight,
            lastReps: ex.lastReps,
            supersetIndex: ex.supersetIndex,
            supersetTotal: ex.supersetTotal,
            methodKey: ex.methodKey,
            methodLabel: ex.methodLabel,
            notes: ex.notes,
            sets: sets,
            currentSetIndex: firstIncomplete
        )
    }

    /// Create execution state from an iPhone-provided snapshot.
    static func from(snapshot: WatchWorkoutSnapshot) -> WorkoutExecutionState {
        let exercises = snapshot.exercises.map { makeExercise(from: $0) }

        let startDate = WatchDateParser.parseISO8601(snapshot.startedAt)
            ?? WatchDateParser.parseISO8601(snapshot.updatedAt)
            ?? Date()

        let cardioStates = snapshot.cardioItems.map { item in
            CardioExecutionState(itemId: item.id)
        }

        let maxIndex = max(0, exercises.count - 1)
        let startIndex = min(max(snapshot.currentExerciseIndex, 0), maxIndex)

        return WorkoutExecutionState(
            workoutId: snapshot.workoutId,
            workoutName: snapshot.workoutName,
            startedAt: startDate,
            hasStarted: snapshot.isActive,
            exerciseIndex: startIndex,
            exercises: exercises,
            lastPersistedAt: Date(),
            cardioStates: cardioStates,
            cardioItems: snapshot.cardioItems
        )
    }

    /// Rebuild a navigable snapshot from the persisted state, so the execution screen
    /// can be re-entered after an app relaunch WITHOUT depending on the iPhone re-syncing
    /// the program. Includes cardio (now persisted); workout-day briefing notes are not
    /// restored (pre-workout only).
    func toResumeSnapshot() -> WatchWorkoutSnapshot {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        let snapshotExercises = exercises.map { ex -> WatchExerciseSnapshot in
            WatchExerciseSnapshot(
                id: ex.id,
                name: ex.name,
                sets: ex.sets.count,
                reps: ex.sets.first?.reps ?? 0,
                weight: ex.sets.first?.weight,
                restTime: ex.restTime,
                completedSets: ex.sets.filter(\.isCompleted).count,
                targetReps: ex.targetReps,
                lastWeight: ex.lastWeight,
                lastReps: ex.lastReps,
                supersetIndex: ex.supersetIndex,
                supersetTotal: ex.supersetTotal,
                methodKey: ex.methodKey,
                methodLabel: ex.methodLabel,
                setDetails: [],   // execution reads store.state directly; not needed here
                notes: ex.notes
            )
        }

        return WatchWorkoutSnapshot(
            workoutId: workoutId,
            workoutName: workoutName,
            studentName: "",
            exercises: snapshotExercises,
            cardioItems: cardioItems,
            currentExerciseIndex: exerciseIndex,
            isActive: hasStarted,
            startedAt: formatter.string(from: startedAt),
            updatedAt: nil
        )
    }

    /// Extract the first integer in a rep target string as the starting reps:
    /// "8-12" → 8, "8+4+2" → 8, "10" → 10. Non-numeric ("AMRAP") → fallback.
    static func startingReps(from target: String, fallback: Int) -> Int {
        var digits = ""
        for ch in target {
            if ch.isNumber {
                digits.append(ch)
            } else if !digits.isEmpty {
                break
            }
        }
        if let n = Int(digits), n > 0 { return n }
        return fallback
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

    /// Build the cardio payload for sendFinishWorkout.
    func buildCardioPayload() -> [[String: Any]] {
        cardioStates.filter(\.isCompleted).map { cardio in
            [
                "itemId": cardio.itemId,
                "elapsedSeconds": cardio.elapsedSeconds,
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
