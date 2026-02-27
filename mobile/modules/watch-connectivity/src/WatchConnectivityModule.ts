import { requireNativeModule, type EventSubscription } from 'expo-modules-core';
import type {
  WatchWorkoutPayload,
  WatchMessageEvent,
} from './WatchConnectivityModule.types';

// CRITICAL: Use requireNativeModule instead of NativeModulesProxy.
// NativeModulesProxy (legacy bridge) does NOT trigger OnStartObserving/OnStopObserving,
// which means hasJSListeners stays false and ALL watch events get buffered but never delivered.
// In Expo SDK 52+, NativeModule extends EventEmitter — the module IS the emitter.
const WatchConnectivityModule = requireNativeModule('WatchConnectivityModule');

/**
 * Sync the latest workout snapshot to Apple Watch.
 * Uses updateApplicationContext (last-write-wins state channel).
 */
export function syncWorkoutToWatch(workout: WatchWorkoutPayload | null): void {
  console.log('[WatchConnectivityModule.ts] Module exists:', !!WatchConnectivityModule);
  console.log('[WatchConnectivityModule.ts] syncWorkoutToWatch function exists:', !!WatchConnectivityModule?.syncWorkoutToWatch);

  if (!WatchConnectivityModule || !WatchConnectivityModule.syncWorkoutToWatch) {
    console.error('[WatchConnectivityModule.ts] Native module or function not found!');
    return;
  }

  const workoutJSON = JSON.stringify(workout);
  return WatchConnectivityModule.syncWorkoutToWatch(workoutJSON);
}

/**
 * Backward-compatible alias used by current RN screens/hooks.
 */
export function sendWorkoutState(payload: WatchWorkoutPayload): void {
  return syncWorkoutToWatch(payload);
}

/**
 * Send arbitrary message to Apple Watch
 * Uses sendMessage (expects reply, may fail if watch unreachable)
 */
export function sendMessage(message: any): Promise<any> {
  return WatchConnectivityModule.sendMessage(message);
}

/**
 * Subscribe to messages from Apple Watch.
 * NativeModule extends EventEmitter — addListener directly triggers OnStartObserving.
 */
export function addWatchMessageListener(
  listener: (event: WatchMessageEvent) => void
): EventSubscription {
  return WatchConnectivityModule.addListener('onWatchMessage', listener);
}

/**
 * Send SYNC_SUCCESS acknowledgement to Apple Watch after saving workout data.
 * The Watch persists FINISH_WORKOUT locally until this ACK is received.
 */
export function sendAckToWatch(workoutId: string): void {
  if (!WatchConnectivityModule || !WatchConnectivityModule.sendAckToWatch) {
    console.error('[WatchConnectivityModule.ts] sendAckToWatch not available on native module');
    return;
  }
  console.log(`[WatchConnectivityModule.ts] Sending SYNC_SUCCESS ACK for workoutId: ${workoutId}`);
  return WatchConnectivityModule.sendAckToWatch(workoutId);
}

/**
 * Check if Apple Watch is paired and reachable
 */
export function isWatchReachable(): boolean {
  return WatchConnectivityModule.isWatchReachable?.() ?? false;
}

/**
 * Get persisted native debug logs (stored in UserDefaults by DebugLogger).
 * Useful for diagnosing Watch → iPhone data flow without Console.app.
 */
export async function getDebugLogs(): Promise<string[]> {
  if (!WatchConnectivityModule || !WatchConnectivityModule.getDebugLogs) {
    console.error('[WatchConnectivityModule.ts] getDebugLogs not available');
    return [];
  }
  try {
    const json = await WatchConnectivityModule.getDebugLogs();
    return JSON.parse(json) ?? [];
  } catch {
    return [];
  }
}

/**
 * Clear all persisted native debug logs.
 */
export function clearDebugLogs(): void {
  if (!WatchConnectivityModule || !WatchConnectivityModule.clearDebugLogs) {
    console.error('[WatchConnectivityModule.ts] clearDebugLogs not available');
    return;
  }
  WatchConnectivityModule.clearDebugLogs();
}
