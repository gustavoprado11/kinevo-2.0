// Fase 14c — Hook auxiliar pra ler conexões do aluno.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface WearableConnectionRow {
  source: 'healthkit' | 'health_connect';
  status: 'active' | 'revoked' | 'error';
  granted_categories: string[];
  last_sync_at: string | null;
  last_error: string | null;
}

export interface UseWearableConnectionsResult {
  data: WearableConnectionRow[] | null;
  isLoading: boolean;
  hasActive: boolean;
  refresh: () => Promise<void>;
}

export function useWearableConnections(): UseWearableConnectionsResult {
  const [data, setData] = useState<WearableConnectionRow[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setData(null); return; }
      const { data: student } = await supabase
        .from('students' as any).select('id').eq('auth_user_id', user.id).maybeSingle();
      const studentId = (student as any)?.id;
      if (!studentId) { setData(null); return; }
      const { data: rows } = await supabase
        .from('wearable_connections' as any)
        .select('source, status, granted_categories, last_sync_at, last_error')
        .eq('student_id', studentId);
      setData(((rows ?? []) as unknown) as WearableConnectionRow[]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const hasActive = (data ?? []).some((c) => c.status === 'active');

  return { data, isLoading, hasActive, refresh: load };
}
