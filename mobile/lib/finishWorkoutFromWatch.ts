import * as SecureStore from 'expo-secure-store';
import { supabase } from './supabase';

// ─────────────────────────────────────────────────────────────────────────────
// Types for the enriched FINISH_WORKOUT payload from Apple Watch
// ─────────────────────────────────────────────────────────────────────────────

interface WatchSetData {
  setIndex: number;
  reps: number;
  weight: number;
  completed: boolean;
}

interface WatchExerciseData {
  id: string; // assigned_workout_item_id
  sets: WatchSetData[];
}

interface WatchCardioData {
  itemId: string;
  elapsedSeconds: number;
}

export interface WatchFinishPayload {
  workoutId: string;
  rpe: number;
  startedAt?: string;
  exercises?: WatchExerciseData[];
  cardio?: WatchCardioData[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Global dedup — prevents the [id].tsx beforeRemove guard from blocking
// navigation after a watch-initiated finish.
// ─────────────────────────────────────────────────────────────────────────────

const _finishedIds = new Set<string>();

export const watchFinishState = {
  markFinished(workoutId: string) {
    _finishedIds.add(workoutId);
    setTimeout(() => _finishedIds.delete(workoutId), 30_000);
  },
  isFinished(workoutId: string) {
    return _finishedIds.has(workoutId);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Pending workouts queue (SecureStore) — fallback when auth fails
// ─────────────────────────────────────────────────────────────────────────────

const PENDING_KEY = 'kinevo_pending_finish_workouts';

async function savePendingWorkout(payload: WatchFinishPayload): Promise<void> {
  try {
    const raw = await SecureStore.getItemAsync(PENDING_KEY);
    const pending: (WatchFinishPayload & { queuedAt: string })[] = raw ? JSON.parse(raw) : [];
    pending.push({ ...payload, queuedAt: new Date().toISOString() });
    await SecureStore.setItemAsync(PENDING_KEY, JSON.stringify(pending));
    if (__DEV__) console.log(`[finishWorkoutFromWatch] Saved to pending queue. Total: ${pending.length}`);
  } catch (e: any) {
    if (__DEV__) console.error('[finishWorkoutFromWatch] Failed to save to pending queue:', e?.message);
  }
}

/**
 * Process any workouts saved to SecureStore because auth was unavailable.
 * Called from WatchBridge on mount + delayed retry.
 */
export async function processPendingWatchWorkouts(): Promise<void> {
  try {
    const raw = await SecureStore.getItemAsync(PENDING_KEY);
    if (!raw) return;

    const pending: (WatchFinishPayload & { queuedAt: string })[] = JSON.parse(raw);
    if (pending.length === 0) return;

    if (__DEV__) console.log(`[finishWorkoutFromWatch] Processing ${pending.length} pending workout(s)`);

    // Check if auth is available before attempting
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      if (__DEV__) console.log('[finishWorkoutFromWatch] Auth not ready — will retry later');
      return;
    }

    const remaining: typeof pending = [];

    for (const entry of pending) {
      try {
        const { queuedAt, ...payload } = entry;
        const sessionId = await finishWorkoutFromWatch(payload);
        if (sessionId) {
          if (__DEV__) console.log(`[finishWorkoutFromWatch] Pending workout processed: ${sessionId}`);
        } else {
          remaining.push(entry);
        }
      } catch (e: any) {
        if (__DEV__) console.error(`[finishWorkoutFromWatch] Pending workout failed: ${e?.message}`);
        remaining.push(entry);
      }
    }

    if (remaining.length > 0) {
      await SecureStore.setItemAsync(PENDING_KEY, JSON.stringify(remaining));
    } else {
      await SecureStore.deleteItemAsync(PENDING_KEY);
    }

    if (__DEV__) console.log(`[finishWorkoutFromWatch] Pending queue: ${remaining.length} remaining`);
  } catch (e: any) {
    if (__DEV__) console.error('[finishWorkoutFromWatch] processPendingWatchWorkouts error:', e?.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Standalone function — saves a workout session + set_logs directly to
// Supabase using data from the Apple Watch payload. Does NOT depend on any
// React state or screen being mounted.
// ─────────────────────────────────────────────────────────────────────────────

export async function finishWorkoutFromWatch(
  payload: WatchFinishPayload
): Promise<string | null> {
  const { workoutId, rpe, startedAt, exercises: watchExercises } = payload;

  if (__DEV__) console.log(`[finishWorkoutFromWatch] Step 1: Starting for workout ${workoutId}, RPE ${rpe}, exercises: ${watchExercises?.length ?? 'NONE'}`);

  // 1. Refresh auth token (may be expired after long workout)
  try {
    const { error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
      if (__DEV__) console.warn('[finishWorkoutFromWatch] Step 1a: Token refresh failed:', refreshError.message);
    }
  } catch (e: any) {
    if (__DEV__) console.warn('[finishWorkoutFromWatch] Step 1a: Token refresh exception:', e?.message);
  }

  // 2. Authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.error('[finishWorkoutFromWatch] Step 2 FAILED: No authenticated user — saving to pending queue');
    await savePendingWorkout(payload);
    return null;
  }

  if (__DEV__) console.log(`[finishWorkoutFromWatch] Step 2: Auth OK — user ${user.id}`);

  // 3. Student row
  const { data: student, error: studentError }: { data: any; error: any } = await supabase
    .from('students' as any)
    .select('id, coach_id')
    .eq('auth_user_id', user.id)
    .single();

  if (studentError || !student) {
    if (__DEV__) console.error('[finishWorkoutFromWatch] Step 3 FAILED: Student not found:', studentError?.message, studentError?.details, studentError?.hint);
    return null;
  }

  if (__DEV__) console.log(`[finishWorkoutFromWatch] Step 3: Student ${student.id}`);

  // 4. Workout metadata
  const { data: workout, error: workoutError }: { data: any; error: any } = await supabase
    .from('assigned_workouts' as any)
    .select('assigned_program_id, name')
    .eq('id', workoutId)
    .single();

  if (workoutError || !workout) {
    if (__DEV__) console.error('[finishWorkoutFromWatch] Step 4 FAILED: Workout not found:', workoutError?.message, workoutError?.details);
    return null;
  }

  if (__DEV__) console.log(`[finishWorkoutFromWatch] Step 4: Workout "${workout.name}"`);

  // 5. Parse timestamps — use Watch's actual startedAt when available
  const now = new Date();
  const parsedStartedAt = startedAt ? new Date(startedAt) : null;
  const rawDuration = parsedStartedAt
    ? Math.max(0, Math.floor((now.getTime() - parsedStartedAt.getTime()) / 1000))
    : null;
  // Safety cap: >6h (21600s) = likely stale timestamp, discard
  const safeDuration = (rawDuration !== null && rawDuration <= 21600) ? rawDuration : null;

  // 6. Find existing session OR reuse recently completed OR create new
  let sessionId: string;

  // 6a. Check for existing in_progress session
  const { data: existingSession }: { data: any; error: any } = await supabase
    .from('workout_sessions' as any)
    .select('id')
    .eq('assigned_workout_id', workoutId)
    .eq('student_id', student.id)
    .eq('status', 'in_progress')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingSession) {
    // Update existing session to completed
    sessionId = existingSession.id;
    if (__DEV__) console.log(`[finishWorkoutFromWatch] Step 6a: Found in_progress session ${sessionId} — updating to completed`);

    const { error: updateError } = await supabase
      .from('workout_sessions' as any)
      .update({
        status: 'completed',
        // Correct started_at with Watch's actual start time (fixes stale pre-created timestamp)
        ...(parsedStartedAt ? { started_at: parsedStartedAt.toISOString() } : {}),
        completed_at: now.toISOString(),
        duration_seconds: safeDuration,
        rpe: rpe || null,
      })
      .eq('id', sessionId);

    if (updateError) {
      if (__DEV__) console.error('[finishWorkoutFromWatch] Step 6a FAILED: Update session error:', updateError.message, updateError.details);
      return null;
    }
  } else {
    // 6b. Check for recently completed session (idempotency — prevents duplicate inserts)
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: recentCompleted }: { data: any; error: any } = await supabase
      .from('workout_sessions' as any)
      .select('id')
      .eq('assigned_workout_id', workoutId)
      .eq('student_id', student.id)
      .eq('status', 'completed')
      .gte('completed_at', fiveMinAgo)
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentCompleted) {
      sessionId = recentCompleted.id;
      if (__DEV__) console.log(`[finishWorkoutFromWatch] Step 6b: Found recently completed session ${sessionId} — reusing (dedup)`);
    } else {
      // 6c. No existing session — create a new completed one
      if (__DEV__) console.log('[finishWorkoutFromWatch] Step 6c: No existing session — creating new completed session');

      const { data: newSession, error: sessionError }: { data: any; error: any } =
        await supabase
          .from('workout_sessions' as any)
          .insert({
            student_id: student.id,
            trainer_id: student.coach_id,
            assigned_workout_id: workoutId,
            assigned_program_id: workout.assigned_program_id,
            status: 'completed',
            started_at: (parsedStartedAt ?? now).toISOString(),
            completed_at: now.toISOString(),
            duration_seconds: safeDuration,
            sync_status: 'synced',
            rpe: rpe || null,
            feedback: null,
          })
          .select('id')
          .single();

      if (sessionError || !newSession) {
        if (__DEV__) console.error('[finishWorkoutFromWatch] Step 6c FAILED: Create session error:', sessionError?.message, sessionError?.details, sessionError?.hint);
        return null;
      }

      sessionId = newSession.id;
    }
  }

  if (__DEV__) console.log(`[finishWorkoutFromWatch] Step 6: Session ready — ${sessionId}`);

  // 7. Upsert completed sets (idempotent — safe for duplicates)
  if (watchExercises && watchExercises.length > 0) {
    const itemIds = watchExercises.map((e) => e.id);
    const { data: items, error: itemsError }: { data: any; error: any } = await supabase
      .from('assigned_workout_items' as any)
      .select('id, exercise_id')
      .in('id', itemIds);

    if (itemsError) {
      if (__DEV__) console.error('[finishWorkoutFromWatch] Step 7a FAILED: Fetch items error:', itemsError.message);
    }

    const itemMap = new Map<string, string>(
      (items || []).map((item: any) => [item.id, item.exercise_id])
    );

    const setLogs: any[] = [];

    for (const exercise of watchExercises) {
      const exerciseId = itemMap.get(exercise.id);
      if (!exerciseId) {
        if (__DEV__) console.warn(`[finishWorkoutFromWatch] Step 7: Could not resolve exercise_id for item ${exercise.id}`);
        continue;
      }

      for (const set of exercise.sets) {
        setLogs.push({
          workout_session_id: sessionId,
          assigned_workout_item_id: exercise.id,
          planned_exercise_id: exerciseId,
          executed_exercise_id: exerciseId,
          swap_source: 'none',
          exercise_id: exerciseId,
          set_number: set.setIndex + 1,
          weight: set.weight || 0,
          reps_completed: set.reps || 0,
          is_completed: set.completed === true,
          completed_at: set.completed ? now.toISOString() : null,
          weight_unit: 'kg',
        });
      }
    }

    if (setLogs.length > 0) {
      const completedCount = setLogs.filter(s => s.is_completed).length;
      if (__DEV__) console.log(`[finishWorkoutFromWatch] Step 7b: Upserting ${setLogs.length} set_logs (${completedCount} completed, ${setLogs.length - completedCount} incomplete)`);

      const { error: logsError } = await supabase
        .from('set_logs' as any)
        .upsert(setLogs, {
          onConflict: 'workout_session_id,assigned_workout_item_id,set_number',
        });

      if (logsError) {
        if (__DEV__) console.error('[finishWorkoutFromWatch] Step 7b FAILED: Upsert set_logs error:', logsError.message, logsError.details, logsError.hint);
      } else {
        if (__DEV__) console.log(`[finishWorkoutFromWatch] Step 7b: Upserted ${setLogs.length} set_logs OK`);
      }
    } else {
      if (__DEV__) console.warn('[finishWorkoutFromWatch] Step 7: No set_logs to upsert');
    }
  } else {
    if (__DEV__) console.warn('[finishWorkoutFromWatch] Step 7: No exercise data from watch — session saved with RPE only');
  }

  // 8. Upsert cardio set_logs (mirrors useWorkoutSession logic for cardio items)
  const watchCardio = payload.cardio;
  if (watchCardio && watchCardio.length > 0) {
    if (__DEV__) console.log(`[finishWorkoutFromWatch] Step 8: Processing ${watchCardio.length} cardio item(s)`);

    // Fetch item_config from assigned_workout_items for each cardio item
    const cardioItemIds = watchCardio.map((c) => c.itemId);
    const { data: cardioItems, error: cardioItemsError }: { data: any; error: any } = await supabase
      .from('assigned_workout_items' as any)
      .select('id, exercise_id, item_config')
      .in('id', cardioItemIds);

    if (cardioItemsError) {
      if (__DEV__) console.error('[finishWorkoutFromWatch] Step 8a FAILED: Fetch cardio items error:', cardioItemsError.message);
    }

    const cardioItemMap = new Map<string, any>(
      (cardioItems || []).map((item: any) => [item.id, item])
    );

    const cardioSetLogs: any[] = [];
    const now = new Date();

    for (const cardio of watchCardio) {
      const item = cardioItemMap.get(cardio.itemId);
      const config = item?.item_config || {};

      const notesJson = JSON.stringify({
        mode: config.mode || 'continuous',
        equipment: config.equipment,
        duration_minutes: config.duration_minutes,
        distance_km: config.distance_km,
        intensity: config.intensity,
        intervals: config.intervals,
        actual_duration_seconds: cardio.elapsedSeconds,
        completed_rounds: config.completed_rounds,
      });

      cardioSetLogs.push({
        workout_session_id: sessionId,
        assigned_workout_item_id: cardio.itemId,
        planned_exercise_id: item?.exercise_id || null,
        executed_exercise_id: item?.exercise_id || null,
        swap_source: 'none',
        exercise_id: item?.exercise_id || null,
        set_number: 1,
        weight: 0,
        reps_completed: 1,
        is_completed: true,
        completed_at: now.toISOString(),
        weight_unit: 'kg',
        notes: notesJson,
      });
    }

    if (cardioSetLogs.length > 0) {
      if (__DEV__) console.log(`[finishWorkoutFromWatch] Step 8b: Upserting ${cardioSetLogs.length} cardio set_logs`);

      const { error: cardioLogsError } = await supabase
        .from('set_logs' as any)
        .upsert(cardioSetLogs, {
          onConflict: 'workout_session_id,assigned_workout_item_id,set_number',
        });

      if (cardioLogsError) {
        if (__DEV__) console.error('[finishWorkoutFromWatch] Step 8b FAILED: Upsert cardio set_logs error:', cardioLogsError.message, cardioLogsError.details);
      } else {
        if (__DEV__) console.log(`[finishWorkoutFromWatch] Step 8b: Upserted ${cardioSetLogs.length} cardio set_logs OK`);
      }
    }
  }

  watchFinishState.markFinished(workoutId);
  if (__DEV__) console.log(`[finishWorkoutFromWatch] DONE — session ${sessionId} saved for workout ${workoutId}`);
  return sessionId;
}
