// Fase 14b — Background task de sync incremental cross-platform.
// iOS chama syncHealthKit, Android chama syncHealthConnect. Ambas são
// funções puras (sem React/hooks), seguras pra rodar dentro de TaskManager.
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { syncHealthKit } from './healthSync/healthKitSync';
import { syncHealthConnect } from './healthSync/healthConnectSync';

export const HEALTH_SYNC_TASK_NAME = 'health-data-daily-sync';

async function runIncrementalSync(): Promise<{ ok: boolean }> {
  try {
    if (Platform.OS === 'ios') {
      const res = await syncHealthKit(supabase, { days: 7, recomputeReadinessDays: 7 });
      if (__DEV__) console.log(`[healthSyncTask] iOS ok=${res.ok}`, res.counts);
      return { ok: res.ok };
    }
    if (Platform.OS === 'android') {
      const res = await syncHealthConnect(supabase, { days: 7, recomputeReadinessDays: 7 });
      if (__DEV__) console.log(`[healthSyncTask] Android ok=${res.ok}`, res.counts, 'sdk=', res.sdkStatus);
      return { ok: res.ok };
    }
    return { ok: false };
  } catch (e: any) {
    if (__DEV__) console.error('[healthSyncTask] threw:', e?.message);
    return { ok: false };
  }
}

if (!TaskManager.isTaskDefined(HEALTH_SYNC_TASK_NAME)) {
  TaskManager.defineTask(HEALTH_SYNC_TASK_NAME, async () => {
    const { ok } = await runIncrementalSync();
    return ok
      ? BackgroundFetch.BackgroundFetchResult.NewData
      : BackgroundFetch.BackgroundFetchResult.NoData;
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
      minimumInterval: 60 * 60 * 12,
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
