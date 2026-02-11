import Foundation
import HealthKit
import Combine

/// Manages HealthKit workout session to keep the app alive in background
class HealthKitManager: NSObject, ObservableObject {
    static let shared = HealthKitManager()

    private let healthStore = HKHealthStore()
    private var workoutSession: HKWorkoutSession?
    private var builder: HKLiveWorkoutBuilder?

    @Published var heartRate: Double = 0.0
    @Published var isWorkoutActive: Bool = false

    override init() {
        super.init()
    }

    // MARK: - Authorization

    func requestAuthorization() {
        guard HKHealthStore.isHealthDataAvailable() else {
            print("[HealthKit] Health data not available on this device")
            return
        }

        let typesToRead: Set<HKObjectType> = [
            HKObjectType.quantityType(forIdentifier: .heartRate)!
        ]

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

    // MARK: - Workout Session

    func startWorkout() {
        guard HKHealthStore.isHealthDataAvailable() else {
            print("[HealthKit] Health data not available")
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
            }

            print("[HealthKit] Workout session started")
        } catch {
            print("[HealthKit] Failed to start workout: \(error)")
        }
    }

    func endWorkout() {
        guard let session = workoutSession, let builder = builder else {
            print("[HealthKit] No active workout to end")
            return
        }

        session.end()
        builder.endCollection(withEnd: Date()) { success, error in
            if let error = error {
                print("[HealthKit] Failed to end collection: \(error)")
            } else {
                print("[HealthKit] Workout collection ended")
            }
        }

        DispatchQueue.main.async {
            self.isWorkoutActive = false
        }

        workoutSession = nil
        self.builder = nil

        print("[HealthKit] Workout session ended")
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
        // Update heart rate if available
        for type in collectedTypes {
            guard let quantityType = type as? HKQuantityType,
                  quantityType == HKQuantityType.quantityType(forIdentifier: .heartRate) else { continue }

            if let statistics = workoutBuilder.statistics(for: quantityType) {
                let heartRateUnit = HKUnit.count().unitDivided(by: .minute())
                let value = statistics.mostRecentQuantity()?.doubleValue(for: heartRateUnit) ?? 0

                DispatchQueue.main.async {
                    self.heartRate = value
                }
            }
        }
    }

    func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {
        // Handle workout events if needed
    }
}
