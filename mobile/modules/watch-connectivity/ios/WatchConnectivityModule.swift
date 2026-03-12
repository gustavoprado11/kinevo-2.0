import Foundation
import ExpoModulesCore
import WatchConnectivity

// ═══════════════════════════════════════════════════════════════════════════════
// MARK: - DebugLogger (persists logs in UserDefaults for in-app viewing)
// ═══════════════════════════════════════════════════════════════════════════════

@objc public class DebugLogger: NSObject {
  @objc public static let shared = DebugLogger()

  private let key = "kinevo_debug_logs"
  private let maxLogs = 200
  private let queue = DispatchQueue(label: "com.kinevo.debuglogger")

  private override init() {
    super.init()
  }

  @objc public func log(_ message: String) {
    queue.async {
      let formatter = DateFormatter()
      formatter.dateFormat = "HH:mm:ss.SSS"
      let timestamp = formatter.string(from: Date())
      let entry = "[\(timestamp)] \(message)"

      var logs = UserDefaults.standard.stringArray(forKey: self.key) ?? []
      logs.append(entry)

      if logs.count > self.maxLogs {
        logs = Array(logs.suffix(self.maxLogs))
      }

      UserDefaults.standard.set(logs, forKey: self.key)
      NSLog("[DebugLog] %@", message)
    }
  }

  @objc public func getLogs() -> [String] {
    return queue.sync {
      return UserDefaults.standard.stringArray(forKey: key) ?? []
    }
  }

  @objc public func clearLogs() {
    queue.async {
      UserDefaults.standard.removeObject(forKey: self.key)
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MARK: - WCSessionRelay (Singleton — activated in AppDelegate)
// ═══════════════════════════════════════════════════════════════════════════════

/// Activates WCSession at app launch (in AppDelegate.didFinishLaunching)
/// and persists incoming Watch events to UserDefaults until the Expo
/// module is ready to consume them.
///
/// Design: PERSIST FIRST, FORWARD SECOND.
/// Every incoming message is written to UserDefaults before any attempt
/// to forward it. This guarantees events survive app kills, OOM, and
/// delegate-swap race conditions. In the worst case an event is processed
/// twice — safe because all downstream DB operations use upsert.
public final class WCSessionRelay: NSObject, WCSessionDelegate {
  public static let shared = WCSessionRelay()

  private let storageKey = "WCSessionRelay_pendingEvents"
  private var currentForwarder: (([String: Any]) -> Void)?
  private let queue = DispatchQueue(label: "com.kinevo.wcsession-relay")

  private override init() {
    super.init()
  }

  // MARK: Activate (called from AppDelegate.didFinishLaunching)

  public func activate() {
    guard WCSession.isSupported() else {
      NSLog("[WCSessionRelay] WCSession not supported on this device")
      DebugLogger.shared.log("[WCSessionRelay] WCSession not supported on this device")
      return
    }
    WCSession.default.delegate = self
    WCSession.default.activate()
    NSLog("[WCSessionRelay] WCSession activated in AppDelegate")

    let session = WCSession.default
    DebugLogger.shared.log("[WCSessionRelay] WCSession activated — isPaired: \(session.isPaired), isWatchAppInstalled: \(session.isWatchAppInstalled)")
  }

  // MARK: Expo Module Integration

  public func setForwarder(_ forwarder: @escaping ([String: Any]) -> Void) {
    queue.sync { currentForwarder = forwarder }
    NSLog("[WCSessionRelay] Forwarder registered")
    DebugLogger.shared.log("[WCSessionRelay] Forwarder registered")
  }

  public func consumePendingEvents() -> [[String: Any]] {
    return queue.sync {
      let events = loadEvents()
      if !events.isEmpty {
        clearEvents()
        NSLog("[WCSessionRelay] Consumed \(events.count) pending event(s)")
        DebugLogger.shared.log("[WCSessionRelay] consumePendingEvents — count: \(events.count)")
      }
      return events
    }
  }

  // MARK: WCSessionDelegate — Activation

  public func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    if let error = error {
      NSLog("[WCSessionRelay] Activation failed: \(error.localizedDescription)")
      DebugLogger.shared.log("[WCSessionRelay] ❌ Activation failed: \(error.localizedDescription)")
    } else {
      NSLog("[WCSessionRelay] Activation complete — state: \(activationState.rawValue)")
      DebugLogger.shared.log("[WCSessionRelay] ✅ Activation complete — state: \(activationState.rawValue), isPaired: \(session.isPaired), isWatchAppInstalled: \(session.isWatchAppInstalled)")
    }
  }

  public func sessionDidBecomeInactive(_ session: WCSession) {
    NSLog("[WCSessionRelay] Session became inactive")
    DebugLogger.shared.log("[WCSessionRelay] Session became inactive")
  }

  public func sessionDidDeactivate(_ session: WCSession) {
    NSLog("[WCSessionRelay] Session deactivated — reactivating")
    DebugLogger.shared.log("[WCSessionRelay] Session deactivated — reactivating")
    session.activate()
  }

  // MARK: WCSessionDelegate — Receive Messages

  public func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    let type = (message["type"] as? String) ?? "unknown"
    NSLog("[WCSessionRelay] 📥 didReceiveMessage — type: \(type)")
    DebugLogger.shared.log("[WCSessionRelay] 📥 didReceiveMessage — type: \(type)")
    handleIncoming(message)
  }

  public func session(
    _ session: WCSession,
    didReceiveMessage message: [String: Any],
    replyHandler: @escaping ([String: Any]) -> Void
  ) {
    let type = (message["type"] as? String) ?? "unknown"
    NSLog("[WCSessionRelay] 📥 didReceiveMessage(reply) — type: \(type)")
    DebugLogger.shared.log("[WCSessionRelay] 📥 didReceiveMessage(reply) — type: \(type)")
    handleIncoming(message)
    replyHandler(["status": "received"])
  }

  public func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any]) {
    let type = (userInfo["type"] as? String) ?? "unknown"
    NSLog("[WCSessionRelay] 📥 didReceiveUserInfo — type: \(type), keys: \(userInfo.keys.sorted().joined(separator: ", "))")
    DebugLogger.shared.log("[WCSessionRelay] 📥 didReceiveUserInfo — type: \(type), keys: \(userInfo.keys.sorted().joined(separator: ", "))")
    handleIncoming(userInfo)
  }

  // MARK: Core — Persist FIRST, Forward SECOND

  private func handleIncoming(_ message: [String: Any]) {
    let type = message["type"] as? String ?? "unknown"
    NSLog("[WCSessionRelay] 📩 Incoming event: \(type)")

    // 1. PERSIST to UserDefaults immediately (before anything else)
    queue.sync { appendEvent(message) }

    // 2. TRY to forward to Expo module (best-effort, non-blocking)
    let forwarder: (([String: Any]) -> Void)? = queue.sync { currentForwarder }
    if let forwarder = forwarder {
      DispatchQueue.main.async { forwarder(message) }
      NSLog("[WCSessionRelay] ✅ Forwarded \(type) to Expo module")
      DebugLogger.shared.log("[WCSessionRelay] ✅ Forwarded \(type) to Expo module")
    } else {
      NSLog("[WCSessionRelay] 📦 No forwarder yet — \(type) persisted for later consumption")
      DebugLogger.shared.log("[WCSessionRelay] 📦 No forwarder yet — \(type) persisted for later consumption")
    }
  }

  // MARK: UserDefaults Persistence

  private func loadEvents() -> [[String: Any]] {
    guard let data = UserDefaults.standard.data(forKey: storageKey),
          let array = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]]
    else { return [] }
    return array
  }

  private func appendEvent(_ event: [String: Any]) {
    var events = loadEvents()
    events.append(event)
    if let data = try? JSONSerialization.data(withJSONObject: events) {
      UserDefaults.standard.set(data, forKey: storageKey)
    }
  }

  private func clearEvents() {
    UserDefaults.standard.removeObject(forKey: storageKey)
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MARK: - Session Delegate (post-claim — handles messages after Expo module loads)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 Payload contract sent to watchOS via `updateApplicationContext`:

 {
   "schemaVersion": 1,
   "syncedAt": "2026-02-24T20:10:30Z",
   "hasWorkout": true | false,
   "workout": { ...WatchWorkoutPayload } // present only when hasWorkout == true
 }
 */

private class SessionDelegate: NSObject, WCSessionDelegate {
  weak var module: WatchConnectivityModule?

  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    module?.handleSessionActivation(activationState: activationState, error: error)

    if let error = error {
      NSLog("[WatchConnectivity] Activation failed: \(error)")
      DebugLogger.shared.log("[SessionDelegate] ❌ Activation failed: \(error.localizedDescription)")
    } else {
      NSLog("[WatchConnectivity] Activation complete: \(activationState.rawValue)")
      DebugLogger.shared.log("[SessionDelegate] ✅ Activation complete — state: \(activationState.rawValue)")
    }
  }

  func sessionDidBecomeInactive(_ session: WCSession) {
    NSLog("[WatchConnectivity] Session became inactive")
    DebugLogger.shared.log("[SessionDelegate] Session became inactive")
  }

  func sessionDidDeactivate(_ session: WCSession) {
    NSLog("[WatchConnectivity] Session deactivated, reactivating...")
    DebugLogger.shared.log("[SessionDelegate] Session deactivated — reactivating")
    session.activate()
  }

  func session(
    _ session: WCSession,
    didReceiveMessage message: [String : Any]
  ) {
    let type = (message["type"] as? String) ?? "unknown"
    NSLog("[WatchConnectivity] 📩 Received sendMessage from watch — type: \(type)")
    DebugLogger.shared.log("[SessionDelegate] 📩 didReceiveMessage — type: \(type)")

    DispatchQueue.main.async {
      if let module = self.module {
        module.emitWatchMessageEvent(message)
      } else {
        NSLog("[WatchConnectivity] ⚠️ SessionDelegate.module is NIL — sendMessage event LOST: \(type)")
        DebugLogger.shared.log("[SessionDelegate] ⚠️ module is NIL — sendMessage event LOST: \(type)")
      }
    }
  }

  func session(
    _ session: WCSession,
    didReceiveMessage message: [String : Any],
    replyHandler: @escaping ([String : Any]) -> Void
  ) {
    let type = (message["type"] as? String) ?? "unknown"
    NSLog("[WatchConnectivity] 📩 Received sendMessage (with reply) from watch — type: \(type)")
    DebugLogger.shared.log("[SessionDelegate] 📩 didReceiveMessage(reply) — type: \(type)")

    DispatchQueue.main.async {
      if let module = self.module {
        module.emitWatchMessageEvent(message)
      } else {
        NSLog("[WatchConnectivity] ⚠️ SessionDelegate.module is NIL — sendMessage(reply) event LOST: \(type)")
        DebugLogger.shared.log("[SessionDelegate] ⚠️ module is NIL — sendMessage(reply) event LOST: \(type)")
      }
    }

    replyHandler(["status": "received"])
  }

  func session(
    _ session: WCSession,
    didReceiveUserInfo userInfo: [String : Any]
  ) {
    let type = (userInfo["type"] as? String) ?? "unknown"
    NSLog("[WatchConnectivity] 📩 Received transferUserInfo from watch — type: \(type)")
    DebugLogger.shared.log("[SessionDelegate] 📩 didReceiveUserInfo — type: \(type), keys: \(userInfo.keys.sorted().joined(separator: ", "))")

    if type == "FINISH_WORKOUT" {
      let payload = userInfo["payload"] as? [String: Any]
      let workoutId = payload?["workoutId"] as? String ?? "?"
      let exerciseCount = (payload?["exercises"] as? [[String: Any]])?.count ?? 0
      NSLog("[WatchConnectivity] 🏋️ FINISH_WORKOUT received — workoutId: \(workoutId), exercises: \(exerciseCount)")
      DebugLogger.shared.log("[SessionDelegate] 🏋️ FINISH_WORKOUT — workoutId: \(workoutId), exercises: \(exerciseCount)")
    }

    DispatchQueue.main.async {
      if let module = self.module {
        module.emitWatchMessageEvent(userInfo)
      } else {
        NSLog("[WatchConnectivity] ⚠️ SessionDelegate.module is NIL — transferUserInfo event LOST: \(type)")
        DebugLogger.shared.log("[SessionDelegate] ⚠️ module is NIL — transferUserInfo event LOST: \(type)")
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MARK: - Expo Module
// ═══════════════════════════════════════════════════════════════════════════════

public class WatchConnectivityModule: Module {
  private var wcSession: WCSession?
  private lazy var sessionDelegate = SessionDelegate()
  private let isoFormatter = ISO8601DateFormatter()
  private var pendingApplicationContext: [String: Any]?

  /// Events that arrived via WatchConnectivity before JS started listening.
  /// Flushed when OnStartObserving fires (i.e., first JS listener is attached).
  private var bufferedWatchEvents: [[String: Any]] = []
  private var hasJSListeners = false

  public func definition() -> ModuleDefinition {
    Name("WatchConnectivityModule")

    Events("onWatchMessage")

    OnCreate {
      self.sessionDelegate.module = self

      self.wcSession = WCSession.isSupported() ? WCSession.default : nil

      // Register forwarder so the relay sends future events to us.
      WCSessionRelay.shared.setForwarder { [weak self] message in
        self?.emitWatchMessageEvent(message)
      }

      // Take over as delegate for future messages (needed for
      // sendMessage reply handlers, applicationContext, etc.)
      self.wcSession?.delegate = self.sessionDelegate
      NSLog("[WatchConnectivity] Delegate swapped → SessionDelegate. Current: \(String(describing: WCSession.default.delegate))")
      DebugLogger.shared.log("[Module] Delegate swapped → SessionDelegate")

      // ⚠️ CRITICAL: Activate WCSession. Without this call, the session stays
      // in .notActivated and ALL communication (applicationContext, sendMessage,
      // transferUserInfo) silently fails. WCSessionRelay.activate() was designed
      // to be called from AppDelegate, but Expo's auto-generated AppDelegate
      // doesn't include it. This is the guaranteed activation point.
      if let session = self.wcSession {
        let stateBefore = session.activationState.rawValue
        session.activate()
        NSLog("[WatchConnectivity] WCSession.activate() called — previous state: \(stateBefore)")
        DebugLogger.shared.log("[Module] WCSession.activate() called — previous state: \(stateBefore)")
      }

      // Consume events that the relay persisted before we loaded.
      let pending = WCSessionRelay.shared.consumePendingEvents()
      if !pending.isEmpty {
        NSLog("[WatchConnectivity] Loading \(pending.count) pending event(s) from relay")
        DebugLogger.shared.log("[Module] Loading \(pending.count) pending event(s) from relay")
        for msg in pending {
          let type = msg["type"] ?? "unknown"
          let payload = msg["payload"] ?? [:]
          self.bufferedWatchEvents.append(["type": type, "payload": payload])
        }
      }

      NSLog("[WatchConnectivity] Module initialized — session: \(self.wcSession != nil), pending: \(pending.count)")
      DebugLogger.shared.log("[Module] initialized — session: \(self.wcSession != nil), pending: \(pending.count), buffered: \(self.bufferedWatchEvents.count)")
    }

    OnStartObserving {
      self.hasJSListeners = true
      DebugLogger.shared.log("[Module] JS listeners ATTACHED — buffered: \(self.bufferedWatchEvents.count)")

      // Flush any watch events that arrived before JS mounted its listener.
      if !self.bufferedWatchEvents.isEmpty {
        NSLog("[WatchConnectivity] Flushing \(self.bufferedWatchEvents.count) buffered watch event(s) to JS")
        DebugLogger.shared.log("[Module] Flushing \(self.bufferedWatchEvents.count) buffered event(s) to JS")
        for event in self.bufferedWatchEvents {
          self.sendEvent("onWatchMessage", event)
        }
        self.bufferedWatchEvents.removeAll()
      }
    }

    OnStopObserving {
      self.hasJSListeners = false
      DebugLogger.shared.log("[Module] JS listeners DETACHED")
    }

    Function("syncWorkoutToWatch") { (workoutJSON: String) in
      self.syncWorkoutToWatch(workoutJSON: workoutJSON)
    }

    Function("syncProgramToWatch") { (programJSON: String) in
      self.syncProgramToWatch(programJSON: programJSON)
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

    Function("sendAckToWatch") { (workoutId: String) in
      self.sendAckToWatch(workoutId: workoutId)
    }

    // MARK: Debug Logs

    // AsyncFunction so NativeModulesProxy resolves the value correctly (sync Function
    // gets wrapped as a Promise by Expo, causing JSON.parse(Promise) → silent failure).
    AsyncFunction("getDebugLogs") { (promise: Promise) in
      let logs = DebugLogger.shared.getLogs()
      guard let data = try? JSONSerialization.data(withJSONObject: logs),
            let str = String(data: data, encoding: .utf8) else {
        promise.resolve("[]")
        return
      }
      promise.resolve(str)
    }

    Function("clearDebugLogs") { () in
      DebugLogger.shared.clearLogs()
    }
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

  private func syncProgramToWatch(programJSON: String) {
    guard let payloadData = programJSON.data(using: .utf8) else {
      NSLog("[WatchConnectivity] ❌ Invalid program JSON encoding")
      return
    }

    do {
      let jsonObject = try JSONSerialization.jsonObject(with: payloadData, options: [])

      if jsonObject is NSNull {
        self.sendApplicationContext(context: self.makeProgramEnvelope(with: nil))
        return
      }

      guard let program = jsonObject as? [String: Any] else {
        NSLog("[WatchConnectivity] ❌ programJSON root must be an object or null")
        return
      }

      self.sendApplicationContext(context: self.makeProgramEnvelope(with: program))
    } catch {
      NSLog("[WatchConnectivity] ❌ Failed to parse programJSON: \(error)")
    }
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

  private func makeProgramEnvelope(with program: [String: Any]?) -> [String: Any] {
    var envelope: [String: Any] = [
      "schemaVersion": 2,
      "syncedAt": isoFormatter.string(from: Date()),
      "hasProgram": program != nil
    ]

    if let program {
      envelope["program"] = program
    }

    return envelope
  }

  private func sendApplicationContext(context: [String: Any]) {
    NSLog("[WatchConnectivity] syncWorkoutToWatch called with context keys: \(context.keys)")

    // Ensure we have a session reference.
    if wcSession == nil, WCSession.isSupported() {
      wcSession = WCSession.default
      NSLog("[WatchConnectivity] Re-acquired WCSession.default reference")
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

    // Flush pending application context (iPhone → Watch).
    if let pendingContext = pendingApplicationContext {
      do {
        try wcSession?.updateApplicationContext(pendingContext)
        pendingApplicationContext = nil
        NSLog("[WatchConnectivity] ✅ Flushed queued application context after activation")
      } catch {
        NSLog("[WatchConnectivity] ❌ Failed to flush queued context: \(error)")
      }
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

  // MARK: - Send ACK to Watch

  private func sendAckToWatch(workoutId: String) {
    guard let session = wcSession else {
      NSLog("[WatchConnectivity] ❌ sendAckToWatch: session is nil")
      return
    }

    let message: [String: Any] = [
      "type": "SYNC_SUCCESS",
      "payload": ["workoutId": workoutId]
    ]

    NSLog("[WatchConnectivity] 📤 Sending SYNC_SUCCESS to watch for workoutId: \(workoutId)")

    if session.isReachable {
      session.sendMessage(message, replyHandler: { reply in
        NSLog("[WatchConnectivity] ✅ SYNC_SUCCESS delivered via sendMessage for \(workoutId)")
      }, errorHandler: { error in
        NSLog("[WatchConnectivity] ⚠️ sendMessage failed for SYNC_SUCCESS, falling back to transferUserInfo: \(error.localizedDescription)")
        session.transferUserInfo(message)
      })
    } else {
      session.transferUserInfo(message)
      NSLog("[WatchConnectivity] 📤 SYNC_SUCCESS queued via transferUserInfo (watch not reachable) for \(workoutId)")
    }
  }

  fileprivate func emitWatchMessageEvent(_ message: [String: Any]) {
    let type = message["type"] ?? "unknown"
    let payload = message["payload"] ?? [:]

    let event: [String: Any] = [
      "type": type,
      "payload": payload
    ]

    NSLog("[WatchConnectivity] 🔄 emitWatchMessageEvent — type: \(type), hasJSListeners: \(hasJSListeners)")
    DebugLogger.shared.log("[Module] emitEvent — type: \(type), hasListeners: \(hasJSListeners)")

    if hasJSListeners {
      sendEvent("onWatchMessage", event)
      NSLog("[WatchConnectivity] ✅ Event emitted to JS — type: \(type)")
      DebugLogger.shared.log("[Module] ✅ Event emitted to JS — type: \(type)")
    } else {
      bufferedWatchEvents.append(event)
      NSLog("[WatchConnectivity] 📦 Buffered watch event (no JS listener yet) — type: \(type), buffer size: \(bufferedWatchEvents.count)")
      DebugLogger.shared.log("[Module] 📦 Buffered (no JS listener) — type: \(type), buffer: \(bufferedWatchEvents.count)")
    }
  }
}
