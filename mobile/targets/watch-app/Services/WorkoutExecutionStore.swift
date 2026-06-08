import Foundation
import SwiftUI
import Combine
import WatchKit

/// Central state owner for workout execution.
/// Lives as @StateObject on KinevoWatchApp — survives view recreation.
/// Persists to disk on every meaningful mutation for crash resilience.
class WorkoutExecutionStore: ObservableObject {
    @Published private(set) var state: WorkoutExecutionState?
    /// Set when iPhone requests a remote start — drives programmatic navigation.
    @Published var remoteStartWorkoutId: String?

    /// Tracks the last completed set for undo support.
    struct LastCompletedSet: Equatable {
        let exerciseIndex: Int
        let setIndex: Int
        let reps: Int
        let weight: Double
    }
    @Published private(set) var lastCompletedSet: LastCompletedSet?

    private var persistDebounceTask: Task<Void, Never>?

    /// Canonical session ids received via SESSION_SYNC, keyed by workoutId. Cached
    /// so a SESSION_SYNC that arrives before the workout is loaded still applies.
    private var sessionIdByWorkout: [String: String] = [:]

    init() {
        // Attempt to restore from disk on launch
        if let restored = WorkoutStatePersistence.load() {
            // If finish was pending and state is stale (>10 min), the ACK was likely
            // received while the app was killed, or delivered but unhandled. Clear it.
            if restored.finishState == .pending {
                let staleness = Date().timeIntervalSince(restored.lastPersistedAt)
                if staleness > 600 { // 10 minutes
                    print("[WorkoutStore] Restored finish-pending workout \(restored.workoutId) but stale (\(Int(staleness))s) — clearing")
                    WorkoutStatePersistence.delete()
                } else {
                    self.state = restored
                    print("[WorkoutStore] Restored finish-pending workout \(restored.workoutId) — waiting for SYNC_SUCCESS")
                }
            } else {
                self.state = restored
                print("[WorkoutStore] Restored active workout \(restored.workoutId) — \(completedSetsCount(restored)) sets completed")
            }
        } else {
            print("[WorkoutStore] No active workout to restore")
        }
    }

    // MARK: - Lifecycle

    /// Start a new workout from an iPhone snapshot.
    /// Ignored if a workout is already in progress.
    func startWorkout(from snapshot: WatchWorkoutSnapshot, startedRemotely: Bool = false) {
        if let existing = state {
            print("[WorkoutStore] WARNING: startWorkout called but workout \(existing.workoutId) is already active — ignoring")
            return
        }

        var newState = WorkoutExecutionState.from(snapshot: snapshot)
        newState.hasStarted = true
        newState.startedAt = Date()
        newState.lastPersistedAt = Date()
        newState.sessionId = sessionIdByWorkout[newState.workoutId]
        newState.startedRemotely = startedRemotely
        state = newState
        persistImmediate()
        print("[WorkoutStore] Started workout \(newState.workoutId) with \(newState.exercises.count) exercises (remote: \(startedRemotely))")
    }

    /// Initialize state from snapshot WITHOUT starting (for pre-start screen).
    func loadWorkout(from snapshot: WatchWorkoutSnapshot) {
        if let existing = state, existing.workoutId == snapshot.workoutId {
            // Same workout already loaded — update exercise order but keep progress
            updateExerciseOrder(from: snapshot.exercises.map(\.id))
            return
        }
        if let existing = state {
            print("[WorkoutStore] WARNING: loadWorkout replacing active workout \(existing.workoutId) with \(snapshot.workoutId)")
        }

        var newState = WorkoutExecutionState.from(snapshot: snapshot)
        newState.sessionId = sessionIdByWorkout[newState.workoutId]
        state = newState
        persistImmediate()
        print("[WorkoutStore] Loaded workout \(newState.workoutId) with \(newState.exercises.count) exercises (not started)")
    }

    /// Apply the canonical workout_session_id from the iPhone (SESSION_SYNC).
    func setSessionId(workoutId: String, sessionId: String) {
        sessionIdByWorkout[workoutId] = sessionId
        if var s = state, s.workoutId == workoutId, s.sessionId != sessionId {
            s.sessionId = sessionId
            state = s
            persistImmediate()
            print("[WorkoutStore] Applied session id for \(workoutId): \(sessionId)")
        }
    }

    /// Mark the current workout as started (user tapped "Iniciar treino").
    func markStarted() {
        guard state != nil else { return }
        state?.hasStarted = true
        state?.startedAt = Date()
        persistImmediate()
        print("[WorkoutStore] Workout marked as started")
    }

    /// Mark the workout as finish-pending. Persists state so it survives app termination.
    /// Called BEFORE sending FINISH_WORKOUT to iPhone.
    func markFinishPending() {
        guard var s = state, s.finishState == .none else { return }
        s.finishState = .pending
        state = s
        persistImmediate()
        print("[WorkoutStore] Workout \(s.workoutId) marked as finish pending")
    }

    /// Handle SYNC_SUCCESS acknowledgement from iPhone.
    /// Clears workout state only if the workoutId matches.
    func acknowledgeFinish(workoutId: String) {
        guard let current = state else {
            print("[WorkoutStore] acknowledgeFinish ignored — no active state")
            return
        }

        guard current.workoutId == workoutId else {
            print("[WorkoutStore] acknowledgeFinish ignored — workoutId mismatch (current: \(current.workoutId), ack: \(workoutId))")
            return
        }

        guard current.finishState == .pending else {
            print("[WorkoutStore] acknowledgeFinish ignored — finishState is \(current.finishState.rawValue), not pending")
            return
        }

        print("[WorkoutStore] SYNC_SUCCESS received for \(workoutId) — clearing workout")
        clearWorkout()
    }

    /// Handle workout finished from iPhone — clear state if matching workout is active.
    /// Returns `true` when an active workout was actually cleared, so the caller can
    /// also end the mirrored HealthKit session (save it to Apple Activity).
    @discardableResult
    func handleRemoteFinish(workoutId: String) -> Bool {
        guard let current = state else {
            print("[WorkoutStore] handleRemoteFinish ignored — no active state")
            return false
        }

        guard current.workoutId == workoutId else {
            print("[WorkoutStore] handleRemoteFinish ignored — workoutId mismatch (current: \(current.workoutId), remote: \(workoutId))")
            return false
        }

        print("[WorkoutStore] WORKOUT_FINISHED_FROM_PHONE for \(workoutId) — clearing workout")
        WKInterfaceDevice.current().play(.success)
        clearWorkout()
        return true
    }

    /// Handle workout discarded from iPhone (user abandoned on the phone).
    /// Returns `true` when an active workout was cleared, so the caller can discard
    /// the mirrored HealthKit session WITHOUT saving it.
    @discardableResult
    func handleRemoteDiscard(workoutId: String) -> Bool {
        guard let current = state else {
            print("[WorkoutStore] handleRemoteDiscard ignored — no active state")
            return false
        }

        guard current.workoutId == workoutId else {
            print("[WorkoutStore] handleRemoteDiscard ignored — workoutId mismatch (current: \(current.workoutId), remote: \(workoutId))")
            return false
        }

        print("[WorkoutStore] WORKOUT_DISCARDED_FROM_PHONE for \(workoutId) — discarding workout")
        WKInterfaceDevice.current().play(.failure)
        clearWorkout()
        return true
    }

    /// Handle workout started from iPhone — find workout in program cache and start it.
    /// Returns `true` when a new workout was actually started (so the caller can also
    /// begin the HealthKit workout session for live time/calories + Apple Activity).
    @discardableResult
    func handleRemoteStart(workoutId: String, programSnapshot: WatchProgramSnapshot?) -> Bool {
        // Guard: if already in a workout, ignore
        if let existing = state {
            if existing.workoutId == workoutId {
                print("[WorkoutStore] handleRemoteStart — same workout \(workoutId) already active, ignoring")
            } else {
                print("[WorkoutStore] handleRemoteStart — different workout \(existing.workoutId) active, ignoring remote start for \(workoutId)")
            }
            return false
        }

        // Find workout in the synced program snapshot
        guard let snapshot = programSnapshot,
              let workoutSummary = snapshot.workouts.first(where: { $0.workoutId == workoutId })
        else {
            print("[WorkoutStore] handleRemoteStart — workout \(workoutId) not found in program cache")
            return false
        }

        let workoutSnapshot = workoutSummary.toWorkoutSnapshot()
        startWorkout(from: workoutSnapshot, startedRemotely: true)
        WKInterfaceDevice.current().play(.start)
        remoteStartWorkoutId = workoutId
        print("[WorkoutStore] handleRemoteStart — started workout \(workoutId) from iPhone")
        return true
    }

    /// Clear workout state (finished or discarded). Deletes persisted file.
    func clearWorkout() {
        persistDebounceTask?.cancel()
        persistDebounceTask = nil
        let workoutId = state?.workoutId ?? "none"
        state = nil
        WorkoutStatePersistence.delete()
        print("[WorkoutStore] Cleared workout \(workoutId)")
    }

    // MARK: - Program Reconciliation (always-active, independent of views)

    /// Called by WatchSessionManager.onProgramUpdated when a new applicationContext arrives.
    /// Extracts the active workout's exercise order and applies it.
    func reconcileProgram(_ snapshot: WatchProgramSnapshot) {
        guard let current = state else {
            print("[WorkoutStore] reconcileProgram — no active workout, skipping")
            return
        }

        guard current.finishState != .pending else {
            print("[WorkoutStore] reconcileProgram — finish pending, skipping")
            return
        }

        guard let matchingWorkout = snapshot.workouts.first(where: { $0.workoutId == current.workoutId }) else {
            // Active workout no longer in the synced program. Do NOT destroy an
            // in-progress session (trainer edited the program mid-workout). Keep it
            // until the user finishes or the explicit remote-finish path clears it.
            if current.hasStarted {
                print("[WorkoutStore] reconcileProgram — active workout \(current.workoutId) not in program but started — keeping local state")
            } else {
                print("[WorkoutStore] reconcileProgram — active workout \(current.workoutId) not in program (not started), clearing")
                clearWorkout()
            }
            return
        }

        print("[WorkoutStore] reconcileProgram — merging exercises for \(current.workoutId)")
        mergeProgramExercises(matchingWorkout.exercises)
    }

    /// Reconcile the active workout's exercises against the fresh program summary,
    /// preserving progress for existing exercises, reordering to the canonical
    /// order, and ADDING exercises the trainer inserted mid-session (built with
    /// full per-set data). Existing exercises no longer in the program are kept
    /// (so completed work is never silently dropped).
    private func mergeProgramExercises(_ summaries: [WatchProgramExerciseSummary]) {
        guard var s = state else { return }
        guard !summaries.isEmpty else { return }

        let summaryIds = summaries.map(\.id)
        if s.exercises.map(\.id) == summaryIds { return } // already aligned

        let currentExerciseId = s.exerciseIndex < s.exercises.count
            ? s.exercises[s.exerciseIndex].id
            : nil

        var existingById: [String: WorkoutExecutionState.ExerciseState] = [:]
        for ex in s.exercises { existingById[ex.id] = ex }

        var rebuilt: [WorkoutExecutionState.ExerciseState] = []
        var addedNew = false
        for summary in summaries {
            if let existing = existingById[summary.id] {
                rebuilt.append(existing) // preserve progress
            } else {
                rebuilt.append(WorkoutExecutionState.makeExercise(from: summary.toExerciseSnapshot()))
                addedNew = true
            }
        }

        // Keep any current exercise not present in the new program (defensive —
        // never drop the user's in-progress/completed work).
        let summaryIdSet = Set(summaryIds)
        for ex in s.exercises where !summaryIdSet.contains(ex.id) {
            rebuilt.append(ex)
        }

        // Keep the user viewing the same exercise.
        if let targetId = currentExerciseId, let idx = rebuilt.firstIndex(where: { $0.id == targetId }) {
            s.exerciseIndex = idx
        } else {
            s.exerciseIndex = min(s.exerciseIndex, max(rebuilt.count - 1, 0))
        }

        s.exercises = rebuilt
        state = s
        persistImmediate()
        print("[WorkoutStore] mergeProgramExercises — \(rebuilt.count) exercises (addedNew: \(addedNew))")
    }

    // MARK: - Exercise Order Update

    /// Reorder exercises to match the canonical order from iPhone, preserving all progress.
    /// Matches by exercise ID. New exercises are appended; removed ones are dropped.
    func updateExerciseOrder(from newOrder: [String]) {
        guard var s = state else { return }
        guard !newOrder.isEmpty else { return }

        let currentOrder = s.exercises.map(\.id)
        if currentOrder == newOrder {
            return // Already in correct order
        }

        // Track which exercise the user is currently viewing
        let currentExerciseId = s.exerciseIndex < s.exercises.count
            ? s.exercises[s.exerciseIndex].id
            : nil

        // Build lookup of existing exercises (with progress) by ID
        var exerciseById: [String: WorkoutExecutionState.ExerciseState] = [:]
        for ex in s.exercises {
            exerciseById[ex.id] = ex
        }

        // Reorder: place existing exercises in the new order, preserving progress
        var reordered: [WorkoutExecutionState.ExerciseState] = []
        for id in newOrder {
            if let existing = exerciseById[id] {
                reordered.append(existing)
            }
            // New exercises not in current state are skipped — they have no progress
            // and were not part of the original workout load
        }

        // Append any exercises that exist in state but not in newOrder (defensive)
        let newOrderSet = Set(newOrder)
        for ex in s.exercises {
            if !newOrderSet.contains(ex.id) {
                reordered.append(ex)
            }
        }

        let oldNames = s.exercises.map(\.name)
        s.exercises = reordered
        let newNames = s.exercises.map(\.name)

        // Update exerciseIndex to follow the exercise the user was viewing
        if let targetId = currentExerciseId,
           let newIndex = reordered.firstIndex(where: { $0.id == targetId }) {
            s.exerciseIndex = newIndex
        } else {
            s.exerciseIndex = min(s.exerciseIndex, max(reordered.count - 1, 0))
        }

        state = s
        persistImmediate()
        print("[WorkoutStore] Updated exercise order: \(oldNames) → \(newNames)")
    }

    // MARK: - Mutations

    /// Complete a set — immediate persistence (critical data).
    func completeSet(exerciseIndex: Int, setIndex: Int) {
        guard var s = state,
              exerciseIndex < s.exercises.count,
              setIndex < s.exercises[exerciseIndex].sets.count,
              !s.exercises[exerciseIndex].sets[setIndex].isCompleted
        else { return }

        let reps = s.exercises[exerciseIndex].sets[setIndex].reps
        let weight = s.exercises[exerciseIndex].sets[setIndex].weight

        s.exercises[exerciseIndex].sets[setIndex].isCompleted = true

        // Carry the just-used weight/reps forward to later incomplete sets so the
        // user doesn't re-enter the same load every set.
        //   • Standard exercise → carry both (uniform sets, expected UX).
        //   • Advanced method (pyramid, drop-set, top+backoff, 5x5, cluster…) →
        //     each set has its OWN prescribed load/reps, so DON'T clobber them
        //     (e.g. a 95 kg top set must not inherit the 40 kg warmup). Weight is
        //     only filled into sets that have no explicit per-set target; reps are
        //     never overwritten (each advanced set keeps its own rep target).
        let methodKey = s.exercises[exerciseIndex].methodKey
        let isAdvanced = methodKey != nil && methodKey != "standard"
        let setsCount = s.exercises[exerciseIndex].sets.count
        for i in (setIndex + 1)..<setsCount {
            guard !s.exercises[exerciseIndex].sets[i].isCompleted else { continue }
            if isAdvanced {
                if s.exercises[exerciseIndex].sets[i].weightTargetKg == nil {
                    s.exercises[exerciseIndex].sets[i].weight = weight
                }
            } else {
                s.exercises[exerciseIndex].sets[i].reps = reps
                s.exercises[exerciseIndex].sets[i].weight = weight
            }
        }

        // Advance currentSetIndex
        let hasNextSet = setIndex < (setsCount - 1)
        if hasNextSet {
            s.exercises[exerciseIndex].currentSetIndex = setIndex + 1
        }

        state = s
        lastCompletedSet = LastCompletedSet(
            exerciseIndex: exerciseIndex,
            setIndex: setIndex,
            reps: reps,
            weight: weight
        )
        persistImmediate()
    }

    /// Undo the last completed set. Reverts isCompleted and restores currentSetIndex.
    func undoLastCompletedSet() {
        guard let last = lastCompletedSet,
              var s = state,
              last.exerciseIndex < s.exercises.count,
              last.setIndex < s.exercises[last.exerciseIndex].sets.count,
              s.exercises[last.exerciseIndex].sets[last.setIndex].isCompleted
        else { return }

        s.exercises[last.exerciseIndex].sets[last.setIndex].isCompleted = false
        s.exercises[last.exerciseIndex].currentSetIndex = last.setIndex

        state = s
        lastCompletedSet = nil
        persistImmediate()
        print("[WorkoutStore] Undid set \(last.setIndex) of exercise \(last.exerciseIndex)")
    }

    /// Update reps for a specific set — debounced persistence (Crown rotation).
    func updateReps(exerciseIndex: Int, setIndex: Int, reps: Int) {
        guard var s = state,
              exerciseIndex < s.exercises.count,
              setIndex < s.exercises[exerciseIndex].sets.count
        else { return }

        s.exercises[exerciseIndex].sets[setIndex].reps = max(0, reps)
        state = s
        persistDebounced()
    }

    /// Update weight for a specific set — debounced persistence (Crown rotation).
    func updateWeight(exerciseIndex: Int, setIndex: Int, weight: Double) {
        guard var s = state,
              exerciseIndex < s.exercises.count,
              setIndex < s.exercises[exerciseIndex].sets.count
        else { return }

        s.exercises[exerciseIndex].sets[setIndex].weight = max(0, weight)
        state = s
        persistDebounced()
    }

    /// Mark a cardio item as completed — immediate persistence.
    func markCardioCompleted(itemId: String, elapsedSeconds: Int) {
        guard var s = state else { return }
        if let idx = s.cardioStates.firstIndex(where: { $0.itemId == itemId }) {
            s.cardioStates[idx].isCompleted = true
            s.cardioStates[idx].elapsedSeconds = elapsedSeconds
        } else {
            s.cardioStates.append(CardioExecutionState(itemId: itemId, isCompleted: true, elapsedSeconds: elapsedSeconds))
        }
        state = s
        persistImmediate()
        print("[WorkoutStore] Cardio \(itemId) completed — \(elapsedSeconds)s")
    }

    /// Change the currently viewed exercise — immediate persistence.
    func setExerciseIndex(_ index: Int) {
        guard var s = state else { return }
        let clamped = min(max(index, 0), max(s.exercises.count - 1, 0))
        guard clamped != s.exerciseIndex else { return }
        s.exerciseIndex = clamped
        state = s
        persistImmediate()
    }

    // MARK: - Reconciliation (iPhone sync)

    /// Handle new applicationContext from iPhone.
    /// Merges if same workout, replaces if different.
    /// Does NOT clear a finish-pending workout (wait for SYNC_SUCCESS instead).
    func reconcile(with dict: [String: Any]?) {
        guard let dict = dict else { return }

        let version = dict["schemaVersion"] as? Int ?? 1

        switch version {
        case 2...:
            // v2+ program envelope — reconcile active workout if it still exists in the program.
            // Forward-compatible: an unknown newer schema is treated as v2 (program-based)
            // rather than falling back to the legacy single-workout path, which would
            // incorrectly clear the program.
            guard let hasProgram = dict["hasProgram"] as? Bool else { return }
            if !hasProgram {
                clearIfNotPending(reason: "iPhone reports no program")
                return
            }
            guard let programDict = dict["program"] as? [String: Any],
                  let workoutsArray = programDict["workouts"] as? [[String: Any]]
            else { return }

            guard let current = state else { return }

            // Find current workout in the program snapshot
            let matchingWorkout = workoutsArray.first { ($0["workoutId"] as? String) == current.workoutId }

            if let matchingWorkout = matchingWorkout {
                // Workout still exists in program — update exercise order from fresh data
                let exercisesArray = matchingWorkout["exercises"] as? [[String: Any]] ?? []
                let newOrder = exercisesArray.compactMap { $0["id"] as? String }
                updateExerciseOrder(from: newOrder)
                print("[WorkoutStore] v2 reconcile — active workout \(current.workoutId) found in program")
            } else {
                // Active workout not in program — iPhone moved on
                clearIfNotPending(reason: "active workout not in v2 program")
            }

        default:
            // v1 envelope
            if let hasWorkout = dict["hasWorkout"] as? Bool {
                if !hasWorkout {
                    clearIfNotPending(reason: "iPhone reports no workout (v1)")
                    return
                }

                guard let workoutDict = dict["workout"] as? [String: Any],
                      let snapshot = WatchWorkoutSnapshot.parse(from: workoutDict) else { return }
                reconcileWithSnapshot(snapshot)
            } else {
                guard let snapshot = WatchWorkoutSnapshot.parse(from: dict) else { return }
                reconcileWithSnapshot(snapshot)
            }
        }
    }

    private func clearIfNotPending(reason: String) {
        guard let current = state else { return }
        if current.finishState == .pending {
            print("[WorkoutStore] \(reason) but finish is pending — keeping state until ACK")
            return
        }
        // Never discard a workout the user has actively started on the Watch.
        // Program-level reconciliation (a fresh applicationContext) must not destroy
        // in-progress local progress — e.g. the trainer edits/reorders/deactivates the
        // program on the web while the student is mid-workout. Only the explicit
        // WORKOUT_FINISHED_FROM_PHONE and SYNC_SUCCESS paths may clear a started workout.
        if current.hasStarted {
            print("[WorkoutStore] \(reason) but workout is in progress (started) — keeping local state until finished/acked")
            return
        }
        print("[WorkoutStore] \(reason) — clearing local state")
        clearWorkout()
    }

    private func reconcileWithSnapshot(_ snapshot: WatchWorkoutSnapshot) {
        guard let current = state else {
            // No active state — nothing to reconcile
            return
        }

        // Never overwrite a finish-pending workout
        if current.finishState == .pending {
            print("[WorkoutStore] Ignoring reconciliation — finish is pending for \(current.workoutId)")
            return
        }

        if current.workoutId == snapshot.workoutId {
            // Same workout — merge: keep local progress, accept iPhone-confirmed completions
            var merged = current
            for (i, snapshotEx) in snapshot.exercises.enumerated() {
                guard i < merged.exercises.count else { break }
                for setIdx in 0..<min(merged.exercises[i].sets.count, snapshotEx.sets) {
                    if setIdx < snapshotEx.completedSets && !merged.exercises[i].sets[setIdx].isCompleted {
                        merged.exercises[i].sets[setIdx].isCompleted = true
                        print("[WorkoutStore] Merged iPhone-confirmed completion: exercise \(i), set \(setIdx)")
                    }
                }
            }
            merged.lastPersistedAt = Date()
            state = merged
            persistImmediate()
        } else {
            // Different workout — iPhone moved on. Preserve a started session;
            // only replace when the local workout was never started.
            if current.hasStarted {
                print("[WorkoutStore] iPhone sent different workout \(snapshot.workoutId) but local \(current.workoutId) is in progress — keeping local state")
            } else {
                print("[WorkoutStore] iPhone sent different workout \(snapshot.workoutId) — clearing local \(current.workoutId)")
                clearWorkout()
            }
        }
    }

    // MARK: - Binding Helpers (for Digital Crown)

    func repsBinding(exerciseIndex: Int, setIndex: Int) -> Binding<Double> {
        Binding<Double>(
            get: { [weak self] in
                guard let s = self?.state,
                      exerciseIndex < s.exercises.count,
                      setIndex < s.exercises[exerciseIndex].sets.count
                else { return 0 }
                return Double(s.exercises[exerciseIndex].sets[setIndex].reps)
            },
            set: { [weak self] newValue in
                self?.updateReps(exerciseIndex: exerciseIndex, setIndex: setIndex, reps: Int(newValue.rounded()))
            }
        )
    }

    func weightBinding(exerciseIndex: Int, setIndex: Int) -> Binding<Double> {
        Binding<Double>(
            get: { [weak self] in
                guard let s = self?.state,
                      exerciseIndex < s.exercises.count,
                      setIndex < s.exercises[exerciseIndex].sets.count
                else { return 0 }
                return s.exercises[exerciseIndex].sets[setIndex].weight
            },
            set: { [weak self] newValue in
                self?.updateWeight(exerciseIndex: exerciseIndex, setIndex: setIndex, weight: newValue)
            }
        )
    }

    // MARK: - Persistence

    /// Flush any pending debounced writes immediately.
    /// Called on scene phase transitions and critical mutations.
    func persistImmediate() {
        persistDebounceTask?.cancel()
        persistDebounceTask = nil

        guard var s = state else { return }
        s.lastPersistedAt = Date()
        state = s
        WorkoutStatePersistence.save(s)
    }

    /// Schedule a debounced persist (500ms). Used for rapid Crown inputs.
    private func persistDebounced() {
        persistDebounceTask?.cancel()
        persistDebounceTask = Task { @MainActor [weak self] in
            try? await Task.sleep(for: .milliseconds(500))
            guard !Task.isCancelled else { return }
            self?.persistImmediate()
        }
    }

    // MARK: - Helpers

    private func completedSetsCount(_ state: WorkoutExecutionState) -> Int {
        state.exercises.reduce(0) { total, ex in
            total + ex.sets.filter(\.isCompleted).count
        }
    }

    // MARK: - Computed Stats (for UI)

    /// Total completed sets across all exercises.
    var totalCompletedSets: Int {
        guard let s = state else { return 0 }
        return s.exercises.reduce(0) { total, ex in
            total + ex.sets.filter(\.isCompleted).count
        }
    }

    /// Total volume (weight × reps) for completed sets. Excludes bodyweight (weight == 0).
    var totalVolume: Double {
        guard let s = state else { return 0 }
        return s.exercises.reduce(0.0) { total, ex in
            total + ex.sets.filter(\.isCompleted).reduce(0.0) { subtotal, set in
                set.weight > 0 ? subtotal + set.weight * Double(set.reps) : subtotal
            }
        }
    }

    /// Count of exercises where at least one completed set exceeds lastWeight.
    var prCount: Int {
        guard let s = state else { return 0 }
        return s.exercises.filter { ex in
            guard let lw = ex.lastWeight else { return false }
            return ex.sets.contains { $0.isCompleted && $0.weight > lw }
        }.count
    }

    /// Overall workout progress (0...1). Ratio of completed sets to total sets.
    var overallProgress: Double {
        guard let s = state else { return 0 }
        let total = s.exercises.reduce(0) { $0 + $1.sets.count }
        guard total > 0 else { return 0 }
        let completed = s.exercises.reduce(0) { $0 + $1.sets.filter(\.isCompleted).count }
        return Double(completed) / Double(total)
    }
}
