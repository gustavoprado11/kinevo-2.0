import { EventEmitter } from 'events';

export const appEvents = new EventEmitter();
export const WORKOUT_COMPLETED = 'workout-completed';
export const WATCH_WORKOUT_FINISHED = 'watch-workout-finished';
