import Foundation
import WatchConnectivity
import Combine

/// Manages WatchConnectivity session for the Apple Watch app
class WatchSessionManager: NSObject, ObservableObject {
  static let shared = WatchSessionManager()

  @Published var currentWorkout: [String: Any]?
  @Published var programSnapshot: WatchProgramSnapshot?
  @Published var isConnected: Bool = false

  /// Callback invoked when SYNC_SUCCESS is received from iPhone.
  /// Set by KinevoWatchApp to forward acknowledgements to WorkoutExecutionStore.
  var onSyncSuccess: ((_ workoutId: String) -> Void)?

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
    print("[WatchSessionManager] Loading mock data for simulator")
    let mockContext: [String: Any] = [
      "schemaVersion": 2,
      "syncedAt": ISO8601DateFormatter().string(from: Date()),
      "hasProgram": true,
      "program": [
        "schemaVersion": 2,
        "programId": "mock-program",
        "programName": "Hipertrofia A/B/C",
        "currentWeek": 3,
        "totalWeeks": 8,
        "scheduleMode": "scheduled",
        "workouts": [
          [
            "workoutId": "mock-w1",
            "workoutName": "Treino A — Peito e Tríceps",
            "orderIndex": 0,
            "scheduledDays": [1, 3, 5],
            "isCompletedToday": false,
            "lastCompletedAt": nil as Any?,
            "exercises": [
              ["id": "ex1", "name": "Supino Reto com Barra", "muscleGroup": "Peito", "sets": 4, "reps": 10, "weight": 80.0, "restTime": 90, "targetReps": "8-12"],
              ["id": "ex2", "name": "Supino Inclinado Halteres", "muscleGroup": "Peito", "sets": 3, "reps": 12, "weight": 28.0, "restTime": 60, "targetReps": "10-12"],
              ["id": "ex3", "name": "Crucifixo Máquina", "muscleGroup": "Peito", "sets": 3, "reps": 12, "weight": 40.0, "restTime": 60, "targetReps": "12"],
              ["id": "ex4", "name": "Tríceps Pulley", "muscleGroup": "Tríceps", "sets": 3, "reps": 12, "weight": 25.0, "restTime": 60, "targetReps": "10-12"],
              ["id": "ex5", "name": "Tríceps Testa", "muscleGroup": "Tríceps", "sets": 3, "reps": 10, "weight": 18.0, "restTime": 60, "targetReps": "10"],
            ]
          ] as [String: Any],
          [
            "workoutId": "mock-w2",
            "workoutName": "Treino B — Costas e Bíceps",
            "orderIndex": 1,
            "scheduledDays": [2, 4],
            "isCompletedToday": true,
            "lastCompletedAt": ISO8601DateFormatter().string(from: Date()),
            "exercises": [
              ["id": "ex6", "name": "Puxada Supinada", "muscleGroup": "Costas", "sets": 4, "reps": 10, "weight": 65.0, "restTime": 90, "targetReps": "8-12"],
              ["id": "ex7", "name": "Remada Baixa Triângulo", "muscleGroup": "Costas", "sets": 3, "reps": 10, "weight": 55.0, "restTime": 60, "targetReps": "10"],
              ["id": "ex8", "name": "Puxada Aberta", "muscleGroup": "Costas", "sets": 3, "reps": 10, "weight": 50.0, "restTime": 60, "targetReps": "10"],
              ["id": "ex9", "name": "Rosca Alternada", "muscleGroup": "Bíceps", "sets": 3, "reps": 12, "weight": 14.0, "restTime": 60, "targetReps": "12"],
              ["id": "ex10", "name": "Rosca Scott Máquina", "muscleGroup": "Bíceps", "sets": 3, "reps": 10, "weight": 30.0, "restTime": 60, "targetReps": "10"],
            ]
          ] as [String: Any],
          [
            "workoutId": "mock-w3",
            "workoutName": "Treino C — Pernas e Ombros",
            "orderIndex": 2,
            "scheduledDays": [6],
            "isCompletedToday": false,
            "lastCompletedAt": nil as Any?,
            "exercises": [
              ["id": "ex11", "name": "Agachamento Smith", "muscleGroup": "Quadríceps", "sets": 4, "reps": 10, "weight": 60.0, "restTime": 120, "targetReps": "8-10"],
              ["id": "ex12", "name": "Leg Press 45°", "muscleGroup": "Quadríceps", "sets": 3, "reps": 12, "weight": 120.0, "restTime": 90, "targetReps": "12"],
              ["id": "ex13", "name": "Cadeira Extensora", "muscleGroup": "Quadríceps", "sets": 3, "reps": 12, "weight": 45.0, "restTime": 60, "targetReps": "12"],
              ["id": "ex14", "name": "Mesa Flexora", "muscleGroup": "Posterior", "sets": 3, "reps": 12, "weight": 35.0, "restTime": 60, "targetReps": "12"],
              ["id": "ex15", "name": "Elevação Lateral", "muscleGroup": "Ombros", "sets": 3, "reps": 15, "weight": 10.0, "restTime": 60, "targetReps": "12-15"],
              ["id": "ex16", "name": "Desenvolvimento Máquina", "muscleGroup": "Ombros", "sets": 3, "reps": 10, "weight": 30.0, "restTime": 60, "targetReps": "10"],
            ],
            "cardioItems": [
              [
                "id": "cardio1",
                "orderIndex": 6,
                "config": [
                  "mode": "continuous",
                  "equipment": "treadmill",
                  "equipmentLabel": "Esteira",
                  "objective": "time",
                  "durationMinutes": 20,
                  "intensity": "Moderada (65-75% FCmáx)"
                ]
              ],
              [
                "id": "cardio2",
                "orderIndex": 7,
                "config": [
                  "mode": "interval",
                  "equipment": "bike",
                  "equipmentLabel": "Bicicleta",
                  "workSeconds": 30,
                  "restSeconds": 15,
                  "rounds": 8
                ]
              ]
            ]
          ] as [String: Any],
        ]
      ] as [String: Any]
    ]

    self.currentWorkout = mockContext
    parseApplicationContext(mockContext)
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

  /// Send FINISH_WORKOUT with RPE, start time, completed exercises, and cardio results.
  /// Uses transferUserInfo for guaranteed delivery.
  func sendFinishWorkout(workoutId: String, rpe: Int, startedAt: Date, exercises: [[String: Any]], cardio: [[String: Any]] = []) {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

    var payload: [String: Any] = [
        "workoutId": workoutId,
        "rpe": rpe,
        "startedAt": formatter.string(from: startedAt),
        "exercises": exercises,
    ]
    if !cardio.isEmpty {
        payload["cardio"] = cardio
    }

    let message: [String: Any] = [
      "type": "FINISH_WORKOUT",
      "payload": payload
    ]

    print("[WatchSessionManager] 📤 Sending FINISH_WORKOUT for \(workoutId) with RPE \(rpe), \(exercises.count) exercises, \(cardio.count) cardio")

    guard let session = wcSession, session.activationState == .activated else {
      print("[WatchSessionManager] ❌ Session not activated for FINISH_WORKOUT")
      return
    }
    session.transferUserInfo(message)
    print("[WatchSessionManager] ✅ FINISH_WORKOUT queued via transferUserInfo for \(workoutId)")
  }

  /// Notify iPhone that a cardio item was completed on the Watch.
  func sendCardioCompletion(workoutId: String, itemId: String, elapsedSeconds: Int) {
    let message: [String: Any] = [
      "type": "CARDIO_COMPLETE",
      "payload": [
        "workoutId": workoutId,
        "itemId": itemId,
        "elapsedSeconds": elapsedSeconds
      ]
    ]
    sendReliable(message, label: "CARDIO_COMPLETE")
  }

  /// Notify iPhone that the user abandoned a workout from the Watch.
  func sendDiscardWorkout(workoutId: String) {
    let message: [String: Any] = [
      "type": "DISCARD_WORKOUT",
      "payload": [
        "workoutId": workoutId
      ]
    ]
    sendReliable(message, label: "DISCARD_WORKOUT")
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
          self.parseApplicationContext(cached)
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
      self.parseApplicationContext(applicationContext)
    }
  }

  // MARK: - Application Context Parsing

  private func parseApplicationContext(_ dict: [String: Any]) {
    let version = dict["schemaVersion"] as? Int ?? 1

    switch version {
    case 2:
      if let hasProgram = dict["hasProgram"] as? Bool, hasProgram {
        programSnapshot = WatchProgramSnapshot.parse(from: dict)
        if let snapshot = programSnapshot {
          print("[WatchSessionManager] Parsed v2 program: \(snapshot.programName) — \(snapshot.workouts.count) workouts")
        } else {
          print("[WatchSessionManager] Failed to parse v2 program payload")
          programSnapshot = nil
        }
      } else {
        print("[WatchSessionManager] v2 context with hasProgram=false — clearing program")
        programSnapshot = nil
      }

    default:
      // Legacy v1 — wrap single workout into synthetic program
      if let synthetic = WatchProgramSnapshot.fromLegacy(dict) {
        programSnapshot = synthetic
        print("[WatchSessionManager] Converted v1 workout to synthetic program — 1 workout")
      } else {
        programSnapshot = nil
        print("[WatchSessionManager] v1 context with no workout — clearing program")
      }
    }
  }

  func session(
    _ session: WCSession,
    didReceiveMessage message: [String : Any]
  ) {
    let type = message["type"] as? String ?? "unknown"
    print("[WatchSessionManager] Received message — type: \(type)")
    handleIncomingMessage(message)
  }

  func session(
    _ session: WCSession,
    didReceiveMessage message: [String : Any],
    replyHandler: @escaping ([String : Any]) -> Void
  ) {
    let type = message["type"] as? String ?? "unknown"
    print("[WatchSessionManager] Received message (with reply) — type: \(type)")
    handleIncomingMessage(message)
    replyHandler(["status": "received"])
  }

  func session(
    _ session: WCSession,
    didReceiveUserInfo userInfo: [String : Any]
  ) {
    let type = userInfo["type"] as? String ?? "unknown"
    print("[WatchSessionManager] Received userInfo — type: \(type)")
    handleIncomingMessage(userInfo)
  }

  // MARK: - Message Routing

  private func handleIncomingMessage(_ message: [String: Any]) {
    guard let type = message["type"] as? String else { return }

    switch type {
    case "SYNC_SUCCESS":
      guard let payload = message["payload"] as? [String: Any],
            let workoutId = payload["workoutId"] as? String
      else {
        print("[WatchSessionManager] SYNC_SUCCESS received but missing workoutId in payload")
        return
      }

      print("[WatchSessionManager] SYNC_SUCCESS for workoutId: \(workoutId)")
      DispatchQueue.main.async {
        self.onSyncSuccess?(workoutId)
      }

    default:
      break
    }
  }
}
