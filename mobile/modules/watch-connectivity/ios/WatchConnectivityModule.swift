import ExpoModulesCore
import WatchConnectivity

// MARK: - Session Delegate (NSObject is required for WCSessionDelegate)

private class SessionDelegate: NSObject, WCSessionDelegate {
  weak var module: WatchConnectivityModule?

  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
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
      self.module?.sendEvent("onWatchMessage", [
        "type": message["type"] ?? "unknown",
        "payload": message["payload"] ?? [:]
      ])
    }
  }

  func session(
    _ session: WCSession,
    didReceiveMessage message: [String : Any],
    replyHandler: @escaping ([String : Any]) -> Void
  ) {
    print("[WatchConnectivity] Received message from watch (with reply): \(message)")

    DispatchQueue.main.async {
      self.module?.sendEvent("onWatchMessage", [
        "type": message["type"] ?? "unknown",
        "payload": message["payload"] ?? [:]
      ])
    }

    replyHandler(["status": "received"])
  }
}

// MARK: - Expo Module

public class WatchConnectivityModule: Module {
  private var wcSession: WCSession?
  private lazy var sessionDelegate = SessionDelegate()

  public func definition() -> ModuleDefinition {
    Name("WatchConnectivityModule")

    Events("onWatchMessage")

    OnCreate {
      self.sessionDelegate.module = self
      self.setupWCSession()
    }

    Function("sendWorkoutState") { (payload: [String: Any]) in
      self.sendWorkoutStateToWatch(payload: payload)
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

  private func sendWorkoutStateToWatch(payload: [String: Any]) {
    NSLog("[WatchConnectivity] sendWorkoutStateToWatch called with \(payload.count) keys")

    // Ensure session is set up (in case OnCreate wasn't called)
    if wcSession == nil {
      NSLog("[WatchConnectivity] Session was nil, initializing now...")
      setupWCSession()
    }

    guard let session = wcSession, session.activationState == .activated else {
      NSLog("[WatchConnectivity] Session not activated, cannot send state. State: \(wcSession?.activationState.rawValue ?? -1)")
      return
    }

    do {
      try session.updateApplicationContext(payload)
      NSLog("[WatchConnectivity] ✅ Sent workout state to watch: \(payload.keys)")
    } catch {
      NSLog("[WatchConnectivity] ❌ Error sending application context: \(error)")
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
}
