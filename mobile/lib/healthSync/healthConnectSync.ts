// Fase 14b — Função pura de sync Health Connect (Android).
// Espelha syncHealthKit. Funções puras (sem hooks) — chamável de TaskManager.
import { Platform } from 'react-native';
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

// Lib é importada apenas no Android — em iOS, requires native (não existe).
// Tipos importados eagerly (não causam runtime side-effect).
import type {
  SleepSessionRecord,
  HeartRateVariabilityRmssdRecord,
} from 'react-native-health-connect/lib/typescript/types/records.types';
import type { AggregationGroupResult } from 'react-native-health-connect/lib/typescript/types/aggregate.types';

export type HealthConnectSdkStatus = 'available' | 'unavailable' | 'update_required' | 'unsupported';

// Stage codes do constants.SleepStageType
const STAGE_AWAKE = 1;
const STAGE_SLEEPING = 2;
const STAGE_LIGHT = 4;
const STAGE_DEEP = 5;
const STAGE_REM = 6;

function loadHC() {
  // Lazy-require pra evitar crash em iOS (módulo nativo não existe).
  // Em Android é importado normalmente. eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('react-native-health-connect');
}

/**
 * Mapeia constant numérica de SdkAvailabilityStatus pra string semântica.
 */
export async function checkHealthConnectSdkStatus(): Promise<HealthConnectSdkStatus> {
  if (Platform.OS !== 'android') return 'unsupported';
  try {
    const hc = loadHC();
    const status: number = await hc.getSdkStatus();
    if (status === hc.SdkAvailabilityStatus.SDK_AVAILABLE) return 'available';
    if (status === hc.SdkAvailabilityStatus.SDK_UNAVAILABLE) return 'unavailable';
    if (status === hc.SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) return 'update_required';
    return 'unavailable';
  } catch (e: any) {
    if (__DEV__) console.warn('[healthConnect] getSdkStatus threw:', e?.message);
    return 'unsupported';
  }
}

export const HC_PERMISSIONS = [
  { accessType: 'read', recordType: 'SleepSession' },
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'RestingHeartRate' },
  { accessType: 'read', recordType: 'HeartRateVariabilityRmssd' },
  { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
  { accessType: 'read', recordType: 'Distance' },
] as const;

/**
 * Pede autorização pras 5+1 record types. Retorna lista de recordType
 * efetivamente concedidos pelo usuário (granular).
 */
export async function requestHealthConnectAuthorization(): Promise<string[]> {
  if (Platform.OS !== 'android') return [];
  const hc = loadHC();
  const initialized: boolean = await hc.initialize();
  if (!initialized) return [];
  const granted: Array<{ accessType: string; recordType: string }> = await hc.requestPermission(
    HC_PERMISSIONS as unknown as any[],
  );
  return granted.filter((p) => p.accessType === 'read').map((p) => p.recordType);
}

/**
 * Retorna lista de recordType já concedidos previamente (sem abrir intent).
 */
export async function getHealthConnectGrantedRecordTypes(): Promise<string[]> {
  if (Platform.OS !== 'android') return [];
  try {
    const hc = loadHC();
    const granted: Array<{ accessType: string; recordType: string }> = await hc.getGrantedPermissions();
    return granted.filter((p) => p.accessType === 'read').map((p) => p.recordType);
  } catch {
    return [];
  }
}

function recordTypeToCategory(recordType: string): string | null {
  if (recordType === 'SleepSession') return 'sleep';
  if (recordType === 'Steps') return 'steps';
  if (recordType === 'RestingHeartRate') return 'hr_resting';
  if (recordType === 'HeartRateVariabilityRmssd') return 'hrv';
  return null;
}

// aggregateGroupByPeriod exige TimeRangeFilter em hora LOCAL (sem 'Z'/offset),
// pois o slicing por 'DAYS' é baseado no calendário. ISO com Z (instant) faz
// o Health Connect lançar erro. Formata YYYY-MM-DDTHH:mm:ss em hora local.
function toLocalDateTimeNoTZ(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${day}T${h}:${min}:${s}`;
}

interface SleepDailyAgg {
  duration_minutes: number;
  efficiency_pct: number | null;
  deep_minutes: number;
  rem_minutes: number;
  light_minutes: number;
  awake_minutes: number;
  raw: Array<{ start: string; end: string; stage?: number }>;
}

// Fix discrepância #5: mescla intervalos sobrepostos (mergedMinutes) em vez de
// somar durações. Quando >1 app grava SleepSession da mesma noite, somar
// duplicava. duration = cobertura mesclada das fases de sono; o total da
// sessão (mesclado) vira o denominador da eficiência (proxy de tempo na cama).
interface SleepIntervalsHC {
  deep: TimeInterval[];
  rem: TimeInterval[];
  light: TimeInterval[];
  asleepAny: TimeInterval[];
  awake: TimeInterval[];
  session: TimeInterval[];
  raw: Array<{ start: string; end: string; stage?: number }>;
}

function aggregateSleepSessions(sessions: SleepSessionRecord[]): Map<string, SleepDailyAgg> {
  const acc = new Map<string, SleepIntervalsHC>();
  for (const session of sessions ?? []) {
    const sessionStart = new Date(session.startTime).getTime();
    const sessionEnd = new Date(session.endTime).getTime();
    if (!(sessionEnd > sessionStart)) continue;
    const day = toDateOnlyISO(new Date(session.endTime));

    let d = acc.get(day);
    if (!d) {
      d = { deep: [], rem: [], light: [], asleepAny: [], awake: [], session: [], raw: [] };
      acc.set(day, d);
    }

    d.session.push({ start: sessionStart, end: sessionEnd });

    if (session.stages && session.stages.length > 0) {
      for (const stg of session.stages) {
        const sStart = new Date(stg.startTime).getTime();
        const sEnd = new Date(stg.endTime).getTime();
        if (!(sEnd > sStart)) continue;
        const iv: TimeInterval = { start: sStart, end: sEnd };
        d.raw.push({ start: stg.startTime, end: stg.endTime, stage: stg.stage });
        if (stg.stage === STAGE_DEEP) { d.deep.push(iv); d.asleepAny.push(iv); }
        else if (stg.stage === STAGE_REM) { d.rem.push(iv); d.asleepAny.push(iv); }
        else if (stg.stage === STAGE_LIGHT) { d.light.push(iv); d.asleepAny.push(iv); }
        else if (stg.stage === STAGE_AWAKE) { d.awake.push(iv); }
        else if (stg.stage === STAGE_SLEEPING) { d.asleepAny.push(iv); }
      }
    } else {
      // Sem stages: a sessão inteira conta como sono
      d.asleepAny.push({ start: sessionStart, end: sessionEnd });
      d.raw.push({ start: session.startTime, end: session.endTime });
    }
  }

  const byDate = new Map<string, SleepDailyAgg>();
  for (const [day, d] of acc) {
    const duration = mergedMinutes(d.asleepAny);
    const awake = mergedMinutes(d.awake);
    const sessionTotal = mergedMinutes(d.session);
    const denom = Math.max(sessionTotal, duration);
    const efficiency_pct = denom > 0 ? Math.round((duration / denom) * 1000) / 10 : null;
    byDate.set(day, {
      duration_minutes: Math.round(duration),
      efficiency_pct,
      deep_minutes: Math.round(mergedMinutes(d.deep)),
      rem_minutes: Math.round(mergedMinutes(d.rem)),
      light_minutes: Math.round(mergedMinutes(d.light)),
      awake_minutes: Math.round(awake),
      raw: d.raw,
    });
  }
  return byDate;
}

export interface SyncHealthConnectResult {
  ok: boolean;
  counts: SyncCounts;
  error?: string;
  sdkStatus?: HealthConnectSdkStatus;
}

export interface SyncHealthConnectOptions {
  days: number;
  recomputeReadinessDays?: number;
}

export async function syncHealthConnect(
  supabase: SupabaseClient<any>,
  options: SyncHealthConnectOptions,
): Promise<SyncHealthConnectResult> {
  const counts = emptyCounts();
  if (Platform.OS !== 'android') {
    return { ok: false, counts, error: 'Android only' };
  }

  const sdkStatus = await checkHealthConnectSdkStatus();
  if (sdkStatus !== 'available') {
    return { ok: false, counts, error: `sdk_${sdkStatus}`, sdkStatus };
  }

  const studentId = await getStudentId(supabase);
  if (!studentId) {
    return { ok: false, counts, error: 'student_not_found', sdkStatus };
  }

  const hc = loadHC();
  try {
    await hc.initialize();
  } catch (e: any) {
    return { ok: false, counts, error: `init_failed: ${e?.message}`, sdkStatus };
  }

  const grantedRecordTypes = await getHealthConnectGrantedRecordTypes();
  const grantedCategories = Array.from(
    new Set(grantedRecordTypes.map(recordTypeToCategory).filter((c): c is string => c !== null))
  );

  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - options.days * 24 * 60 * 60 * 1000);
  const timeRangeFilter = {
    operator: 'between' as const,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
  };

  // Filtro em hora local + buckets de dia ancorados à meia-noite local, pra
  // agregação por período (passos/cal/dist/FC). Veja toLocalDateTimeNoTZ.
  const startMidnight = new Date(startTime);
  startMidnight.setHours(0, 0, 0, 0);
  const localTimeRangeFilter = {
    operator: 'between' as const,
    startTime: toLocalDateTimeNoTZ(startMidnight),
    endTime: toLocalDateTimeNoTZ(endTime),
  };
  const daySlicer = { period: 'DAYS' as const, length: 1 };

  let lastError: string | undefined;

  // ─── Sleep ───
  if (grantedRecordTypes.includes('SleepSession')) {
    try {
      const res = await hc.readRecords('SleepSession', { timeRangeFilter });
      const sessions = (res.records ?? []) as SleepSessionRecord[];
      const byDate = aggregateSleepSessions(sessions);
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
            source: 'health_connect',
            raw: agg.raw,
            synced_at: new Date().toISOString(),
          },
          { onConflict: 'student_id,sample_date' }
        );
        counts.sleep += 1;
      }
    } catch (e: any) {
      if (__DEV__) console.warn('[syncHealthConnect] sleep failed:', e?.message);
      lastError = e?.message;
    }
  }

  // ─── Steps + ActiveCalories + Distance → daily_activity_samples ───
  const wantsActivity =
    grantedRecordTypes.includes('Steps') ||
    grantedRecordTypes.includes('ActiveCaloriesBurned') ||
    grantedRecordTypes.includes('Distance');

  if (wantsActivity) {
    try {
      // Fix discrepância #1: agregação por período deduplica entre apps/fontes
      // respeitando a prioridade de origem do Health Connect. Somar registros
      // brutos (readRecords) contava em dobro quando >1 app grava passos.
      // Unidades já vêm normalizadas (inKilocalories / inMeters).
      const [stepsGroups, kcalGroups, distGroups] = (await Promise.all([
        grantedRecordTypes.includes('Steps')
          ? hc.aggregateGroupByPeriod({ recordType: 'Steps', timeRangeFilter: localTimeRangeFilter, timeRangeSlicer: daySlicer }).catch(() => [])
          : Promise.resolve([]),
        grantedRecordTypes.includes('ActiveCaloriesBurned')
          ? hc.aggregateGroupByPeriod({ recordType: 'ActiveCaloriesBurned', timeRangeFilter: localTimeRangeFilter, timeRangeSlicer: daySlicer }).catch(() => [])
          : Promise.resolve([]),
        grantedRecordTypes.includes('Distance')
          ? hc.aggregateGroupByPeriod({ recordType: 'Distance', timeRangeFilter: localTimeRangeFilter, timeRangeSlicer: daySlicer }).catch(() => [])
          : Promise.resolve([]),
      ])) as [
        AggregationGroupResult<'Steps'>[],
        AggregationGroupResult<'ActiveCaloriesBurned'>[],
        AggregationGroupResult<'Distance'>[],
      ];

      const stepsByDay = new Map<string, number>();
      for (const g of stepsGroups ?? []) {
        const v = Number(g.result.COUNT_TOTAL);
        if (Number.isFinite(v) && v > 0) stepsByDay.set(g.startTime.slice(0, 10), v);
      }

      const kcalByDay = new Map<string, number>();
      for (const g of kcalGroups ?? []) {
        const v = Number(g.result.ACTIVE_CALORIES_TOTAL?.inKilocalories ?? 0);
        if (Number.isFinite(v) && v > 0) kcalByDay.set(g.startTime.slice(0, 10), v);
      }

      const distByDay = new Map<string, number>();
      for (const g of distGroups ?? []) {
        const v = Number(g.result.DISTANCE?.inMeters ?? 0);
        if (Number.isFinite(v) && v > 0) distByDay.set(g.startTime.slice(0, 10), v);
      }

      const allDays = new Set<string>([...stepsByDay.keys(), ...kcalByDay.keys(), ...distByDay.keys()]);
      for (const day of allDays) {
        await supabase.from('daily_activity_samples' as any).upsert(
          {
            student_id: studentId,
            sample_date: day,
            steps: stepsByDay.has(day) ? Math.round(stepsByDay.get(day)!) : null,
            calories_active: kcalByDay.has(day) ? Math.round(kcalByDay.get(day)! * 100) / 100 : null,
            distance_meters: distByDay.has(day) ? Math.round(distByDay.get(day)! * 100) / 100 : null,
            source: 'health_connect',
            synced_at: new Date().toISOString(),
          },
          { onConflict: 'student_id,sample_date' }
        );
        counts.steps += 1;
      }
    } catch (e: any) {
      if (__DEV__) console.warn('[syncHealthConnect] activity failed:', e?.message);
      lastError = e?.message;
    }
  }

  // ─── HR repouso — média diária deduplicada por prioridade de origem ───
  if (grantedRecordTypes.includes('RestingHeartRate')) {
    try {
      const groups = (await hc.aggregateGroupByPeriod({
        recordType: 'RestingHeartRate',
        timeRangeFilter: localTimeRangeFilter,
        timeRangeSlicer: daySlicer,
      })) as AggregationGroupResult<'RestingHeartRate'>[];
      for (const g of groups ?? []) {
        const bpm = Number(g.result.BPM_AVG);
        if (!Number.isFinite(bpm) || bpm <= 0) continue;
        await supabase.from('hr_resting_samples' as any).upsert(
          {
            student_id: studentId,
            sample_date: g.startTime.slice(0, 10),
            bpm: Math.round(bpm),
            source: 'health_connect',
            synced_at: new Date().toISOString(),
          },
          { onConflict: 'student_id,sample_date' }
        );
        counts.hr_resting += 1;
      }
    } catch (e: any) {
      if (__DEV__) console.warn('[syncHealthConnect] hr_resting failed:', e?.message);
      lastError = e?.message;
    }
  }

  // ─── HRV (RMSSD em ms) ───
  if (grantedRecordTypes.includes('HeartRateVariabilityRmssd')) {
    try {
      const res = await hc.readRecords('HeartRateVariabilityRmssd', { timeRangeFilter });
      const records = (res.records ?? []) as HeartRateVariabilityRmssdRecord[];
      const byDate = new Map<string, { sum: number; count: number }>();
      for (const r of records) {
        const day = toDateOnlyISO(new Date(r.time));
        const v = Number(r.heartRateVariabilityMillis);
        if (!Number.isFinite(v) || v <= 0) continue;
        const cur = byDate.get(day) ?? { sum: 0, count: 0 };
        cur.sum += v;
        cur.count += 1;
        byDate.set(day, cur);
      }
      for (const [day, { sum, count }] of byDate) {
        await supabase.from('hrv_samples' as any).upsert(
          {
            student_id: studentId,
            sample_date: day,
            value_ms: Math.round((sum / count) * 100) / 100,
            source: 'health_connect',
            synced_at: new Date().toISOString(),
          },
          { onConflict: 'student_id,sample_date' }
        );
        counts.hrv += 1;
      }
    } catch (e: any) {
      if (__DEV__) console.warn('[syncHealthConnect] hrv failed:', e?.message);
    }
  }

  await upsertConnectionStatus(supabase, studentId, 'health_connect', {
    status: lastError ? 'error' : 'active',
    granted_categories: grantedCategories,
    last_error: lastError ?? null,
  });

  if (options.recomputeReadinessDays && options.recomputeReadinessDays > 0) {
    await recomputeReadinessLastDays(supabase, studentId, options.recomputeReadinessDays);
  }

  return { ok: !lastError, counts, error: lastError, sdkStatus };
}
