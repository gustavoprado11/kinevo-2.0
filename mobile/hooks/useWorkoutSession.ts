import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { router } from 'expo-router';
import { Alert } from 'react-native';

export interface WorkoutSetData {
    weight: string;
    reps: string;
    completed: boolean;
}

export interface ExerciseData {
    id: string; // assigned_workout_item_id
    exercise_id: string;
    name: string;
    sets: number;
    reps: string;
    rest_seconds: number;
    video_url?: string;
    setsData: WorkoutSetData[];
    previousLoad?: string;
}

export function useWorkoutSession(workoutId: string) {
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [exercises, setExercises] = useState<ExerciseData[]>([]);
    const [duration, setDuration] = useState(0);
    const [workoutName, setWorkoutName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Timer
    useEffect(() => {
        const interval = setInterval(() => {
            setDuration(prev => prev + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // Fetch Workout Data
    useEffect(() => {
        let mounted = true;

        async function fetchWorkout() {
            if (!workoutId || !user) return;

            try {
                // 1. Get Workout Details
                const { data: workout, error: workoutError }: { data: any; error: any } = await supabase
                    .from('assigned_workouts' as any)
                    .select('name, assigned_program_id')
                    .eq('id', workoutId)
                    .single();

                if (workoutError) throw workoutError;
                if (mounted) setWorkoutName(workout.name);

                // 2. Get Workout Items (Exercises)
                const { data: items, error: itemsError }: { data: any; error: any } = await supabase
                    .from('assigned_workout_items' as any)
                    .select(`
                        id, 
                        exercise_id, 
                        exercise_name, 
                        sets, 
                        reps, 
                        rest_seconds, 
                        item_type, 
                        order_index,
                        exercises ( video_url )
                    `)
                    .eq('assigned_workout_id', workoutId)
                    .eq('item_type', 'exercise') // Only exercises
                    .order('order_index');

                if (itemsError) throw itemsError;

                // 3. Initialize State and Fetch History
                const exercisesData: ExerciseData[] = await Promise.all(items.map(async (item: any) => {
                    // Fetch last log for this exercise
                    let previousLoad = undefined;
                    if (item.exercise_id) {
                        const { data: history }: { data: any; error: any } = await supabase
                            .from('set_logs' as any)
                            .select('weight, weight_unit')
                            .eq('exercise_id', item.exercise_id)
                            .order('completed_at', { ascending: false })
                            .limit(1)
                            .maybeSingle();

                        if (history) {
                            previousLoad = `${history.weight}${history.weight_unit}`;
                        }
                    }

                    // Init sets
                    const initialSets = Array(item.sets || 3).fill(null).map(() => ({
                        weight: '',
                        reps: '',
                        completed: false
                    }));

                    return {
                        id: item.id,
                        exercise_id: item.exercise_id,
                        name: item.exercise_name,
                        sets: item.sets || 3,
                        reps: item.reps || '10',
                        rest_seconds: item.rest_seconds || 60,
                        video_url: item.exercises?.video_url,
                        setsData: initialSets,
                        previousLoad
                    };
                }));

                if (mounted) setExercises(exercisesData);

            } catch (error) {
                console.error("Error fetching workout:", error);
                Alert.alert("Erro", "Falha ao carregar o treino.");
            } finally {
                if (mounted) setIsLoading(false);
            }
        }

        fetchWorkout();
        return () => { mounted = false; };
    }, [workoutId, user]);


    const handleSetChange = (exerciseIndex: number, setIndex: number, field: 'weight' | 'reps', value: string) => {
        setExercises(prev => {
            const newExercises = JSON.parse(JSON.stringify(prev)); // Deep copy for safety
            const sets = newExercises[exerciseIndex].setsData;

            // Get the value BEFORE the update
            const oldValue = sets[setIndex][field];

            // Update the current set
            sets[setIndex][field] = value;

            // Smart Waterfall Logic: Propagate to subsequent sets
            // Rule: Propagate if the next set is empty OR if it matched the *old* value (was previously auto-filled)
            for (let i = setIndex + 1; i < sets.length; i++) {
                const currentNextValue = sets[i][field];

                // Conditions to propagate:
                // 1. The target field is empty
                // 2. The target field matches the oldValue (meaning it was likely following the waterfall)
                if (currentNextValue === '' || currentNextValue === oldValue) {
                    sets[i][field] = value;
                } else {
                    // Stop propagation if we hit a manually changed value (rock in the waterfall)
                    break;
                }
            }

            return newExercises;
        });
    };

    const handleToggleSetComplete = (exerciseIndex: number, setIndex: number) => {
        setExercises(prev => {
            const newExercises = [...prev];
            const newSets = [...newExercises[exerciseIndex].setsData];
            newSets[setIndex] = { ...newSets[setIndex], completed: !newSets[setIndex].completed };
            newExercises[exerciseIndex].setsData = newSets;
            return newExercises;
        });
    };

    const finishWorkout = async (rpe?: number, feedback?: string) => {
        if (isSubmitting || !user) return;

        // Validation: Check if at least one set is completed? Or allow partial?
        // For now allow partial, but maybe warn?

        setIsSubmitting(true);

        try {
            // Get Student ID
            const { data: student }: { data: any; error: any } = await supabase
                .from('students' as any)
                .select('id, trainer_id')
                .eq('auth_user_id', user.id)
                .single();

            if (!student) throw new Error("Student not found");

            // Get assigned_program_id again ensuring accuracy
            const { data: workout }: { data: any; error: any } = await supabase
                .from('assigned_workouts' as any)
                .select('assigned_program_id')
                .eq('id', workoutId)
                .single();

            const startedAt = new Date();
            startedAt.setSeconds(startedAt.getSeconds() - duration);

            // 1. Create Session
            const { data: session, error: sessionError }: { data: any; error: any } = await supabase
                .from('workout_sessions' as any)
                .insert({
                    student_id: student.id,
                    trainer_id: student.trainer_id,
                    assigned_workout_id: workoutId,
                    assigned_program_id: workout.assigned_program_id,
                    status: 'completed',
                    started_at: startedAt.toISOString(),
                    completed_at: new Date().toISOString(),
                    duration_seconds: duration,
                    sync_status: 'synced',
                    rpe: rpe || null,
                    feedback: feedback || null
                })
                .select()
                .single();

            if (sessionError) throw sessionError;

            // 2. Log Sets
            const setLogs = [];

            for (const exercise of exercises) {
                for (let i = 0; i < exercise.setsData.length; i++) {
                    const set = exercise.setsData[i];
                    // Log all sets or only completed? The requirements imply logging completed.
                    // But if we want to save incomplete but filled sets? 
                    // Let's save ONLY completed for now as per requirement "Check Button".
                    if (set.completed) {
                        setLogs.push({
                            workout_session_id: session.id,
                            assigned_workout_item_id: exercise.id,
                            exercise_id: exercise.exercise_id,
                            set_number: i + 1,
                            weight: parseFloat(set.weight) || 0,
                            reps_completed: parseInt(set.reps) || 0,
                            is_completed: true,
                            completed_at: new Date().toISOString(),
                            weight_unit: 'kg'
                        });
                    }
                }
            }

            if (setLogs.length > 0) {
                const { error: logsError }: { error: any } = await supabase
                    .from('set_logs' as any)
                    .insert(setLogs);

                if (logsError) throw logsError;
            }

            // Success! We just return here and let the component handle the UI/Navigation
            return true;

        } catch (error: any) {
            console.error("Error finishing workout:", error);
            throw error; // Re-throw to be handled by component
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return {
        isLoading,
        workoutName,
        exercises,
        duration: formatTime(duration),
        handleSetChange,
        handleToggleSetComplete,
        finishWorkout,
        isSubmitting
    };
}
