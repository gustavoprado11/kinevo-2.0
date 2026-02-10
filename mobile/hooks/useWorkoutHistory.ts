import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

export interface HistorySession {
    id: string;
    started_at: string;
    completed_at: string;
    duration_seconds: number;
    workout_name: string;
    volume_load: number;
    is_intense: boolean;
    exercises: HistoryExercise[];
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

            // Fetch sessions with logs
            const { data, error } = await supabase
                .from('workout_sessions')
                .select(`
                    id,
                    started_at,
                    completed_at,
                    duration_seconds,
                    status,
                    assigned_workout:assigned_workouts(name),
                    logs:set_logs(
                        id,
                        executed_exercise_id,
                        exercise_id,
                        weight,
                        reps_completed,
                        is_completed,
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

                session.logs?.forEach((log: any) => {
                    if (!log.is_completed) return;

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

                totalVol += sessionVol;
                totalSecs += session.duration_seconds || 0;

                sessions.push({
                    id: session.id,
                    started_at: session.started_at,
                    completed_at: session.completed_at,
                    duration_seconds: session.duration_seconds || 0,
                    workout_name: session.assigned_workout?.name || 'Treino Sem Nome',
                    volume_load: sessionVol,
                    is_intense: sessionVol > 8000,
                    exercises: Array.from(exerciseMap.values())
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
            console.error('Error fetching history:', err);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    return { history, stats, isLoading, refetch: fetchHistory };
}
