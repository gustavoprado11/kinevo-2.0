import Foundation
import HealthKit
import Combine

/// Manages HealthKit workout session — keeps the app alive in background,
/// tracks heart rate & active calories in real-time, and saves the workout
/// to Apple Health on completion (appears as "Musculação" in the Saúde app).
class HealthKitManager: NSObject, ObservableObject {
    private let healthStore = HKHealthStore()
    private var workoutSession: HKWorkoutSession?
    private var builder: HKLiveWorkoutBuilder?

    @Published var heartRate: Double = 0.0
    @Published var activeCalories: Double = 0.0
    @Published var isWorkoutActive: Bool = false

    // Fase 13 — buffer pra exportar HR/calorias agregados ao iPhone.
    // Atualizado em workoutBuilder(_:didCollectDataOf:) e resetado em startWorkout().
    private var heartRateSeriesBuffer: [(timestamp: Date, bpm: Double)] = []
    private var lastSeriesSampleAt: Date?
    private var minHeartRate: Double = .infinity
    private var maxHeartRate: Double = 0
    private var heartRateSampleCount: Int = 0
    private var heartRateSum: Double = 0
    private let seriesIntervalSeconds: TimeInterval = 60

    // A-2 — HR aggregates live in memory only, so a crash/relaunch mid-workout would
    // lose them even though the workout state and HKWorkoutSession are recovered. We
    // snapshot them to UserDefaults at each series sample (~60s) so recovery restores
    // average/min/max/series for the export to the iPhone.
    private let healthBufferKey = "kinevo_watch_health_buffer"

    override init() {
        super.init()
        recoverActiveWorkoutSession()
    }

    // MARK: - Authorization

    func requestAuthorization() {
        guard HKHealthStore.isHealthDataAvailable() else {
            print("[HealthKit] Health data not available on this device")
            return
        }

        var typesToRead: Set<HKObjectType> = []
        if let heartRateType = HKObjectType.quantityType(forIdentifier: .heartRate) {
            typesToRead.insert(heartRateType)
        }
        if let activeEnergyType = HKObjectType.quantityType(forIdentifier: .activeEnergyBurned) {
            typesToRead.insert(activeEnergyType)
        }

        let typesToWrite: Set<HKSampleType> = [
            HKObjectType.workoutType()
        ]

        healthStore.requestAuthorization(toShare: typesToWrite, read: typesToRead) { success, error in
            if let error = error {
                print("[HealthKit] Authorization failed: \(error)")
            } else if success {
                print("[HealthKit] Authorization granted")
            }
        }
    }

    // MARK: - Crash Recovery

    /// Attempt to recover an active workout session after app relaunch.
    /// Called on init — if watchOS killed the app while a workout was running,
    /// this reclaims the HKWorkoutSession so HR/calories tracking continues.
    private func recoverActiveWorkoutSession() {
        guard HKHealthStore.isHealthDataAvailable() else { return }

        healthStore.recoverActiveWorkoutSession { [weak self] session, error in
            guard let self else { return }

            if let error {
                print("[HealthKit] No active session to recover: \(error.localizedDescription)")
                return
            }

            guard let session else {
                print("[HealthKit] recoverActiveWorkoutSession returned nil session")
                return
            }

            print("[HealthKit] Recovered active workout session — state: \(session.state.rawValue)")

            self.workoutSession = session
            self.builder = session.associatedWorkoutBuilder()

            session.delegate = self
            self.builder?.delegate = self

            // Restore HR aggregates persisted before the crash/relaunch.
            self.restoreHealthBuffers()

            DispatchQueue.main.async {
                self.isWorkoutActive = (session.state == .running)
            }
        }
    }

    // MARK: - Workout Session

    func startWorkout() {
        guard HKHealthStore.isHealthDataAvailable() else {
            print("[HealthKit] Health data not available")
            return
        }

        // Don't start a new session if one is already active
        if workoutSession != nil {
            print("[HealthKit] Workout session already active — skipping startWorkout")
            return
        }

        // Defensive: ensure authorization was requested. On a very first launch the
        // request from the list screen may not have completed yet; this is idempotent
        // (the system prompt is shown at most once) and lets the session collect HR.
        requestAuthorization()

        let configuration = HKWorkoutConfiguration()
        configuration.activityType = .traditionalStrengthTraining
        configuration.locationType = .indoor

        do {
            workoutSession = try HKWorkoutSession(healthStore: healthStore, configuration: configuration)
            builder = workoutSession?.associatedWorkoutBuilder()

            workoutSession?.delegate = self
            builder?.delegate = self

            builder?.dataSource = HKLiveWorkoutDataSource(
                healthStore: healthStore,
                workoutConfiguration: configuration
            )

            resetHealthBuffers()

            let startDate = Date()
            workoutSession?.startActivity(with: startDate)
            builder?.beginCollection(withStart: startDate) { success, error in
                if let error = error {
                    print("[HealthKit] Failed to begin collection: \(error)")
                } else {
                    print("[HealthKit] Workout collection started")
                }
            }

            DispatchQueue.main.async {
                self.isWorkoutActive = true
                self.activeCalories = 0.0
                self.heartRate = 0.0
            }

            print("[HealthKit] Workout session started")
        } catch {
            print("[HealthKit] Failed to start workout: \(error)")
        }
    }

    /// End the workout session WITHOUT saving to Apple Health.
    /// Used when the user abandons/discards a workout from the Watch.
    func discardWorkout() {
        guard let session = workoutSession, let builder = builder else {
            print("[HealthKit] No active workout to discard")
            return
        }

        session.end()
        let endDate = Date()

        builder.endCollection(withEnd: endDate) { [weak self] _, error in
            if let error = error {
                print("[HealthKit] Failed to end collection for discard: \(error)")
            }
            Task {
                do {
                    try await builder.discardWorkout()
                    print("[HealthKit] Workout discarded (not saved to Health)")
                } catch {
                    print("[HealthKit] Failed to discard workout: \(error)")
                }
                await MainActor.run {
                    self?.isWorkoutActive = false
                    self?.activeCalories = 0.0
                    self?.heartRate = 0.0
                }
            }
        }

        workoutSession = nil
        self.builder = nil
    }

    func endWorkout() {
        guard let session = workoutSession, let builder = builder else {
            print("[HealthKit] No active workout to end")
            return
        }

        session.end()

        let endDate = Date()

        // Critical order: endCollection FIRST, then finishWorkout.
        // Without finishWorkout(), the workout won't appear in Apple Health.
        builder.endCollection(withEnd: endDate) { [weak self] _, error in
            if let error = error {
                print("[HealthKit] Failed to end collection: \(error)")
            } else {
                print("[HealthKit] Workout collection ended — saving to HealthKit...")
            }

            Task {
                do {
                    if let workout = try await builder.finishWorkout() {
                        let duration = workout.duration
                        let calories = workout.totalEnergyBurned?.doubleValue(for: .kilocalorie()) ?? 0
                        print("[HealthKit] Workout saved to HealthKit — duration: \(Int(duration))s, calories: \(Int(calories)) kcal")
                    }
                } catch {
                    print("[HealthKit] Failed to save workout to HealthKit: \(error)")
                }

                await MainActor.run {
                    self?.isWorkoutActive = false
                    self?.activeCalories = 0.0
                    self?.heartRate = 0.0
                }
            }
        }

        workoutSession = nil
        self.builder = nil
    }

    // MARK: - Health Samples Export (Fase 13)

    /// Returns aggregated health metrics for the just-finished workout.
    /// Call AFTER `endWorkout()` (or as part of the finish flow). Returns nil
    /// if no HR samples were collected — caller skips sending in that case.
    func exportHealthSamples() -> [String: Any]? {
        guard heartRateSampleCount > 0 else { return nil }

        let avgHR = heartRateSum / Double(heartRateSampleCount)
        let avgRounded = (avgHR * 10).rounded() / 10
        let kcalRounded = (activeCalories * 100).rounded() / 100

        let hrSeries: [[String: Any]] = heartRateSeriesBuffer.map { sample in
            return [
                "ts": Int(sample.timestamp.timeIntervalSince1970),
                "bpm": Int(sample.bpm.rounded())
            ]
        }

        var payload: [String: Any] = [
            "avgHeartRate": avgRounded,
            "maxHeartRate": Int(maxHeartRate.rounded()),
            "caloriesActive": kcalRounded
        ]
        if minHeartRate != .infinity {
            payload["minHeartRate"] = Int(minHeartRate.rounded())
        }
        if !hrSeries.isEmpty {
            payload["heartRateSeries"] = hrSeries
        }
        return payload
    }

    private func resetHealthBuffers() {
        heartRateSeriesBuffer = []
        lastSeriesSampleAt = nil
        minHeartRate = .infinity
        maxHeartRate = 0
        heartRateSampleCount = 0
        heartRateSum = 0
        UserDefaults.standard.removeObject(forKey: healthBufferKey)
    }

    /// Snapshot the running HR aggregates to UserDefaults for crash recovery.
    private func persistHealthBuffers() {
        let series: [[String: Any]] = heartRateSeriesBuffer.map {
            ["ts": $0.timestamp.timeIntervalSince1970, "bpm": $0.bpm]
        }
        let snapshot: [String: Any] = [
            "sum": heartRateSum,
            "count": heartRateSampleCount,
            "min": minHeartRate == .infinity ? -1 : minHeartRate,
            "max": maxHeartRate,
            "lastSeriesAt": lastSeriesSampleAt?.timeIntervalSince1970 ?? -1,
            "series": series,
        ]
        UserDefaults.standard.set(snapshot, forKey: healthBufferKey)
    }

    /// Restore HR aggregates after recovering a workout session post-crash.
    private func restoreHealthBuffers() {
        guard let snapshot = UserDefaults.standard.dictionary(forKey: healthBufferKey) else { return }

        heartRateSum = snapshot["sum"] as? Double ?? 0
        heartRateSampleCount = snapshot["count"] as? Int ?? 0
        let restoredMin = snapshot["min"] as? Double ?? -1
        minHeartRate = restoredMin < 0 ? .infinity : restoredMin
        maxHeartRate = snapshot["max"] as? Double ?? 0
        let lastAt = snapshot["lastSeriesAt"] as? Double ?? -1
        lastSeriesSampleAt = lastAt < 0 ? nil : Date(timeIntervalSince1970: lastAt)
        if let series = snapshot["series"] as? [[String: Any]] {
            heartRateSeriesBuffer = series.compactMap { entry in
                guard let ts = entry["ts"] as? Double, let bpm = entry["bpm"] as? Double else { return nil }
                return (timestamp: Date(timeIntervalSince1970: ts), bpm: bpm)
            }
        }
        print("[HealthKit] Restored HR buffers — \(heartRateSampleCount) samples, \(heartRateSeriesBuffer.count) series points")
    }
}

// MARK: - HKWorkoutSessionDelegate

extension HealthKitManager: HKWorkoutSessionDelegate {
    func workoutSession(
        _ workoutSession: HKWorkoutSession,
        didChangeTo toState: HKWorkoutSessionState,
        from fromState: HKWorkoutSessionState,
        date: Date
    ) {
        print("[HealthKit] Workout state changed from \(fromState.rawValue) to \(toState.rawValue)")

        DispatchQueue.main.async {
            self.isWorkoutActive = (toState == .running)
        }
    }

    func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
        print("[HealthKit] Workout session failed: \(error)")

        DispatchQueue.main.async {
            self.isWorkoutActive = false
        }
    }
}

// MARK: - HKLiveWorkoutBuilderDelegate

extension HealthKitManager: HKLiveWorkoutBuilderDelegate {
    func workoutBuilder(_ workoutBuilder: HKLiveWorkoutBuilder, didCollectDataOf collectedTypes: Set<HKSampleType>) {
        for type in collectedTypes {
            guard let quantityType = type as? HKQuantityType else { continue }

            // Heart rate — instantaneous (mostRecentQuantity)
            if quantityType == HKQuantityType.quantityType(forIdentifier: .heartRate) {
                if let statistics = workoutBuilder.statistics(for: quantityType) {
                    let heartRateUnit = HKUnit.count().unitDivided(by: .minute())
                    let value = statistics.mostRecentQuantity()?.doubleValue(for: heartRateUnit) ?? 0

                    if value > 0 {
                        heartRateSum += value
                        heartRateSampleCount += 1
                        minHeartRate = min(minHeartRate, value)
                        maxHeartRate = max(maxHeartRate, value)

                        let now = Date()
                        if lastSeriesSampleAt == nil || now.timeIntervalSince(lastSeriesSampleAt!) >= seriesIntervalSeconds {
                            heartRateSeriesBuffer.append((timestamp: now, bpm: value))
                            lastSeriesSampleAt = now
                            // Snapshot aggregates for crash recovery (~once per minute).
                            persistHealthBuffers()
                        }
                    }

                    DispatchQueue.main.async {
                        self.heartRate = value
                    }
                }
            }

            // Active calories — cumulative (sumQuantity)
            if quantityType == HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned) {
                if let statistics = workoutBuilder.statistics(for: quantityType) {
                    let energyUnit = HKUnit.kilocalorie()
                    let value = statistics.sumQuantity()?.doubleValue(for: energyUnit) ?? 0

                    DispatchQueue.main.async {
                        self.activeCalories = value
                    }
                }
            }
        }
    }

    func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {
        // Handle workout events if needed
    }
}
