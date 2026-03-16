import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { router } from 'expo-router';
import { Alert } from 'react-native';

export interface WorkoutSetData {
    weight: string;
    reps: string;
    completed: boolean;
}

export interface PreviousSetData {
    set_number: number;
    weight: number;
    reps: number;
}

export interface ExerciseData {
    id: string; // assigned_workout_item_id
    item_type?: 'exercise' | 'warmup' | 'cardio';
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
    previousSets?: PreviousSetData[];
    notes?: string | null;
    supersetId?: string | null;
    supersetRestSeconds?: number;
    order_index: number;
    exerciseFunction?: string | null;
    item_config?: Record<string, any>;
}

export interface WorkoutNote {
    id: string;
    notes: string;
    order_index: number;
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
    /** When true, the session is NOT created on mount. Call createSession() manually. */
    deferSessionCreation?: boolean;
}

export function useWorkoutSession(workoutId: string, options?: UseWorkoutSessionOptions) {
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [exercises, setExercises] = useState<ExerciseData[]>([]);
    const [workoutNotes, setWorkoutNotes] = useState<WorkoutNote[]>([]);
    const [studentId, setStudentId] = useState<string | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const preSubmissionIdRef = useRef<string | null>(null);
    const [assignedProgramId, setAssignedProgramId] = useState<string | null>(null);
    const scheduledDaysRef = useRef<number[] | null>(null);
    const [startTime] = useState(() => Date.now());
    const [elapsed, setElapsed] = useState(0);
    const [workoutName, setWorkoutName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Guard: prevent re-fetching workout data when auth session refreshes.
    // Supabase onAuthStateChange fires on TOKEN_REFRESHED, creating a new `user`
    // reference which would re-trigger the fetchWorkout effect and wipe exercise state.
    const hasLoadedRef = useRef(false);

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

    const fetchPreviousSets = async (
        targetStudentId: string,
        exerciseId: string
    ): Promise<{ previousSets: PreviousSetData[]; previousLoad?: string }> => {
        if (!targetStudentId || !exerciseId) return { previousSets: [] };

        // Try per-set RPC first
        const { data: sets, error: setsError }: { data: any; error: any } = await supabase
            .rpc('get_previous_exercise_sets' as any, {
                p_student_id: targetStudentId,
                p_exercise_id: exerciseId,
            });

        if (!setsError && Array.isArray(sets) && sets.length > 0) {
            const previousSets: PreviousSetData[] = sets.map((s: any) => ({
                set_number: s.set_number,
                weight: Number(s.weight) || 0,
                reps: Number(s.reps) || 0,
            }));
            const maxWeight = Math.max(...previousSets.map(s => s.weight));
            return { previousSets, previousLoad: formatLoadLabel(maxWeight) };
        }

        // Fallback: aggregated RPC
        const { data: metrics, error: rpcError }: { data: any; error: any } = await supabase
            .rpc('get_last_exercise_metrics' as any, {
                p_student_id: targetStudentId,
                p_exercise_id: exerciseId,
            });

        if (!rpcError && Array.isArray(metrics) && metrics.length > 0) {
            return { previousSets: [], previousLoad: formatLoadLabel(metrics[0]?.max_weight) };
        }

        // Final fallback: direct query
        const { data: legacyHistory }: { data: any; error: any } = await supabase
            .from('set_logs' as any)
            .select('weight, weight_unit')
            .eq('exercise_id', exerciseId)
            .order('completed_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (legacyHistory?.weight !== undefined && legacyHistory?.weight !== null) {
            return { previousSets: [], previousLoad: `${legacyHistory.weight}${legacyHistory.weight_unit || 'kg'}` };
        }

        return { previousSets: [] };
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
                if (__DEV__) console.error(`[useWorkoutSession] persistSetLog error: ${error.message}`);
            } else {
                if (__DEV__) console.log(`[useWorkoutSession] Set persisted: exercise=${exercise.name}, set=${setIndex + 1}, ${repsCompleted}reps x ${weight}kg`);
            }
        } catch (err: any) {
            if (__DEV__) console.error(`[useWorkoutSession] persistSetLog exception: ${err?.message}`);
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
        if (hasLoadedRef.current) return;

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
                    .select('name, assigned_program_id, scheduled_days')
                    .eq('id', workoutId)
                    .single();

                if (workoutError) throw workoutError;
                if (mounted) {
                    setWorkoutName(workout.name);
                    setAssignedProgramId(workout.assigned_program_id || null);
                    scheduledDaysRef.current = workout.scheduled_days || null;
                }

                // 1b. Find or create workout_session (in_progress)
                // When deferSessionCreation is true, skip creating a new session.
                // An existing in_progress session is still reattached.
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
                    if (__DEV__) console.log(`[useWorkoutSession] Found existing in_progress session: ${existingSession.id}`);
                    if (mounted) setSessionId(existingSession.id);
                } else if (!options?.deferSessionCreation) {
                    // Get trainer_id from student
                    const { data: studentFull }: { data: any; error: any } = await supabase
                        .from('students' as any)
                        .select('coach_id')
                        .eq('id', currentStudentId)
                        .single();

                    // Determine scheduled_date: set to today if this workout is scheduled for today's day-of-week
                    const todayDow = new Date().getDay();
                    const isScheduledToday = workout.scheduled_days?.includes(todayDow);
                    const scheduledDate = isScheduledToday ? new Date().toISOString().split('T')[0] : null;

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
                            scheduled_date: scheduledDate,
                        })
                        .select('id')
                        .single();

                    if (sessionError) {
                        console.error('[useWorkoutSession] Failed to create session:', __DEV__ ? sessionError : '');
                    } else {
                        if (__DEV__) console.log(`[useWorkoutSession] Created new in_progress session: ${newSession.id}`);
                        if (mounted) setSessionId(newSession.id);
                    }
                } else {
                    if (__DEV__) console.log('[useWorkoutSession] Session creation deferred — waiting for createSession()');
                }

                // 2. Get ALL Workout Items (exercises, supersets, notes)
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
                        parent_item_id,
                        notes,
                        exercise_function,
                        item_config,
                        exercises ( id, video_url )
                    `)
                    .eq('assigned_workout_id', workoutId)
                    .order('order_index');

                if (itemsError) throw itemsError;

                // 3. Build superset map and extract notes
                const supersetMap = new Map<string, { rest_seconds: number; order_index: number }>();
                const noteItems: WorkoutNote[] = [];

                for (const item of items) {
                    if (item.item_type === 'superset') {
                        supersetMap.set(item.id, { rest_seconds: item.rest_seconds || 60, order_index: item.order_index });
                    } else if (item.item_type === 'note' && item.notes?.trim()) {
                        noteItems.push({ id: item.id, notes: item.notes, order_index: item.order_index });
                    }
                }

                // 4. Initialize exercise state and fetch history
                const exerciseItems = items.filter((item: any) => item.item_type === 'exercise');
                const warmupCardioItems = items.filter((item: any) => item.item_type === 'warmup' || item.item_type === 'cardio');
                const exercisesData: ExerciseData[] = await Promise.all(exerciseItems.map(async (item: any) => {
                    let previousLoad: string | undefined = undefined;
                    let previousSets: PreviousSetData[] | undefined = undefined;
                    if (item.exercise_id && currentStudentId) {
                        const result = await fetchPreviousSets(currentStudentId, item.exercise_id);
                        previousLoad = result.previousLoad;
                        previousSets = result.previousSets.length > 0 ? result.previousSets : undefined;
                    }

                    const parentSuperset = item.parent_item_id ? supersetMap.get(item.parent_item_id) : null;

                    return {
                        id: item.id,
                        item_type: 'exercise' as const,
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
                        previousLoad,
                        previousSets,
                        notes: item.notes || null,
                        supersetId: item.parent_item_id || null,
                        supersetRestSeconds: parentSuperset?.rest_seconds,
                        order_index: item.order_index,
                        exerciseFunction: item.exercise_function || null,
                        item_config: item.item_config || {},
                    };
                }));

                // Add warmup/cardio items — no set tracking
                for (const item of warmupCardioItems) {
                    exercisesData.push({
                        id: item.id,
                        item_type: item.item_type as 'warmup' | 'cardio',
                        planned_exercise_id: '',
                        exercise_id: '',
                        name: item.notes || (item.item_type === 'warmup' ? 'Aquecimento' : 'Aeróbio'),
                        sets: 0,
                        reps: '0',
                        rest_seconds: 0,
                        substitute_exercise_ids: [],
                        swap_source: 'none',
                        setsData: [],
                        order_index: item.order_index,
                        exerciseFunction: item.exercise_function || null,
                        item_config: item.item_config || {},
                    });
                }

                if (mounted) {
                    setExercises(exercisesData);
                    setWorkoutNotes(noteItems);
                    hasLoadedRef.current = true;
                }

            } catch (error) {
                if (__DEV__) console.error("Error fetching workout:", error);
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
        let nextPreviousSets: PreviousSetData[] | undefined = undefined;
        if (studentId) {
            const result = await fetchPreviousSets(studentId, substitute.id);
            nextPreviousLoad = result.previousLoad;
            nextPreviousSets = result.previousSets.length > 0 ? result.previousSets : undefined;
        }

        setExercises((prev) => prev.map((exercise, index) => {
            if (index !== exerciseIndex) return exercise;

            return {
                ...exercise,
                exercise_id: substitute.id,
                name: substitute.name,
                video_url: substitute.video_url ?? exercise.video_url ?? undefined,
                previousLoad: nextPreviousLoad,
                previousSets: nextPreviousSets,
                swap_source: substitute.source === 'search' ? 'manual' : substitute.source,
                setsData: createInitialSets(exercise.sets),
            };
        }));

        return { success: true };
    };

    /**
     * Manually create the workout_session. Used when deferSessionCreation is true.
     * Returns the new session ID, or null on failure.
     */
    const createSession = async (preWorkoutSubmissionId?: string): Promise<string | null> => {
        if (sessionId) return sessionId; // Already exists
        if (!user || !studentId) return null;

        try {
            const { data: studentFull }: { data: any; error: any } = await supabase
                .from('students' as any)
                .select('coach_id')
                .eq('id', studentId)
                .single();

            // Determine scheduled_date: set to today if this workout is scheduled for today's day-of-week
            const todayDow = new Date().getDay();
            const isScheduledToday = scheduledDaysRef.current?.includes(todayDow);
            const scheduledDate = isScheduledToday ? new Date().toISOString().split('T')[0] : null;

            const insertPayload: Record<string, any> = {
                student_id: studentId,
                trainer_id: studentFull?.coach_id,
                assigned_workout_id: workoutId,
                assigned_program_id: assignedProgramId,
                status: 'in_progress',
                started_at: new Date().toISOString(),
                sync_status: 'synced',
                scheduled_date: scheduledDate,
            };
            if (preWorkoutSubmissionId) {
                insertPayload.pre_workout_submission_id = preWorkoutSubmissionId;
                preSubmissionIdRef.current = preWorkoutSubmissionId;
            }

            const { data: newSession, error: sessionError }: { data: any; error: any } = await supabase
                .from('workout_sessions' as any)
                .insert(insertPayload)
                .select('id')
                .single();

            if (sessionError) {
                console.error('[useWorkoutSession] createSession error:', __DEV__ ? sessionError : '');
                return null;
            }

            if (__DEV__) console.log(`[useWorkoutSession] Session created via createSession(): ${newSession.id}`);
            setSessionId(newSession.id);
            return newSession.id;
        } catch (err: any) {
            if (__DEV__) console.error('[useWorkoutSession] createSession exception:', err?.message);
            return null;
        }
    };

    const finishWorkout = async (rpe?: number, feedback?: string, postWorkoutSubmissionId?: string) => {
        if (isSubmitting || !user) return;

        setIsSubmitting(true);

        try {
            const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
            const now = new Date().toISOString();

            // Use existing session (created on workout start) or create one as fallback
            let currentSessionId = sessionId;

            if (!currentSessionId) {
                if (__DEV__) console.warn('[useWorkoutSession] No sessionId at finish — creating session now');

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

                const fallbackPayload: Record<string, any> = {
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
                };
                if (preSubmissionIdRef.current) {
                    fallbackPayload.pre_workout_submission_id = preSubmissionIdRef.current;
                }
                if (postWorkoutSubmissionId) {
                    fallbackPayload.post_workout_submission_id = postWorkoutSubmissionId;
                }

                const { data: newSession, error: sessionError }: { data: any; error: any } = await supabase
                    .from('workout_sessions' as any)
                    .insert(fallbackPayload)
                    .select('id')
                    .single();

                if (sessionError) throw sessionError;
                currentSessionId = newSession.id;
            } else {
                // Update existing in_progress session to completed
                const updatePayload: Record<string, any> = {
                    status: 'completed',
                    started_at: new Date(startTime).toISOString(), // Correct to actual workout start
                    completed_at: now,
                    duration_seconds: durationSeconds,
                    rpe: rpe || null,
                    feedback: feedback || null,
                };
                if (postWorkoutSubmissionId) {
                    updatePayload.post_workout_submission_id = postWorkoutSubmissionId;
                }

                const { error: updateError } = await supabase
                    .from('workout_sessions' as any)
                    .update(updatePayload)
                    .eq('id', currentSessionId);

                if (updateError) throw updateError;
            }

            // Upsert any remaining set_logs (catch-up for sets that may not have been persisted)
            const setLogs: any[] = [];
            for (const exercise of exercises) {
                // Cardio items: persist a single set_log with config data in notes
                if (exercise.item_type === 'cardio' && exercise.setsData.length > 0 && exercise.setsData[0].completed) {
                    const config = exercise.item_config || {};
                    const notesJson = JSON.stringify({
                        mode: config.mode || 'continuous',
                        equipment: config.equipment,
                        duration_minutes: config.duration_minutes,
                        distance_km: config.distance_km,
                        intensity: config.intensity,
                        intervals: config.intervals,
                        actual_duration_seconds: config.actual_duration_seconds,
                        completed_rounds: config.completed_rounds,
                    });
                    setLogs.push({
                        workout_session_id: currentSessionId,
                        assigned_workout_item_id: exercise.id,
                        planned_exercise_id: exercise.planned_exercise_id || exercise.exercise_id,
                        executed_exercise_id: exercise.exercise_id,
                        swap_source: exercise.swap_source || 'none',
                        exercise_id: exercise.exercise_id,
                        set_number: 1,
                        weight: 0,
                        reps_completed: 1,
                        is_completed: true,
                        completed_at: now,
                        weight_unit: 'kg',
                        notes: notesJson,
                    });
                    continue;
                }

                // Warmup items: visual-only, no persistence
                if (exercise.item_type === 'warmup') continue;

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
                    console.error('[useWorkoutSession] Error upserting set_logs at finish:', __DEV__ ? logsError : '');
                }
            }

            if (__DEV__) console.log(`[useWorkoutSession] Workout finished. Session: ${currentSessionId}, sets: ${setLogs.length}`);

            // Notify Watch that workout was finished from iPhone
            if (Platform.OS === 'ios') {
              try {
                const { sendMessage } = require('../modules/watch-connectivity/src/WatchConnectivityModule');
                await sendMessage({
                  type: 'WORKOUT_FINISHED_FROM_PHONE',
                  payload: { workoutId },
                });
                if (__DEV__) console.log('[useWorkoutSession] Notified Watch of finish');
              } catch (e: any) {
                // Watch may not be reachable — not critical
                if (__DEV__) console.log('[useWorkoutSession] Could not notify Watch:', e?.message);
              }
            }

            return currentSessionId;

        } catch (error: any) {
            if (__DEV__) console.error("Error finishing workout:", error);
            throw error;
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleCardioComplete = (exerciseId: string, completed: boolean, extraData?: Record<string, any>) => {
        setExercises(prev => {
            const newExercises = [...prev];
            const idx = newExercises.findIndex(e => e.id === exerciseId);
            if (idx === -1) return prev;

            const exercise = { ...newExercises[idx] };
            if (completed) {
                exercise.setsData = [{ weight: '0', reps: '1', completed: true }];
                // Store actual execution data for serialization at finishWorkout
                if (extraData) {
                    exercise.item_config = { ...(exercise.item_config || {}), ...extraData };
                }
            } else {
                exercise.setsData = [];
            }
            newExercises[idx] = exercise;
            return newExercises;
        });
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
        workoutNotes,
        duration: formatTime(elapsed),
        handleSetChange,
        handleToggleSetComplete,
        applyWatchSetCompletion,
        loadSubstituteOptions,
        searchSubstituteOptions,
        swapExercise,
        finishWorkout,
        createSession,
        assignedProgramId,
        toggleCardioComplete,
        isSubmitting
    };
}
