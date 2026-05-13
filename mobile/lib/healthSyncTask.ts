// Fase 14b → 14c — Background task de sync incremental cross-platform.
// iOS chama syncHealthKit, Android chama syncHealthConnect. Ambas são
// funções puras (sem React/hooks), seguras pra rodar dentro de TaskManager.
// 14c adicionou exponential retry: após falhas consecutivas, próxima execução
// é skipped até o delay alvo passar (1h → 2h → 4h → daily slot).
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { syncHealthKit } from './healthSync/healthKitSync';
import { syncHealthConnect } from './healthSync/healthConnectSync';

export const HEALTH_SYNC_TASK_NAME = 'health-data-daily-sync';

// ──────────────────────────────────────────────────────────────────────────────
// Exponential retry state — persiste em MMKV (fallback in-memory pra Expo Go).
// failures: 0 → tenta normal. 1 → próximo só após 1h. 2 → 2h. 3 → 4h.
// Após 3 falhas, desiste até next daily slot (12h via BackgroundFetch interval).
// ──────────────────────────────────────────────────────────────────────────────
type RetryState = { failures: number; nextAttemptAt: number };

let getRetry: () => RetryState;
let setRetry: (state: RetryState) => void;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createMMKV } = require('react-native-mmkv');
  const mmkv = createMMKV({ id: 'kinevo-health-sync-retry' });
  getRetry = () => {
    const raw = mmkv.getString('state');
    if (!raw) return { failures: 0, nextAttemptAt: 0 };
    try { return JSON.parse(raw) as RetryState; } catch { return { failures: 0, nextAttemptAt: 0 }; }
  };
  setRetry = (state: RetryState) => mmkv.set('state', JSON.stringify(state));
} catch {
  let memState: RetryState = { failures: 0, nextAttemptAt: 0 };
  getRetry = () => memState;
  setRetry = (state: RetryState) => { memState = state; };
}

function backoffDelayMs(failures: number): number {
  if (failures <= 0) return 0;
  if (failures === 1) return 60 * 60 * 1000;
  if (failures === 2) return 2 * 60 * 60 * 1000;
  return 4 * 60 * 60 * 1000;
}

async function runIncrementalSync(): Promise<{ ok: boolean; skipped?: boolean }> {
  const now = Date.now();
  const state = getRetry();

  if (state.failures >= 3) {
    // Desistiu — só retoma após daily slot completo (12h)
    if (now < state.nextAttemptAt) {
      if (__DEV__) console.log('[healthSyncTask] skipped (gave up until next daily slot)');
      return { ok: false, skipped: true };
    }
    // Daily slot passou → reset e tenta de novo
    setRetry({ failures: 0, nextAttemptAt: 0 });
  } else if (state.nextAttemptAt > now) {
    if (__DEV__) console.log(`[healthSyncTask] skipped (backoff, next attempt in ${Math.round((state.nextAttemptAt - now) / 60000)}min)`);
    return { ok: false, skipped: true };
  }

  try {
    let ok = false;
    if (Platform.OS === 'ios') {
      const res = await syncHealthKit(supabase, { days: 7, recomputeReadinessDays: 7 });
      ok = res.ok;
      if (__DEV__) console.log(`[healthSyncTask] iOS ok=${ok}`, res.counts);
    } else if (Platform.OS === 'android') {
      const res = await syncHealthConnect(supabase, { days: 7, recomputeReadinessDays: 7 });
      ok = res.ok;
      if (__DEV__) console.log(`[healthSyncTask] Android ok=${ok}`, res.counts, 'sdk=', res.sdkStatus);
    }

    if (ok) {
      setRetry({ failures: 0, nextAttemptAt: 0 });
    } else {
      const newFailures = state.failures + 1;
      const delay = newFailures >= 3 ? 12 * 60 * 60 * 1000 : backoffDelayMs(newFailures);
      setRetry({ failures: newFailures, nextAttemptAt: now + delay });
      if (__DEV__) console.warn(`[healthSyncTask] failure #${newFailures}, next attempt in ${Math.round(delay / 60000)}min`);
    }
    return { ok };
  } catch (e: any) {
    if (__DEV__) console.error('[healthSyncTask] threw:', e?.message);
    const newFailures = state.failures + 1;
    const delay = newFailures >= 3 ? 12 * 60 * 60 * 1000 : backoffDelayMs(newFailures);
    setRetry({ failures: newFailures, nextAttemptAt: now + delay });
    return { ok: false };
  }
}

if (!TaskManager.isTaskDefined(HEALTH_SYNC_TASK_NAME)) {
  TaskManager.defineTask(HEALTH_SYNC_TASK_NAME, async () => {
    const { ok, skipped } = await runIncrementalSync();
    if (skipped) return BackgroundFetch.BackgroundFetchResult.NoData;
    return ok
      ? BackgroundFetch.BackgroundFetchResult.NewData
      : BackgroundFetch.BackgroundFetchResult.Failed;
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
