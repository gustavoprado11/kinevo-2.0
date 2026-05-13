import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface WorkoutHealthSummary {
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  minHeartRate: number | null;
  caloriesActive: number | null;
  heartRateSeries: Array<{ ts: number; bpm: number }> | null;
  source: string;
}

export function useWorkoutHealthSummary(
  workoutSessionId: string | null | undefined,
): { data: WorkoutHealthSummary | null; isLoading: boolean } {
  const [data, setData] = useState<WorkoutHealthSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!workoutSessionId) {
      setData(null);
      return;
    }
    let cancelled = false;
    setIsLoading(true);

    supabase
      .from('workout_health_samples' as any)
      .select('avg_heart_rate, max_heart_rate, min_heart_rate, calories_active, heart_rate_series, source')
      .eq('workout_session_id', workoutSessionId)
      .maybeSingle()
      .then(({ data: row, error }: any) => {
        if (cancelled) return;
        if (error || !row) {
          setData(null);
        } else {
          setData({
            avgHeartRate: row.avg_heart_rate != null ? Number(row.avg_heart_rate) : null,
            maxHeartRate: row.max_heart_rate != null ? Number(row.max_heart_rate) : null,
            minHeartRate: row.min_heart_rate != null ? Number(row.min_heart_rate) : null,
            caloriesActive: row.calories_active != null ? Number(row.calories_active) : null,
            heartRateSeries: Array.isArray(row.heart_rate_series) ? row.heart_rate_series : null,
            source: row.source ?? 'apple_watch',
          });
        }
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [workoutSessionId]);

  return { data, isLoading };
}
