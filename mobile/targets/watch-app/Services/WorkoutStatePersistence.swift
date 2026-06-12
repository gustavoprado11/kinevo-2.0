import Foundation

/// Atomic JSON persistence for workout execution state.
/// Stores a single file in Application Support directory.
enum WorkoutStatePersistence {
    private static let filename = "active-workout-state.json"

    static var fileURL: URL {
        let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        return appSupport.appendingPathComponent(filename)
    }

    /// Atomically write state to disk.
    /// Writes to a temp file first, then renames for crash safety.
    static func save(_ state: WorkoutExecutionState) {
        do {
            let directory = fileURL.deletingLastPathComponent()
            if !FileManager.default.fileExists(atPath: directory.path) {
                try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            }

            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            let data = try encoder.encode(state)

            // Write to temp file for atomic swap
            let tempURL = directory.appendingPathComponent("active-workout-state.tmp.json")
            try data.write(to: tempURL, options: .atomic)

            // Atomic replace
            if FileManager.default.fileExists(atPath: fileURL.path) {
                _ = try FileManager.default.replaceItemAt(fileURL, withItemAt: tempURL)
            } else {
                try FileManager.default.moveItem(at: tempURL, to: fileURL)
            }

            print("[WorkoutPersistence] Saved state (\(data.count) bytes) for workout \(state.workoutId)")
        } catch {
            print("[WorkoutPersistence] ERROR saving state: \(error)")
        }
    }

    /// Load state from disk. Returns nil if no file exists or decoding fails.
    static func load() -> WorkoutExecutionState? {
        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            print("[WorkoutPersistence] No persisted state file found")
            return nil
        }

        do {
            let data = try Data(contentsOf: fileURL)
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            let state = try decoder.decode(WorkoutExecutionState.self, from: data)
            print("[WorkoutPersistence] Loaded state for workout \(state.workoutId) — \(state.exercises.count) exercises, persisted at \(state.lastPersistedAt)")
            return state
        } catch {
            print("[WorkoutPersistence] ERROR loading state: \(error)")
            return nil
        }
    }

    /// Delete the persisted state file.
    static func delete() {
        guard FileManager.default.fileExists(atPath: fileURL.path) else { return }

        do {
            try FileManager.default.removeItem(at: fileURL)
            print("[WorkoutPersistence] Deleted persisted state")
        } catch {
            print("[WorkoutPersistence] ERROR deleting state: \(error)")
        }
    }

    // MARK: - Pending-finish queue (unacknowledged FINISH_WORKOUTs)
    //
    // When the finish sheet is dismissed without a SYNC_SUCCESS from the iPhone,
    // the workout state is moved OUT of the active slot into this queue (one file
    // per workout) so it stays re-sendable across launches without keeping the
    // active-workout UI (resume card, auto-resume) alive. Entries are deleted on
    // ACK or after 48h (see WorkoutExecutionStore.pendingFinishResends()).

    private static let pendingFinishPrefix = "pending-finish-"

    private static func pendingFinishURL(for workoutId: String) -> URL {
        fileURL.deletingLastPathComponent()
            .appendingPathComponent("\(pendingFinishPrefix)\(workoutId).json")
    }

    /// Persist an unacknowledged finished workout to the queue (atomic write).
    static func savePendingFinish(_ state: WorkoutExecutionState) {
        do {
            let url = pendingFinishURL(for: state.workoutId)
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            let data = try encoder.encode(state)
            try data.write(to: url, options: .atomic)
            print("[WorkoutPersistence] Queued pending finish for workout \(state.workoutId)")
        } catch {
            print("[WorkoutPersistence] ERROR queueing pending finish: \(error)")
        }
    }

    /// Load every queued (unacknowledged) finished workout.
    static func loadAllPendingFinishes() -> [WorkoutExecutionState] {
        let directory = fileURL.deletingLastPathComponent()
        guard let files = try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil) else {
            return []
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        return files
            .filter { $0.lastPathComponent.hasPrefix(pendingFinishPrefix) }
            .compactMap { url in
                guard let data = try? Data(contentsOf: url),
                      let state = try? decoder.decode(WorkoutExecutionState.self, from: data)
                else {
                    print("[WorkoutPersistence] Dropping unreadable pending finish at \(url.lastPathComponent)")
                    try? FileManager.default.removeItem(at: url)
                    return nil
                }
                return state
            }
    }

    /// Remove one workout from the pending-finish queue (ACK received or expired).
    static func deletePendingFinish(workoutId: String) {
        let url = pendingFinishURL(for: workoutId)
        guard FileManager.default.fileExists(atPath: url.path) else { return }
        do {
            try FileManager.default.removeItem(at: url)
            print("[WorkoutPersistence] Removed pending finish for workout \(workoutId)")
        } catch {
            print("[WorkoutPersistence] ERROR removing pending finish: \(error)")
        }
    }
}
