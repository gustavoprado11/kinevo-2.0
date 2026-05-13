// Fase 14c — Decide se deve mostrar PreWorkoutReadinessSheet.
// Mostra apenas se: (1) pelo menos 1 conexão ativa, (2) há readinessData hoje.
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useReadinessToday } from './useReadinessToday';
import type { ReadinessResult } from '../lib/readiness';

export interface PreWorkoutDecisionResult {
  shouldShowSheet: boolean;
  readinessData: ReadinessResult | null;
  isLoading: boolean;
}

async function hasActiveConnection(): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { data: student } = await supabase
      .from('students' as any)
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle();
    const studentId = (student as any)?.id;
    if (!studentId) return false;

    const { data: rows } = await supabase
      .from('wearable_connections' as any)
      .select('id')
      .eq('student_id', studentId)
      .eq('status', 'active')
      .limit(1);
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

export function usePreWorkoutDecision(_workoutId: string | undefined | null): PreWorkoutDecisionResult {
  const { data: readiness, isLoading: readinessLoading } = useReadinessToday();
  const [connectionChecked, setConnectionChecked] = useState(false);
  const [hasConnection, setHasConnection] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void hasActiveConnection().then((ok) => {
      if (cancelled) return;
      setHasConnection(ok);
      setConnectionChecked(true);
    });
    return () => { cancelled = true; };
  }, []);

  const isLoading = readinessLoading || !connectionChecked;

  if (isLoading) {
    return { shouldShowSheet: false, readinessData: null, isLoading: true };
  }

  if (!hasConnection || !readiness) {
    return { shouldShowSheet: false, readinessData: null, isLoading: false };
  }

  return { shouldShowSheet: true, readinessData: readiness, isLoading: false };
}
