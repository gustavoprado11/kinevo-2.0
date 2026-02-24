import Foundation
import ExpoModulesCore
import WatchConnectivity

/**
 Payload contract sent to watchOS via `updateApplicationContext`:

 {
   "schemaVersion": 1,
   "syncedAt": "2026-02-24T20:10:30Z",
   "hasWorkout": true | false,
   "workout": { ...WatchWorkoutPayload } // present only when hasWorkout == true
 }
 */

// MARK: - Session Delegate (NSObject is required for WCSessionDelegate)

private class SessionDelegate: NSObject, WCSessionDelegate {
  weak var module: WatchConnectivityModule?

  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    module?.handleSessionActivation(activationState: activationState, error: error)

    if let error = error {
      print("[WatchConnectivity] Activation failed: \(error)")
    } else {
      print("[WatchConnectivity] Activation complete: \(activationState.rawValue)")
    }
  }

  func sessionDidBecomeInactive(_ session: WCSession) {
    print("[WatchConnectivity] Session became inactive")
  }

  func sessionDidDeactivate(_ session: WCSession) {
    print("[WatchConnectivity] Session deactivated, reactivating...")
    session.activate()
  }

  func session(
    _ session: WCSession,
    didReceiveMessage message: [String : Any]
  ) {
    print("[WatchConnectivity] Received message from watch: \(message)")

    DispatchQueue.main.async {
      self.module?.emitWatchMessageEvent(message)
    }
  }

  func session(
    _ session: WCSession,
    didReceiveMessage message: [String : Any],
    replyHandler: @escaping ([String : Any]) -> Void
  ) {
    print("[WatchConnectivity] Received message from watch (with reply): \(message)")

    DispatchQueue.main.async {
      self.module?.emitWatchMessageEvent(message)
    }

    replyHandler(["status": "received"])
  }

  func session(
    _ session: WCSession,
    didReceiveUserInfo userInfo: [String : Any]
  ) {
    print("[WatchConnectivity] Received userInfo from watch: \(userInfo)")

    DispatchQueue.main.async {
      self.module?.emitWatchMessageEvent(userInfo)
    }
  }
}

// MARK: - Expo Module

public class WatchConnectivityModule: Module {
  private var wcSession: WCSession?
  private lazy var sessionDelegate = SessionDelegate()
  private let isoFormatter = ISO8601DateFormatter()
  private var pendingApplicationContext: [String: Any]?

  public func definition() -> ModuleDefinition {
    Name("WatchConnectivityModule")

    Events("onWatchMessage")

    OnCreate {
      self.sessionDelegate.module = self
      self.setupWCSession()
    }

    Function("syncWorkoutToWatch") { (workoutJSON: String) in
      self.syncWorkoutToWatch(workoutJSON: workoutJSON)
    }

    // Backward-compatible alias while React Native migrates callsites.
    Function("sendWorkoutState") { (payload: [String: Any]) in
      self.syncWorkoutToWatch(payload: payload)
    }

    AsyncFunction("sendMessage") { (message: [String: Any], promise: Promise) in
      self.sendMessageToWatch(message: message, promise: promise)
    }

    Function("isWatchReachable") { () -> Bool in
      return self.wcSession?.isReachable ?? false
    }
  }

  // MARK: - Setup

  private func setupWCSession() {
    guard WCSession.isSupported() else {
      NSLog("[WatchConnectivity] WCSession not supported on this device")
      return
    }

    wcSession = WCSession.default
    wcSession?.delegate = sessionDelegate
    wcSession?.activate()

    NSLog("[WatchConnectivity] WCSession activated")
  }

  // MARK: - Send to Watch

  private func syncWorkoutToWatch(workoutJSON: String) {
    guard let payloadData = workoutJSON.data(using: .utf8) else {
      NSLog("[WatchConnectivity] ❌ Invalid workout JSON encoding")
      return
    }

    do {
      let jsonObject = try JSONSerialization.jsonObject(with: payloadData, options: [])

      if jsonObject is NSNull {
        self.sendApplicationContext(context: self.makeEnvelope(with: nil))
        return
      }

      guard let workout = jsonObject as? [String: Any] else {
        NSLog("[WatchConnectivity] ❌ workoutJSON root must be an object or null")
        return
      }

      self.sendApplicationContext(context: self.makeEnvelope(with: workout))
    } catch {
      NSLog("[WatchConnectivity] ❌ Failed to parse workoutJSON: \(error)")
    }
  }

  private func syncWorkoutToWatch(payload: [String: Any]) {
    self.sendApplicationContext(context: self.makeEnvelope(with: payload))
  }

  private func makeEnvelope(with workout: [String: Any]?) -> [String: Any] {
    var envelope: [String: Any] = [
      "schemaVersion": 1,
      "syncedAt": isoFormatter.string(from: Date()),
      "hasWorkout": workout != nil
    ]

    if let workout {
      envelope["workout"] = workout
    }

    return envelope
  }

  private func sendApplicationContext(context: [String: Any]) {
    NSLog("[WatchConnectivity] syncWorkoutToWatch called with context keys: \(context.keys)")

    // Ensure session is set up (in case OnCreate wasn't called).
    if wcSession == nil {
      NSLog("[WatchConnectivity] Session was nil, initializing now...")
      setupWCSession()
    }

    guard let session = wcSession, session.activationState == .activated else {
      pendingApplicationContext = context
      NSLog("[WatchConnectivity] Session not activated yet. Context queued. State: \(wcSession?.activationState.rawValue ?? -1)")
      return
    }

    do {
      try session.updateApplicationContext(context)
      pendingApplicationContext = nil
      NSLog("[WatchConnectivity] ✅ Sent application context to watch")
    } catch {
      NSLog("[WatchConnectivity] ❌ Error sending application context: \(error)")
    }
  }

  fileprivate func handleSessionActivation(
    activationState: WCSessionActivationState,
    error: Error?
  ) {
    guard error == nil else { return }
    guard activationState == .activated else { return }
    guard let pendingContext = pendingApplicationContext else { return }

    do {
      try wcSession?.updateApplicationContext(pendingContext)
      pendingApplicationContext = nil
      NSLog("[WatchConnectivity] ✅ Flushed queued application context after activation")
    } catch {
      NSLog("[WatchConnectivity] ❌ Failed to flush queued context: \(error)")
    }
  }

  private func sendMessageToWatch(message: [String: Any], promise: Promise) {
    guard let session = wcSession, session.isReachable else {
      promise.reject("WATCH_UNREACHABLE", "Apple Watch is not reachable")
      return
    }

    session.sendMessage(message, replyHandler: { reply in
      promise.resolve(reply)
    }, errorHandler: { error in
      promise.reject("SEND_FAILED", error.localizedDescription)
    })
  }

  fileprivate func emitWatchMessageEvent(_ message: [String: Any]) {
    sendEvent("onWatchMessage", [
      "type": message["type"] ?? "unknown",
      "payload": message["payload"] ?? [:]
    ])
  }
}
