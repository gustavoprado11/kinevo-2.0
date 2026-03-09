import Foundation
import SwiftUI
import Combine

/// Central state owner for workout execution.
/// Lives as @StateObject on KinevoWatchApp — survives view recreation.
/// Persists to disk on every meaningful mutation for crash resilience.
class WorkoutExecutionStore: ObservableObject {
    @Published private(set) var state: WorkoutExecutionState?

    /// Tracks the last completed set for undo support.
    struct LastCompletedSet: Equatable {
        let exerciseIndex: Int
        let setIndex: Int
        let reps: Int
        let weight: Double
    }
    @Published private(set) var lastCompletedSet: LastCompletedSet?

    private var persistDebounceTask: Task<Void, Never>?

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
    func startWorkout(from snapshot: WatchWorkoutSnapshot) {
        if let existing = state {
            print("[WorkoutStore] WARNING: startWorkout called but workout \(existing.workoutId) is already active — ignoring")
            return
        }

        var newState = WorkoutExecutionState.from(snapshot: snapshot)
        newState.hasStarted = true
        newState.startedAt = Date()
        newState.lastPersistedAt = Date()
        state = newState
        persistImmediate()
        print("[WorkoutStore] Started workout \(newState.workoutId) with \(newState.exercises.count) exercises")
    }

    /// Initialize state from snapshot WITHOUT starting (for pre-start screen).
    func loadWorkout(from snapshot: WatchWorkoutSnapshot) {
        if let existing = state, existing.workoutId == snapshot.workoutId {
            // Same workout already loaded — don't overwrite progress
            print("[WorkoutStore] Workout \(existing.workoutId) already loaded — keeping existing state")
            return
        }
        if let existing = state {
            print("[WorkoutStore] WARNING: loadWorkout replacing active workout \(existing.workoutId) with \(snapshot.workoutId)")
        }

        let newState = WorkoutExecutionState.from(snapshot: snapshot)
        state = newState
        persistImmediate()
        print("[WorkoutStore] Loaded workout \(newState.workoutId) with \(newState.exercises.count) exercises (not started)")
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

    /// Clear workout state (finished or discarded). Deletes persisted file.
    func clearWorkout() {
        persistDebounceTask?.cancel()
        persistDebounceTask = nil
        let workoutId = state?.workoutId ?? "none"
        state = nil
        WorkoutStatePersistence.delete()
        print("[WorkoutStore] Cleared workout \(workoutId)")
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

        // Copy weight/reps to subsequent incomplete sets
        let setsCount = s.exercises[exerciseIndex].sets.count
        for i in (setIndex + 1)..<setsCount {
            if !s.exercises[exerciseIndex].sets[i].isCompleted {
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
        case 2:
            // v2 program envelope — reconcile active workout if it still exists in the program
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

            if matchingWorkout != nil {
                // Workout still exists in program — no reconciliation needed for v2
                // (v2 exercises start fresh, no completedSets to merge)
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
        } else {
            print("[WorkoutStore] \(reason) — clearing local state")
            clearWorkout()
        }
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
            // Different workout — iPhone moved on
            print("[WorkoutStore] iPhone sent different workout \(snapshot.workoutId) — clearing local \(current.workoutId)")
            clearWorkout()
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
}
