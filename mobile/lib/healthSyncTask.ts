// Fase 14a — Background task pra sync incremental de health data (iOS).
// 14b adicionará branch Android (Health Connect).
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { Platform } from 'react-native';
import AppleHealthKit, {
  HealthInputOptions,
  HealthValue,
} from 'react-native-health';
import { supabase } from './supabase';
import { computeReadiness } from './readiness';

export const HEALTH_SYNC_TASK_NAME = 'health-data-daily-sync';

function toDateOnlyISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Inline syncIncremental — duplica lógica do hook porque TaskManager.defineTask
// roda sem React (sem hooks).
async function runIncrementalSync(): Promise<{ ok: boolean; counts: Record<string, number> }> {
  const counts = { sleep: 0, steps: 0, hr_resting: 0, hrv: 0 };
  if (Platform.OS !== 'ios') return { ok: false, counts };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, counts };

  const { data: student } = await supabase
    .from('students' as any)
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  const studentId = (student as any)?.id;
  if (!studentId) return { ok: false, counts };

  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
  const opts: HealthInputOptions = {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  };

  const call = <T,>(fn: any): Promise<T> =>
    new Promise((resolve, reject) => {
      fn(opts, (err: string, results: T) => {
        if (err) reject(new Error(err));
        else resolve(results);
      });
    });

  // HR repouso — input crítico pro readiness
  try {
    const hrSamples = await call<HealthValue[]>(AppleHealthKit.getRestingHeartRateSamples.bind(AppleHealthKit));
    const byDate = new Map<string, { sum: number; count: number }>();
    for (const s of hrSamples ?? []) {
      const day = toDateOnlyISO(new Date(s.endDate ?? s.startDate));
      const v = Number(s.value ?? 0);
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
          source: 'healthkit',
          synced_at: new Date().toISOString(),
        },
        { onConflict: 'student_id,sample_date' }
      );
      counts.hr_resting += 1;
    }
  } catch (e) {
    if (__DEV__) console.warn('[healthSyncTask] hr_resting failed:', e);
  }

  // Sleep
  try {
    const sleepBlocks = await call<Array<HealthValue & { value: string | number }>>(
      AppleHealthKit.getSleepSamples.bind(AppleHealthKit)
    );
    const byDate = new Map<string, number>();
    for (const block of sleepBlocks ?? []) {
      const stage = String(block.value ?? '').toUpperCase();
      if (stage !== 'ASLEEP' && stage !== 'DEEP' && stage !== 'REM' && stage !== 'CORE' && stage !== 'LIGHT') continue;
      const day = toDateOnlyISO(new Date(block.endDate));
      const dur = (new Date(block.endDate).getTime() - new Date(block.startDate).getTime()) / 60000;
      byDate.set(day, (byDate.get(day) ?? 0) + dur);
    }
    for (const [day, mins] of byDate) {
      await supabase.from('daily_sleep_samples' as any).upsert(
        {
          student_id: studentId,
          sample_date: day,
          duration_minutes: Math.round(mins),
          source: 'healthkit',
          synced_at: new Date().toISOString(),
        },
        { onConflict: 'student_id,sample_date' }
      );
      counts.sleep += 1;
    }
  } catch (e) {
    if (__DEV__) console.warn('[healthSyncTask] sleep failed:', e);
  }

  // Recompute readiness pros últimos 7 dias
  try {
    for (let i = 0; i < 7; i++) {
      const scoreDate = new Date(endDate.getTime() - i * 24 * 60 * 60 * 1000);
      const scoreDateISO = toDateOnlyISO(scoreDate);
      const sleepNight = new Date(scoreDate.getTime() - 24 * 60 * 60 * 1000);
      const sleepNightISO = toDateOnlyISO(sleepNight);
      const baselineStart = new Date(scoreDate.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [sleepRes, hrTodayRes, hrBaseRes]: any[] = await Promise.all([
        supabase.from('daily_sleep_samples' as any).select('duration_minutes')
          .eq('student_id', studentId).eq('sample_date', sleepNightISO).maybeSingle(),
        supabase.from('hr_resting_samples' as any).select('bpm')
          .eq('student_id', studentId).eq('sample_date', scoreDateISO).maybeSingle(),
        supabase.from('hr_resting_samples' as any).select('bpm')
          .eq('student_id', studentId).gte('sample_date', toDateOnlyISO(baselineStart)),
      ]);
      const sleepMin = sleepRes.data?.duration_minutes ?? null;
      const hrToday = hrTodayRes.data?.bpm ?? null;
      const baseRows = (hrBaseRes.data ?? []) as Array<{ bpm: number }>;
      const baseline = baseRows.length > 0
        ? Math.round(baseRows.reduce((acc, r) => acc + Number(r.bpm), 0) / baseRows.length)
        : null;
      if (sleepMin == null && hrToday == null) continue;
      const result = computeReadiness({
        sleepMinutes: sleepMin,
        hrRestingToday: hrToday,
        hrBaseline30d: baseline,
      });
      await supabase.from('readiness_scores' as any).upsert(
        {
          student_id: studentId,
          score_date: scoreDateISO,
          score: result.score,
          sleep_component: Math.round(result.sleepComponent * 1000) / 1000,
          hr_component: Math.round(result.hrComponent * 1000) / 1000,
          sleep_minutes: sleepMin,
          hr_baseline_30d: baseline,
          computed_at: new Date().toISOString(),
        },
        { onConflict: 'student_id,score_date' }
      );
    }
  } catch (e) {
    if (__DEV__) console.warn('[healthSyncTask] readiness recompute failed:', e);
  }

  await supabase.from('wearable_connections' as any).upsert(
    {
      student_id: studentId,
      source: 'healthkit',
      status: 'active',
      last_sync_at: new Date().toISOString(),
    },
    { onConflict: 'student_id,source' }
  );

  return { ok: true, counts };
}

// Define a task globalmente (idempotente — TaskManager dedup por nome)
if (!TaskManager.isTaskDefined(HEALTH_SYNC_TASK_NAME)) {
  TaskManager.defineTask(HEALTH_SYNC_TASK_NAME, async () => {
    try {
      const { ok, counts } = await runIncrementalSync();
      if (__DEV__) console.log(`[healthSyncTask] ${ok ? 'ok' : 'failed'}`, counts);
      return ok
        ? BackgroundFetch.BackgroundFetchResult.NewData
        : BackgroundFetch.BackgroundFetchResult.NoData;
    } catch (err: any) {
      if (__DEV__) console.error('[healthSyncTask] task failed:', err?.message);
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  });
}

export async function registerHealthSyncTask(): Promise<void> {
  try {
    const status = await BackgroundFetch.getStatusAsync();
    if (status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
        status === BackgroundFetch.BackgroundFetchStatus.Denied) {
      if (__DEV__) console.warn('[healthSyncTask] background fetch denied/restricted');
      return;
    }
    await BackgroundFetch.registerTaskAsync(HEALTH_SYNC_TASK_NAME, {
      minimumInterval: 60 * 60 * 12, // 12 horas
      stopOnTerminate: false,
      startOnBoot: true,
    });
    if (__DEV__) console.log('[healthSyncTask] registered');
  } catch (err: any) {
    if (__DEV__) console.warn('[healthSyncTask] register failed:', err?.message);
  }
}

export async function unregisterHealthSyncTask(): Promise<void> {
  try {
    await BackgroundFetch.unregisterTaskAsync(HEALTH_SYNC_TASK_NAME);
  } catch {
    // ignore
  }
}
