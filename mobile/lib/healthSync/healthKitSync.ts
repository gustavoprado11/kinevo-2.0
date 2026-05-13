// Fase 14b — Função pura de sync HealthKit (iOS).
// Extraída do useHealthKitSync da 14a pra rodar fora do React (TaskManager).
import { Platform } from 'react-native';
import AppleHealthKit, {
  HealthInputOptions,
  HealthValue,
} from 'react-native-health';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  emptyCounts,
  getStudentId,
  recomputeReadinessLastDays,
  SyncCounts,
  toDateOnlyISO,
  upsertConnectionStatus,
} from './shared';

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

    if (stage === 'DEEP') { agg.deep_minutes += durMin; agg.duration_minutes += durMin; }
    else if (stage === 'REM') { agg.rem_minutes += durMin; agg.duration_minutes += durMin; }
    else if (stage === 'CORE' || stage === 'LIGHT') { agg.light_minutes += durMin; agg.duration_minutes += durMin; }
    else if (stage === 'AWAKE') { agg.awake_minutes += durMin; }
    else if (stage === 'ASLEEP') { agg.duration_minutes += durMin; }
  }

  for (const [, agg] of byDate) {
    const inBedMin = agg.raw
      .filter((r) => r.stage === 'INBED')
      .reduce((acc, r) => acc + (new Date(r.end).getTime() - new Date(r.start).getTime()) / 60000, 0);
    if (inBedMin > 0) {
      agg.efficiency_pct = Math.min(100, Math.round((agg.duration_minutes / inBedMin) * 1000) / 10);
    }
    agg.duration_minutes = Math.round(agg.duration_minutes);
    agg.deep_minutes = Math.round(agg.deep_minutes);
    agg.rem_minutes = Math.round(agg.rem_minutes);
    agg.light_minutes = Math.round(agg.light_minutes);
    agg.awake_minutes = Math.round(agg.awake_minutes);
  }
  return byDate;
}

function aggregateSamplesByDay(samples: HealthValue[]): Map<string, number> {
  const byDate = new Map<string, number>();
  for (const s of samples) {
    const day = toDateOnlyISO(new Date(s.endDate ?? s.startDate));
    byDate.set(day, (byDate.get(day) ?? 0) + Number(s.value ?? 0));
  }
  return byDate;
}

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

export interface SyncHealthKitResult {
  ok: boolean;
  counts: SyncCounts;
  error?: string;
}

export interface SyncHealthKitOptions {
  days: number;
  recomputeReadinessDays?: number;
}

/**
 * Sync HealthKit pra os últimos `days` dias do aluno autenticado.
 * Função pura — pode ser chamada de hook (foreground) ou TaskManager (background).
 */
export async function syncHealthKit(
  supabase: SupabaseClient<any>,
  options: SyncHealthKitOptions,
): Promise<SyncHealthKitResult> {
  const counts = emptyCounts();
  if (Platform.OS !== 'ios') {
    return { ok: false, counts, error: 'iOS only' };
  }

  const studentId = await getStudentId(supabase);
  if (!studentId) {
    return { ok: false, counts, error: 'student_not_found' };
  }

  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - options.days * 24 * 60 * 60 * 1000);
  const opts: HealthInputOptions = {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  };

  const granted: string[] = [];
  let lastError: string | undefined;

  // Sleep
  try {
    const samples = await call<SleepBlock[]>(AppleHealthKit.getSleepSamples.bind(AppleHealthKit), opts);
    const byDate = aggregateSleep(samples ?? []);
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
    if (__DEV__) console.warn('[syncHealthKit] sleep failed:', e?.message);
    lastError = e?.message;
  }

  // Activity (steps + calories + distance)
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
    if (__DEV__) console.warn('[syncHealthKit] activity failed:', e?.message);
    lastError = e?.message;
  }

  // HR repouso
  try {
    const samples = await call<HealthValue[]>(AppleHealthKit.getRestingHeartRateSamples.bind(AppleHealthKit), opts);
    const byDay = pickDailyHrValue(samples ?? []);
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
    if (__DEV__) console.warn('[syncHealthKit] hr_resting failed:', e?.message);
    lastError = e?.message;
  }

  // HRV (SDNN) — pode falhar sem Apple Watch (vazio, não-erro)
  try {
    const samples = await call<HealthValue[]>(
      AppleHealthKit.getHeartRateVariabilitySamples.bind(AppleHealthKit),
      opts,
    );
    const byDay = pickDailyHrValue(samples ?? []);
    if (byDay.size > 0) granted.push('hrv');
    for (const [day, valueMs] of byDay) {
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
    if (__DEV__) console.warn('[syncHealthKit] hrv failed:', e?.message);
  }

  await upsertConnectionStatus(supabase, studentId, 'healthkit', {
    status: lastError ? 'error' : 'active',
    granted_categories: granted,
    last_error: lastError ?? null,
  });

  if (options.recomputeReadinessDays && options.recomputeReadinessDays > 0) {
    await recomputeReadinessLastDays(supabase, studentId, options.recomputeReadinessDays);
  }

  return { ok: !lastError, counts, error: lastError };
}
