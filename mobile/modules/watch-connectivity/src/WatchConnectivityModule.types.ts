/**
 * TypeScript types for WatchConnectivity module
 */

export interface WatchWorkoutExercise {
  id: string;
  name: string;
  sets: number;
  reps: number;
  weight?: number;
  restTime: number;
  completedSets: number;
}

export interface WatchWorkoutPayload {
  workoutId: string;
  studentName: string;
  exercises: WatchWorkoutExercise[];
  currentExerciseIndex: number;
  currentSetIndex: number;
  isActive: boolean;
}

export interface WatchSetCompletionEvent {
  exerciseIndex: number;
  setIndex: number;
}

export interface WatchMessageEvent {
  type: string;
  payload: any;
}
