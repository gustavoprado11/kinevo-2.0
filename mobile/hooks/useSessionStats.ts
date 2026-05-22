import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ShareableCardProps } from '../components/workout/sharing/types';

const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
function fmtShortDate(d: Date): string {
    return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

interface PrInfo {
    delta: number;
    previousDate: string;
}

export function useSessionStats(sessionId: string | null) {
    const [stats, setStats] = useState<{
        volume: number;
        maxLoads: ShareableCardProps['maxLoads'];
        exerciseDetails: ShareableCardProps['exerciseDetails'];
        loading: boolean;
    }>({
        volume: 0,
        maxLoads: [],
        exerciseDetails: [],
        loading: false
    });

    useEffect(() => {
        if (!sessionId) return;

        const fetchStats = async () => {
            setStats(prev => ({ ...prev, loading: true }));
            try {
                const { data: logs, error } = await supabase
                    .from('set_logs' as any)
                    .select(`
                        weight,
                        reps_completed,
                        is_completed,
                        exercise_id,
                        assigned_workout_item_id,
                        exercises:exercises!set_logs_exercise_id_fkey (name),
                        assigned_workout_items:assigned_workout_item_id (exercise_function)
                    `)
                    .eq('workout_session_id', sessionId)
                    .eq('is_completed', true);

                if (error) throw error;

                if (logs) {
                    let totalVolume = 0;
                    // Keyed by exercise_id (precisa do id pra cruzar com o histórico de PR).
                    const exerciseMaxes: Record<string, { weight: number, reps: number, name: string, exerciseId: string }> = {};
                    const exerciseAgg: Record<string, { name: string, sets: number, maxWeight: number, maxReps: number, order: number, exerciseId: string }> = {};
                    let exerciseOrder = 0;

                    const hasAnyFunction = logs.some((log: any) => log.assigned_workout_items?.exercise_function);

                    logs.forEach((log: any) => {
                        const weight = Number(log.weight) || 0;
                        const reps = Number(log.reps_completed) || 0;
                        const name = log.exercises?.name || 'Exercício';
                        const exerciseId = log.exercise_id as string;
                        const exerciseFunction = log.assigned_workout_items?.exercise_function;

                        const countsForVolume = !hasAnyFunction || exerciseFunction === 'main';
                        if (countsForVolume) {
                            totalVolume += weight * reps;
                        }

                        const key = exerciseId || name;
                        if (!exerciseMaxes[key] || weight > exerciseMaxes[key].weight) {
                            exerciseMaxes[key] = { weight, reps, name, exerciseId };
                        }

                        if (!exerciseAgg[key]) {
                            exerciseAgg[key] = { name, sets: 0, maxWeight: 0, maxReps: 0, order: exerciseOrder++, exerciseId };
                        }
                        exerciseAgg[key].sets += 1;
                        if (weight > exerciseAgg[key].maxWeight) {
                            exerciseAgg[key].maxWeight = weight;
                            exerciseAgg[key].maxReps = reps;
                        }
                    });

                    // ── PR detection: compara o máx da sessão com o histórico do aluno ──
                    const prByExercise = await detectPRs(sessionId, exerciseMaxes);

                    const maxLoads = Object.values(exerciseMaxes)
                        .sort((a, b) => b.weight - a.weight)
                        .slice(0, 3)
                        .map(item => {
                            const pr = prByExercise[item.exerciseId];
                            return {
                                exerciseName: item.name,
                                weight: item.weight,
                                reps: item.reps,
                                isPr: !!pr,
                                delta: pr?.delta ?? null,
                                previousDate: pr?.previousDate ?? null,
                            };
                        });

                    const exerciseDetails = Object.values(exerciseAgg)
                        .sort((a, b) => a.order - b.order)
                        .map(item => ({
                            name: item.name,
                            sets: item.sets,
                            reps: item.maxReps,
                            // Peso corporal / não registrado → null (vira "—" na lista).
                            weight: item.maxWeight > 0 ? item.maxWeight : null,
                            isPr: !!prByExercise[item.exerciseId],
                        }));

                    setStats({ volume: totalVolume, maxLoads, exerciseDetails, loading: false });
                }
            } catch (err) {
                if (__DEV__) console.error("Error fetching session stats:", err);
                setStats(prev => ({ ...prev, loading: false }));
            }
        };

        fetchStats();
    }, [sessionId]);

    return stats;
}

/**
 * Para cada exercício da sessão, verifica se a carga máxima superou o melhor
 * histórico do aluno (sessões anteriores). Retorna delta (kg) + data do recorde
 * anterior. Best-effort: qualquer falha → sem PRs (não quebra os stats).
 * Primeiro registro de um exercício NÃO conta como PR (conservador).
 */
async function detectPRs(
    sessionId: string,
    exerciseMaxes: Record<string, { weight: number, exerciseId: string }>,
): Promise<Record<string, PrInfo>> {
    const result: Record<string, PrInfo> = {};
    try {
        const exerciseIds = Object.values(exerciseMaxes)
            .map(e => e.exerciseId)
            .filter((id): id is string => !!id);
        if (exerciseIds.length === 0) return result;

        // 1. student_id + data desta sessão
        const { data: sessData } = await supabase
            .from('workout_sessions' as any)
            .select('student_id, started_at, completed_at')
            .eq('id', sessionId)
            .maybeSingle();
        const sess = sessData as any;
        if (!sess?.student_id) return result;
        const thisDate = new Date(sess.completed_at ?? sess.started_at).getTime();

        // 2. sessões concluídas anteriores do aluno (cap p/ limitar URL/payload)
        const { data: priorSessions } = await supabase
            .from('workout_sessions' as any)
            .select('id, started_at, completed_at')
            .eq('student_id', sess.student_id)
            .eq('status', 'completed')
            .neq('id', sessionId)
            .order('started_at', { ascending: false })
            .limit(400);

        const dateBySession = new Map<string, number>();
        const priorIds: string[] = [];
        for (const s of (priorSessions || []) as any[]) {
            const t = new Date(s.completed_at ?? s.started_at).getTime();
            if (t < thisDate) {
                dateBySession.set(s.id, t);
                priorIds.push(s.id);
            }
        }
        if (priorIds.length === 0) return result;

        // 3. set_logs históricos desses exercícios nessas sessões
        const { data: histLogs } = await supabase
            .from('set_logs' as any)
            .select('weight, exercise_id, workout_session_id')
            .in('workout_session_id', priorIds)
            .in('exercise_id', exerciseIds)
            .eq('is_completed', true);

        // máx histórico por exercício + data desse máx
        const histMax: Record<string, { weight: number, date: number }> = {};
        for (const log of (histLogs || []) as any[]) {
            const w = Number(log.weight) || 0;
            const exId = log.exercise_id as string;
            const date = dateBySession.get(log.workout_session_id) ?? 0;
            if (!histMax[exId] || w > histMax[exId].weight) {
                histMax[exId] = { weight: w, date };
            }
        }

        // 4. PR = máx da sessão > melhor histórico (e existe histórico)
        for (const item of Object.values(exerciseMaxes)) {
            const prev = histMax[item.exerciseId];
            if (prev && prev.weight > 0 && item.weight > prev.weight) {
                result[item.exerciseId] = {
                    delta: Math.round((item.weight - prev.weight) * 10) / 10,
                    previousDate: fmtShortDate(new Date(prev.date)),
                };
            }
        }
    } catch (err) {
        if (__DEV__) console.error('[useSessionStats] PR detection failed:', err);
    }
    return result;
}
