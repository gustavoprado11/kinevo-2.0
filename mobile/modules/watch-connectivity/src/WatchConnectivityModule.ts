import { NativeModulesProxy, EventEmitter, Subscription } from 'expo-modules-core';
import type {
  WatchWorkoutPayload,
  WatchMessageEvent,
} from './WatchConnectivityModule.types';

const WatchConnectivityModule = NativeModulesProxy.WatchConnectivityModule;

const emitter = new EventEmitter(WatchConnectivityModule);

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
 * Subscribe to messages from Apple Watch
 */
export function addWatchMessageListener(
  listener: (event: WatchMessageEvent) => void
): Subscription {
  return emitter.addListener('onWatchMessage', listener);
}

/**
 * Check if Apple Watch is paired and reachable
 */
export function isWatchReachable(): boolean {
  return WatchConnectivityModule.isWatchReachable?.() ?? false;
}
