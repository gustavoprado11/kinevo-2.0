import Foundation
import WatchConnectivity
import Combine

/// Manages WatchConnectivity session for the Apple Watch app
class WatchSessionManager: NSObject, ObservableObject {
  static let shared = WatchSessionManager()

  @Published var currentWorkout: [String: Any]?
  @Published var isConnected: Bool = false

  private var wcSession: WCSession?

  override init() {
    super.init()
    setupWCSession()

    #if targetEnvironment(simulator)
    // Load mock data after a short delay if no real data arrives (for screenshots)
    DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
      if self.currentWorkout == nil {
        self.loadMockData()
      }
    }
    #endif
  }

  #if targetEnvironment(simulator)
  private func loadMockData() {
    print("[WatchSessionManager] Loading mock data for simulator screenshots")
    let mockWorkout: [String: Any] = [
      "workoutId": "mock-001",
      "studentName": "Gustavo Prado",
      "exercises": [
        ["id": "ex1", "name": "Puxada Supinada Barra Reta", "sets": 4, "reps": 10, "weight": 65.0, "restTime": 60, "completedSets": 1],
        ["id": "ex2", "name": "Remada Baixa Triângulo", "sets": 3, "reps": 10, "weight": 55.0, "restTime": 60, "completedSets": 0],
        ["id": "ex3", "name": "Puxada Aberta Barra Reta", "sets": 3, "reps": 10, "weight": 50.0, "restTime": 60, "completedSets": 0],
        ["id": "ex4", "name": "Rosca Alternada Halteres", "sets": 3, "reps": 12, "weight": 14.0, "restTime": 60, "completedSets": 0],
        ["id": "ex5", "name": "Rosca Scott Máquina", "sets": 3, "reps": 10, "weight": 30.0, "restTime": 60, "completedSets": 0]
      ],
      "currentExerciseIndex": 0,
      "currentSetIndex": 1,
      "isActive": true
    ]
    self.currentWorkout = mockWorkout
  }
  #endif

  // MARK: - Setup

  private func setupWCSession() {
    guard WCSession.isSupported() else {
      print("[WatchSessionManager] WCSession not supported")
      return
    }

    wcSession = WCSession.default
    wcSession?.delegate = self
    wcSession?.activate()

    print("[WatchSessionManager] WCSession activated")
  }

  // MARK: - Send to iPhone

  func sendSetComplete(exerciseIndex: Int, setIndex: Int) {
    guard let session = wcSession, session.activationState == .activated else {
      print("[WatchSessionManager] Session not activated")
      return
    }

    let message: [String: Any] = [
      "type": "SET_COMPLETE",
      "payload": [
        "exerciseIndex": exerciseIndex,
        "setIndex": setIndex
      ]
    ]

    if session.isReachable {
      session.sendMessage(message, replyHandler: { reply in
        print("[WatchSessionManager] Set completion acknowledged: \(reply)")
      }, errorHandler: { error in
        print("[WatchSessionManager] Error sending set completion: \(error)")
      })
    } else {
      print("[WatchSessionManager] iPhone not reachable")
    }
  }

  /// Enriched set completion with exercise data (used by WorkoutExecutionView).
  func sendSetCompletion(
    workoutId: String,
    exerciseIndex: Int,
    exerciseId: String,
    setIndex: Int,
    reps: Int,
    weight: Double
  ) {
    let message: [String: Any] = [
      "type": "SET_COMPLETE",
      "payload": [
        "workoutId": workoutId,
        "exerciseIndex": exerciseIndex,
        "exerciseId": exerciseId,
        "setIndex": setIndex,
        "reps": reps,
        "weight": weight
      ]
    ]

    sendReliable(message, label: "SET_COMPLETE")
  }

  /// Notify iPhone that a workout was started from the Watch.
  func sendStartWorkout(workoutId: String) {
    let message: [String: Any] = [
      "type": "START_WORKOUT",
      "payload": [
        "workoutId": workoutId
      ]
    ]

    sendReliable(message, label: "START_WORKOUT")
  }

  /// Send FINISH_WORKOUT with RPE, start time, and completed exercises.
  /// Uses transferUserInfo for guaranteed delivery.
  func sendFinishWorkout(workoutId: String, rpe: Int, startedAt: Date, exercises: [[String: Any]]) {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

    let message: [String: Any] = [
      "type": "FINISH_WORKOUT",
      "payload": [
        "workoutId": workoutId,
        "rpe": rpe,
        "startedAt": formatter.string(from: startedAt),
        "exercises": exercises,
      ]
    ]

    print("[WatchSessionManager] 📤 Sending FINISH_WORKOUT for \(workoutId) with RPE \(rpe), \(exercises.count) exercises")

    guard let session = wcSession, session.activationState == .activated else {
      print("[WatchSessionManager] ❌ Session not activated for FINISH_WORKOUT")
      return
    }
    session.transferUserInfo(message)
    print("[WatchSessionManager] ✅ FINISH_WORKOUT queued via transferUserInfo for \(workoutId)")
  }

  func sendMessage(_ message: [String: Any]) {
    guard let session = wcSession, session.isReachable else {
      print("[WatchSessionManager] Cannot send message, session not reachable")
      return
    }

    session.sendMessage(message, replyHandler: nil, errorHandler: { error in
      print("[WatchSessionManager] Error sending message: \(error)")
    })
  }

  // MARK: - Reliable Send (sendMessage with transferUserInfo fallback)

  private func sendReliable(_ message: [String: Any], label: String) {
    guard let session = wcSession, session.activationState == .activated else {
      print("[WatchSessionManager] ❌ Session not activated for \(label)")
      return
    }

    if session.isReachable {
      session.sendMessage(message, replyHandler: { reply in
        print("[WatchSessionManager] ✅ \(label) acknowledged via sendMessage")
      }, errorHandler: { error in
        print("[WatchSessionManager] ⚠️ sendMessage failed for \(label), falling back to transferUserInfo: \(error.localizedDescription)")
        session.transferUserInfo(message)
      })
    } else {
      session.transferUserInfo(message)
      print("[WatchSessionManager] 📤 \(label) queued via transferUserInfo (iPhone not reachable)")
    }
  }
}

// MARK: - WCSessionDelegate

extension WatchSessionManager: WCSessionDelegate {
  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    if let error = error {
      print("[WatchSessionManager] Activation failed: \(error)")
    } else {
      print("[WatchSessionManager] Activation complete: \(activationState.rawValue)")
    }

    DispatchQueue.main.async {
      self.isConnected = activationState == .activated

      // Read any applicationContext that was already delivered before this session activated.
      // Without this, the Watch app shows "Aguardando" indefinitely because the
      // didReceiveApplicationContext delegate is only called for NEW contexts, not cached ones.
      if activationState == .activated {
        let cached = session.receivedApplicationContext
        if !cached.isEmpty {
          print("[WatchSessionManager] Loaded cached applicationContext on activation: \(cached.keys.sorted())")
          self.currentWorkout = cached
        } else {
          print("[WatchSessionManager] No cached applicationContext — waiting for iPhone to sync")
        }
      }
    }
  }

  func session(
    _ session: WCSession,
    didReceiveApplicationContext applicationContext: [String : Any]
  ) {
    print("[WatchSessionManager] Received application context: \(applicationContext.keys)")

    DispatchQueue.main.async {
      self.currentWorkout = applicationContext
    }
  }

  func session(
    _ session: WCSession,
    didReceiveMessage message: [String : Any]
  ) {
    print("[WatchSessionManager] Received message: \(message)")
    // Handle other message types if needed
  }

  func session(
    _ session: WCSession,
    didReceiveMessage message: [String : Any],
    replyHandler: @escaping ([String : Any]) -> Void
  ) {
    print("[WatchSessionManager] Received message with reply: \(message)")
    replyHandler(["status": "received"])
  }
}
