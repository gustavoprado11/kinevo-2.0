/**
 * getNextWorkoutForWatch
 *
 * Determines the next pending workout for the student and returns
 * a WatchWorkoutPayload ready to be sent via updateApplicationContext.
 *
 * Priority logic:
 * 1. If the program uses scheduled_days and today has a scheduled workout
 *    that hasn't been completed → return that workout.
 * 2. If all scheduled workouts for today are done → return null
 *    (Watch shows "no pending workouts").
 * 3. If the program has NO scheduled_days → return the first
 *    workout not yet completed today.
 * 4. No program or no workouts → return null.
 */

import { supabase } from './supabase';
import type { WatchWorkoutPayload } from '../modules/watch-connectivity/src/WatchConnectivityModule.types';

/**
 * Fetch the next workout the student should do and format it
 * as a WatchWorkoutPayload (or null if nothing pending).
 */
export async function getNextWorkoutForWatch(
  userId: string,
): Promise<WatchWorkoutPayload | null> {
  // 1. Get student
  const { data: student, error: studentError }: { data: any; error: any } =
    await supabase
      .from('students' as any)
      .select('id, name')
      .eq('auth_user_id', userId)
      .maybeSingle();

  if (studentError || !student) {
    console.log('[getNextWorkoutForWatch] Student not found:', studentError?.message);
    return null;
  }

  // 2. Get active program
  const { data: program, error: programError }: { data: any; error: any } =
    await supabase
      .from('assigned_programs' as any)
      .select('id')
      .eq('student_id', student.id)
      .eq('status', 'active')
      .maybeSingle();

  if (programError || !program) {
    console.log('[getNextWorkoutForWatch] No active program:', programError?.message);
    return null;
  }

  // 3. Get all workouts ordered by order_index
  const { data: workouts, error: workoutsError }: { data: any; error: any } =
    await supabase
      .from('assigned_workouts' as any)
      .select('id, name, order_index, scheduled_days')
      .eq('assigned_program_id', program.id)
      .order('order_index');

  if (workoutsError || !workouts?.length) {
    console.log('[getNextWorkoutForWatch] No workouts found:', workoutsError?.message);
    return null;
  }

  // 4. Check today's completed sessions
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const { data: todaySessions }: { data: any; error: any } = await supabase
    .from('workout_sessions' as any)
    .select('assigned_workout_id, status')
    .eq('assigned_program_id', program.id)
    .gte('started_at', todayStart.toISOString())
    .lte('started_at', todayEnd.toISOString());

  const completedToday = new Set(
    (todaySessions || [])
      .filter((s: any) => s.status === 'completed')
      .map((s: any) => s.assigned_workout_id),
  );

  // 5. Determine which workout to send
  const todayDow = new Date().getDay(); // 0=Sunday … 6=Saturday

  // Check if program uses scheduled_days at all
  const hasScheduledDays = workouts.some(
    (w: any) => w.scheduled_days && w.scheduled_days.length > 0,
  );

  let targetWorkout: any = null;

  if (hasScheduledDays) {
    // Program uses scheduled_days
    const scheduledToday = workouts.filter(
      (w: any) => w.scheduled_days?.some((d: any) => Number(d) === todayDow),
    );

    if (scheduledToday.length > 0) {
      // There are workouts scheduled for today
      if (scheduledToday.every((w: any) => completedToday.has(w.id))) {
        // All scheduled workouts for today are done
        console.log('[getNextWorkoutForWatch] All scheduled workouts completed for today');
        return null;
      }
      // Pick the first scheduled workout not yet completed
      targetWorkout = scheduledToday.find((w: any) => !completedToday.has(w.id)) || null;
    } else {
      // No workouts scheduled for today (rest day)
      console.log('[getNextWorkoutForWatch] No workouts scheduled for today (rest day)');
      return null;
    }
  } else {
    // Program does NOT use scheduled_days (free schedule)
    // Pick the first workout not yet completed today
    targetWorkout = workouts.find((w: any) => !completedToday.has(w.id)) || null;
  }

  if (!targetWorkout) {
    console.log('[getNextWorkoutForWatch] No pending workout found');
    return null;
  }

  // 6. Fetch exercise details for the target workout
  const { data: items, error: itemsError }: { data: any; error: any } =
    await supabase
      .from('assigned_workout_items' as any)
      .select('id, exercise_id, exercise_name, sets, reps, rest_seconds')
      .eq('assigned_workout_id', targetWorkout.id)
      .eq('item_type', 'exercise')
      .order('order_index');

  if (itemsError) {
    console.error('[getNextWorkoutForWatch] Error fetching items:', itemsError);
    return null;
  }

  // 7. Build Watch payload
  const payload: WatchWorkoutPayload = {
    workoutId: targetWorkout.id,
    workoutName: targetWorkout.name,
    studentName: student.name || '',
    exercises: (items || []).map((item: any, idx: number) => ({
      id: item.id,
      name: item.exercise_name || `Exercício ${idx + 1}`,
      sets: item.sets || 3,
      reps: parseInt(item.reps || '0', 10) || 0,
      restTime: item.rest_seconds || 60,
      completedSets: 0,
      targetReps: item.reps || undefined,
    })),
    currentExerciseIndex: 0,
    currentSetIndex: 0,
    isActive: false, // Not started yet — Watch shows "Iniciar treino"
    updatedAt: new Date().toISOString(),
  };

  console.log(
    `[getNextWorkoutForWatch] Next workout: "${targetWorkout.name}" (${payload.exercises.length} exercises)`,
  );

  return payload;
}
