import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { hrvMetricFromSource, type HrvMetric } from '../lib/hrv';

// Tabelas que alimentam os cards do dashboard (fix C13 — realtime).
const REALTIME_TABLES = ['daily_sleep_samples', 'hr_resting_samples', 'daily_activity_samples', 'hrv_samples'] as const;

export function toLocalDateISO(d: Date): string {
  // Fix BUG 2 (1.6.0/33): usa local time do device, não UTC. Evita
  // que "hoje" no dashboard caia no dia errado pra usuários em UTC-3+.
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

// Fix C7 (analise-saude-aluno-2026-07-07): os cards exigiam sample_date = HOJE,
// mas HR repouso/HRV do Watch normalmente só existem para ONTEM (derivados do
// sono) → o card mostrava "–"/valor enganoso enquanto o detalhe (que usa o mais
// recente) mostrava valor. Agora o dashboard usa o registro MAIS RECENTE dentro
// desta janela e expõe a DATA para a UI rotular ("· ontem").
const LATEST_LOOKBACK_DAYS = 7;

export interface HealthDashboardData {
  /** Sono mais recente (última noite registrada) dentro da janela. */
  sleepLatest: { duration_minutes: number | null; efficiency_pct: number | null; date: string } | null;
  hrRestingLatest: { bpm: number; date: string } | null;
  hrBaseline30d: number | null;
  stepsLatest: { steps: number | null; date: string } | null;
  hrvLatest: { value_ms: number; date: string } | null;
  hrvBaseline30d: number | null;
  hrvMetric: HrvMetric | null;
  sleepWeek: Array<{ date: string; minutes: number | null }>;
  connections: Array<{ source: string; status: string; last_sync_at: string | null; granted_categories: string[] }>;
  /**
   * Fix C5: quando DADO chegou de fato (max synced_at dos registros exibidos).
   * Diferente de wearable_connections.last_sync_at, que marca a última TENTATIVA
   * de sync (mesmo vazia/parcial) — era o que fazia o "Atualizado há X" mentir.
   */
  lastDataAt: string | null;
}

export interface UseHealthDashboardResult {
  data: HealthDashboardData | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

export function useHealthDashboard(): UseHealthDashboardResult {
  const [data, setData] = useState<HealthDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [studentId, setStudentId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const sid = await getCurrentStudentId();
      setStudentId(sid);
      const studentId = sid;
      if (!studentId) {
        setData(null);
        return;
      }

      const today = new Date();
      const lookbackISO = toLocalDateISO(new Date(today.getTime() - LATEST_LOOKBACK_DAYS * 24 * 60 * 60 * 1000));
      const sevenDaysAgoISO = toLocalDateISO(new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000));
      const thirtyDaysAgoISO = toLocalDateISO(new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000));

      const latest = (table: string, cols: string) =>
        supabase.from(table as any)
          .select(cols)
          .eq('student_id', studentId)
          .gte('sample_date', lookbackISO)
          .order('sample_date', { ascending: false })
          .limit(1)
          .maybeSingle();

      const [sleepRes, hrRes, hrBaselineRes, stepsRes, hrvRes, hrvBaselineRes, sleepWeekRes, connRes]: any[] = await Promise.all([
        latest('daily_sleep_samples', 'duration_minutes, efficiency_pct, sample_date, synced_at'),
        latest('hr_resting_samples', 'bpm, sample_date, synced_at'),
        supabase.from('hr_resting_samples' as any).select('bpm')
          .eq('student_id', studentId).gte('sample_date', thirtyDaysAgoISO),
        latest('daily_activity_samples', 'steps, sample_date, synced_at'),
        latest('hrv_samples', 'value_ms, source, sample_date, synced_at'),
        supabase.from('hrv_samples' as any).select('value_ms, source, sample_date')
          .eq('student_id', studentId).gte('sample_date', thirtyDaysAgoISO).order('sample_date', { ascending: false }),
        supabase.from('daily_sleep_samples' as any).select('sample_date, duration_minutes')
          .eq('student_id', studentId).gte('sample_date', sevenDaysAgoISO).order('sample_date'),
        supabase.from('wearable_connections' as any).select('source, status, last_sync_at, granted_categories')
          .eq('student_id', studentId),
      ]);

      const hrBaseRows = (hrBaselineRes.data ?? []) as Array<{ bpm: number }>;
      const hrBaseline = hrBaseRows.length > 0
        ? Math.round(hrBaseRows.reduce((acc, r) => acc + Number(r.bpm), 0) / hrBaseRows.length)
        : null;

      // Fix discrepância #2: SDNN (iOS) e RMSSD (Android) não são comparáveis.
      // A métrica é a do registro mais recente. O baseline só agrega registros
      // da MESMA métrica.
      const hrvBaseRows = (hrvBaselineRes.data ?? []) as Array<{ value_ms: number; source: string | null }>;
      const hrvLatestSource = (hrvRes.data as { source?: string | null } | null)?.source ?? null;
      const hrvMetric: HrvMetric | null =
        hrvMetricFromSource(hrvLatestSource) ?? hrvMetricFromSource(hrvBaseRows[0]?.source);
      const hrvSameMetric = hrvMetric
        ? hrvBaseRows.filter((r) => hrvMetricFromSource(r.source) === hrvMetric)
        : [];
      const hrvBaseline = hrvSameMetric.length > 0
        ? Math.round(hrvSameMetric.reduce((acc, r) => acc + Number(r.value_ms), 0) / hrvSameMetric.length)
        : null;

      const sleepWeekRows = (sleepWeekRes.data ?? []) as Array<{ sample_date: string; duration_minutes: number | null }>;
      const sleepWeekMap = new Map(sleepWeekRows.map((r) => [r.sample_date, r.duration_minutes]));
      const sleepWeek: HealthDashboardData['sleepWeek'] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
        const iso = toLocalDateISO(d);
        sleepWeek.push({ date: iso, minutes: sleepWeekMap.get(iso) ?? null });
      }

      // Fix C5: frescor REAL = quando os registros exibidos foram gravados.
      const syncedAts = [sleepRes.data, hrRes.data, stepsRes.data, hrvRes.data]
        .map((r) => (r as { synced_at?: string | null } | null)?.synced_at)
        .filter((s): s is string => !!s)
        .sort();
      const lastDataAt = syncedAts.length > 0 ? syncedAts[syncedAts.length - 1] : null;

      setData({
        sleepLatest: sleepRes.data
          ? {
              duration_minutes: sleepRes.data.duration_minutes ?? null,
              efficiency_pct: sleepRes.data.efficiency_pct ?? null,
              date: sleepRes.data.sample_date,
            }
          : null,
        hrRestingLatest: hrRes.data ? { bpm: hrRes.data.bpm, date: hrRes.data.sample_date } : null,
        hrBaseline30d: hrBaseline,
        stepsLatest: stepsRes.data ? { steps: stepsRes.data.steps ?? null, date: stepsRes.data.sample_date } : null,
        hrvLatest: hrvRes.data ? { value_ms: hrvRes.data.value_ms, date: hrvRes.data.sample_date } : null,
        hrvBaseline30d: hrvBaseline,
        hrvMetric,
        sleepWeek,
        connections: (connRes.data ?? []) as HealthDashboardData['connections'],
        lastDataAt,
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Fix C13 — realtime: quando o webhook/reconcile/outro device grava uma
  // amostra deste aluno, a aba reflete sem esperar refocus/pull. Um sync escreve
  // várias linhas em rajada, então coalescemos os eventos num único refresh
  // (debounce 1,2s). RLS já restringe as linhas ao próprio aluno; o filtro por
  // student_id enxuga o tráfego server-side.
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!studentId) return;
    const scheduleRefresh = () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => { void load(); }, 1200);
    };
    const channel = supabase.channel(`health-dashboard-${studentId}`);
    for (const table of REALTIME_TABLES) {
      channel.on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table, filter: `student_id=eq.${studentId}` },
        scheduleRefresh,
      );
    }
    channel.subscribe();
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      void supabase.removeChannel(channel);
    };
  }, [studentId, load]);

  return { data, isLoading, refresh: load };
}
