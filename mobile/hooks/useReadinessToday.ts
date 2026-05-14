import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { computeReadiness, ReadinessResult } from '../lib/readiness';

function toDateOnlyISO(d: Date): string {
  // Fix BUG 2 (1.6.0/33): usa local time do device, não UTC. Evita
  // que "readiness hoje" caia no dia errado pra usuários em UTC-3+.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function getCurrentStudentId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: student } = await supabase
    .from('students' as any)
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  return (student as any)?.id ?? null;
}

export interface UseReadinessTodayResult {
  data: ReadinessResult | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

export function useReadinessToday(): UseReadinessTodayResult {
  const [data, setData] = useState<ReadinessResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const studentId = await getCurrentStudentId();
      if (!studentId) {
        setData(null);
        return;
      }
      const today = new Date();
      const todayISO = toDateOnlyISO(today);
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      const yesterdayISO = toDateOnlyISO(yesterday);
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      // 1. Cache hit?
      const { data: cached } = await supabase
        .from('readiness_scores' as any)
        .select('score, sleep_component, hr_component, sleep_minutes, hr_baseline_30d')
        .eq('student_id', studentId)
        .eq('score_date', todayISO)
        .maybeSingle();

      if (cached) {
        const c = cached as any;
        const score = Number(c.score);
        let category: ReadinessResult['category'];
        if (score >= 80) category = 'otimo';
        else if (score >= 60) category = 'bom';
        else if (score >= 40) category = 'regular';
        else category = 'reduzido';
        setData({
          score,
          category,
          sleepComponent: Number(c.sleep_component),
          hrComponent: Number(c.hr_component),
          sleepMinutesUsed: c.sleep_minutes ?? null,
          hrBaselineUsed: c.hr_baseline_30d ?? null,
        });
        return;
      }

      // 2. Compute from raw samples
      const [sleepRes, hrTodayRes, hrBaselineRes]: any[] = await Promise.all([
        supabase
          .from('daily_sleep_samples' as any)
          .select('duration_minutes')
          .eq('student_id', studentId)
          .eq('sample_date', yesterdayISO)
          .maybeSingle(),
        supabase
          .from('hr_resting_samples' as any)
          .select('bpm')
          .eq('student_id', studentId)
          .eq('sample_date', todayISO)
          .maybeSingle(),
        supabase
          .from('hr_resting_samples' as any)
          .select('bpm')
          .eq('student_id', studentId)
          .gte('sample_date', toDateOnlyISO(thirtyDaysAgo)),
      ]);

      const sleepMinutes = sleepRes.data?.duration_minutes ?? null;
      const hrToday = hrTodayRes.data?.bpm ?? null;

      const baselineRows = (hrBaselineRes.data ?? []) as Array<{ bpm: number }>;
      const baseline = baselineRows.length > 0
        ? Math.round(baselineRows.reduce((acc, r) => acc + Number(r.bpm), 0) / baselineRows.length)
        : null;

      // Sem nenhuma fonte de dados → não mostra readiness (escondido)
      if (sleepMinutes == null && hrToday == null) {
        setData(null);
        return;
      }

      const result = computeReadiness({
        sleepMinutes,
        hrRestingToday: hrToday,
        hrBaseline30d: baseline,
      });
      setData(result);

      // Cache em readiness_scores (best-effort)
      void supabase.from('readiness_scores' as any).upsert(
        {
          student_id: studentId,
          score_date: todayISO,
          score: result.score,
          sleep_component: Math.round(result.sleepComponent * 1000) / 1000,
          hr_component: Math.round(result.hrComponent * 1000) / 1000,
          sleep_minutes: sleepMinutes,
          hr_baseline_30d: baseline,
          computed_at: new Date().toISOString(),
        },
        { onConflict: 'student_id,score_date' }
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, isLoading, refresh: load };
}
