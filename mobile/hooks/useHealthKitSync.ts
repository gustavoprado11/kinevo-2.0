// Fase 14a (refatorado na 14b → reescrito na 14c migração Kingstinct)
// Hook fino que delega lógica de sync pra função pura syncHealthKit.
// API pública 100% preservada da implementação anterior.
import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import {
  requestAuthorization,
  isHealthDataAvailable,
} from '@kingstinct/react-native-healthkit';
import { supabase } from '../lib/supabase';
import { syncHealthKit, READ_IDENTIFIERS } from '../lib/healthSync/healthKitSync';
import type { SyncCounts, HealthCategory } from '../lib/healthSync/shared';

export type { HealthCategory, SyncCounts };

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

  const requestAuth = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'ios') {
      setError('HealthKit disponível apenas no iOS');
      return false;
    }
    try {
      if (!isHealthDataAvailable()) {
        setError('HealthKit não disponível neste dispositivo');
        return false;
      }
      const ok = await requestAuthorization({ toRead: READ_IDENTIFIERS });
      setIsAuthorized(ok);
      setError(ok ? null : 'Permissões não concedidas');

      // Fix BUG 2 — Apple por design NÃO expõe read permissions per-type
      // (questão de privacidade — não vaza quais types o usuário negou).
      // Assumimos todas as categorias requested como granted após sucesso.
      // Opt-out granular fica client-side via toggles em Settings/connections.
      if (ok) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: student } = await supabase
              .from('students' as any).select('id').eq('auth_user_id', user.id).maybeSingle();
            const studentId = (student as any)?.id;
            if (studentId) {
              await supabase.from('wearable_connections' as any).upsert(
                {
                  student_id: studentId,
                  source: 'healthkit',
                  status: 'active',
                  granted_categories: ['sleep', 'steps', 'hr_resting', 'hrv'],
                  connected_at: new Date().toISOString(),
                },
                { onConflict: 'student_id,source' }
              );
            }
          }
        } catch (upsertErr: any) {
          if (__DEV__) console.warn('[useHealthKitSync] connection upsert failed:', upsertErr?.message);
        }
      }

      return ok;
    } catch (e: any) {
      const msg = e?.message ?? 'request_auth_failed';
      setError(msg);
      setIsAuthorized(false);
      return false;
    }
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

  return {
    isAuthorized,
    isLoading,
    error,
    requestAuthorization: requestAuth,
    syncHistorical,
    syncIncremental,
  };
}
