import * as SecureStore from 'expo-secure-store';
import { supabase } from './supabase';
import { getProgramWeek } from '@kinevo/shared/utils/schedule-projection';

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
  /** Canonical workout_session_id from the iPhone (SESSION_SYNC). When present,
   *  the exact session is updated instead of resolving by workout + time window. */
  sessionId?: string;
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
    const raw = await SecureStore.getItemAsync(PENDING_KEY, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK }).catch(() => SecureStore.getItemAsync(PENDING_KEY).catch(() => null));
    const pending: (WatchFinishPayload & { queuedAt: string })[] = raw ? JSON.parse(raw) : [];
    // Idempotent: replace any existing entry for the same workout instead of
    // stacking duplicates (a retry that fails again must not grow the queue).
    const deduped = pending.filter((p) => p.workoutId !== payload.workoutId);
    deduped.push({ ...payload, queuedAt: new Date().toISOString() });
    await SecureStore.setItemAsync(PENDING_KEY, JSON.stringify(deduped), { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK });
    if (__DEV__) console.log(`[finishWorkoutFromWatch] Saved to pending queue. Total: ${deduped.length}`);
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
    const raw = await SecureStore.getItemAsync(PENDING_KEY, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK }).catch(() => SecureStore.getItemAsync(PENDING_KEY).catch(() => null));
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
        // Only a real session id means done. 'pending' (re-queued on transient
        // failure) and null (permanent failure) both keep the entry for later.
        // NOTE: on 'pending', finishWorkoutFromWatch already re-saved this entry
        // (deduped) — keeping it in `remaining` converges to the same single copy.
        if (sessionId && sessionId !== 'pending') {
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
      await SecureStore.setItemAsync(PENDING_KEY, JSON.stringify(remaining), { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK });
    } else {
      await SecureStore.deleteItemAsync(PENDING_KEY, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK });
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
    return 'pending';
  }

  if (__DEV__) console.log(`[finishWorkoutFromWatch] Step 2: Auth OK — user ${user.id}`);

  // 3. Student row
  const { data: student, error: studentError }: { data: any; error: any } = await supabase
    .from('students' as any)
    .select('id, coach_id')
    .eq('auth_user_id', user.id)
    .single();

  if (studentError) {
    // Transient (network/DB) failure — queue for retry instead of dropping the workout.
    console.error('[finishWorkoutFromWatch] Step 3 ERROR (queuing for retry):', studentError?.message, studentError?.details, studentError?.hint);
    await savePendingWorkout(payload);
    return 'pending';
  }
  if (!student) {
    if (__DEV__) console.error('[finishWorkoutFromWatch] Step 3 FAILED: Student not found (permanent)');
    return null;
  }

  if (__DEV__) console.log(`[finishWorkoutFromWatch] Step 3: Student ${student.id}`);

  // 4. Workout metadata
  let workout: { assigned_program_id: string | null; name: string };
  {
    const { data, error: workoutError }: { data: any; error: any } = await supabase
      .from('assigned_workouts' as any)
      .select('assigned_program_id, name')
      .eq('id', workoutId)
      .single();

    if (workoutError) {
      if (workoutError.code === 'PGRST116') {
        // R15: treino DELETADO da prescrição (pós-227 a sessão sobrevive com
        // FK NULL + snapshots). `.single()` sem linhas NÃO é transiente —
        // re-enfileirar envenenava a fila (retry infinito, sem TTL). Com o
        // sessionId canônico dá para completar a sessão mesmo assim.
        if (payload.sessionId) {
          console.warn('[finishWorkoutFromWatch] Step 4: workout deleted — proceeding via canonical session id');
          workout = { assigned_program_id: null, name: 'Treino' };
        } else {
          console.error('[finishWorkoutFromWatch] Step 4 FAILED: workout deleted and no canonical session id (permanent)');
          return null;
        }
      } else {
        console.error('[finishWorkoutFromWatch] Step 4 ERROR (queuing for retry):', workoutError?.message, workoutError?.details);
        await savePendingWorkout(payload);
        return 'pending';
      }
    } else if (!data) {
      if (__DEV__) console.error('[finishWorkoutFromWatch] Step 4 FAILED: Workout not found (permanent)');
      return null;
    } else {
      workout = data;
    }
  }

  if (__DEV__) console.log(`[finishWorkoutFromWatch] Step 4: Workout "${workout.name}"`);

  // 4b. Fetch program dates for program_week
  let computedProgramWeek = 1;
  if (workout.assigned_program_id) {
    const { data: prog }: { data: any; error: any } = await supabase
      .from('assigned_programs' as any)
      .select('started_at, duration_weeks')
      .eq('id', workout.assigned_program_id)
      .single();
    if (prog?.started_at) {
      computedProgramWeek = getProgramWeek(new Date(), prog.started_at, prog.duration_weeks) ?? 1;
    }
  }

  // 5. Parse timestamps — use Watch's actual startedAt when available
  const now = new Date();
  const parsedStartedAt = startedAt ? new Date(startedAt) : null;
  const rawDuration = parsedStartedAt
    ? Math.max(0, Math.floor((now.getTime() - parsedStartedAt.getTime()) / 1000))
    : null;
  // Safety cap: >6h (21600s) = likely stale timestamp, discard
  const safeDuration = (rawDuration !== null && rawDuration <= 21600) ? rawDuration : null;

  // 6. Resolve the session. Preferred path: the Watch echoed the canonical
  //    sessionId (SESSION_SYNC). Otherwise fall back to the resolve-by-workout
  //    heuristic (6a/6b/6c) for older Watch builds.
  let sessionId: string;

  if (payload.sessionId) {
    sessionId = payload.sessionId;
    if (__DEV__) console.log(`[finishWorkoutFromWatch] Step 6: Using canonical session id from Watch — ${sessionId}`);

    // FIX A: guarda de status. Só completamos uma sessão que AINDA está
    // in_progress — assim o finish do Watch NUNCA ressuscita uma sessão que o
    // aluno já descartou no celular ('abandoned'). Pedimos a linha de volta
    // (.select) pra distinguir os dois casos de "0 linhas afetadas".
    const { data: updatedRows, error: directUpdateError }: { data: any; error: any } = await supabase
      .from('workout_sessions' as any)
      .update({
        status: 'completed',
        ...(parsedStartedAt ? { started_at: parsedStartedAt.toISOString() } : {}),
        completed_at: now.toISOString(),
        duration_seconds: safeDuration,
        rpe: rpe || null,
      })
      .eq('id', sessionId)
      .eq('status', 'in_progress')
      .select('id, status');

    if (directUpdateError) {
      console.error('[finishWorkoutFromWatch] Step 6 ERROR updating canonical session (queuing for retry):', directUpdateError.message, directUpdateError.details);
      await savePendingWorkout(payload);
      return 'pending';
    }

    // 0 linhas afetadas: a sessão não estava mais in_progress. Descobrimos o
    // estado real pra decidir entre abortar (descartada) ou idempotência (já
    // concluída).
    if (!updatedRows || updatedRows.length === 0) {
      const { data: current }: { data: any; error: any } = await supabase
        .from('workout_sessions' as any)
        .select('id, status')
        .eq('id', sessionId)
        .maybeSingle();

      if (current?.status === 'abandoned') {
        // O aluno descartou o treino no celular. NÃO ressuscitar — abortar o
        // finish sem tocar nos set_logs (passos 7-8) pra não re-notificar o
        // treinador nem inflar o histórico.
        if (__DEV__) console.warn(`[finishWorkoutFromWatch] Step 6: session ${sessionId} já 'abandoned' — finish abortado (não ressuscitar)`);
        watchFinishState.markFinished(workoutId);
        return null;
      }
      // 'completed' (ou ausente): a sessão já foi finalizada por outro caminho.
      // Idempotência — seguimos para o upsert idempotente dos set_logs.
      if (__DEV__) console.log(`[finishWorkoutFromWatch] Step 6: session ${sessionId} já '${current?.status ?? 'desconhecida'}' — idempotência, segue p/ upsert`);
    }
  } else {

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
      console.error('[finishWorkoutFromWatch] Step 6a ERROR (queuing for retry):', updateError.message, updateError.details);
      await savePendingWorkout(payload);
      return 'pending';
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
            // Use Watch's startedAt when available; fallback: estimate start from duration or use now
            started_at: (parsedStartedAt ?? (safeDuration ? new Date(now.getTime() - safeDuration * 1000) : now)).toISOString(),
            completed_at: now.toISOString(),
            duration_seconds: safeDuration,
            sync_status: 'synced',
            rpe: rpe || null,
            feedback: null,
            program_week: computedProgramWeek,
          })
          .select('id')
          .single();

      if (sessionError || !newSession) {
        console.error('[finishWorkoutFromWatch] Step 6c ERROR (queuing for retry):', sessionError?.message, sessionError?.details, sessionError?.hint);
        await savePendingWorkout(payload);
        return 'pending';
      }

      sessionId = newSession.id;
    }
  }
  } // end fallback resolve-by-workout branch (no canonical sessionId)

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
        // A3: only write COMPLETED sets. Writing incomplete sets (is_completed=false)
        // would downgrade a set the iPhone already completed (e.g. logged on the phone
        // while the Watch's copy stayed incomplete), and the rehydrate path only reads
        // is_completed=true rows anyway — so an incomplete row is pure downside.
        if (set.completed !== true) continue;
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
          is_completed: true,
          completed_at: now.toISOString(),
          weight_unit: 'kg',
        });
      }
    }

    if (setLogs.length > 0) {
      const completedCount = setLogs.filter(s => s.is_completed).length;
      if (__DEV__) console.log(`[finishWorkoutFromWatch] Step 7b: Upserting ${setLogs.length} set_logs (${completedCount} completed, ${setLogs.length - completedCount} incomplete)`);

      let { error: logsError } = await supabase
        .from('set_logs' as any)
        .upsert(setLogs, {
          onConflict: 'workout_session_id,assigned_workout_item_id,set_number',
        });

      // R15: item deletado da prescrição → FK 23503 no upsert. Re-enfileirar
      // envenenava a fila (retry infinito). Filtra as séries do(s) item(ns)
      // mortos e tenta 1x com o resto — preserva o máximo do treino (semântica
      // da 227). Só filtra se a checagem de vivos não errou (senão mantém o
      // erro original e cai no caminho de retry transiente).
      if (logsError && (logsError as { code?: string }).code === '23503') {
        const itemIds = Array.from(new Set(setLogs.map((l) => l.assigned_workout_item_id)));
        const { data: aliveRows, error: aliveError }: { data: any; error: any } = await supabase
          .from('assigned_workout_items' as any)
          .select('id')
          .in('id', itemIds);
        if (!aliveError) {
          const alive = new Set((aliveRows ?? []).map((r: any) => r.id));
          const filtered = setLogs.filter((l) => alive.has(l.assigned_workout_item_id));
          console.warn(`[finishWorkoutFromWatch] Step 7b: dropping ${setLogs.length - filtered.length}/${setLogs.length} set(s) of deleted item(s)`);
          if (filtered.length === 0) {
            logsError = null; // nada válido a gravar — sessão completa com o que houver
          } else {
            const retry = await supabase
              .from('set_logs' as any)
              .upsert(filtered, { onConflict: 'workout_session_id,assigned_workout_item_id,set_number' });
            logsError = retry.error;
          }
        }
      }

      if (logsError) {
        // A3: NÃO engolir — a sessão já está completed neste ponto; sem isto o
        // treino do Watch aparecia concluído com 0 séries, sem retry (perda
        // silenciosa e permanente). Mesma técnica do C3 do telefone: reverte a
        // sessão p/ in_progress (best-effort) e re-enfileira o payload — a fila
        // em SecureStore é idempotente e o retry re-upserta tudo.
        console.error('[finishWorkoutFromWatch] Step 7b ERROR (reverting session + queuing for retry):', logsError.message, logsError.details, logsError.hint);
        try {
          await supabase
            .from('workout_sessions' as any)
            .update({ status: 'in_progress', completed_at: null })
            .eq('id', sessionId);
        } catch { /* best-effort */ }
        await savePendingWorkout(payload);
        return 'pending';
      }
      if (__DEV__) console.log(`[finishWorkoutFromWatch] Step 7b: Upserted ${setLogs.length} set_logs OK`);
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
        intensity_target: config.intensity_target,
        intervals: config.intervals,
        protocol_key: config.protocol_key,
        segments: config.segments,
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
        // A3: mesmo tratamento do passo 7b — o retry re-upserta os set_logs de
        // exercício já gravados (idempotente) e completa o cardio que faltou.
        console.error('[finishWorkoutFromWatch] Step 8b ERROR (reverting session + queuing for retry):', cardioLogsError.message, cardioLogsError.details);
        try {
          await supabase
            .from('workout_sessions' as any)
            .update({ status: 'in_progress', completed_at: null })
            .eq('id', sessionId);
        } catch { /* best-effort */ }
        await savePendingWorkout(payload);
        return 'pending';
      }
      if (__DEV__) console.log(`[finishWorkoutFromWatch] Step 8b: Upserted ${cardioSetLogs.length} cardio set_logs OK`);
    }
  }

  watchFinishState.markFinished(workoutId);
  if (__DEV__) console.log(`[finishWorkoutFromWatch] DONE — session ${sessionId} saved for workout ${workoutId}`);
  return sessionId;
}
