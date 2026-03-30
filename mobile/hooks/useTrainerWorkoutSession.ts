import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useTrainingRoomStore } from '../stores/training-room-store';
import type {
    ExerciseData,
    WorkoutNote,
    SessionSetupData,
} from '../stores/training-room-store';

// Re-export types used by components
export type { ExerciseData, WorkoutNote };

export interface ExerciseSubstituteOption {
    id: string;
    name: string;
    equipment?: string | null;
    video_url?: string | null;
    muscle_groups: string[];
    source: 'manual' | 'auto' | 'search';
}

interface TrainingRoomStudent {
    id: string;
    name: string;
    avatar_url: string | null;
    program: {
        id: string;
        name: string;
        started_at: string;
        duration_weeks: number | null;
    } | null;
    workouts: {
        id: string;
        name: string;
        scheduled_days: number[];
    }[];
}

// ---------------------------------------------------------------------------
// Hook: fetch students list for the picker
// ---------------------------------------------------------------------------

export function useTrainingRoomStudents() {
    const [students, setStudents] = useState<TrainingRoomStudent[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const { data, error: rpcError } = await (supabase.rpc as any)(
                'get_training_room_students',
            );
            if (rpcError) throw rpcError;
            setStudents(data || []);
        } catch (err: any) {
            if (__DEV__) console.error('[useTrainingRoomStudents]', err);
            setError(err.message || 'Erro ao buscar alunos');
        } finally {
            setIsLoading(false);
        }
    }, []);

    return { students, isLoading, error, refresh: fetch };
}

// ---------------------------------------------------------------------------
// Hook: fetch full workout for a student (to add them to the room)
// ---------------------------------------------------------------------------

export function useFetchStudentWorkout() {
    const [isLoading, setIsLoading] = useState(false);

    const fetchWorkout = useCallback(
        async (
            studentId: string,
            assignedWorkoutId: string,
        ): Promise<{
            data: {
                assignedProgramId: string;
                workoutName: string;
                exercises: ExerciseData[];
                workoutNotes: WorkoutNote[];
            } | null;
            error: string | null;
        }> => {
            // Guard: reject empty/invalid UUIDs before hitting the RPC
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (!studentId || !uuidRegex.test(studentId)) {
                console.error('[useFetchStudentWorkout] invalid studentId:', __DEV__ ? JSON.stringify(studentId) : '');
                return { data: null, error: 'ID do aluno inválido' };
            }
            if (!assignedWorkoutId || !uuidRegex.test(assignedWorkoutId)) {
                console.error('[useFetchStudentWorkout] invalid assignedWorkoutId:', __DEV__ ? JSON.stringify(assignedWorkoutId) : '');
                return { data: null, error: 'ID do treino inválido' };
            }

            setIsLoading(true);
            try {
                const { data, error: rpcError } = await (supabase.rpc as any)(
                    'get_student_today_workout_for_trainer',
                    {
                        p_student_id: studentId,
                        p_assigned_workout_id: assignedWorkoutId,
                    },
                );

                if (rpcError) throw rpcError;
                if (!data) return { data: null, error: 'Treino não encontrado' };

                // Fetch trainer custom videos for exercise items
                const rawExercises = data.exercises || [];
                const exerciseIds = rawExercises
                    .map((ex: any) => ex.exercise_id)
                    .filter(Boolean);

                const trainerVideoMap = new Map<string, string>();
                if (exerciseIds.length > 0) {
                    // In trainer context, get current trainer's custom videos
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user) {
                        const { data: trainer } = await supabase
                            .from('trainers')
                            .select('id')
                            .eq('auth_user_id', user.id)
                            .single();

                        if (trainer) {
                            const { data: trainerVideos }: { data: any; error: any } = await (supabase as any)
                                .from('trainer_exercise_videos')
                                .select('exercise_id, video_url')
                                .eq('trainer_id', trainer.id)
                                .in('exercise_id', exerciseIds);

                            for (const tv of trainerVideos || []) {
                                trainerVideoMap.set(tv.exercise_id, tv.video_url);
                            }
                        }
                    }
                }

                // The RPC returns exercises with setsData as empty — we need to init them
                const exercises: ExerciseData[] = rawExercises.map((ex: any) => ({
                    ...ex,
                    video_url: trainerVideoMap.get(ex.exercise_id) || ex.video_url,
                    substitute_exercise_ids: ex.substitute_exercise_ids || [],
                    swap_source: ex.swap_source || 'none',
                    setsData: Array.from({ length: ex.sets || 3 }, () => ({
                        weight: '',
                        reps: '',
                        completed: false,
                    })),
                    previousSets: ex.previousSets?.length > 0 ? ex.previousSets : undefined,
                }));

                const workoutNotes: WorkoutNote[] = data.workoutNotes || [];

                return {
                    data: {
                        assignedProgramId: data.assignedProgramId,
                        workoutName: data.workoutName,
                        exercises,
                        workoutNotes,
                    },
                    error: null,
                };
            } catch (err: any) {
                if (__DEV__) console.error('[useFetchStudentWorkout]', err);
                return { data: null, error: err.message || 'Erro ao carregar treino' };
            } finally {
                setIsLoading(false);
            }
        },
        [],
    );

    return { fetchWorkout, isLoading };
}

// ---------------------------------------------------------------------------
// Hook: exercise swap (search + load substitutes)
// ---------------------------------------------------------------------------

export function useExerciseSwap() {
    const swapExercise = useTrainingRoomStore((s) => s.swapExercise);

    const loadSubstituteOptions = useCallback(
        async (exercise: ExerciseData): Promise<ExerciseSubstituteOption[]> => {
            const options: ExerciseSubstituteOption[] = [];

            // 1. Manual substitutes defined by trainer
            if (exercise.substitute_exercise_ids?.length) {
                const { data: manualSubs } = await supabase
                    .from('exercises' as any)
                    .select('id, name, equipment, video_url, exercise_muscle_groups(muscle_groups(name))')
                    .in('id', exercise.substitute_exercise_ids);

                if (manualSubs) {
                    for (const ex of manualSubs) {
                        options.push(mapExerciseToOption(ex, 'manual'));
                    }
                }
            }

            // 2. Auto substitutes from smart RPC
            if (exercise.exercise_id) {
                try {
                    const { data: autoSubs } = await (supabase.rpc as any)(
                        'get_smart_substitutes',
                        { p_exercise_id: exercise.exercise_id },
                    );
                    if (autoSubs) {
                        const manualIds = new Set(options.map((o) => o.id));
                        for (const ex of autoSubs) {
                            if (!manualIds.has(ex.id) && ex.id !== exercise.exercise_id) {
                                options.push({
                                    id: ex.id,
                                    name: ex.name,
                                    equipment: ex.equipment,
                                    video_url: ex.video_url,
                                    muscle_groups: ex.muscle_groups || [],
                                    source: 'auto',
                                });
                            }
                        }
                    }
                } catch {
                    // RPC may not exist yet — fail silently
                }
            }

            return options;
        },
        [],
    );

    const searchSubstituteOptions = useCallback(
        async (exercise: ExerciseData, query: string): Promise<ExerciseSubstituteOption[]> => {
            if (!query.trim()) return [];

            const { data } = await supabase
                .from('exercises' as any)
                .select('id, name, equipment, video_url, exercise_muscle_groups(muscle_groups(name))')
                .ilike('name', `%${query}%`)
                .neq('id', exercise.exercise_id)
                .limit(20);

            if (!data) return [];
            return data.map((ex: any) => mapExerciseToOption(ex, 'search'));
        },
        [],
    );

    const performSwap = useCallback(
        (
            studentId: string,
            exerciseIdx: number,
            newExercise: ExerciseSubstituteOption,
        ) => {
            swapExercise(studentId, exerciseIdx, {
                id: newExercise.id,
                name: newExercise.name,
                source: newExercise.source === 'search' ? 'manual' : newExercise.source,
            });
        },
        [swapExercise],
    );

    return { loadSubstituteOptions, searchSubstituteOptions, performSwap };
}

// ---------------------------------------------------------------------------
// Hook: finish workout session via RPC
// ---------------------------------------------------------------------------

export function useFinishTrainerWorkout() {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const finishSession = useTrainingRoomStore((s) => s.finishSession);

    const finish = useCallback(
        async (
            studentId: string,
            session: {
                assignedWorkoutId: string;
                assignedProgramId: string;
                startedAt: number;
                exercises: ExerciseData[];
            },
            rpe: number | null,
            feedback: string | null,
        ): Promise<{ sessionId: string | null; error: string | null }> => {
            setIsSubmitting(true);
            try {
                // Build set_logs payload — only completed sets
                const sets: any[] = [];
                for (const exercise of session.exercises) {
                    for (let i = 0; i < exercise.setsData.length; i++) {
                        const s = exercise.setsData[i];
                        if (s.completed) {
                            sets.push({
                                assignedWorkoutItemId: exercise.id,
                                plannedExerciseId: exercise.planned_exercise_id || exercise.exercise_id || null,
                                executedExerciseId: exercise.exercise_id || null,
                                swapSource: exercise.swap_source || 'none',
                                setNumber: i + 1,
                                weight: parseFloat(s.weight) || 0,
                                repsCompleted: parseInt(s.reps) || 0,
                                weightUnit: 'kg',
                            });
                        }
                    }
                }

                const durationSeconds = Math.floor((Date.now() - session.startedAt) / 1000);

                const { data, error: rpcError } = await (supabase.rpc as any)(
                    'trainer_finish_workout_session',
                    {
                        p_student_id: studentId,
                        p_assigned_workout_id: session.assignedWorkoutId,
                        p_assigned_program_id: session.assignedProgramId,
                        p_sets: sets,
                        p_started_at: new Date(session.startedAt).toISOString(),
                        p_duration_seconds: durationSeconds,
                        p_rpe: rpe,
                        p_feedback: feedback,
                    },
                );

                if (rpcError) throw rpcError;

                // Remove from store
                finishSession(studentId);

                return { sessionId: data, error: null };
            } catch (err: any) {
                if (__DEV__) console.error('[useFinishTrainerWorkout]', err);
                return { sessionId: null, error: err.message || 'Erro ao salvar sessão' };
            } finally {
                setIsSubmitting(false);
            }
        },
        [finishSession],
    );

    return { finish, isSubmitting };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapExerciseToOption(
    exercise: any,
    source: 'manual' | 'auto' | 'search',
): ExerciseSubstituteOption {
    return {
        id: exercise.id,
        name: exercise.name,
        equipment: exercise.equipment,
        video_url: exercise.video_url,
        muscle_groups: (exercise.exercise_muscle_groups || [])
            .map((entry: any) => entry.muscle_groups?.name)
            .filter(Boolean),
        source,
    };
}
