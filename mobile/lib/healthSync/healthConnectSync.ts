// Fase 14b — Função pura de sync Health Connect (Android).
// Espelha syncHealthKit. Funções puras (sem hooks) — chamável de TaskManager.
import { Platform } from 'react-native';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  emptyCounts,
  getStudentId,
  recomputeReadinessLastDays,
  SyncCounts,
  toDateOnlyISO,
  upsertConnectionStatus,
} from './shared';

// Lib é importada apenas no Android — em iOS, requires native (não existe).
// Tipos importados eagerly (não causam runtime side-effect).
import type {
  RestingHeartRateRecord,
  StepsRecord,
  SleepSessionRecord,
  HeartRateVariabilityRmssdRecord,
  ActiveCaloriesBurnedRecord,
} from 'react-native-health-connect/lib/typescript/types/records.types';

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

function aggregateSleepSessions(sessions: SleepSessionRecord[]): Map<string, {
  duration_minutes: number;
  efficiency_pct: number | null;
  deep_minutes: number;
  rem_minutes: number;
  light_minutes: number;
  awake_minutes: number;
  raw: Array<{ start: string; end: string; stage?: number }>;
}> {
  const byDate = new Map<string, ReturnType<typeof aggregateSleepSessions> extends Map<string, infer V> ? V : never>();
  for (const session of sessions ?? []) {
    const sessionStart = new Date(session.startTime);
    const sessionEnd = new Date(session.endTime);
    if (!(sessionEnd.getTime() > sessionStart.getTime())) continue;
    const day = toDateOnlyISO(sessionEnd);

    let agg = byDate.get(day);
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
      byDate.set(day, agg);
    }

    const sessionTotalMin = (sessionEnd.getTime() - sessionStart.getTime()) / 60000;

    if (session.stages && session.stages.length > 0) {
      let awakeMin = 0;
      let sleepMin = 0;
      for (const stg of session.stages) {
        const sStart = new Date(stg.startTime);
        const sEnd = new Date(stg.endTime);
        const dur = Math.max(0, (sEnd.getTime() - sStart.getTime()) / 60000);
        agg.raw.push({ start: stg.startTime, end: stg.endTime, stage: stg.stage });
        if (stg.stage === STAGE_DEEP) { agg.deep_minutes += dur; sleepMin += dur; }
        else if (stg.stage === STAGE_REM) { agg.rem_minutes += dur; sleepMin += dur; }
        else if (stg.stage === STAGE_LIGHT) { agg.light_minutes += dur; sleepMin += dur; }
        else if (stg.stage === STAGE_AWAKE) { awakeMin += dur; }
        else if (stg.stage === STAGE_SLEEPING) { sleepMin += dur; }
      }
      agg.awake_minutes += awakeMin;
      agg.duration_minutes += sleepMin;
      if (sessionTotalMin > 0) {
        const eff = (sleepMin / sessionTotalMin) * 100;
        agg.efficiency_pct = Math.round(eff * 10) / 10;
      }
    } else {
      // Sem stages: salva só duração total
      agg.duration_minutes += sessionTotalMin;
      agg.raw.push({ start: session.startTime, end: session.endTime });
    }
  }

  for (const [, agg] of byDate) {
    agg.duration_minutes = Math.round(agg.duration_minutes);
    agg.deep_minutes = Math.round(agg.deep_minutes);
    agg.rem_minutes = Math.round(agg.rem_minutes);
    agg.light_minutes = Math.round(agg.light_minutes);
    agg.awake_minutes = Math.round(agg.awake_minutes);
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
      const [stepsRes, kcalRes, distRes] = await Promise.all([
        grantedRecordTypes.includes('Steps')
          ? hc.readRecords('Steps', { timeRangeFilter }).catch(() => ({ records: [] }))
          : Promise.resolve({ records: [] }),
        grantedRecordTypes.includes('ActiveCaloriesBurned')
          ? hc.readRecords('ActiveCaloriesBurned', { timeRangeFilter }).catch(() => ({ records: [] }))
          : Promise.resolve({ records: [] }),
        grantedRecordTypes.includes('Distance')
          ? hc.readRecords('Distance', { timeRangeFilter }).catch(() => ({ records: [] }))
          : Promise.resolve({ records: [] }),
      ]);

      const stepsByDay = new Map<string, number>();
      for (const r of (stepsRes.records ?? []) as StepsRecord[]) {
        const day = toDateOnlyISO(new Date(r.endTime));
        stepsByDay.set(day, (stepsByDay.get(day) ?? 0) + Number(r.count ?? 0));
      }

      const kcalByDay = new Map<string, number>();
      for (const r of (kcalRes.records ?? []) as ActiveCaloriesBurnedRecord[]) {
        const day = toDateOnlyISO(new Date(r.endTime));
        // Energy.unit pode ser 'kilocalories' | 'calories' | 'joules' | 'kilojoules'.
        let kcal = Number(r.energy?.value ?? 0);
        const unit = r.energy?.unit;
        if (unit === 'calories') kcal = kcal / 1000;
        else if (unit === 'joules') kcal = kcal / 4184;
        else if (unit === 'kilojoules') kcal = kcal / 4.184;
        kcalByDay.set(day, (kcalByDay.get(day) ?? 0) + kcal);
      }

      const distByDay = new Map<string, number>();
      for (const r of (distRes.records ?? []) as any[]) {
        const day = toDateOnlyISO(new Date(r.endTime));
        let meters = Number(r.distance?.value ?? 0);
        const unit = r.distance?.unit;
        if (unit === 'kilometers') meters = meters * 1000;
        else if (unit === 'feet') meters = meters * 0.3048;
        else if (unit === 'miles') meters = meters * 1609.344;
        else if (unit === 'inches') meters = meters * 0.0254;
        distByDay.set(day, (distByDay.get(day) ?? 0) + meters);
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

  // ─── HR repouso ───
  if (grantedRecordTypes.includes('RestingHeartRate')) {
    try {
      const res = await hc.readRecords('RestingHeartRate', { timeRangeFilter });
      const records = (res.records ?? []) as RestingHeartRateRecord[];
      const byDate = new Map<string, { sum: number; count: number }>();
      for (const r of records) {
        const day = toDateOnlyISO(new Date(r.time));
        const v = Number(r.beatsPerMinute);
        if (!Number.isFinite(v) || v <= 0) continue;
        const cur = byDate.get(day) ?? { sum: 0, count: 0 };
        cur.sum += v;
        cur.count += 1;
        byDate.set(day, cur);
      }
      for (const [day, { sum, count }] of byDate) {
        await supabase.from('hr_resting_samples' as any).upsert(
          {
            student_id: studentId,
            sample_date: day,
            bpm: Math.round(sum / count),
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
