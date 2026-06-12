import { supabase } from './supabase';

// ─────────────────────────────────────────────────────────────────────────────
// A2 — Durable persistence of Apple Watch set completions when the workout screen
// is NOT mounted.
//
// SET_COMPLETE events are normally handled by app/workout/[id].tsx, which updates
// React state AND persists to the DB. But that screen is only mounted while the
// user is on it. If the user backgrounds the phone (or is on another screen) and
// keeps logging sets on the Watch, those events used to be dropped — and then
// vanished when the workout was finished on the phone (the phone state never knew
// about them). This module is the safety net: it writes the set straight to the DB
// so the finish flow (which rehydrates completed set_logs from the DB) picks it up.
//
// It is intentionally a NO-OP while the workout screen is mounted, to avoid a
// double-write race with the screen's own handler.
// ─────────────────────────────────────────────────────────────────────────────

/** workoutId → in_progress session id. Primed when the session is (pre-)created. */
const _sessionCache = new Map<string, string>();

/** workoutIds whose execution screen is currently mounted (handles its own sets). */
const _mountedScreens = new Set<string>();

export function cacheWatchSession(workoutId: string, sessionId: string): void {
  if (workoutId && sessionId) _sessionCache.set(workoutId, sessionId);
}

export function clearWatchSessionCache(workoutId?: string): void {
  if (workoutId) _sessionCache.delete(workoutId);
  else _sessionCache.clear();
}

export function markWatchWorkoutScreenMounted(workoutId: string): void {
  if (workoutId) _mountedScreens.add(workoutId);
}

export function markWatchWorkoutScreenUnmounted(workoutId: string): void {
  if (workoutId) _mountedScreens.delete(workoutId);
}

export function isWatchWorkoutScreenMounted(workoutId: string): boolean {
  return _mountedScreens.has(workoutId);
}

interface WatchSetLogInput {
  workoutId: string;
  /** assigned_workout_item id */
  exerciseId: string;
  setIndex: number;
  reps?: number;
  weight?: number;
}

/**
 * Persist a single Watch-completed set directly to set_logs. Idempotent (upsert on
 * session+item+set_number) and never downgrades — only writes is_completed=true.
 * Returns true when the row was written, false when skipped (no session/student/item
 * or a transient error). Safe to call repeatedly.
 */
export async function persistWatchSetLog(input: WatchSetLogInput): Promise<boolean> {
  try {
    const { workoutId, exerciseId, setIndex, reps, weight } = input;
    if (!workoutId || !exerciseId || !Number.isFinite(setIndex) || setIndex < 0) return false;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data: student }: { data: any } = await supabase
      .from('students' as any)
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle();
    if (!student) return false;

    // Resolve the active session: cache first, then the in_progress lookup.
    let sessionId = _sessionCache.get(workoutId);
    if (!sessionId) {
      const { data: session }: { data: any } = await supabase
        .from('workout_sessions' as any)
        .select('id')
        .eq('assigned_workout_id', workoutId)
        .eq('student_id', student.id)
        .eq('status', 'in_progress')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!session) {
        if (__DEV__) console.warn(`[persistWatchSetLog] No in_progress session for ${workoutId} — set not persisted`);
        return false;
      }
      const resolved: string = session.id;
      sessionId = resolved;
      _sessionCache.set(workoutId, resolved);
    }
    if (!sessionId) return false;

    const { data: item }: { data: any } = await supabase
      .from('assigned_workout_items' as any)
      .select('exercise_id')
      .eq('id', exerciseId)
      .maybeSingle();
    if (!item) {
      if (__DEV__) console.warn(`[persistWatchSetLog] Item ${exerciseId} not found — set not persisted`);
      return false;
    }

    const { error } = await supabase
      .from('set_logs' as any)
      .upsert(
        {
          workout_session_id: sessionId,
          assigned_workout_item_id: exerciseId,
          planned_exercise_id: item.exercise_id,
          executed_exercise_id: item.exercise_id,
          swap_source: 'none',
          exercise_id: item.exercise_id,
          set_number: setIndex + 1,
          weight: weight ?? 0,
          reps_completed: reps ?? 0,
          is_completed: true,
          completed_at: new Date().toISOString(),
          weight_unit: 'kg',
        },
        { onConflict: 'workout_session_id,assigned_workout_item_id,set_number' }
      );

    if (error) {
      if (__DEV__) console.error(`[persistWatchSetLog] Upsert failed: ${error.message}`);
      return false;
    }

    if (__DEV__) console.log(`[persistWatchSetLog] Persisted Watch set: item ${exerciseId}, set ${setIndex + 1}`);
    return true;
  } catch (e: any) {
    if (__DEV__) console.error(`[persistWatchSetLog] Exception: ${e?.message}`);
    return false;
  }
}
