// Fase 14b — Hook fino Android. Delega lógica pra função pura
// mobile/lib/healthSync/healthConnectSync.ts pra reuso pelo TaskManager.
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import {
  syncHealthConnect,
  checkHealthConnectSdkStatus,
  requestHealthConnectAuthorization,
  HealthConnectSdkStatus,
} from '../lib/healthSync/healthConnectSync';
import type { SyncCounts } from '../lib/healthSync/shared';

export type { HealthConnectSdkStatus };

export interface UseHealthConnectSyncResult {
  isAuthorized: boolean;
  isLoading: boolean;
  error: string | null;
  sdkStatus: HealthConnectSdkStatus;
  requestAuthorization: () => Promise<boolean>;
  syncHistorical: (days: number) => Promise<{ ok: boolean; counts: SyncCounts; error?: string; sdkStatus?: HealthConnectSdkStatus }>;
  syncIncremental: () => Promise<{ ok: boolean; counts: SyncCounts; error?: string; sdkStatus?: HealthConnectSdkStatus }>;
  refreshSdkStatus: () => Promise<HealthConnectSdkStatus>;
}

export function useHealthConnectSync(): UseHealthConnectSyncResult {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sdkStatus, setSdkStatus] = useState<HealthConnectSdkStatus>(
    Platform.OS === 'android' ? 'available' : 'unsupported',
  );

  const refreshSdkStatus = useCallback(async () => {
    const status = await checkHealthConnectSdkStatus();
    setSdkStatus(status);
    return status;
  }, []);

  useEffect(() => {
    void refreshSdkStatus();
  }, [refreshSdkStatus]);

  const requestAuthorization = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      setError('Health Connect disponível apenas no Android');
      return false;
    }
    const status = await refreshSdkStatus();
    if (status !== 'available') {
      setError(`sdk_${status}`);
      return false;
    }
    try {
      const granted = await requestHealthConnectAuthorization();
      const ok = granted.length > 0;
      setIsAuthorized(ok);
      if (!ok) setError('Nenhuma categoria autorizada');
      return ok;
    } catch (e: any) {
      const msg = e?.message ?? 'request_permission_failed';
      setError(msg);
      setIsAuthorized(false);
      return false;
    }
  }, [refreshSdkStatus]);

  const runSync = useCallback(async (days: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await syncHealthConnect(supabase, { days, recomputeReadinessDays: Math.min(days, 30) });
      if (result.error) setError(result.error);
      if (result.sdkStatus) setSdkStatus(result.sdkStatus);
      return result;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const syncHistorical = useCallback((days: number) => runSync(days), [runSync]);
  const syncIncremental = useCallback(() => runSync(7), [runSync]);

  return {
    isAuthorized,
    isLoading,
    error,
    sdkStatus,
    requestAuthorization,
    syncHistorical,
    syncIncremental,
    refreshSdkStatus,
  };
}
