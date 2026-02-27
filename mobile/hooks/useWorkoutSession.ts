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
    planned_exercise_id: string;
    exercise_id: string;
    name: string;
    sets: number;
    reps: string;
    rest_seconds: number;
    video_url?: string;
    substitute_exercise_ids: string[];
    swap_source: 'none' | 'manual' | 'auto';
    setsData: WorkoutSetData[];
    previousLoad?: string;
}

export interface ExerciseSubstituteOption {
    id: string;
    name: string;
    equipment?: string | null;
    video_url?: string | null;
    muscle_groups: string[];
    source: 'manual' | 'auto' | 'search';
}

interface UseWorkoutSessionOptions {
    onSetComplete?: (exerciseIndex: number, setIndex: number) => void;
}

export function useWorkoutSession(workoutId: string, options?: UseWorkoutSessionOptions) {
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [exercises, setExercises] = useState<ExerciseData[]>([]);
    const [studentId, setStudentId] = useState<string | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [startTime] = useState(() => Date.now());
    const [elapsed, setElapsed] = useState(0);
    const [workoutName, setWorkoutName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const mapExerciseToSubstituteOption = (
        exercise: any,
        source: 'manual' | 'auto' | 'search'
    ): ExerciseSubstituteOption => ({
        id: exercise.id,
        name: exercise.name,
        equipment: exercise.equipment,
        video_url: exercise.video_url,
        muscle_groups: (exercise.exercise_muscle_groups || [])
            .map((entry: any) => entry.muscle_groups?.name)
            .filter(Boolean),
        source,
    });

    const createInitialSets = (setsCount: number) => (
        Array(Math.max(setsCount || 0, 0)).fill(null).map(() => ({
            weight: '',
            reps: '',
            completed: false
        }))
    );

    const formatLoadLabel = (maxWeight?: number | null) => {
        if (maxWeight === null || maxWeight === undefined) return undefined;
        const value = Number(maxWeight);
        if (!Number.isFinite(value) || value <= 0) return undefined;
        const normalized = Number.isInteger(value) ? `${value}` : value.toFixed(1);
        return `${normalized}kg`;
    };

    const fetchLastExerciseLoad = async (targetStudentId: string, exerciseId: string): Promise<string | undefined> => {
        if (!targetStudentId || !exerciseId) return undefined;

        const { data: metrics, error: rpcError }: { data: any; error: any } = await supabase
            .rpc('get_last_exercise_metrics' as any, {
                p_student_id: targetStudentId,
                p_exercise_id: exerciseId,
            });

        if (!rpcError && Array.isArray(metrics) && metrics.length > 0) {
            return formatLoadLabel(metrics[0]?.max_weight);
        }

        // Fallback for environments where RPC has not been applied yet.
        const { data: legacyHistory }: { data: any; error: any } = await supabase
            .from('set_logs' as any)
            .select('weight, weight_unit')
            .eq('exercise_id', exerciseId)
            .order('completed_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (legacyHistory?.weight !== undefined && legacyHistory?.weight !== null) {
            return `${legacyHistory.weight}${legacyHistory.weight_unit || 'kg'}`;
        }

        return undefined;
    };

    const fetchExerciseIdsBySharedMuscleGroups = async (exerciseId: string): Promise<string[]> => {
        if (!exerciseId) return [];

        const { data: groups }: { data: any; error: any } = await supabase
            .from('exercise_muscle_groups' as any)
            .select('muscle_group_id')
            .eq('exercise_id', exerciseId);

        const groupIds: string[] = Array.from(
            new Set(
                (groups || [])
                    .map((g: any) => g.muscle_group_id)
                    .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
            )
        );

        if (groupIds.length === 0) return [];

        const { data: groupMatches }: { data: any; error: any } = await supabase
            .from('exercise_muscle_groups' as any)
            .select('exercise_id')
            .in('muscle_group_id', groupIds)
            .limit(400);

        return Array.from(
            new Set(
                (groupMatches || [])
                    .map((match: any) => match.exercise_id)
                    .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
            )
        );
    };

    const fetchExercisesByIds = async (
        ids: string[],
        source: 'manual' | 'auto' | 'search'
    ): Promise<ExerciseSubstituteOption[]> => {
        if (ids.length === 0) return [];

        const { data: exercisesData, error: exerciseError }: { data: any; error: any } = await supabase
            .from('exercises' as any)
            .select(`
                id,
                name,
                equipment,
                video_url,
                exercise_muscle_groups (
                    muscle_groups ( name )
                )
            `)
            .in('id', ids);

        if (exerciseError || !exercisesData) return [];

        const byId = new Map<string, ExerciseSubstituteOption>(
            exercisesData.map((exercise: any) => [
                exercise.id,
                mapExerciseToSubstituteOption(exercise, source),
            ])
        );

        return ids
            .map((id) => byId.get(id))
            .filter((option): option is ExerciseSubstituteOption => Boolean(option));
    };

    // Persist a single set_log to Supabase (fire-and-forget, non-blocking).
    const persistSetLog = async (
        exercise: ExerciseData,
        setIndex: number,
        setData: WorkoutSetData
    ) => {
        if (!sessionId || !setData.completed) return;

        const weight = parseFloat(setData.weight) || 0;
        const repsCompleted = parseInt(setData.reps) || 0;

        try {
            const { error } = await supabase
                .from('set_logs' as any)
                .upsert({
                    workout_session_id: sessionId,
                    assigned_workout_item_id: exercise.id,
                    planned_exercise_id: exercise.planned_exercise_id || exercise.exercise_id,
                    executed_exercise_id: exercise.exercise_id,
                    swap_source: exercise.swap_source || 'none',
                    exercise_id: exercise.exercise_id,
                    set_number: setIndex + 1,
                    weight,
                    reps_completed: repsCompleted,
                    is_completed: true,
                    completed_at: new Date().toISOString(),
                    weight_unit: 'kg',
                }, {
                    onConflict: 'workout_session_id,assigned_workout_item_id,set_number',
                });

            if (error) {
                console.error(`[useWorkoutSession] persistSetLog error: ${error.message}`);
            } else {
                console.log(`[useWorkoutSession] Set persisted: exercise=${exercise.name}, set=${setIndex + 1}, ${repsCompleted}reps x ${weight}kg`);
            }
        } catch (err: any) {
            console.error(`[useWorkoutSession] persistSetLog exception: ${err?.message}`);
        }
    };

    // Timer — timestamp-based so it survives background/lock screen
    useEffect(() => {
        const interval = setInterval(() => {
            setElapsed(Math.floor((Date.now() - startTime) / 1000));
        }, 1000);
        return () => clearInterval(interval);
    }, [startTime]);

    // Fetch Workout Data
    useEffect(() => {
        let mounted = true;

        async function fetchWorkout() {
            if (!workoutId || !user) return;

            try {
                // Student context for logs/history RPC
                const { data: student, error: studentError }: { data: any; error: any } = await supabase
                    .from('students' as any)
                    .select('id')
                    .eq('auth_user_id', user.id)
                    .maybeSingle();

                if (studentError) throw studentError;
                const currentStudentId = student?.id || null;
                if (mounted) setStudentId(currentStudentId);

                // 1. Get Workout Details
                const { data: workout, error: workoutError }: { data: any; error: any } = await supabase
                    .from('assigned_workouts' as any)
                    .select('name, assigned_program_id')
                    .eq('id', workoutId)
                    .single();

                if (workoutError) throw workoutError;
                if (mounted) setWorkoutName(workout.name);

                // 1b. Find or create workout_session (in_progress)
                const { data: existingSession }: { data: any; error: any } = await supabase
                    .from('workout_sessions' as any)
                    .select('id')
                    .eq('assigned_workout_id', workoutId)
                    .eq('student_id', currentStudentId)
                    .eq('status', 'in_progress')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (existingSession) {
                    console.log(`[useWorkoutSession] Found existing in_progress session: ${existingSession.id}`);
                    if (mounted) setSessionId(existingSession.id);
                } else {
                    // Get trainer_id from student
                    const { data: studentFull }: { data: any; error: any } = await supabase
                        .from('students' as any)
                        .select('coach_id')
                        .eq('id', currentStudentId)
                        .single();

                    const { data: newSession, error: sessionError }: { data: any; error: any } = await supabase
                        .from('workout_sessions' as any)
                        .insert({
                            student_id: currentStudentId,
                            trainer_id: studentFull?.coach_id,
                            assigned_workout_id: workoutId,
                            assigned_program_id: workout.assigned_program_id,
                            status: 'in_progress',
                            started_at: new Date().toISOString(),
                            sync_status: 'synced',
                        })
                        .select('id')
                        .single();

                    if (sessionError) {
                        console.error('[useWorkoutSession] Failed to create session:', sessionError);
                    } else {
                        console.log(`[useWorkoutSession] Created new in_progress session: ${newSession.id}`);
                        if (mounted) setSessionId(newSession.id);
                    }
                }

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
                        substitute_exercise_ids,
                        item_type, 
                        order_index,
                        exercises ( id, video_url )
                    `)
                    .eq('assigned_workout_id', workoutId)
                    .eq('item_type', 'exercise') // Only exercises
                    .order('order_index');

                if (itemsError) throw itemsError;

                // 3. Initialize State and Fetch History
                const exercisesData: ExerciseData[] = await Promise.all(items.map(async (item: any) => {
                    let previousLoad = undefined;
                    if (item.exercise_id && currentStudentId) {
                        previousLoad = await fetchLastExerciseLoad(currentStudentId, item.exercise_id);
                    }

                    return {
                        id: item.id,
                        planned_exercise_id: item.exercise_id,
                        exercise_id: item.exercise_id,
                        name: item.exercise_name,
                        sets: item.sets || 3,
                        reps: item.reps || '10',
                        rest_seconds: item.rest_seconds || 60,
                        video_url: item.exercises?.video_url,
                        substitute_exercise_ids: item.substitute_exercise_ids || [],
                        swap_source: 'none',
                        setsData: createInitialSets(item.sets || 3),
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
            const exercise = { ...newExercises[exerciseIndex] };
            const newSets = [...exercise.setsData];
            const wasCompleted = newSets[setIndex].completed;
            newSets[setIndex] = { ...newSets[setIndex], completed: !wasCompleted };
            exercise.setsData = newSets;
            newExercises[exerciseIndex] = exercise;

            // Fire callback when marking as complete (not when unchecking)
            if (!wasCompleted && options?.onSetComplete) {
                options.onSetComplete(exerciseIndex, setIndex);
            }

            // Persist to DB immediately (fire-and-forget)
            if (!wasCompleted) {
                persistSetLog(exercise, setIndex, newSets[setIndex]);
            }

            return newExercises;
        });
    };

    const applyWatchSetCompletion = (
        exerciseIndex: number,
        setIndex: number,
        reps?: number,
        weight?: number
    ) => {
        setExercises(prev => {
            if (!prev[exerciseIndex] || !prev[exerciseIndex].setsData[setIndex]) return prev;

            const newExercises = [...prev];
            const exercise = { ...newExercises[exerciseIndex] };
            const newSets = [...exercise.setsData];
            const currentSet = { ...newSets[setIndex] };
            const wasCompleted = currentSet.completed;

            if (reps !== undefined && Number.isFinite(reps)) {
                currentSet.reps = String(reps);
            }

            if (weight !== undefined && Number.isFinite(weight)) {
                currentSet.weight = String(weight);
            }

            currentSet.completed = true;
            newSets[setIndex] = currentSet;
            exercise.setsData = newSets;
            newExercises[exerciseIndex] = exercise;

            if (!wasCompleted && options?.onSetComplete) {
                options.onSetComplete(exerciseIndex, setIndex);
            }

            // Persist to DB immediately (fire-and-forget)
            persistSetLog(exercise, setIndex, currentSet);

            return newExercises;
        });
    };

    const loadSubstituteOptions = async (exerciseIndex: number): Promise<ExerciseSubstituteOption[]> => {
        const current = exercises[exerciseIndex];
        if (!current?.id) return [];

        const plannedExerciseId = current.planned_exercise_id || current.exercise_id;
        if (!plannedExerciseId) return [];

        // 1) Manual suggestions from assigned item
        const { data: assignedItem }: { data: any; error: any } = await supabase
            .from('assigned_workout_items' as any)
            .select('substitute_exercise_ids')
            .eq('id', current.id)
            .maybeSingle();

        const manualIdsRaw: string[] = (
            Array.isArray(assignedItem?.substitute_exercise_ids)
                ? assignedItem.substitute_exercise_ids
                : (current.substitute_exercise_ids || [])
        ).filter((id: unknown): id is string => typeof id === 'string' && id.length > 0);

        const manualIds: string[] = Array.from(new Set(manualIdsRaw))
            .filter((id) => id !== current.exercise_id);

        const manualOptions = await fetchExercisesByIds(manualIds, 'manual');
        const manualSet = new Set(manualOptions.map((option) => option.id));

        // Automatic suggestions: max 2, using smart RPC when available.
        let autoOptions: ExerciseSubstituteOption[] = [];
        const { data: smartRows, error: smartError }: { data: any; error: any } = await supabase
            .rpc('get_smart_substitutes' as any, {
                target_exercise_id: plannedExerciseId,
                match_limit: 2,
            });

        if (!smartError && Array.isArray(smartRows)) {
            const smartIds: string[] = smartRows
                .map((row: any) => row.id)
                .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
                .filter((id) => id !== plannedExerciseId && id !== current.exercise_id && !manualSet.has(id))
                .slice(0, 2);

            autoOptions = await fetchExercisesByIds(smartIds, 'auto');
        } else {
            // Fallback if RPC is not yet available: old same-muscle strategy limited to 2.
            const sharedIds = await fetchExerciseIdsBySharedMuscleGroups(plannedExerciseId);
            const fallbackAutoIds = sharedIds
                .filter((id) => id !== plannedExerciseId && id !== current.exercise_id && !manualSet.has(id))
                .slice(0, 2);

            autoOptions = await fetchExercisesByIds(fallbackAutoIds, 'auto');
        }

        return [...manualOptions, ...autoOptions];
    };

    const searchSubstituteOptions = async (
        exerciseIndex: number,
        query: string
    ): Promise<ExerciseSubstituteOption[]> => {
        const current = exercises[exerciseIndex];
        if (!current?.id) return [];

        const searchTerm = query.trim();
        if (searchTerm.length < 2) return [];

        const plannedExerciseId = current.planned_exercise_id || current.exercise_id;
        if (!plannedExerciseId) return [];

        const sharedIds = await fetchExerciseIdsBySharedMuscleGroups(plannedExerciseId);
        const candidateIds = sharedIds.filter((id) => id !== plannedExerciseId && id !== current.exercise_id);
        if (candidateIds.length === 0) return [];

        const { data: exercisesData, error: searchError }: { data: any; error: any } = await supabase
            .from('exercises' as any)
            .select(`
                id,
                name,
                equipment,
                video_url,
                exercise_muscle_groups (
                    muscle_groups ( name )
                )
            `)
            .in('id', candidateIds)
            .ilike('name', `%${searchTerm}%`)
            .order('name')
            .limit(20);

        if (searchError || !exercisesData) return [];

        return exercisesData.map((exercise: any) => mapExerciseToSubstituteOption(exercise, 'search'));
    };

    const swapExercise = async (
        exerciseIndex: number,
        substitute: ExerciseSubstituteOption,
        forceReset = false
    ): Promise<{ success: boolean; requiresConfirmation?: boolean; message?: string }> => {
        const current = exercises[exerciseIndex];
        if (!current) {
            return { success: false, message: 'Exercicio nao encontrado.' };
        }

        const hasCompletedSets = current.setsData.some((set) => set.completed);
        if (hasCompletedSets && !forceReset) {
            return { success: false, requiresConfirmation: true, message: 'Este exercicio ja possui series concluidas.' };
        }

        let nextPreviousLoad: string | undefined = undefined;
        if (studentId) {
            nextPreviousLoad = await fetchLastExerciseLoad(studentId, substitute.id);
        }

        setExercises((prev) => prev.map((exercise, index) => {
            if (index !== exerciseIndex) return exercise;

            return {
                ...exercise,
                exercise_id: substitute.id,
                name: substitute.name,
                video_url: substitute.video_url ?? exercise.video_url ?? undefined,
                previousLoad: nextPreviousLoad,
                swap_source: substitute.source === 'search' ? 'manual' : substitute.source,
                setsData: createInitialSets(exercise.sets),
            };
        }));

        return { success: true };
    };

    const finishWorkout = async (rpe?: number, feedback?: string) => {
        if (isSubmitting || !user) return;

        setIsSubmitting(true);

        try {
            const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
            const now = new Date().toISOString();

            // Use existing session (created on workout start) or create one as fallback
            let currentSessionId = sessionId;

            if (!currentSessionId) {
                console.warn('[useWorkoutSession] No sessionId at finish — creating session now');

                const { data: student }: { data: any; error: any } = await supabase
                    .from('students' as any)
                    .select('id, coach_id')
                    .eq('auth_user_id', user.id)
                    .single();

                if (!student) throw new Error("Student not found");

                const { data: workout }: { data: any; error: any } = await supabase
                    .from('assigned_workouts' as any)
                    .select('assigned_program_id')
                    .eq('id', workoutId)
                    .single();

                const { data: newSession, error: sessionError }: { data: any; error: any } = await supabase
                    .from('workout_sessions' as any)
                    .insert({
                        student_id: student.id,
                        trainer_id: student.coach_id,
                        assigned_workout_id: workoutId,
                        assigned_program_id: workout?.assigned_program_id,
                        status: 'completed',
                        started_at: new Date(startTime).toISOString(),
                        completed_at: now,
                        duration_seconds: durationSeconds,
                        sync_status: 'synced',
                        rpe: rpe || null,
                        feedback: feedback || null,
                    })
                    .select('id')
                    .single();

                if (sessionError) throw sessionError;
                currentSessionId = newSession.id;
            } else {
                // Update existing in_progress session to completed
                const { error: updateError } = await supabase
                    .from('workout_sessions' as any)
                    .update({
                        status: 'completed',
                        completed_at: now,
                        duration_seconds: durationSeconds,
                        rpe: rpe || null,
                        feedback: feedback || null,
                    })
                    .eq('id', currentSessionId);

                if (updateError) throw updateError;
            }

            // Upsert any remaining set_logs (catch-up for sets that may not have been persisted)
            const setLogs: any[] = [];
            for (const exercise of exercises) {
                for (let i = 0; i < exercise.setsData.length; i++) {
                    const set = exercise.setsData[i];
                    if (set.completed) {
                        setLogs.push({
                            workout_session_id: currentSessionId,
                            assigned_workout_item_id: exercise.id,
                            planned_exercise_id: exercise.planned_exercise_id || exercise.exercise_id,
                            executed_exercise_id: exercise.exercise_id,
                            swap_source: exercise.swap_source || 'none',
                            exercise_id: exercise.exercise_id,
                            set_number: i + 1,
                            weight: parseFloat(set.weight) || 0,
                            reps_completed: parseInt(set.reps) || 0,
                            is_completed: true,
                            completed_at: now,
                            weight_unit: 'kg',
                        });
                    }
                }
            }

            if (setLogs.length > 0) {
                const { error: logsError } = await supabase
                    .from('set_logs' as any)
                    .upsert(setLogs, {
                        onConflict: 'workout_session_id,assigned_workout_item_id,set_number',
                    });

                if (logsError) {
                    console.error('[useWorkoutSession] Error upserting set_logs at finish:', logsError);
                }
            }

            console.log(`[useWorkoutSession] Workout finished. Session: ${currentSessionId}, sets: ${setLogs.length}`);
            return currentSessionId;

        } catch (error: any) {
            console.error("Error finishing workout:", error);
            throw error;
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
        duration: formatTime(elapsed),
        handleSetChange,
        handleToggleSetComplete,
        applyWatchSetCompletion,
        loadSubstituteOptions,
        searchSubstituteOptions,
        swapExercise,
        finishWorkout,
        isSubmitting
    };
}
