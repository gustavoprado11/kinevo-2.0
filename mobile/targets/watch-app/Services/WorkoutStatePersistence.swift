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
}
