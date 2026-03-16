import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

export type HistoryItemType = 'exercise' | 'warmup' | 'cardio' | 'note' | 'superset';

export interface HistorySession {
    id: string;
    started_at: string;
    completed_at: string;
    duration_seconds: number | null;
    workout_name: string;
    volume_load: number;
    is_intense: boolean;
    exercises: HistoryExercise[];
    workoutItems: HistoryWorkoutItem[];
    has_pre_checkin: boolean;
    has_post_checkin: boolean;
}

export interface HistoryWorkoutItem {
    id: string;
    itemType: HistoryItemType;
    orderIndex: number;
    exerciseName?: string;
    notes?: string;
    itemConfig?: Record<string, any>;
    parentItemId?: string | null;
    setLogs: HistorySet[];
    children?: HistoryWorkoutItem[];
    cardioResult?: Record<string, any> | null;
}

export interface HistoryExercise {
    id: string;
    name: string;
    sets: HistorySet[];
}

export interface HistorySet {
    id: string;
    weight: number;
    reps: number;
    completed: boolean;
}

export interface HistoryStats {
    totalWorkouts: number;
    totalVolume: number; // Tons
    totalHours: number;
    personalRecords: {
        exerciseName: string;
        weight: number;
        date: string;
    }[];
}

export function useWorkoutHistory() {
    const { user } = useAuth();
    const [history, setHistory] = useState<HistorySession[]>([]);
    const [stats, setStats] = useState<HistoryStats>({
        totalWorkouts: 0,
        totalVolume: 0,
        totalHours: 0,
        personalRecords: []
    });
    const [isLoading, setIsLoading] = useState(true);

    const fetchHistory = useCallback(async () => {
        if (!user) return;

        try {
            setIsLoading(true);

            const { data: student, error: studentError } = await supabase
                .from('students')
                .select('id')
                .eq('auth_user_id', user.id)
                .maybeSingle();

            if (studentError) throw studentError;
            if (!student?.id) {
                setHistory([]);
                setStats({
                    totalWorkouts: 0,
                    totalVolume: 0,
                    totalHours: 0,
                    personalRecords: []
                });
                return;
            }

            // Fetch sessions with logs and workout items
            const { data, error } = await supabase
                .from('workout_sessions')
                .select(`
                    id,
                    started_at,
                    completed_at,
                    duration_seconds,
                    status,
                    pre_workout_submission_id,
                    post_workout_submission_id,
                    assigned_workout:assigned_workouts(
                        name,
                        items:assigned_workout_items(
                            id, item_type, order_index, exercise_name, notes, item_config, parent_item_id,
                            exercises(name)
                        )
                    ),
                    logs:set_logs(
                        id,
                        assigned_workout_item_id,
                        executed_exercise_id,
                        exercise_id,
                        weight,
                        reps_completed,
                        is_completed,
                        notes,
                        executed_exercise:exercises!set_logs_executed_exercise_id_fkey(name),
                        legacy_exercise:exercises!set_logs_exercise_id_fkey(name)
                    )
                `)
                .eq('student_id', student.id)
                .order('completed_at', { ascending: false });

            if (error) throw error;

            const sessions: HistorySession[] = [];
            let totalVol = 0;
            let totalSecs = 0;

            // PR Logic: Map<ExerciseName, { weight, date }>
            // We use a Map to keep track of max weight per exercise across ALL sessions
            const prMap = new Map<string, { weight: number, date: string }>();

            data?.forEach((session: any) => {
                if (session.status !== 'completed') return;

                let sessionVol = 0;
                const exerciseMap = new Map<string, HistoryExercise>();

                // Index logs by assigned_workout_item_id
                const logsByItem = new Map<string, any[]>();
                session.logs?.forEach((log: any) => {
                    if (!log.is_completed) return;
                    const itemId = log.assigned_workout_item_id;
                    if (itemId) {
                        if (!logsByItem.has(itemId)) logsByItem.set(itemId, []);
                        logsByItem.get(itemId)!.push(log);
                    }

                    const weight = Number(log.weight) || 0;
                    const reps = Number(log.reps_completed) || 0;
                    sessionVol += weight * reps;

                    const exerciseName =
                        log.executed_exercise?.name ||
                        log.legacy_exercise?.name ||
                        'Exercício';
                    const exerciseId = log.executed_exercise_id || log.exercise_id || 'unknown';

                    if (!exerciseMap.has(exerciseId)) {
                        exerciseMap.set(exerciseId, {
                            id: exerciseId,
                            name: exerciseName,
                            sets: []
                        });
                    }

                    exerciseMap.get(exerciseId)?.sets.push({
                        id: log.id,
                        weight,
                        reps,
                        completed: log.is_completed
                    });

                    // Update PR (Global)
                    if (weight > 0) {
                        const currentMax = prMap.get(exerciseName)?.weight || 0;
                        if (weight > currentMax) {
                            prMap.set(exerciseName, {
                                weight: weight,
                                date: session.completed_at
                            });
                        }
                    }
                });

                // Build structured workout items
                const rawItems: any[] = session.assigned_workout?.items || [];
                const topLevel = rawItems.filter((i: any) => !i.parent_item_id).sort((a: any, b: any) => a.order_index - b.order_index);
                const childItems = rawItems.filter((i: any) => i.parent_item_id);

                const workoutItems: HistoryWorkoutItem[] = topLevel.map((item: any) => {
                    const builtItem = buildHistoryItem(item, logsByItem);
                    if (item.item_type === 'superset') {
                        builtItem.children = childItems
                            .filter((c: any) => c.parent_item_id === item.id)
                            .sort((a: any, b: any) => a.order_index - b.order_index)
                            .map((c: any) => buildHistoryItem(c, logsByItem));
                    }
                    return builtItem;
                });

                totalVol += sessionVol;
                totalSecs += session.duration_seconds ?? 0;

                sessions.push({
                    id: session.id,
                    started_at: session.started_at,
                    completed_at: session.completed_at,
                    duration_seconds: session.duration_seconds ?? null,
                    workout_name: session.assigned_workout?.name || 'Treino Sem Nome',
                    volume_load: sessionVol,
                    is_intense: sessionVol > 8000,
                    exercises: Array.from(exerciseMap.values()),
                    workoutItems,
                    has_pre_checkin: !!session.pre_workout_submission_id,
                    has_post_checkin: !!session.post_workout_submission_id,
                });
            });

            // Calculate Top PRs
            const prs = Array.from(prMap.entries())
                .map(([name, data]) => ({
                    exerciseName: name,
                    weight: data.weight,
                    date: data.date
                }))
                .sort((a, b) => b.weight - a.weight)
                .slice(0, 6); // Top 6 heaviest

            setStats({
                totalWorkouts: sessions.length,
                totalVolume: totalVol / 1000, // Tons
                totalHours: Math.round(totalSecs / 3600),
                personalRecords: prs
            });
            setHistory(sessions);

        } catch (err) {
            if (__DEV__) console.error('Error fetching history:', err);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    return { history, stats, isLoading, refetch: fetchHistory };
}

// ── Helpers ──

function buildHistoryItem(item: any, logsByItem: Map<string, any[]>): HistoryWorkoutItem {
    const itemType = item.item_type as HistoryItemType;
    const exerciseName = item.exercises?.name || item.exercise_name || undefined;
    const itemLogs = logsByItem.get(item.id) || [];

    const result: HistoryWorkoutItem = {
        id: item.id,
        itemType,
        orderIndex: item.order_index,
        exerciseName,
        notes: item.notes || undefined,
        itemConfig: item.item_config || undefined,
        parentItemId: item.parent_item_id || null,
        setLogs: [],
        cardioResult: null,
    };

    if (itemType === 'exercise') {
        result.setLogs = itemLogs.map((log: any) => ({
            id: log.id,
            weight: Number(log.weight) || 0,
            reps: Number(log.reps_completed) || 0,
            completed: !!log.is_completed,
        }));
    }

    if (itemType === 'cardio' && itemLogs[0]?.notes) {
        try {
            result.cardioResult = JSON.parse(itemLogs[0].notes);
        } catch { /* ignore parse error */ }
    }

    return result;
}
