/**
 * getProgramSnapshotForWatch
 *
 * Builds a full program snapshot for the Apple Watch (schemaVersion 2).
 * Includes all workouts with exercises, completion status, and last-used weights.
 * The Watch can start any workout offline from this snapshot.
 */

import { supabase } from './supabase';
import { getProgramWeek } from '@kinevo/shared/utils/schedule-projection';
import { sortExerciseItems } from '../utils/sortExerciseItems';

const EQUIPMENT_LABELS: Record<string, string> = {
  treadmill: 'Esteira',
  bike: 'Bicicleta',
  elliptical: 'Elíptico',
  rower: 'Remo',
  stairmaster: 'Escada',
  jump_rope: 'Corda',
  outdoor_run: 'Corrida',
  outdoor_bike: 'Bike Outdoor',
  swimming: 'Natação',
  other: 'Outro',
};
import type { WatchProgramPayload, WatchProgramWorkout, WatchProgramExercise, WatchCardioItem } from '../modules/watch-connectivity/src/WatchConnectivityModule.types';

export async function getProgramSnapshotForWatch(
  userId: string,
): Promise<WatchProgramPayload | null> {
  // 1. Get student
  const { data: student, error: studentError }: { data: any; error: any } =
    await supabase
      .from('students' as any)
      .select('id')
      .eq('auth_user_id', userId)
      .maybeSingle();

  if (studentError || !student) {
    if (__DEV__) console.log('[getProgramSnapshot] Student not found:', studentError?.message);
    return null;
  }

  // 2. Get active program
  const { data: program, error: programError }: { data: any; error: any } =
    await supabase
      .from('assigned_programs' as any)
      .select('id, name, current_week, duration_weeks, started_at')
      .eq('student_id', student.id)
      .eq('status', 'active')
      .maybeSingle();

  if (programError || !program) {
    if (__DEV__) console.log('[getProgramSnapshot] No active program:', programError?.message);
    return null;
  }

  // 3. Get all workouts with ALL items (including superset parents for ordering)
  const { data: workouts, error: workoutsError }: { data: any; error: any } =
    await supabase
      .from('assigned_workouts' as any)
      .select(`
        id, name, order_index, scheduled_days,
        assigned_workout_items(id, item_type, parent_item_id, exercise_id, exercise_name, exercise_muscle_group, sets, reps, rest_seconds, order_index, item_config)
      `)
      .eq('assigned_program_id', program.id)
      .order('order_index')
      .order('order_index', { referencedTable: 'assigned_workout_items' });

  if (workoutsError || !workouts?.length) {
    if (__DEV__) console.log('[getProgramSnapshot] No workouts found:', workoutsError?.message);
    return null;
  }

  // 4. Today's completed sessions
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const { data: todaySessions }: { data: any; error: any } = await supabase
    .from('workout_sessions' as any)
    .select('assigned_workout_id, status')
    .eq('assigned_program_id', program.id)
    .or(`and(started_at.gte.${todayStart.toISOString()},started_at.lte.${todayEnd.toISOString()}),and(completed_at.gte.${todayStart.toISOString()},completed_at.lte.${todayEnd.toISOString()})`);

  const completedToday = new Set(
    (todaySessions || [])
      .filter((s: any) => s.status === 'completed')
      .map((s: any) => s.assigned_workout_id),
  );

  // 5. Last completed session per workout (for lastCompletedAt)
  const workoutIds = workouts.map((w: any) => w.id);
  const { data: lastSessions }: { data: any; error: any } = await supabase
    .from('workout_sessions' as any)
    .select('assigned_workout_id, completed_at')
    .eq('assigned_program_id', program.id)
    .eq('status', 'completed')
    .in('assigned_workout_id', workoutIds)
    .order('completed_at', { ascending: false });

  const lastCompletedMap = new Map<string, string>();
  for (const s of lastSessions || []) {
    if (!lastCompletedMap.has(s.assigned_workout_id)) {
      lastCompletedMap.set(s.assigned_workout_id, s.completed_at);
    }
  }

  // 6. Last-used weights and reps per exercise item (exclude superset containers)
  const allItemIds = workouts.flatMap((w: any) =>
    (w.assigned_workout_items || [])
      .filter((item: any) => item.item_type !== 'superset')
      .map((item: any) => item.id),
  );

  const weightMap = new Map<string, number>();
  const repsMap = new Map<string, number>();
  if (allItemIds.length > 0) {
    const { data: lastSets }: { data: any; error: any } = await supabase
      .from('set_logs' as any)
      .select('assigned_workout_item_id, weight, reps_completed')
      .in('assigned_workout_item_id', allItemIds)
      .eq('is_completed', true)
      .order('completed_at', { ascending: false });

    for (const row of lastSets || []) {
      if (!weightMap.has(row.assigned_workout_item_id) && row.weight > 0) {
        weightMap.set(row.assigned_workout_item_id, row.weight);
      }
      if (!repsMap.has(row.assigned_workout_item_id) && row.reps_completed > 0) {
        repsMap.set(row.assigned_workout_item_id, row.reps_completed);
      }
    }
  }

  // 7. Determine schedule mode
  const hasScheduledDays = workouts.some(
    (w: any) => w.scheduled_days && w.scheduled_days.length > 0,
  );

  // 8. Build payload
  const programWorkouts: WatchProgramWorkout[] = workouts.map((w: any) => {
    const allItems: any[] = w.assigned_workout_items || [];

    // Build superset parent map: parentId → { order_index }
    const supersetParentOrder = new Map<string, { order_index: number }>();
    for (const item of allItems) {
      if (item.item_type === 'superset') {
        supersetParentOrder.set(item.id, { order_index: item.order_index });
      }
    }

    // Filter to exercise/cardio items only, sort with superset-aware ordering
    const sortableItems = sortExerciseItems(
      allItems.filter((i: any) => i.item_type === 'exercise' || i.item_type === 'cardio'),
      supersetParentOrder,
    );

    const exerciseItems = sortableItems.filter((i: any) => i.item_type === 'exercise');
    const cardioRawItems = sortableItems.filter((i: any) => i.item_type === 'cardio');

    // Compute superset group sizes and per-exercise position
    const supersetGroupSize = new Map<string, number>();
    for (const item of exerciseItems) {
      if (item.parent_item_id) {
        supersetGroupSize.set(item.parent_item_id, (supersetGroupSize.get(item.parent_item_id) || 0) + 1);
      }
    }
    const supersetPositionCounter = new Map<string, number>();

    const exercises: WatchProgramExercise[] = exerciseItems.map((item: any, idx: number) => {
      let supersetIndex: number | undefined;
      let supersetTotal: number | undefined;
      if (item.parent_item_id) {
        const pos = supersetPositionCounter.get(item.parent_item_id) || 0;
        supersetPositionCounter.set(item.parent_item_id, pos + 1);
        supersetIndex = pos;
        supersetTotal = supersetGroupSize.get(item.parent_item_id);
      }
      return {
        id: item.id,
        name: item.exercise_name || `Exercício ${idx + 1}`,
        muscleGroup: item.exercise_muscle_group || undefined,
        sets: item.sets || 3,
        reps: parseInt(item.reps || '0', 10) || 0,
        weight: weightMap.get(item.id) ?? null,
        restTime: item.rest_seconds || 60,
        targetReps: item.reps || null,
        lastWeight: weightMap.get(item.id) ?? null,
        lastReps: repsMap.get(item.id) ?? null,
        ...(supersetIndex !== undefined ? { supersetIndex, supersetTotal } : {}),
      };
    });

    // Build cardio items for Watch
    const cardioItems: WatchCardioItem[] = cardioRawItems.map((item: any) => {
      const cfg = item.item_config || {};
      return {
        id: item.id,
        itemType: 'cardio' as const,
        orderIndex: item.effectiveOrder ?? 999,
        config: {
          mode: cfg.mode || 'continuous',
          equipment: cfg.equipment,
          equipmentLabel: cfg.equipment ? EQUIPMENT_LABELS[cfg.equipment] ?? undefined : undefined,
          objective: cfg.objective,
          durationMinutes: cfg.duration_minutes,
          distanceKm: cfg.distance_km,
          intensity: cfg.intensity,
          workSeconds: cfg.intervals?.work_seconds,
          restSeconds: cfg.intervals?.rest_seconds,
          rounds: cfg.intervals?.rounds,
        },
      };
    });

    return {
      workoutId: w.id,
      workoutName: w.name,
      orderIndex: w.order_index,
      scheduledDays: (w.scheduled_days || []).map(Number),
      isCompletedToday: completedToday.has(w.id),
      lastCompletedAt: lastCompletedMap.get(w.id) ?? null,
      exercises,
      ...(cardioItems.length > 0 ? { cardioItems } : {}),
    };
  });

  const payload: WatchProgramPayload = {
    schemaVersion: 2,
    programId: program.id,
    programName: program.name,
    currentWeek: program.started_at
      ? getProgramWeek(new Date(), program.started_at, program.duration_weeks) ?? (program.duration_weeks || 1)
      : (program.current_week || 1),
    totalWeeks: program.duration_weeks || 0,
    scheduleMode: hasScheduledDays ? 'scheduled' : 'flexible',
    workouts: programWorkouts,
  };

  if (__DEV__) console.log(
    `[getProgramSnapshot] Program "${program.name}" — ${programWorkouts.length} workouts, ${allItemIds.length} exercises`,
  );

  return payload;
}
