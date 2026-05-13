import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

function toDateOnlyISO(d: Date): string {
  return d.toISOString().slice(0, 10);
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

export interface HealthDashboardData {
  sleepYesterday: { duration_minutes: number | null; efficiency_pct: number | null } | null;
  hrRestingToday: number | null;
  hrBaseline30d: number | null;
  stepsToday: number | null;
  hrvToday: number | null;
  hrvBaseline30d: number | null;
  sleepWeek: Array<{ date: string; minutes: number | null }>;
  connections: Array<{ source: string; status: string; last_sync_at: string | null; granted_categories: string[] }>;
}

export interface UseHealthDashboardResult {
  data: HealthDashboardData | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

export function useHealthDashboard(): UseHealthDashboardResult {
  const [data, setData] = useState<HealthDashboardData | null>(null);
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
      const sevenDaysAgo = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
      const sevenDaysAgoISO = toDateOnlyISO(sevenDaysAgo);
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgoISO = toDateOnlyISO(thirtyDaysAgo);

      const [sleepYRes, hrTodayRes, hrBaselineRes, stepsRes, hrvTodayRes, hrvBaselineRes, sleepWeekRes, connRes]: any[] = await Promise.all([
        supabase.from('daily_sleep_samples' as any)
          .select('duration_minutes, efficiency_pct')
          .eq('student_id', studentId).eq('sample_date', yesterdayISO).maybeSingle(),
        supabase.from('hr_resting_samples' as any).select('bpm')
          .eq('student_id', studentId).eq('sample_date', todayISO).maybeSingle(),
        supabase.from('hr_resting_samples' as any).select('bpm')
          .eq('student_id', studentId).gte('sample_date', thirtyDaysAgoISO),
        supabase.from('daily_activity_samples' as any).select('steps')
          .eq('student_id', studentId).eq('sample_date', todayISO).maybeSingle(),
        supabase.from('hrv_samples' as any).select('value_ms')
          .eq('student_id', studentId).eq('sample_date', todayISO).maybeSingle(),
        supabase.from('hrv_samples' as any).select('value_ms')
          .eq('student_id', studentId).gte('sample_date', thirtyDaysAgoISO),
        supabase.from('daily_sleep_samples' as any).select('sample_date, duration_minutes')
          .eq('student_id', studentId).gte('sample_date', sevenDaysAgoISO).order('sample_date'),
        supabase.from('wearable_connections' as any).select('source, status, last_sync_at, granted_categories')
          .eq('student_id', studentId),
      ]);

      const hrBaseRows = (hrBaselineRes.data ?? []) as Array<{ bpm: number }>;
      const hrBaseline = hrBaseRows.length > 0
        ? Math.round(hrBaseRows.reduce((acc, r) => acc + Number(r.bpm), 0) / hrBaseRows.length)
        : null;

      const hrvBaseRows = (hrvBaselineRes.data ?? []) as Array<{ value_ms: number }>;
      const hrvBaseline = hrvBaseRows.length > 0
        ? Math.round(hrvBaseRows.reduce((acc, r) => acc + Number(r.value_ms), 0) / hrvBaseRows.length)
        : null;

      const sleepWeekRows = (sleepWeekRes.data ?? []) as Array<{ sample_date: string; duration_minutes: number | null }>;
      const sleepWeekMap = new Map(sleepWeekRows.map((r) => [r.sample_date, r.duration_minutes]));
      const sleepWeek: HealthDashboardData['sleepWeek'] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
        const iso = toDateOnlyISO(d);
        sleepWeek.push({ date: iso, minutes: sleepWeekMap.get(iso) ?? null });
      }

      setData({
        sleepYesterday: sleepYRes.data
          ? {
              duration_minutes: sleepYRes.data.duration_minutes ?? null,
              efficiency_pct: sleepYRes.data.efficiency_pct ?? null,
            }
          : null,
        hrRestingToday: hrTodayRes.data?.bpm ?? null,
        hrBaseline30d: hrBaseline,
        stepsToday: stepsRes.data?.steps ?? null,
        hrvToday: hrvTodayRes.data?.value_ms ?? null,
        hrvBaseline30d: hrvBaseline,
        sleepWeek,
        connections: (connRes.data ?? []) as HealthDashboardData['connections'],
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, isLoading, refresh: load };
}
