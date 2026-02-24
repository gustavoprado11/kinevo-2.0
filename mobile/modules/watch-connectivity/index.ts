export {
  syncWorkoutToWatch,
  sendWorkoutState,
  sendMessage,
  addWatchMessageListener,
  isWatchReachable,
} from './src/WatchConnectivityModule';

export type {
  WatchWorkoutPayload,
  WatchWorkoutExercise,
  WatchSetCompletionEvent,
  WatchStartWorkoutEvent,
  WatchMessageEvent,
} from './src/WatchConnectivityModule.types';
