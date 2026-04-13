import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// ── Types ──

export interface SessionSetLog {
    setNumber: number;
    weight: number;
    weightUnit: string;
    reps: number;
    rpe: number | null;
}

export interface CardioResult {
    mode?: string;
    equipment?: string;
    durationMinutes?: number;
    distanceKm?: number;
    intensity?: string;
    intervals?: { work_seconds: number; rest_seconds: number; rounds: number };
}

export interface SessionItem {
    id: string;
    itemType: 'exercise' | 'warmup' | 'cardio' | 'note' | 'superset';
    orderIndex: number;
    exerciseName?: string;
    exerciseFunction?: string;
    itemConfig?: Record<string, any>;
    notes?: string;
    parentItemId?: string | null;
    setsPrescribed?: number;
    repsPrescribed?: string;
    restSeconds?: number;
    setLogs: SessionSetLog[];
    cardioResult?: CardioResult | null;
    children?: SessionItem[];
}

export interface SessionStats {
    durationSeconds: number;
    totalSetsPrescribed: number;
    completedSets: number;
    totalTonnage: number;
    exerciseCount: number;
}

export interface SessionDetailsData {
    id: string;
    started_at: string;
    completed_at: string;
    duration_seconds: number;
    rpe: number | null;
    feedback: string | null;
    workoutName: string;
    items: SessionItem[];
    stats: SessionStats;
}

// ── Helper ──

function buildSessionItem(
    item: any,
    logsByItem: Map<string, any[]>,
): SessionItem {
    const itemType = item.item_type as SessionItem['itemType'];
    const exerciseName = item.exercises?.name || item.exercise_name || undefined;

    const result: SessionItem = {
        id: item.id,
        itemType,
        orderIndex: item.order_index,
        exerciseName,
        exerciseFunction: item.exercise_function || undefined,
        itemConfig: item.item_config || undefined,
        notes: item.notes || undefined,
        parentItemId: item.parent_item_id || null,
        setsPrescribed: item.sets || undefined,
        repsPrescribed: item.reps || undefined,
        restSeconds: item.rest_seconds || undefined,
        setLogs: [],
        cardioResult: null,
    };

    const itemLogs = logsByItem.get(item.id) || [];

    if (itemType === 'exercise') {
        result.setLogs = itemLogs
            .map((log: any) => ({
                setNumber: log.set_number,
                weight: log.weight || 0,
                weightUnit: log.weight_unit || 'kg',
                reps: log.reps_completed || 0,
                rpe: log.rpe || null,
            }))
            .sort((a: SessionSetLog, b: SessionSetLog) => a.setNumber - b.setNumber);
    }

    if (itemType === 'cardio') {
        const cardioLog = itemLogs[0];
        if (cardioLog?.notes) {
            try {
                const parsed = JSON.parse(cardioLog.notes);
                result.cardioResult = {
                    mode: parsed.mode,
                    equipment: parsed.equipment,
                    durationMinutes: parsed.duration_minutes,
                    distanceKm: parsed.distance_km,
                    intensity: parsed.intensity,
                    intervals: parsed.intervals,
                };
            } catch {
                result.cardioResult = null;
            }
        }
    }

    return result;
}

// ── Hook ──

export function useSessionDetails() {
    const [data, setData] = useState<SessionDetailsData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchDetails = useCallback(async (sessionId: string) => {
        setIsLoading(true);
        setError(null);
        setData(null);

        try {
            // 1. Session base info
            const { data: session, error: sessionError } = await (supabase as any)
                .from('workout_sessions')
                .select(`
                    id,
                    started_at,
                    completed_at,
                    duration_seconds,
                    rpe,
                    feedback,
                    assigned_workout_id,
                    assigned_workouts ( name )
                `)
                .eq('id', sessionId)
                .single();

            if (sessionError) throw sessionError;

            // 2. Fetch set_logs
            const { data: logs, error: logsError } = await (supabase as any)
                .from('set_logs')
                .select(`
                    id,
                    assigned_workout_item_id,
                    set_number,
                    weight,
                    weight_unit,
                    reps_completed,
                    rpe,
                    notes,
                    executed_exercise_id,
                    exercise_id,
                    executed_exercise:exercises!set_logs_executed_exercise_id_fkey ( name ),
                    legacy_exercise:exercises!set_logs_exercise_id_fkey ( name )
                `)
                .eq('workout_session_id', sessionId)
                .order('set_number', { ascending: true });

            if (logsError) throw logsError;

            // Index logs by assigned_workout_item_id
            const logsByItem = new Map<string, any[]>();
            for (const log of (logs || [])) {
                const itemId = log.assigned_workout_item_id;
                if (!itemId) continue;
                if (!logsByItem.has(itemId)) logsByItem.set(itemId, []);
                logsByItem.get(itemId)!.push(log);
            }

            // 3. Fetch assigned_workout_items
            let items: SessionItem[] = [];
            const stats: SessionStats = {
                durationSeconds: session.duration_seconds || 0,
                totalSetsPrescribed: 0,
                completedSets: 0,
                totalTonnage: 0,
                exerciseCount: 0,
            };

            if (session.assigned_workout_id) {
                const { data: workoutItems, error: itemsError } = await (supabase as any)
                    .from('assigned_workout_items')
                    .select(`
                        id,
                        item_type,
                        order_index,
                        exercise_id,
                        exercise_name,
                        sets,
                        reps,
                        rest_seconds,
                        notes,
                        exercise_function,
                        item_config,
                        parent_item_id,
                        exercises ( name )
                    `)
                    .eq('assigned_workout_id', session.assigned_workout_id)
                    .order('order_index', { ascending: true });

                if (itemsError) throw itemsError;

                const topLevel = (workoutItems || []).filter((i: any) => !i.parent_item_id);
                const children = (workoutItems || []).filter((i: any) => i.parent_item_id);

                for (const item of topLevel) {
                    const sessionItem = buildSessionItem(item, logsByItem);

                    if (item.item_type === 'superset') {
                        sessionItem.children = children
                            .filter((c: any) => c.parent_item_id === item.id)
                            .sort((a: any, b: any) => a.order_index - b.order_index)
                            .map((c: any) => buildSessionItem(c, logsByItem));

                        for (const child of sessionItem.children || []) {
                            if (child.itemType === 'exercise') {
                                stats.exerciseCount++;
                                stats.totalSetsPrescribed += child.setsPrescribed || 0;
                                stats.completedSets += child.setLogs.length;
                                stats.totalTonnage += child.setLogs.reduce((acc, s) => acc + s.weight * s.reps, 0);
                            }
                        }
                    } else if (item.item_type === 'exercise') {
                        stats.exerciseCount++;
                        stats.totalSetsPrescribed += sessionItem.setsPrescribed || 0;
                        stats.completedSets += sessionItem.setLogs.length;
                        stats.totalTonnage += sessionItem.setLogs.reduce((acc, s) => acc + s.weight * s.reps, 0);
                    }

                    items.push(sessionItem);
                }
            }

            // Fallback: build from set_logs alone
            if (items.length === 0 && (logs || []).length > 0) {
                const exercisesMap = new Map<string, { id: string; name: string; sets: SessionSetLog[] }>();

                for (const log of (logs || [])) {
                    const exerciseId = log.executed_exercise_id || log.exercise_id;
                    if (!exerciseId) continue;
                    const exName = log.executed_exercise?.name || log.legacy_exercise?.name || 'Exercício';

                    if (!exercisesMap.has(exerciseId)) {
                        exercisesMap.set(exerciseId, { id: exerciseId, name: exName, sets: [] });
                    }
                    exercisesMap.get(exerciseId)!.sets.push({
                        setNumber: log.set_number,
                        weight: log.weight || 0,
                        weightUnit: log.weight_unit || 'kg',
                        reps: log.reps_completed || 0,
                        rpe: log.rpe,
                    });
                }

                let idx = 0;
                for (const [exId, ex] of exercisesMap) {
                    ex.sets.sort((a, b) => a.setNumber - b.setNumber);
                    items.push({
                        id: exId,
                        itemType: 'exercise',
                        orderIndex: idx++,
                        exerciseName: ex.name,
                        setLogs: ex.sets,
                        setsPrescribed: ex.sets.length,
                    });
                    stats.exerciseCount++;
                    stats.completedSets += ex.sets.length;
                    stats.totalSetsPrescribed += ex.sets.length;
                    stats.totalTonnage += ex.sets.reduce((acc, s) => acc + s.weight * s.reps, 0);
                }
            }

            setData({
                id: session.id,
                started_at: session.started_at,
                completed_at: session.completed_at,
                duration_seconds: session.duration_seconds,
                rpe: session.rpe,
                feedback: session.feedback,
                workoutName: session.assigned_workouts?.name || 'Treino',
                items,
                stats,
            });
        } catch (err: any) {
            if (__DEV__) console.error('Error fetching session details:', err);
            setError('Erro ao carregar detalhes do treino');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const reset = useCallback(() => {
        setData(null);
        setError(null);
        setIsLoading(false);
    }, []);

    return { data, isLoading, error, fetchDetails, reset };
}
