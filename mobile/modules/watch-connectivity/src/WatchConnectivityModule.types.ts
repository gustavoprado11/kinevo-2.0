/**
 * Apple Watch Workout Snapshot Contract (v1)
 *
 * The iPhone sends this JSON through WatchConnectivity `updateApplicationContext`.
 * Native iOS wraps it as:
 * {
 *   schemaVersion: 1,
 *   syncedAt: string (ISO8601),
 *   hasWorkout: boolean,
 *   workout?: WatchWorkoutPayload
 * }
 *
 * `workout` represents the latest visible workout state on iPhone.
 */

export interface WatchWorkoutExercise {
  id: string;
  name: string;
  sets?: number;
  reps?: number;
  weight?: number;
  restTime?: number;
  completedSets?: number;
  targetReps?: string; // Prescribed rep range, e.g. "8-12" or "10"
}

export interface WatchWorkoutPayload {
  workoutId: string;
  workoutName: string;
  studentName: string;
  exercises: WatchWorkoutExercise[];
  currentExerciseIndex?: number;
  currentSetIndex?: number;
  isActive: boolean;
  startedAt?: string;
  updatedAt?: string;
}

export interface WatchSetCompletionEvent {
  workoutId?: string;
  exerciseIndex: number;
  exerciseId?: string;
  setIndex: number;
  reps?: number;
  weight?: number;
}

export interface WatchStartWorkoutEvent {
  workoutId: string;
}

export interface WatchFinishWorkoutEvent {
  workoutId: string;
  rpe: number;
}

export interface WatchMessageEvent {
  type: string;
  payload: any;
}
