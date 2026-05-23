import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface Achievements {
    loading: boolean;
    perfectWeeks: number;
    perfectWeeksConsecutive: number;
    totalWorkouts: number;
    weekStreak: number;
}

function toDateOnly(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/** Início da semana (domingo) de uma data — alinha com getWeekRange/perfect_weeks. */
function weekStartOf(d: Date): Date {
    const x = new Date(d);
    x.setHours(12, 0, 0, 0);
    x.setDate(x.getDate() - x.getDay());
    return x;
}

const EMPTY: Achievements = {
    loading: false, perfectWeeks: 0, perfectWeeksConsecutive: 0, totalWorkouts: 0, weekStreak: 0,
};

/**
 * Agregação read-only de conquistas do aluno (semanas perfeitas, treinos
 * concluídos, streak de semanas). Standalone — não depende do programa ativo,
 * pra rodar na tela de perfil. Best-effort: erro → zeros.
 */
export function useAchievements(studentId?: string | null): Achievements {
    const [state, setState] = useState<Achievements>({ ...EMPTY, loading: !!studentId });

    useEffect(() => {
        if (!studentId) {
            setState(EMPTY);
            return;
        }
        let cancelled = false;
        setState((s) => ({ ...s, loading: true }));

        (async () => {
            try {
                const [{ count: totalWorkouts }, pwRes, sessRes] = await Promise.all([
                    supabase
                        .from('workout_sessions' as any)
                        .select('id', { count: 'exact', head: true })
                        .eq('student_id', studentId)
                        .eq('status', 'completed'),
                    supabase
                        .from('perfect_weeks' as any)
                        .select('week_start_date')
                        .eq('student_id', studentId)
                        .order('week_start_date', { ascending: false })
                        .limit(260),
                    supabase
                        .from('workout_sessions' as any)
                        .select('completed_at, started_at')
                        .eq('student_id', studentId)
                        .eq('status', 'completed')
                        .order('completed_at', { ascending: false, nullsFirst: false })
                        .limit(800),
                ]);

                // ── Semanas perfeitas ──
                const pwSet = new Set<string>(((pwRes.data || []) as any[]).map((r) => r.week_start_date));
                const perfectWeeks = pwSet.size;
                let perfectWeeksConsecutive = 0;
                let cur = weekStartOf(new Date());
                while (pwSet.has(toDateOnly(cur))) {
                    perfectWeeksConsecutive++;
                    cur = new Date(cur);
                    cur.setDate(cur.getDate() - 7);
                }

                // ── Streak de semanas com ≥1 treino ──
                const weekSet = new Set<string>();
                for (const s of (sessRes.data || []) as any[]) {
                    weekSet.add(toDateOnly(weekStartOf(new Date(s.completed_at ?? s.started_at))));
                }
                let weekStreak = 0;
                let wc = weekStartOf(new Date());
                while (weekSet.has(toDateOnly(wc))) {
                    weekStreak++;
                    wc = new Date(wc);
                    wc.setDate(wc.getDate() - 7);
                }

                if (!cancelled) {
                    setState({
                        loading: false,
                        perfectWeeks,
                        perfectWeeksConsecutive,
                        totalWorkouts: totalWorkouts ?? 0,
                        weekStreak,
                    });
                }
            } catch (err) {
                if (__DEV__) console.error('[useAchievements]', err);
                if (!cancelled) setState((s) => ({ ...s, loading: false }));
            }
        })();

        return () => { cancelled = true; };
    }, [studentId]);

    return state;
}
