import Foundation
import WatchConnectivity
import Combine

/// Manages WatchConnectivity session for the Apple Watch app
class WatchSessionManager: NSObject, ObservableObject {
  @Published var currentWorkout: [String: Any]?
  @Published var programSnapshot: WatchProgramSnapshot?
  @Published var isConnected: Bool = false

  /// Callback invoked when SYNC_SUCCESS is received from iPhone.
  /// Set by KinevoWatchApp to forward acknowledgements to WorkoutExecutionStore.
  var onSyncSuccess: ((_ workoutId: String) -> Void)?
  var onRemoteFinish: ((_ workoutId: String) -> Void)?
  var onRemoteDiscard: ((_ workoutId: String) -> Void)?
  var onRemoteStartWorkout: ((_ workoutId: String) -> Void)?
  var onRemoteSetComplete: ((_ workoutId: String, _ exerciseId: String, _ setIndex: Int, _ reps: Int, _ weight: Double) -> Void)?
  var onProgramUpdated: ((_ snapshot: WatchProgramSnapshot) -> Void)?
  var onExerciseOrderUpdate: ((_ workoutId: String, _ exerciseIds: [String]) -> Void)?
  var onSessionSync: ((_ workoutId: String, _ sessionId: String) -> Void)?
  /// Fired when the WCSession finishes activating. Used to (re-)send any
  /// finish-pending workout once the transport is actually ready — closing the
  /// cold-launch window where sendReliable would otherwise silently drop (B-05).
  var onSessionActivated: (() -> Void)?

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
            "notes": ["Foco em controle hoje, sem pressa. Capricha no aquecimento de ombro antes de começar."],
            "exercises": [
              ["id": "ex1", "name": "Supino Reto com Barra", "muscleGroup": "Peito", "sets": 4, "reps": 10, "weight": 80.0, "restTime": 90, "targetReps": "8-12",
                "methodKey": "top_backoff", "methodLabel": "Top + backoff",
                "notes": "Escápulas retraídas e pés firmes no chão. Cadência 3-1-1 (desce em 3s). Se passar de 6 reps na série Top, sobe 2,5 kg na próxima semana. Qualquer dor no ombro, troca pelo supino com halteres.",
                "setDetails": [
                  ["setNumber": 1, "setType": "warmup", "setTypeLabel": "Aquecimento", "repsTarget": "10", "restSeconds": 60, "weightTargetKg": 40.0],
                  ["setNumber": 2, "setType": "top", "setTypeLabel": "Top", "repsTarget": "5", "restSeconds": 120, "weightTargetKg": 95.0, "notes": "Série pesada — pode pedir ajuda na última repetição."],
                  ["setNumber": 3, "setType": "backoff", "setTypeLabel": "Backoff", "repsTarget": "8-10", "restSeconds": 90, "weightTargetKg": 75.0],
                  ["setNumber": 4, "setType": "backoff", "setTypeLabel": "Backoff", "repsTarget": "8-10", "restSeconds": 90, "weightTargetKg": 75.0],
                ]],
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
  /// Uses sendReliable (sendMessage first, transferUserInfo fallback) for immediate delivery
  /// when iPhone is reachable — transferUserInfo alone may not wake the JS runtime.
  func sendFinishWorkout(workoutId: String, rpe: Int, startedAt: Date, exercises: [[String: Any]], cardio: [[String: Any]] = [], sessionId: String? = nil, isResend: Bool = false) {
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
    if let sessionId {
        payload["sessionId"] = sessionId
    }
    if isResend {
        // Tells the iPhone this is a reconciliation re-send (not a fresh finish),
        // so it saves + ACKs silently without navigating the user to home.
        payload["isResend"] = true
    }

    let message: [String: Any] = [
      "type": "FINISH_WORKOUT",
      "payload": payload
    ]

    print("[WatchSessionManager] 📤 Sending FINISH_WORKOUT for \(workoutId) with RPE \(rpe), \(exercises.count) exercises, \(cardio.count) cardio")
    sendReliable(message, label: "FINISH_WORKOUT")
  }

  /// Fase 13 — Envia agregados de HR + calorias do Apple Watch ao iPhone via
  /// transferUserInfo (queued/guaranteed delivery). Chamado pós-FINISH_WORKOUT.
  /// `samples` é o payload retornado por HealthKitManager.exportHealthSamples().
  func sendHealthSamples(workoutId: String, samples: [String: Any], sessionId: String? = nil) {
    var payload = samples
    payload["workoutId"] = workoutId
    if let sessionId {
        payload["sessionId"] = sessionId
    }

    let message: [String: Any] = [
      "type": "WORKOUT_HEALTH_SAMPLES",
      "payload": payload
    ]

    guard let session = wcSession, session.activationState == .activated else {
      print("[WatchSessionManager] ❌ Session not activated for WORKOUT_HEALTH_SAMPLES")
      return
    }

    // Sempre transferUserInfo: tolera iPhone offline, entrega quando reconecta.
    session.transferUserInfo(message)
    print("[WatchSessionManager] 📤 WORKOUT_HEALTH_SAMPLES queued via transferUserInfo for \(workoutId)")
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

        // Transport is ready — re-send any finish-pending workout that never got
        // acknowledged (survives the iPhone dropping the buffered FINISH event).
        self.onSessionActivated?()
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
    case 2...:
      // v2+ program envelope. Forward-compatible: an unknown newer schema is treated
      // as v2 (program-based) instead of the legacy v1 path, which would clear the program.
      if let hasProgram = dict["hasProgram"] as? Bool, hasProgram {
        programSnapshot = WatchProgramSnapshot.parse(from: dict)
        if let snapshot = programSnapshot {
          print("[WatchSessionManager] Parsed v2 program: \(snapshot.programName) — \(snapshot.workouts.count) workouts")
          onProgramUpdated?(snapshot)
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

    case "SESSION_SYNC":
      guard let payload = message["payload"] as? [String: Any],
            let workoutId = payload["workoutId"] as? String,
            let sessionId = payload["sessionId"] as? String
      else {
        print("[WatchSessionManager] SESSION_SYNC missing workoutId/sessionId")
        return
      }
      print("[WatchSessionManager] SESSION_SYNC for \(workoutId): \(sessionId)")
      DispatchQueue.main.async {
        self.onSessionSync?(workoutId, sessionId)
      }

    case "START_WORKOUT_FROM_PHONE":
      guard let payload = message["payload"] as? [String: Any],
            let workoutId = payload["workoutId"] as? String
      else {
        print("[WatchSessionManager] START_WORKOUT_FROM_PHONE received but missing workoutId")
        return
      }

      print("[WatchSessionManager] START_WORKOUT_FROM_PHONE for workoutId: \(workoutId)")
      DispatchQueue.main.async {
        self.onRemoteStartWorkout?(workoutId)
      }

    case "WORKOUT_FINISHED_FROM_PHONE":
      guard let payload = message["payload"] as? [String: Any],
            let workoutId = payload["workoutId"] as? String
      else {
        print("[WatchSessionManager] WORKOUT_FINISHED_FROM_PHONE received but missing workoutId")
        return
      }

      print("[WatchSessionManager] WORKOUT_FINISHED_FROM_PHONE for workoutId: \(workoutId)")
      DispatchQueue.main.async {
        self.onRemoteFinish?(workoutId)
      }

    case "WORKOUT_DISCARDED_FROM_PHONE":
      guard let payload = message["payload"] as? [String: Any],
            let workoutId = payload["workoutId"] as? String
      else {
        print("[WatchSessionManager] WORKOUT_DISCARDED_FROM_PHONE missing workoutId")
        return
      }

      print("[WatchSessionManager] WORKOUT_DISCARDED_FROM_PHONE for workoutId: \(workoutId)")
      DispatchQueue.main.async {
        self.onRemoteDiscard?(workoutId)
      }

    case "SET_COMPLETE_FROM_PHONE":
      guard let payload = message["payload"] as? [String: Any],
            let workoutId = payload["workoutId"] as? String,
            let exerciseId = payload["exerciseId"] as? String,
            let setIndex = (payload["setIndex"] as? NSNumber)?.intValue
      else {
        print("[WatchSessionManager] SET_COMPLETE_FROM_PHONE missing fields")
        return
      }
      let reps = (payload["reps"] as? NSNumber)?.intValue ?? 0
      let weight = (payload["weight"] as? NSNumber)?.doubleValue ?? 0
      DispatchQueue.main.async {
        self.onRemoteSetComplete?(workoutId, exerciseId, setIndex, reps, weight)
      }

    case "UPDATE_EXERCISE_ORDER":
      guard let payload = message["payload"] as? [String: Any],
            let workoutId = payload["workoutId"] as? String
      else {
        print("[WatchSessionManager] UPDATE_EXERCISE_ORDER — failed to parse payload or workoutId")
        return
      }

      // Robust array parsing — handle Obj-C bridge types
      let exerciseIds: [String]
      if let ids = payload["exerciseIds"] as? [String] {
        exerciseIds = ids
      } else if let rawArray = payload["exerciseIds"] as? [Any] {
        exerciseIds = rawArray.compactMap { $0 as? String }
      } else {
        print("[WatchSessionManager] UPDATE_EXERCISE_ORDER — exerciseIds not parseable")
        return
      }

      guard !exerciseIds.isEmpty else {
        print("[WatchSessionManager] UPDATE_EXERCISE_ORDER — exerciseIds is empty")
        return
      }

      print("[WatchSessionManager] UPDATE_EXERCISE_ORDER for workoutId: \(workoutId) — \(exerciseIds.count) exercises")
      DispatchQueue.main.async {
        self.onExerciseOrderUpdate?(workoutId, exerciseIds)
      }

    default:
      break
    }
  }
}
