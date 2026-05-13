import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { WatchHealthSamplesEvent } from './useWatchConnectivity';

export interface UseWorkoutHealthUploadResult {
  uploadHealthSamples: (event: WatchHealthSamplesEvent) => Promise<{ ok: boolean; reason?: string }>;
}

// NOTE: maps assigned_workout_id (Watch payload) to workout_session_id
// (Supabase). Ambiguous if user completes the same assigned_workout
// twice in 15min — logged via warn for monitoring. Fase 14 will move
// workout_session_id into the initial Watch sync payload, eliminating
// the heuristic.
async function resolveSessionId(assignedWorkoutId: string): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: student } = await supabase
    .from('students' as any)
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  const studentId = (student as any)?.id;
  if (!studentId) return null;

  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const { data: completedRows } = await supabase
    .from('workout_sessions' as any)
    .select('id, completed_at')
    .eq('assigned_workout_id', assignedWorkoutId)
    .eq('student_id', studentId)
    .eq('status', 'completed')
    .gte('completed_at', fifteenMinAgo)
    .order('completed_at', { ascending: false })
    .limit(5);

  const completed = (completedRows as Array<{ id: string }> | null) ?? [];

  if (completed.length > 1) {
    console.warn(
      '[useWorkoutHealthUpload] resolveSessionId: ambiguous mapping —',
      'multiple workout_sessions match assigned_workout_id',
      { assignedWorkoutId, candidates: completed.map((r) => r.id), pickedFirst: completed[0].id }
    );
  }

  if (completed.length > 0) return completed[0].id;

  // Fallback: session in_progress (caso WORKOUT_HEALTH_SAMPLES chegue antes
  // do FINISH_WORKOUT terminar de promover a session pra completed).
  const { data: inProgress } = await supabase
    .from('workout_sessions' as any)
    .select('id')
    .eq('assigned_workout_id', assignedWorkoutId)
    .eq('student_id', studentId)
    .eq('status', 'in_progress')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (inProgress as any)?.id ?? null;
}

export function useWorkoutHealthUpload(): UseWorkoutHealthUploadResult {
  const uploadHealthSamples = useCallback(async (event: WatchHealthSamplesEvent) => {
    try {
      const sessionId = await resolveSessionId(event.workoutId);
      if (!sessionId) {
        if (__DEV__) console.warn(`[useWorkoutHealthUpload] No workout_session found for assigned_workout ${event.workoutId} — skipping upload`);
        return { ok: false, reason: 'session_not_found' };
      }

      const { error } = await supabase
        .from('workout_health_samples' as any)
        .upsert(
          {
            workout_session_id: sessionId,
            avg_heart_rate: event.avgHeartRate,
            max_heart_rate: event.maxHeartRate,
            min_heart_rate: event.minHeartRate,
            calories_active: event.caloriesActive,
            heart_rate_series: event.heartRateSeries,
            source: 'apple_watch',
          },
          { onConflict: 'workout_session_id' }
        );

      if (error) {
        console.warn('[useWorkoutHealthUpload] upsert failed:', error.message);
        return { ok: false, reason: error.message };
      }
      if (__DEV__) console.log(`[useWorkoutHealthUpload] Saved health samples for session ${sessionId}`);
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown';
      console.warn('[useWorkoutHealthUpload] threw:', message);
      return { ok: false, reason: message };
    }
  }, []);

  return { uploadHealthSamples };
}
