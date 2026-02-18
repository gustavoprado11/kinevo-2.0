import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ShareableCardProps } from '../components/workout/sharing/types';

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
                        exercises:exercises!set_logs_exercise_id_fkey (name)
                    `)
                    .eq('workout_session_id', sessionId)
                    .eq('is_completed', true);

                if (error) throw error;

                if (logs) {
                    let totalVolume = 0;
                    const exerciseMaxes: Record<string, { weight: number, reps: number, name: string }> = {};
                    // Track per-exercise aggregated data for full workout template
                    const exerciseAgg: Record<string, { name: string, sets: number, maxWeight: number, maxReps: number, order: number }> = {};
                    let exerciseOrder = 0;

                    logs.forEach((log: any) => {
                        const weight = Number(log.weight) || 0;
                        const reps = Number(log.reps_completed) || 0;
                        const name = log.exercises?.name || 'Exercício';

                        // Volume
                        totalVolume += weight * reps;

                        // Max Load per Exercise
                        if (!exerciseMaxes[name] || weight > exerciseMaxes[name].weight) {
                            exerciseMaxes[name] = { weight, reps, name };
                        }

                        // Aggregate exercise details (sets count, best weight, best reps)
                        if (!exerciseAgg[name]) {
                            exerciseAgg[name] = { name, sets: 0, maxWeight: 0, maxReps: 0, order: exerciseOrder++ };
                        }
                        exerciseAgg[name].sets += 1;
                        if (weight > exerciseAgg[name].maxWeight) {
                            exerciseAgg[name].maxWeight = weight;
                            exerciseAgg[name].maxReps = reps;
                        }
                    });

                    const maxLoads = Object.values(exerciseMaxes)
                        .sort((a, b) => b.weight - a.weight)
                        .slice(0, 3)
                        .map(item => ({
                            exerciseName: item.name,
                            weight: item.weight,
                            reps: item.reps,
                            isPr: false
                        }));

                    const exerciseDetails = Object.values(exerciseAgg)
                        .sort((a, b) => a.order - b.order)
                        .map(item => ({
                            name: item.name,
                            sets: item.sets,
                            reps: item.maxReps,
                            weight: item.maxWeight,
                        }));

                    setStats({ volume: totalVolume, maxLoads, exerciseDetails, loading: false });
                }
            } catch (err) {
                console.error("Error fetching session stats:", err);
                setStats(prev => ({ ...prev, loading: false }));
            }
        };

        fetchStats();
    }, [sessionId]);

    return stats;
}
