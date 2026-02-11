export {
  sendWorkoutState,
  sendMessage,
  addWatchMessageListener,
  isWatchReachable,
} from './src/WatchConnectivityModule';

export type {
  WatchWorkoutPayload,
  WatchWorkoutExercise,
  WatchSetCompletionEvent,
  WatchMessageEvent,
} from './src/WatchConnectivityModule.types';
