// Fase 14b — Utils compartilhados entre iOS HealthKit e Android Health Connect.
// Importante: NADA aqui pode usar hooks (chamado de TaskManager fora do React).
import type { SupabaseClient } from '@supabase/supabase-js';
import { computeReadiness } from '../readiness';

export type HealthSource = 'healthkit' | 'health_connect';

export type HealthCategory = 'sleep' | 'steps' | 'hr_resting' | 'hrv';

export type SyncCounts = Record<HealthCategory, number>;

export function emptyCounts(): SyncCounts {
  return { sleep: 0, steps: 0, hr_resting: 0, hrv: 0 };
}

// Fix discrepância #5: contagem dupla de sono. Quando >1 fonte grava o mesmo
// período (ex: Apple Watch + app terceiro como AutoSleep/Pillow), somar as
// durações infla o total. mergedMinutes mescla intervalos sobrepostos e conta
// cada minuto coberto uma única vez. Também lida com cochilos (intervalos
// disjuntos no mesmo dia somam normalmente). Type-safe — usa só start/end.
export interface TimeInterval {
  start: number; // epoch ms
  end: number; // epoch ms
}

export function mergedMinutes(intervals: readonly TimeInterval[]): number {
  const valid = intervals.filter((iv) => iv.end > iv.start);
  if (valid.length === 0) return 0;
  const sorted = [...valid].sort((a, b) => a.start - b.start);
  let totalMs = 0;
  let curStart = sorted[0].start;
  let curEnd = sorted[0].end;
  for (let i = 1; i < sorted.length; i++) {
    const iv = sorted[i];
    if (iv.start <= curEnd) {
      if (iv.end > curEnd) curEnd = iv.end;
    } else {
      totalMs += curEnd - curStart;
      curStart = iv.start;
      curEnd = iv.end;
    }
  }
  totalMs += curEnd - curStart;
  return totalMs / 60000;
}

export function toDateOnlyISO(d: Date): string {
  // Fix BUG 2 (1.6.0/33): usa local time do device, não UTC.
  // toISOString() converte pra UTC, causando bucket cruzado: samples
  // de 21:00 SP (= 00:00 UTC dia seguinte) eram contadas no dia errado,
  // inflando "passos hoje" com passos da noite anterior.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Resolve o student_id do aluno autenticado. Retorna null se não houver auth.
 */
export async function getStudentId(supabase: SupabaseClient<any>): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: student } = await supabase
    .from('students' as any)
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  return (student as any)?.id ?? null;
}

/**
 * Recomputa readiness_scores pros últimos `days` dias do aluno. Best-effort —
 * falhas individuais por dia não interrompem o loop. Usado tanto no foreground
 * sync quanto no background TaskManager.
 */
export async function recomputeReadinessLastDays(
  supabase: SupabaseClient<any>,
  studentId: string,
  days: number,
): Promise<number> {
  let computed = 0;
  const now = new Date();
  for (let i = 0; i < days; i++) {
    try {
      const scoreDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
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
          // source explícito: o trigger de prioridade (#6) usa isso pra impedir
          // que o readiness computado sobrescreva o score nativo de Oura/Whoop.
          source: 'computed',
          computed_at: new Date().toISOString(),
        },
        { onConflict: 'student_id,score_date' }
      );
      computed += 1;
    } catch (e) {
      if (__DEV__) console.warn(`[recomputeReadiness] day ${i} failed:`, e);
    }
  }
  return computed;
}

/**
 * Upsert do status da conexão em wearable_connections.
 */
export async function upsertConnectionStatus(
  supabase: SupabaseClient<any>,
  studentId: string,
  source: HealthSource,
  patch: {
    status?: 'active' | 'revoked' | 'error';
    granted_categories?: string[];
    last_error?: string | null;
  } = {},
): Promise<void> {
  await supabase.from('wearable_connections' as any).upsert(
    {
      student_id: studentId,
      source,
      status: patch.status ?? 'active',
      ...(patch.granted_categories !== undefined ? { granted_categories: patch.granted_categories } : {}),
      last_sync_at: new Date().toISOString(),
      ...(patch.last_error !== undefined ? { last_error: patch.last_error } : {}),
    },
    { onConflict: 'student_id,source' }
  );
}
