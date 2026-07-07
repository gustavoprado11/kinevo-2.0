// Fase 14a (refatorado na 14b → reescrito na 14c migração Kingstinct).
// Função pura de sync HealthKit pra iOS via @kingstinct/react-native-healthkit.
// Sem hooks — pode rodar dentro de TaskManager (background, sem React).
import { Platform } from 'react-native';
import {
  queryCategorySamples,
  queryQuantitySamples,
  queryStatisticsCollectionForQuantity,
  CategoryValueSleepAnalysis,
  type CategorySampleTyped,
  type QuantitySampleTyped,
  type QuantityTypeIdentifier,
  type StatisticsOptions,
} from '@kingstinct/react-native-healthkit';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  emptyCounts,
  getStudentId,
  mergedMinutes,
  recomputeReadinessLastDays,
  SyncCounts,
  TimeInterval,
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

// Fix discrepância #5: em vez de somar a duração de cada sample (que conta em
// dobro quando Apple Watch + app terceiro gravam a mesma noite), coletamos os
// intervalos por fase e mesclamos os sobrepostos (mergedMinutes). Cada minuto
// é contado uma vez só. duration = cobertura mesclada de TODAS as fases de sono.
interface SleepIntervals {
  deep: TimeInterval[];
  rem: TimeInterval[];
  light: TimeInterval[];
  asleepAny: TimeInterval[]; // união de deep+rem+core+asleep(legacy) p/ duração
  awake: TimeInterval[];
  inBed: TimeInterval[];
  raw: Array<{ start: string; end: string; stage: number }>;
}

function aggregateSleep(samples: readonly SleepSample[]): Map<string, SleepDailyAgg> {
  const acc = new Map<string, SleepIntervals>();
  for (const sample of samples) {
    const start = sample.startDate.getTime();
    const end = sample.endDate.getTime();
    if (!(end > start)) continue;
    const value = Number(sample.value);
    const iv: TimeInterval = { start, end };

    const sampleDate = toDateOnlyISO(sample.endDate);
    let day = acc.get(sampleDate);
    if (!day) {
      day = { deep: [], rem: [], light: [], asleepAny: [], awake: [], inBed: [], raw: [] };
      acc.set(sampleDate, day);
    }

    day.raw.push({ start: sample.startDate.toISOString(), end: sample.endDate.toISOString(), stage: value });

    if (value === CategoryValueSleepAnalysis.asleepDeep) {
      day.deep.push(iv);
      day.asleepAny.push(iv);
    } else if (value === CategoryValueSleepAnalysis.asleepREM) {
      day.rem.push(iv);
      day.asleepAny.push(iv);
    } else if (value === CategoryValueSleepAnalysis.asleepCore) {
      day.light.push(iv);
      day.asleepAny.push(iv);
    } else if (value === CategoryValueSleepAnalysis.awake) {
      day.awake.push(iv);
    } else if (value === CategoryValueSleepAnalysis.asleep || value === CategoryValueSleepAnalysis.asleepUnspecified) {
      // Legacy single-stage: conta como duração mas sem detalhamento de fase
      day.asleepAny.push(iv);
    } else if (value === CategoryValueSleepAnalysis.inBed) {
      day.inBed.push(iv);
    }
  }

  const byDate = new Map<string, SleepDailyAgg>();
  for (const [sampleDate, day] of acc) {
    const duration = mergedMinutes(day.asleepAny);
    const deep = mergedMinutes(day.deep);
    const rem = mergedMinutes(day.rem);
    const light = mergedMinutes(day.light);
    const awake = mergedMinutes(day.awake);
    const explicitInBed = mergedMinutes(day.inBed);
    // Fallback: Apple Watch sempre emite inBed; iPhone-only/apps third-party
    // podem omitir. Sem inBed explícito, usa asleep+awake como proxy.
    const inBedMin = Math.max(explicitInBed, duration + awake);
    const efficiency_pct = inBedMin > 0
      ? Math.min(100, Math.round((duration / inBedMin) * 1000) / 10)
      : null;
    byDate.set(sampleDate, {
      duration_minutes: Math.round(duration),
      efficiency_pct,
      deep_minutes: Math.round(deep),
      rem_minutes: Math.round(rem),
      light_minutes: Math.round(light),
      awake_minutes: Math.round(awake),
      raw: day.raw,
    });
  }
  return byDate;
}

// Fix discrepância #1/#3: bucket diário DEDUPLICADO entre fontes via
// HKStatisticsCollectionQuery. Somar samples brutos (queryQuantitySamples)
// conta o mesmo passo/caloria 2-3x quando iPhone + Apple Watch + apps
// terceiros gravam em paralelo — o app Saúde já deduplica. Esta query
// espelha exatamente o número do app Saúde.
//   'cumulativeSum'  → passos, calorias, distância (totais do dia)
//   'discreteAverage'→ FC repouso (valor representativo, não média cega)
async function queryDailyStatistic(
  identifier: QuantityTypeIdentifier,
  option: 'cumulativeSum' | 'discreteAverage',
  startDate: Date,
  endDate: Date,
): Promise<Map<string, number>> {
  const byDate = new Map<string, number>();
  // Anchor à meia-noite local: alinha os buckets ao dia do dispositivo
  // (consistente com toDateOnlyISO), evitando vazamento de fuso (UTC-3+).
  const anchor = new Date(startDate);
  anchor.setHours(0, 0, 0, 0);
  const collection = await queryStatisticsCollectionForQuantity(
    identifier,
    [option] as StatisticsOptions[],
    anchor,
    { day: 1 },
    { filter: { date: { startDate, endDate } } },
  );
  for (const bucket of collection ?? []) {
    const when = bucket.startDate ?? bucket.endDate;
    if (!when) continue;
    const q = option === 'cumulativeSum' ? bucket.sumQuantity : bucket.averageQuantity;
    const value = q?.quantity;
    if (value == null || !Number.isFinite(value) || value <= 0) continue;
    byDate.set(toDateOnlyISO(when), value);
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

  // ── Activity (steps + active energy + distance) — deduplicado entre fontes ──
  try {
    const [stepsByDay, kcalByDay, distByDay] = await Promise.all([
      queryDailyStatistic('HKQuantityTypeIdentifierStepCount', 'cumulativeSum', startDate, endDate).catch(() => new Map<string, number>()),
      queryDailyStatistic('HKQuantityTypeIdentifierActiveEnergyBurned', 'cumulativeSum', startDate, endDate).catch(() => new Map<string, number>()),
      queryDailyStatistic('HKQuantityTypeIdentifierDistanceWalkingRunning', 'cumulativeSum', startDate, endDate).catch(() => new Map<string, number>()),
    ]);
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

  // ── HR repouso — valor diário representativo, deduplicado entre fontes ──
  try {
    const byDay = await queryDailyStatistic('HKQuantityTypeIdentifierRestingHeartRate', 'discreteAverage', startDate, endDate);
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
    // Fix item 7 (analise-saude-aluno-2026-07-07): antes a exceção do HRV era
    // engolida sem tocar lastError → uma falha REAL de query ficava invisível e
    // a conexão seguia 'active'. Sem Apple Watch o HealthKit retorna VAZIO (não
    // lança), então chegar aqui é erro genuíno — registra como as outras
    // categorias (self-healing: limpa no próximo sync com sucesso).
    if (__DEV__) console.warn('[syncHealthKit] hrv failed:', e?.message);
    lastError = e?.message ?? lastError;
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
