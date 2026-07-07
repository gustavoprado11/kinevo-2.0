// Fase 14d — Hook que avalia regras heurísticas e expõe top 3 insights.
// Cache MMKV (TTL 6h + dia LOCAL). Pull-to-refresh/focus → refresh() ignora cache.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { toLocalDateISO } from './useHealthDashboard';
import { evaluateInsights } from '../lib/healthInsights/evaluate';
import { prioritize } from '../lib/healthInsights/prioritize';
import { hrvMetricFromSource } from '../lib/hrv';
import type {
  HealthInsight,
  RuleInput,
  SleepSample,
  HrRestingSample,
  HrvSample,
  StepsSample,
  WorkoutSessionSample,
} from '@kinevo/shared/types/healthInsights';

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h

// ──────────────────────────────────────────────────────────────────────────────
// Cache MMKV (com fallback in-memory pra Expo Go) — pattern espelha
// themePreferenceStore / healthOnboardingFlag.
// ──────────────────────────────────────────────────────────────────────────────
interface InsightsCacheEntry {
  insights: HealthInsight[];
  generatedAt: number;
  forDate: string; // YYYY-MM-DD LOCAL (fix C9: era UTC → virava o dia na hora errada)
}

let cacheGet: (key: string) => InsightsCacheEntry | null;
let cacheSet: (key: string, value: InsightsCacheEntry) => void;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createMMKV } = require('react-native-mmkv');
  const mmkv = createMMKV({ id: 'kinevo-health-insights' });
  cacheGet = (key: string) => {
    const raw = mmkv.getString(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as InsightsCacheEntry;
    } catch {
      return null;
    }
  };
  cacheSet = (key: string, value: InsightsCacheEntry) => mmkv.set(key, JSON.stringify(value));
} catch {
  const memStore = new Map<string, InsightsCacheEntry>();
  cacheGet = (key: string) => memStore.get(key) ?? null;
  cacheSet = (key: string, value: InsightsCacheEntry) => {
    memStore.set(key, value);
  };
}

function todayLocalString(): string {
  return toLocalDateISO(new Date());
}

function isCacheFresh(entry: InsightsCacheEntry): boolean {
  if (entry.forDate !== todayLocalString()) return false;
  if (Date.now() - entry.generatedAt > CACHE_TTL_MS) return false;
  return true;
}

// ──────────────────────────────────────────────────────────────────────────────
// Hook
// ──────────────────────────────────────────────────────────────────────────────

export interface UseHealthInsightsResult {
  insights: HealthInsight[];
  isLoading: boolean;
  error: string | null;
  /** Força revalidação ignorando cache (pull-to-refresh). */
  refresh: () => Promise<void>;
}

async function getStudentId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: student } = await supabase
    .from('students' as any).select('id').eq('auth_user_id', user.id).maybeSingle();
  return (student as any)?.id ?? null;
}

async function fetchSamples(studentId: string): Promise<RuleInput> {
  const today = new Date();
  const ninetyDaysAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ninetyISO = ninetyDaysAgo.toISOString().slice(0, 10);
  const thirtyISO = thirtyDaysAgo.toISOString().slice(0, 10);

  const [sleepRes, hrRes, hrvRes, stepsRes, sessionsRes]: any[] = await Promise.all([
    supabase.from('daily_sleep_samples' as any)
      .select('sample_date, duration_minutes, efficiency_pct, deep_minutes, rem_minutes, light_minutes, awake_minutes')
      .eq('student_id', studentId)
      .gte('sample_date', ninetyISO)
      .order('sample_date', { ascending: false }),
    supabase.from('hr_resting_samples' as any)
      .select('sample_date, bpm')
      .eq('student_id', studentId)
      .gte('sample_date', ninetyISO)
      .order('sample_date', { ascending: false }),
    supabase.from('hrv_samples' as any)
      .select('sample_date, value_ms, source')
      .eq('student_id', studentId)
      .gte('sample_date', ninetyISO)
      .order('sample_date', { ascending: false }),
    supabase.from('daily_activity_samples' as any)
      .select('sample_date, steps')
      .eq('student_id', studentId)
      .gte('sample_date', thirtyISO)
      .order('sample_date', { ascending: false }),
    supabase.from('workout_sessions' as any)
      .select('started_at, status')
      .eq('student_id', studentId)
      .gte('started_at', thirtyDaysAgo.toISOString())
      .order('started_at', { ascending: false }),
  ]);

  const sleepSamples: SleepSample[] = (sleepRes.data ?? []).map((r: any) => ({
    sampleDate: r.sample_date,
    durationMinutes: r.duration_minutes,
    efficiencyPct: r.efficiency_pct,
    deepMinutes: r.deep_minutes,
    remMinutes: r.rem_minutes,
    lightMinutes: r.light_minutes,
    awakeMinutes: r.awake_minutes,
  }));
  const hrSamples: HrRestingSample[] = (hrRes.data ?? []).map((r: any) => ({
    sampleDate: r.sample_date,
    bpm: Number(r.bpm),
  }));
  // Fix discrepância #2: regras de HRV (queda/streak) calculam baseline sobre
  // a série. Misturar SDNN (iOS) e RMSSD (Android) corromperia o baseline, então
  // filtramos pra métrica do registro mais recente (rows vêm desc por data).
  const hrvRows = (hrvRes.data ?? []) as Array<{ sample_date: string; value_ms: number; source: string | null }>;
  const dominantHrvMetric = hrvMetricFromSource(hrvRows[0]?.source);
  const hrvSamples: HrvSample[] = hrvRows
    .filter((r) => !dominantHrvMetric || hrvMetricFromSource(r.source) === dominantHrvMetric)
    .map((r) => ({
      sampleDate: r.sample_date,
      valueMs: Number(r.value_ms),
    }));
  const stepsSamples: StepsSample[] = (stepsRes.data ?? []).map((r: any) => ({
    sampleDate: r.sample_date,
    steps: r.steps,
  }));
  const workoutSessions: WorkoutSessionSample[] = (sessionsRes.data ?? []).map((r: any) => ({
    startedAt: r.started_at,
    status: r.status,
  }));

  return { sleepSamples, hrSamples, hrvSamples, stepsSamples, workoutSessions, today };
}

export function useHealthInsights(): UseHealthInsightsResult {
  const [insights, setInsights] = useState<HealthInsight[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (ignoreCache: boolean) => {
    setIsLoading(true);
    setError(null);
    try {
      const studentId = await getStudentId();
      if (!studentId) {
        setInsights([]);
        return;
      }

      const cacheKey = `student-${studentId}`;
      if (!ignoreCache) {
        const cached = cacheGet(cacheKey);
        if (cached && isCacheFresh(cached)) {
          setInsights(cached.insights);
          return;
        }
      }

      const ruleInput = await fetchSamples(studentId);

      // Mínimo de 7 dias com pelo menos uma métrica (sleep ou HR ou steps)
      const totalSamples =
        ruleInput.sleepSamples.length +
        ruleInput.hrSamples.length +
        ruleInput.stepsSamples.length;
      if (totalSamples < 7) {
        setInsights([]);
        return;
      }

      const raw = evaluateInsights(ruleInput);
      const top3 = prioritize(raw);
      setInsights(top3);
      cacheSet(cacheKey, {
        insights: top3,
        generatedAt: Date.now(),
        forDate: todayLocalString(),
      });
    } catch (e: any) {
      if (__DEV__) console.warn('[useHealthInsights] load failed:', e?.message);
      setError(e?.message ?? 'failed');
      setInsights([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const refresh = useCallback(async () => {
    await load(true);
  }, [load]);

  return { insights, isLoading, error, refresh };
}
