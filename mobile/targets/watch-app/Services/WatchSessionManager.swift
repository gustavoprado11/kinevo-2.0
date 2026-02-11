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

  func sendMessage(_ message: [String: Any]) {
    guard let session = wcSession, session.isReachable else {
      print("[WatchSessionManager] Cannot send message, session not reachable")
      return
    }

    session.sendMessage(message, replyHandler: nil, errorHandler: { error in
      print("[WatchSessionManager] Error sending message: \(error)")
    })
  }
}

// MARK: - WCSessionDelegate

extension WatchSessionManager: WCSessionDelegate {
  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    DispatchQueue.main.async {
      self.isConnected = activationState == .activated
    }

    if let error = error {
      print("[WatchSessionManager] Activation failed: \(error)")
    } else {
      print("[WatchSessionManager] Activation complete: \(activationState.rawValue)")
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
