export {
  syncWorkoutToWatch,
  syncProgramToWatch,
  sendWorkoutState,
  sendMessage,
  sendReliableToWatch,
  sendAckToWatch,
  addWatchMessageListener,
  isWatchReachable,
  getDebugLogs,
  clearDebugLogs,
} from './src/WatchConnectivityModule';

export type {
  WatchWorkoutPayload,
  WatchWorkoutExercise,
  WatchProgramPayload,
  WatchProgramWorkout,
  WatchProgramExercise,
  WatchSetCompletionEvent,
  WatchStartWorkoutEvent,
  WatchMessageEvent,
} from './src/WatchConnectivityModule.types';
