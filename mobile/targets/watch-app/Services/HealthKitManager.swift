import Foundation
import HealthKit
import Combine

/// Manages HealthKit workout session — keeps the app alive in background,
/// tracks heart rate & active calories in real-time, and saves the workout
/// to Apple Health on completion (appears as "Musculação" in the Saúde app).
class HealthKitManager: NSObject, ObservableObject {
    static let shared = HealthKitManager()

    private let healthStore = HKHealthStore()
    private var workoutSession: HKWorkoutSession?
    private var builder: HKLiveWorkoutBuilder?

    @Published var heartRate: Double = 0.0
    @Published var activeCalories: Double = 0.0
    @Published var isWorkoutActive: Bool = false

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

        builder.endCollection(withEnd: endDate) { [weak self] success, error in
            if let error = error {
                print("[HealthKit] Failed to end collection for discard: \(error)")
            }

            builder.discardWorkout {
                print("[HealthKit] Workout discarded (not saved to Health)")
                DispatchQueue.main.async {
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
        builder.endCollection(withEnd: endDate) { [weak self] success, error in
            if let error = error {
                print("[HealthKit] Failed to end collection: \(error)")
            } else {
                print("[HealthKit] Workout collection ended — saving to HealthKit...")
            }

            builder.finishWorkout { workout, error in
                if let error = error {
                    print("[HealthKit] Failed to save workout to HealthKit: \(error)")
                } else if let workout = workout {
                    let duration = workout.duration
                    let calories = workout.totalEnergyBurned?.doubleValue(for: .kilocalorie()) ?? 0
                    print("[HealthKit] Workout saved to HealthKit — duration: \(Int(duration))s, calories: \(Int(calories)) kcal")
                }

                DispatchQueue.main.async {
                    self?.isWorkoutActive = false
                    self?.activeCalories = 0.0
                    self?.heartRate = 0.0
                }
            }
        }

        workoutSession = nil
        self.builder = nil
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
