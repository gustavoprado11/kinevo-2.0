// Fase 14a (refatorado na 14b → reescrito na 14c migração Kingstinct).
// Função pura de sync HealthKit pra iOS via @kingstinct/react-native-healthkit.
// Sem hooks — pode rodar dentro de TaskManager (background, sem React).
import { Platform } from 'react-native';
import {
  queryCategorySamples,
  queryQuantitySamples,
  CategoryValueSleepAnalysis,
  type CategorySampleTyped,
  type QuantitySampleTyped,
} from '@kingstinct/react-native-healthkit';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  emptyCounts,
  getStudentId,
  recomputeReadinessLastDays,
  SyncCounts,
  toDateOnlyISO,
  upsertConnectionStatus,
} from './shared';

// Identifiers de leitura — exportado pra reuso no hook (requestAuthorization).
export const READ_IDENTIFIERS = [
  'HKCategoryTypeIdentifierSleepAnalysis',
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierRestingHeartRate',
  'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
  'HKQuantityTypeIdentifierActiveEnergyBurned',
  'HKQuantityTypeIdentifierDistanceWalkingRunning',
] as const;

// ──────────────────────────────────────────────────────────────────────────────
// Sleep aggregation (Kingstinct)
// queryCategorySamples('SleepAnalysis') retorna blocos com value enum:
//   inBed=0, asleepUnspecified=1, awake=2, asleepCore=3, asleepDeep=4, asleepREM=5
// Eficiência = (asleep total) / (in bed total).
// ──────────────────────────────────────────────────────────────────────────────

type SleepSample = CategorySampleTyped<'HKCategoryTypeIdentifierSleepAnalysis'>;

interface SleepDailyAgg {
  duration_minutes: number;
  efficiency_pct: number | null;
  deep_minutes: number;
  rem_minutes: number;
  light_minutes: number;
  awake_minutes: number;
  raw: Array<{ start: string; end: string; stage: number }>;
}

function aggregateSleep(samples: readonly SleepSample[]): Map<string, SleepDailyAgg> {
  const byDate = new Map<string, SleepDailyAgg>();
  for (const sample of samples) {
    const start = sample.startDate;
    const end = sample.endDate;
    const durMin = Math.max(0, (end.getTime() - start.getTime()) / 60000);
    if (durMin <= 0) continue;
    const value = Number(sample.value);

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

    agg.raw.push({ start: start.toISOString(), end: end.toISOString(), stage: value });

    if (value === CategoryValueSleepAnalysis.asleepDeep) {
      agg.deep_minutes += durMin;
      agg.duration_minutes += durMin;
    } else if (value === CategoryValueSleepAnalysis.asleepREM) {
      agg.rem_minutes += durMin;
      agg.duration_minutes += durMin;
    } else if (value === CategoryValueSleepAnalysis.asleepCore) {
      agg.light_minutes += durMin;
      agg.duration_minutes += durMin;
    } else if (value === CategoryValueSleepAnalysis.awake) {
      agg.awake_minutes += durMin;
    } else if (value === CategoryValueSleepAnalysis.asleep || value === CategoryValueSleepAnalysis.asleepUnspecified) {
      // Legacy single-stage: conta como duração mas sem detalhamento
      agg.duration_minutes += durMin;
    }
    // inBed (0) é ignorado — só usado pra cálculo de eficiência abaixo
  }

  for (const [, agg] of byDate) {
    const explicitInBed = agg.raw
      .filter((r) => r.stage === CategoryValueSleepAnalysis.inBed)
      .reduce((acc, r) => acc + (new Date(r.end).getTime() - new Date(r.start).getTime()) / 60000, 0);
    // Fallback robustness: se Apple emitir samples só por fase de sono
    // (sem inBed explícito), usa asleep+awake como proxy de tempo na cama.
    // Apple Watch padrão sempre emite inBed; iPhone-only ou apps third-party
    // podem omitir. Sem este fallback, efficiency_pct viraria null.
    const inBedMin = Math.max(explicitInBed, agg.duration_minutes + agg.awake_minutes);
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

function aggregateQuantitySamplesByDay(samples: readonly QuantitySampleTyped<any>[]): Map<string, number> {
  const byDate = new Map<string, number>();
  for (const s of samples) {
    const day = toDateOnlyISO(s.endDate ?? s.startDate);
    byDate.set(day, (byDate.get(day) ?? 0) + Number(s.quantity ?? 0));
  }
  return byDate;
}

function averageQuantityByDay(samples: readonly QuantitySampleTyped<any>[]): Map<string, number> {
  const acc = new Map<string, { sum: number; count: number }>();
  for (const s of samples) {
    const day = toDateOnlyISO(s.endDate ?? s.startDate);
    const v = Number(s.quantity ?? 0);
    if (!Number.isFinite(v) || v <= 0) continue;
    const cur = acc.get(day) ?? { sum: 0, count: 0 };
    cur.sum += v;
    cur.count += 1;
    acc.set(day, cur);
  }
  const result = new Map<string, number>();
  for (const [day, { sum, count }] of acc) result.set(day, sum / count);
  return result;
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
  const dateFilter = { date: { startDate, endDate } };
  let lastError: string | undefined;
  // Fix BUG 2 — não derivar granted_categories do conteúdo retornado pelas
  // queries (Apple Saúde vazio ≠ permissão negada). granted_categories é
  // populado em useHealthKitSync.requestAuthorization após autorização e
  // editado granularmente via toggles em Settings.

  // ── Sleep ──
  try {
    const samples = await queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', {
      filter: dateFilter,
      limit: 0,
      ascending: true,
    });
    const byDate = aggregateSleep(samples ?? []);
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

  // ── Activity (steps + active energy + distance) ──
  try {
    const [stepsSamples, kcalSamples, distSamples] = await Promise.all([
      queryQuantitySamples('HKQuantityTypeIdentifierStepCount', { filter: dateFilter, limit: 0, ascending: true } as any).catch(() => []),
      queryQuantitySamples('HKQuantityTypeIdentifierActiveEnergyBurned', { filter: dateFilter, limit: 0, ascending: true } as any).catch(() => []),
      queryQuantitySamples('HKQuantityTypeIdentifierDistanceWalkingRunning', { filter: dateFilter, limit: 0, ascending: true } as any).catch(() => []),
    ]);
    const stepsByDay = aggregateQuantitySamplesByDay(stepsSamples as readonly QuantitySampleTyped<any>[]);
    const kcalByDay = aggregateQuantitySamplesByDay(kcalSamples as readonly QuantitySampleTyped<any>[]);
    const distByDay = aggregateQuantitySamplesByDay(distSamples as readonly QuantitySampleTyped<any>[]);
    const allDays = new Set<string>([...stepsByDay.keys(), ...kcalByDay.keys(), ...distByDay.keys()]);
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

  // ── HR repouso ──
  try {
    const samples = await queryQuantitySamples('HKQuantityTypeIdentifierRestingHeartRate', {
      filter: dateFilter,
      limit: 0,
      ascending: true,
    } as any);
    const byDay = averageQuantityByDay(samples as readonly QuantitySampleTyped<any>[]);
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

  // ── HRV (SDNN em ms) — pode falhar sem Apple Watch (vazio, não-erro) ──
  try {
    const samples = await queryQuantitySamples('HKQuantityTypeIdentifierHeartRateVariabilitySDNN', {
      filter: dateFilter,
      limit: 0,
      ascending: true,
    } as any);
    const byDay = averageQuantityByDay(samples as readonly QuantitySampleTyped<any>[]);
    for (const [day, valueMs] of byDay) {
      // Kingstinct retorna em ms diretamente quando unit é 'ms' (default pra HRV SDNN)
      await supabase.from('hrv_samples' as any).upsert(
        {
          student_id: studentId,
          sample_date: day,
          value_ms: Math.round(valueMs * 100) / 100,
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

  // Não passa granted_categories aqui — preserva valor anterior persistido
  // pela requestAuthorization (que populou com as 4 categorias autorizadas)
  // ou pelos toggles granulares em Settings.
  await upsertConnectionStatus(supabase, studentId, 'healthkit', {
    status: lastError ? 'error' : 'active',
    last_error: lastError ?? null,
  });

  if (options.recomputeReadinessDays && options.recomputeReadinessDays > 0) {
    await recomputeReadinessLastDays(supabase, studentId, options.recomputeReadinessDays);
  }

  return { ok: !lastError, counts, error: lastError };
}
