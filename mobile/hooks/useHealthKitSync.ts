import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import AppleHealthKit, {
  HealthKitPermissions,
  HealthValue,
  HealthInputOptions,
} from 'react-native-health';
import { supabase } from '../lib/supabase';

// ──────────────────────────────────────────────────────────────────────────────
// Permissions — 4 categorias de leitura + 2 auxiliares (activity / distance)
// que populam daily_activity_samples junto com steps.
// ──────────────────────────────────────────────────────────────────────────────
const PERMISSIONS: HealthKitPermissions = {
  permissions: {
    read: [
      AppleHealthKit.Constants.Permissions.SleepAnalysis,
      AppleHealthKit.Constants.Permissions.StepCount,
      AppleHealthKit.Constants.Permissions.RestingHeartRate,
      AppleHealthKit.Constants.Permissions.HeartRateVariability,
      AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
      AppleHealthKit.Constants.Permissions.DistanceWalkingRunning,
    ],
    write: [],
  },
};

export type HealthCategory = 'sleep' | 'steps' | 'hr_resting' | 'hrv';
export type SyncCounts = Record<HealthCategory, number>;

export interface UseHealthKitSyncResult {
  isAuthorized: boolean;
  isLoading: boolean;
  error: string | null;
  requestAuthorization: () => Promise<boolean>;
  syncHistorical: (days: number) => Promise<{ ok: boolean; counts: SyncCounts; error?: string }>;
  syncIncremental: () => Promise<{ ok: boolean; counts: SyncCounts; error?: string }>;
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers internos
// ──────────────────────────────────────────────────────────────────────────────

function toDateOnlyISO(d: Date): string {
  // YYYY-MM-DD
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

// Promisify callback-based API da lib
function call<T>(
  fn: (opts: HealthInputOptions, cb: (err: string, results: T) => void) => void,
  opts: HealthInputOptions,
): Promise<T> {
  return new Promise((resolve, reject) => {
    fn(opts, (err, results) => {
      if (err) reject(new Error(err));
      else resolve(results);
    });
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Sleep aggregation
// HealthKit retorna blocos (cada interval pode ser INBED / ASLEEP / CORE / DEEP / REM / AWAKE).
// Agrupamos por noite (sample_date = data do endDate). Eficiencia = asleep / inBed.
// ──────────────────────────────────────────────────────────────────────────────
type SleepBlock = HealthValue & { value: string | number };

interface SleepDailyAgg {
  duration_minutes: number;
  efficiency_pct: number | null;
  deep_minutes: number;
  rem_minutes: number;
  light_minutes: number;
  awake_minutes: number;
  raw: Array<{ start: string; end: string; stage: string }>;
}

function aggregateSleep(blocks: SleepBlock[]): Map<string, SleepDailyAgg> {
  const byDate = new Map<string, SleepDailyAgg>();
  for (const block of blocks) {
    const stage = String(block.value ?? '').toUpperCase();
    const start = new Date(block.startDate);
    const end = new Date(block.endDate);
    const durMin = Math.max(0, (end.getTime() - start.getTime()) / 60000);
    if (durMin <= 0) continue;

    const sampleDate = toDateOnlyISO(end);
    let agg = byDate.get(sampleDate);
    if (!agg) {
      agg = {
        duration_minutes: 0,
        efficiency_pct: null,
        deep_minutes: 0,
        rem_minutes: 0,
        light_minutes: 0,
        awake_minutes: 0,
        raw: [],
      };
      byDate.set(sampleDate, agg);
    }

    agg.raw.push({ start: block.startDate, end: block.endDate, stage });

    // Categorizar fases:
    // ASLEEP (legacy) → soma em duration mas sem fase
    // DEEP / REM / CORE (light) → soma em duration + fase
    // AWAKE / INBED → não conta em asleep, mas INBED conta em total_in_bed
    if (stage === 'DEEP') {
      agg.deep_minutes += durMin;
      agg.duration_minutes += durMin;
    } else if (stage === 'REM') {
      agg.rem_minutes += durMin;
      agg.duration_minutes += durMin;
    } else if (stage === 'CORE' || stage === 'LIGHT') {
      agg.light_minutes += durMin;
      agg.duration_minutes += durMin;
    } else if (stage === 'AWAKE') {
      agg.awake_minutes += durMin;
    } else if (stage === 'ASLEEP') {
      // Legacy single-stage: conta como duração mas sem detalhamento de fase
      agg.duration_minutes += durMin;
    }
    // INBED é ignorado — só usado pra cálculo de eficiência abaixo
  }

  // Calcular efficiency_pct = asleep / total_in_bed por data
  for (const [date, agg] of byDate) {
    const inBedMin = agg.raw
      .filter((r) => r.stage === 'INBED')
      .reduce((acc, r) => acc + (new Date(r.end).getTime() - new Date(r.start).getTime()) / 60000, 0);
    if (inBedMin > 0) {
      const totalSleepish = agg.duration_minutes;
      agg.efficiency_pct = Math.min(100, Math.round((totalSleepish / inBedMin) * 1000) / 10);
    }
    // Round all minute values
    agg.duration_minutes = Math.round(agg.duration_minutes);
    agg.deep_minutes = Math.round(agg.deep_minutes);
    agg.rem_minutes = Math.round(agg.rem_minutes);
    agg.light_minutes = Math.round(agg.light_minutes);
    agg.awake_minutes = Math.round(agg.awake_minutes);
  }
  return byDate;
}

// ──────────────────────────────────────────────────────────────────────────────
// Steps + ActiveEnergy aggregation por dia
// ──────────────────────────────────────────────────────────────────────────────
function aggregateSamplesByDay(samples: HealthValue[]): Map<string, number> {
  const byDate = new Map<string, number>();
  for (const s of samples) {
    const day = toDateOnlyISO(new Date(s.endDate ?? s.startDate));
    byDate.set(day, (byDate.get(day) ?? 0) + Number(s.value ?? 0));
  }
  return byDate;
}

// HR / HRV samples — pegar valor diário (média do dia ou último valor).
// Para HR repouso: HealthKit já retorna 1 valor por dia tipicamente.
function pickDailyHrValue(samples: HealthValue[]): Map<string, number> {
  const byDate = new Map<string, { sum: number; count: number }>();
  for (const s of samples) {
    const day = toDateOnlyISO(new Date(s.endDate ?? s.startDate));
    const v = Number(s.value ?? 0);
    if (!Number.isFinite(v) || v <= 0) continue;
    const cur = byDate.get(day) ?? { sum: 0, count: 0 };
    cur.sum += v;
    cur.count += 1;
    byDate.set(day, cur);
  }
  const result = new Map<string, number>();
  for (const [day, { sum, count }] of byDate) {
    result.set(day, sum / count);
  }
  return result;
}

// ──────────────────────────────────────────────────────────────────────────────
// Hook
// ──────────────────────────────────────────────────────────────────────────────
export function useHealthKitSync(): UseHealthKitSyncResult {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pré-checa autorização ao montar (best-effort — iOS não expõe granular reads)
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AppleHealthKit.isAvailable((err, available) => {
      if (err || !available) return;
      // Sem método pra "isAuthorized" agregado — assume true se já houve init bem-sucedido
      // antes; UI deve mostrar estado real via wearable_connections.status.
    });
  }, []);

  const requestAuthorization = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'ios') {
      setError('HealthKit disponível apenas no iOS');
      return false;
    }
    return new Promise((resolve) => {
      AppleHealthKit.initHealthKit(PERMISSIONS, (err) => {
        if (err) {
          setError(err);
          setIsAuthorized(false);
          resolve(false);
        } else {
          setError(null);
          setIsAuthorized(true);
          resolve(true);
        }
      });
    });
  }, []);

  const syncWindow = useCallback(async (days: number): Promise<{ ok: boolean; counts: SyncCounts; error?: string }> => {
    if (Platform.OS !== 'ios') {
      return { ok: false, counts: { sleep: 0, steps: 0, hr_resting: 0, hrv: 0 }, error: 'iOS only' };
    }
    setIsLoading(true);
    setError(null);

    const counts: SyncCounts = { sleep: 0, steps: 0, hr_resting: 0, hrv: 0 };
    let lastError: string | undefined;

    try {
      const studentId = await getCurrentStudentId();
      if (!studentId) {
        return { ok: false, counts, error: 'student_not_found' };
      }

      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
      const opts: HealthInputOptions = {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      };

      const granted: string[] = [];

      // ── Sleep ────────────────────────────────────────────────
      try {
        const sleepSamples = await call<SleepBlock[]>(AppleHealthKit.getSleepSamples.bind(AppleHealthKit), opts);
        const byDate = aggregateSleep(sleepSamples ?? []);
        if (byDate.size > 0) granted.push('sleep');
        for (const [sample_date, agg] of byDate) {
          await supabase.from('daily_sleep_samples' as any).upsert(
            {
              student_id: studentId,
              sample_date,
              duration_minutes: agg.duration_minutes || null,
              efficiency_pct: agg.efficiency_pct,
              deep_minutes: agg.deep_minutes || null,
              rem_minutes: agg.rem_minutes || null,
              light_minutes: agg.light_minutes || null,
              awake_minutes: agg.awake_minutes || null,
              source: 'healthkit',
              raw: agg.raw,
              synced_at: new Date().toISOString(),
            },
            { onConflict: 'student_id,sample_date' }
          );
          counts.sleep += 1;
        }
      } catch (e: any) {
        if (__DEV__) console.warn('[useHealthKitSync] sleep failed:', e?.message);
        lastError = e?.message;
      }

      // ── Steps + ActiveEnergy + Distance → daily_activity_samples ──
      try {
        const [steps, kcal, dist] = await Promise.all([
          call<HealthValue[]>(AppleHealthKit.getDailyStepCountSamples.bind(AppleHealthKit), opts).catch(() => []),
          call<HealthValue[]>(AppleHealthKit.getActiveEnergyBurned.bind(AppleHealthKit), opts).catch(() => []),
          call<HealthValue[]>(AppleHealthKit.getDailyDistanceWalkingRunningSamples.bind(AppleHealthKit), opts).catch(() => []),
        ]);
        const stepsByDay = aggregateSamplesByDay(steps);
        const kcalByDay = aggregateSamplesByDay(kcal);
        const distByDay = aggregateSamplesByDay(dist);
        const allDays = new Set<string>([...stepsByDay.keys(), ...kcalByDay.keys(), ...distByDay.keys()]);
        if (allDays.size > 0) granted.push('steps');
        for (const day of allDays) {
          await supabase.from('daily_activity_samples' as any).upsert(
            {
              student_id: studentId,
              sample_date: day,
              steps: stepsByDay.has(day) ? Math.round(stepsByDay.get(day)!) : null,
              calories_active: kcalByDay.has(day) ? Math.round(kcalByDay.get(day)! * 100) / 100 : null,
              distance_meters: distByDay.has(day) ? Math.round(distByDay.get(day)! * 100) / 100 : null,
              source: 'healthkit',
              synced_at: new Date().toISOString(),
            },
            { onConflict: 'student_id,sample_date' }
          );
          counts.steps += 1;
        }
      } catch (e: any) {
        if (__DEV__) console.warn('[useHealthKitSync] activity failed:', e?.message);
        lastError = e?.message;
      }

      // ── HR repouso ───────────────────────────────────────────
      try {
        const hrSamples = await call<HealthValue[]>(AppleHealthKit.getRestingHeartRateSamples.bind(AppleHealthKit), opts);
        const byDay = pickDailyHrValue(hrSamples ?? []);
        if (byDay.size > 0) granted.push('hr_resting');
        for (const [day, bpm] of byDay) {
          await supabase.from('hr_resting_samples' as any).upsert(
            {
              student_id: studentId,
              sample_date: day,
              bpm: Math.round(bpm),
              source: 'healthkit',
              synced_at: new Date().toISOString(),
            },
            { onConflict: 'student_id,sample_date' }
          );
          counts.hr_resting += 1;
        }
      } catch (e: any) {
        if (__DEV__) console.warn('[useHealthKitSync] hr_resting failed:', e?.message);
        lastError = e?.message;
      }

      // ── HRV (SDNN) — requer Apple Watch ──────────────────────
      try {
        const hrvSamples = await call<HealthValue[]>(
          AppleHealthKit.getHeartRateVariabilitySamples.bind(AppleHealthKit),
          opts,
        );
        const byDay = pickDailyHrValue(hrvSamples ?? []);
        if (byDay.size > 0) granted.push('hrv');
        for (const [day, valueMs] of byDay) {
          // HealthKit retorna em segundos (SDNN). Multiplica por 1000 pra ms.
          const ms = valueMs < 1 ? valueMs * 1000 : valueMs;
          await supabase.from('hrv_samples' as any).upsert(
            {
              student_id: studentId,
              sample_date: day,
              value_ms: Math.round(ms * 100) / 100,
              source: 'healthkit',
              synced_at: new Date().toISOString(),
            },
            { onConflict: 'student_id,sample_date' }
          );
          counts.hrv += 1;
        }
      } catch (e: any) {
        if (__DEV__) console.warn('[useHealthKitSync] hrv failed:', e?.message);
        // HRV vazio quando aluno só tem iPhone — não é erro
      }

      // ── wearable_connections upsert ──────────────────────────
      await supabase.from('wearable_connections' as any).upsert(
        {
          student_id: studentId,
          source: 'healthkit',
          status: lastError ? 'error' : 'active',
          granted_categories: granted,
          last_sync_at: new Date().toISOString(),
          last_error: lastError ?? null,
        },
        { onConflict: 'student_id,source' }
      );

      if (lastError) setError(lastError);
      return { ok: !lastError, counts, error: lastError };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const syncHistorical = useCallback((days: number) => syncWindow(days), [syncWindow]);
  const syncIncremental = useCallback(() => syncWindow(7), [syncWindow]);

  return {
    isAuthorized,
    isLoading,
    error,
    requestAuthorization,
    syncHistorical,
    syncIncremental,
  };
}
