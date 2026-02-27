export {
  syncWorkoutToWatch,
  sendWorkoutState,
  sendMessage,
  sendAckToWatch,
  addWatchMessageListener,
  isWatchReachable,
  getDebugLogs,
  clearDebugLogs,
} from './src/WatchConnectivityModule';

export type {
  WatchWorkoutPayload,
  WatchWorkoutExercise,
  WatchSetCompletionEvent,
  WatchStartWorkoutEvent,
  WatchMessageEvent,
} from './src/WatchConnectivityModule.types';
