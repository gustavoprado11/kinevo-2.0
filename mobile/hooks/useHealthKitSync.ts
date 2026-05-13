// Fase 14a (refatorado na 14b) — hook fino que delega pra função pura.
// API mantida; lógica de sync vive em mobile/lib/healthSync/healthKitSync.ts
// pra ser reusada pelo TaskManager (background, sem React context).
import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import AppleHealthKit, { HealthKitPermissions } from 'react-native-health';
import { supabase } from '../lib/supabase';
import { syncHealthKit } from '../lib/healthSync/healthKitSync';
import type { SyncCounts, HealthCategory } from '../lib/healthSync/shared';

export type { HealthCategory, SyncCounts };

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

export interface UseHealthKitSyncResult {
  isAuthorized: boolean;
  isLoading: boolean;
  error: string | null;
  requestAuthorization: () => Promise<boolean>;
  syncHistorical: (days: number) => Promise<{ ok: boolean; counts: SyncCounts; error?: string }>;
  syncIncremental: () => Promise<{ ok: boolean; counts: SyncCounts; error?: string }>;
}

export function useHealthKitSync(): UseHealthKitSyncResult {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const runSync = useCallback(async (days: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await syncHealthKit(supabase, { days, recomputeReadinessDays: Math.min(days, 30) });
      if (result.error) setError(result.error);
      return result;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const syncHistorical = useCallback((days: number) => runSync(days), [runSync]);
  const syncIncremental = useCallback(() => runSync(7), [runSync]);

  return { isAuthorized, isLoading, error, requestAuthorization, syncHistorical, syncIncremental };
}
