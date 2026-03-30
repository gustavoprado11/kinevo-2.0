/**
 * Apple Watch Workout Snapshot Contract
 *
 * The iPhone sends JSON through WatchConnectivity `updateApplicationContext`.
 *
 * schemaVersion 1 (legacy — single workout):
 * {
 *   schemaVersion: 1,
 *   syncedAt: string (ISO8601),
 *   hasWorkout: boolean,
 *   workout?: WatchWorkoutPayload
 * }
 *
 * schemaVersion 2 (current — full program):
 * {
 *   schemaVersion: 2,
 *   syncedAt: string (ISO8601),
 *   hasProgram: boolean,
 *   program?: WatchProgramPayload
 * }
 */

// ── v1 types (kept for backward compatibility) ──

export interface WatchWorkoutExercise {
  id: string;
  name: string;
  sets?: number;
  reps?: number;
  weight?: number;
  restTime?: number;
  completedSets?: number;
  targetReps?: string;
  supersetIndex?: number;  // 0-based position within superset group
  supersetTotal?: number;  // total exercises in superset group
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

// ── v2 types (program snapshot) ──

export interface WatchProgramExercise {
  id: string;
  name: string;
  muscleGroup?: string;
  sets: number;
  reps: number;
  weight: number | null;
  restTime: number;
  targetReps: string | null;
  lastWeight: number | null;
  lastReps: number | null;
  supersetIndex?: number;  // 0-based position within superset group
  supersetTotal?: number;  // total exercises in superset group
}

export interface WatchCardioItem {
  id: string;
  itemType: 'cardio';
  orderIndex: number;
  config: {
    mode: 'continuous' | 'interval';
    equipment?: string;
    equipmentLabel?: string;
    // Continuous
    objective?: 'time' | 'distance';
    durationMinutes?: number;
    distanceKm?: number;
    intensity?: string;
    // Interval
    workSeconds?: number;
    restSeconds?: number;
    rounds?: number;
  };
}

export interface WatchProgramWorkout {
  workoutId: string;
  workoutName: string;
  orderIndex: number;
  scheduledDays: number[];
  isCompletedToday: boolean;
  lastCompletedAt: string | null;
  exercises: WatchProgramExercise[];
  cardioItems?: WatchCardioItem[];
}

export interface WatchProgramPayload {
  schemaVersion: 2;
  programId: string;
  programName: string;
  currentWeek: number;
  totalWeeks: number;
  scheduleMode: 'scheduled' | 'flexible';
  workouts: WatchProgramWorkout[];
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
