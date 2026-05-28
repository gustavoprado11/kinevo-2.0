import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface Achievements {
    loading: boolean;
    perfectWeeks: number;
    perfectWeeksConsecutive: number;
    totalWorkouts: number;
    weekStreak: number;
    bestWeekStreak: number;
    totalVolumeKg: number;
    programsCompleted: number;
    topMuscleGroup: string | null;
    topMuscleGroupSets: number;
}

function toDateOnly(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/**
 * Início da semana (segunda-feira) de uma data. Alinha com getWeekRange e com
 * a gravação de perfect_weeks em usePerfectWeek (ambos segunda-based).
 */
function weekStartOf(d: Date): Date {
    const x = new Date(d);
    x.setHours(12, 0, 0, 0);
    const mondayOffset = (x.getDay() + 6) % 7; // dom=6, seg=0, ter=1, ..., sáb=5
    x.setDate(x.getDate() - mondayOffset);
    return x;
}

const EMPTY: Achievements = {
    loading: false, perfectWeeks: 0, perfectWeeksConsecutive: 0, totalWorkouts: 0,
    weekStreak: 0, bestWeekStreak: 0, totalVolumeKg: 0, programsCompleted: 0,
    topMuscleGroup: null, topMuscleGroupSets: 0,
};

interface SessionRow {
    completed_at: string | null;
    started_at: string | null;
    set_logs: {
        weight: number | null;
        reps_completed: number | null;
        exercises: { exercise_muscle_groups: { muscle_groups: { name: string } | null }[] } | null;
    }[] | null;
}

/**
 * Agregação read-only de conquistas do aluno (semanas perfeitas, treinos
 * concluídos, streak de semanas, volume total, programas concluídos, grupo
 * muscular favorito). Standalone — não depende do programa ativo, pra rodar na
 * tela de perfil. Best-effort: erro → zeros.
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
                const [{ count: totalWorkouts }, pwRes, sessRes, { count: programsCompleted }] = await Promise.all([
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
                        .select('completed_at, started_at, set_logs(weight, reps_completed, exercises!set_logs_exercise_id_fkey(exercise_muscle_groups(muscle_groups(name))))')
                        .eq('student_id', studentId)
                        .eq('status', 'completed')
                        .order('completed_at', { ascending: false, nullsFirst: false })
                        .limit(800),
                    supabase
                        .from('assigned_programs' as any)
                        .select('id', { count: 'exact', head: true })
                        .eq('student_id', studentId)
                        .eq('status', 'completed'),
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

                // ── Sessões: streak, volume e grupo muscular ──
                const sessions = (sessRes.data || []) as unknown as SessionRow[];
                const weekSet = new Set<string>();
                let totalVolumeKg = 0;
                const muscleCounts = new Map<string, number>();

                for (const s of sessions) {
                    const when = s.completed_at ?? s.started_at;
                    if (when) weekSet.add(toDateOnly(weekStartOf(new Date(when))));

                    for (const log of s.set_logs ?? []) {
                        if (log.weight != null && log.reps_completed != null && log.weight > 0 && log.reps_completed > 0) {
                            totalVolumeKg += log.weight * log.reps_completed;
                        }
                        for (const emg of log.exercises?.exercise_muscle_groups ?? []) {
                            const name = emg.muscle_groups?.name;
                            if (name) muscleCounts.set(name, (muscleCounts.get(name) ?? 0) + 1);
                        }
                    }
                }

                // Streak atual (semanas consecutivas terminando na semana atual)
                let weekStreak = 0;
                let wc = weekStartOf(new Date());
                while (weekSet.has(toDateOnly(wc))) {
                    weekStreak++;
                    wc = new Date(wc);
                    wc.setDate(wc.getDate() - 7);
                }

                // Maior streak histórico (qualquer janela de semanas consecutivas)
                let bestWeekStreak = 0;
                for (const wk of weekSet) {
                    const prev = new Date(wk + 'T12:00:00');
                    prev.setDate(prev.getDate() - 7);
                    if (weekSet.has(toDateOnly(prev))) continue; // só conta a partir do início de uma sequência
                    let len = 0;
                    const c = new Date(wk + 'T12:00:00');
                    while (weekSet.has(toDateOnly(c))) {
                        len++;
                        c.setDate(c.getDate() + 7);
                    }
                    if (len > bestWeekStreak) bestWeekStreak = len;
                }

                // Grupo muscular favorito
                let topMuscleGroup: string | null = null;
                let topMuscleGroupSets = 0;
                for (const [name, count] of muscleCounts) {
                    if (count > topMuscleGroupSets) {
                        topMuscleGroup = name;
                        topMuscleGroupSets = count;
                    }
                }

                if (!cancelled) {
                    setState({
                        loading: false,
                        perfectWeeks,
                        perfectWeeksConsecutive,
                        totalWorkouts: totalWorkouts ?? 0,
                        weekStreak,
                        bestWeekStreak,
                        totalVolumeKg: Math.round(totalVolumeKg),
                        programsCompleted: programsCompleted ?? 0,
                        topMuscleGroup,
                        topMuscleGroupSets,
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
