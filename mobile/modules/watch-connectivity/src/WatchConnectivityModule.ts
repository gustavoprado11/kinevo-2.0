import { NativeModulesProxy, EventEmitter, Subscription } from 'expo-modules-core';
import type {
  WatchWorkoutPayload,
  WatchSetCompletionEvent,
  WatchMessageEvent,
} from './WatchConnectivityModule.types';

const WatchConnectivityModule = NativeModulesProxy.WatchConnectivityModule;

const emitter = new EventEmitter(WatchConnectivityModule);

/**
 * Send workout state to Apple Watch
 * Uses updateApplicationContext (overwrites previous state)
 */
export function sendWorkoutState(payload: WatchWorkoutPayload): void {
  console.log('[WatchConnectivityModule.ts] Module exists:', !!WatchConnectivityModule);
  console.log('[WatchConnectivityModule.ts] sendWorkoutState function exists:', !!WatchConnectivityModule?.sendWorkoutState);

  if (!WatchConnectivityModule || !WatchConnectivityModule.sendWorkoutState) {
    console.error('[WatchConnectivityModule.ts] Native module or function not found!');
    return;
  }

  return WatchConnectivityModule.sendWorkoutState(payload);
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
