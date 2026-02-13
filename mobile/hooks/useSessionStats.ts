import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ShareableCardProps } from '../components/workout/sharing/types';

export function useSessionStats(sessionId: string | null) {
    const [stats, setStats] = useState<{
        volume: number;
        maxLoads: ShareableCardProps['maxLoads'];
        loading: boolean;
    }>({
        volume: 0,
        maxLoads: [],
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
                        exercises:exercises!set_logs_exercise_id_fkey (name)
                    `)
                    .eq('workout_session_id', sessionId)
                    .eq('is_completed', true);

                if (error) throw error;

                if (logs) {
                    let totalVolume = 0;
                    const exerciseMaxes: Record<string, { weight: number, reps: number, name: string }> = {};

                    logs.forEach((log: any) => {
                        const weight = Number(log.weight) || 0;
                        const reps = Number(log.reps_completed) || 0;

                        // Calc Volume
                        totalVolume += weight * reps;

                        // Calc Max Load per Exercise
                        const name = log.exercises?.name || 'Exercício';

                        if (!exerciseMaxes[name] || weight > exerciseMaxes[name].weight) {
                            exerciseMaxes[name] = { weight, reps, name };
                        }
                    });

                    const maxLoads = Object.values(exerciseMaxes)
                        .sort((a, b) => b.weight - a.weight)
                        .slice(0, 3)
                        .map(item => ({
                            exerciseName: item.name,
                            weight: item.weight,
                            reps: item.reps,
                            isPr: false // Placeholder for PR logic
                        }));

                    setStats({ volume: totalVolume, maxLoads, loading: false });
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
