'use server'

import { createClient } from '@/lib/supabase/server'
import type { ExerciseData, WorkoutSetData } from '@/stores/training-room-store'

interface GetStudentWorkoutResult {
    data: {
        assignedProgramId: string
        workoutName: string
        exercises: ExerciseData[]
    } | null
    error: string | null
}

/**
 * Fetches the full exercise list for a given assigned workout,
 * including previous load data for each exercise.
 * The returned ExerciseData[] matches the exact mobile interface.
 */
export async function getStudentTodayWorkout(
    studentId: string,
    assignedWorkoutId: string,
): Promise<GetStudentWorkoutResult> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { data: null, error: 'Não autorizado' }

    // Validate trainer ownership
    const { data: trainer } = await supabase
        .from('trainers')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()

    if (!trainer) return { data: null, error: 'Treinador não encontrado' }

    const { data: student } = await supabase
        .from('students')
        .select('id, coach_id')
        .eq('id', studentId)
        .single()

    if (!student || student.coach_id !== trainer.id) {
        return { data: null, error: 'Aluno não encontrado' }
    }

    // Fetch assigned workout
    const { data: workout } = await supabase
        .from('assigned_workouts')
        .select('id, name, assigned_program_id')
        .eq('id', assignedWorkoutId)
        .single()

    if (!workout) return { data: null, error: 'Treino não encontrado' }

    // Fetch assigned workout items (exercises only, ordered)
    const { data: items, error: itemsError } = await supabase
        .from('assigned_workout_items')
        .select(`
            id,
            exercise_id,
            exercise_name,
            sets,
            reps,
            rest_seconds,
            order_index,
            substitute_exercise_ids,
            exercises:exercise_id (id, name, video_url)
        `)
        .eq('assigned_workout_id', assignedWorkoutId)
        .eq('item_type', 'exercise')
        .order('order_index')

    if (itemsError) return { data: null, error: itemsError.message }
    if (!items?.length) return { data: null, error: 'Nenhum exercício encontrado neste treino' }

    // Fetch previous loads for all exercises in parallel
    const exerciseIds = items
        .map((item) => item.exercise_id)
        .filter(Boolean) as string[]

    const previousLoads = await fetchPreviousLoads(supabase, studentId, exerciseIds)

    // Build ExerciseData array — same structure as mobile
    const exercises: ExerciseData[] = items.map((item) => {
        const exerciseRef = item.exercises as any
        const exerciseId = item.exercise_id || ''
        const setsCount = item.sets || 3
        const prevLoad = previousLoads.get(exerciseId)

        return {
            id: item.id,
            planned_exercise_id: exerciseId,
            exercise_id: exerciseId,
            name: exerciseRef?.name || item.exercise_name || 'Exercício',
            sets: setsCount,
            reps: item.reps || '12',
            rest_seconds: item.rest_seconds || 60,
            video_url: exerciseRef?.video_url || undefined,
            substitute_exercise_ids: item.substitute_exercise_ids || [],
            swap_source: 'none' as const,
            setsData: createInitialSets(setsCount),
            previousLoad: prevLoad,
        }
    })

    return {
        data: {
            assignedProgramId: workout.assigned_program_id,
            workoutName: workout.name,
            exercises,
        },
        error: null,
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createInitialSets(count: number): WorkoutSetData[] {
    return Array.from({ length: count }, () => ({
        weight: '',
        reps: '',
        completed: false,
    }))
}

/**
 * Fetches previous max weight for each exercise in a single batch.
 * Uses the get_last_exercise_metrics RPC (same as mobile).
 * Falls back to direct set_logs query if RPC unavailable.
 */
async function fetchPreviousLoads(
    supabase: Awaited<ReturnType<typeof createClient>>,
    studentId: string,
    exerciseIds: string[],
): Promise<Map<string, string>> {
    const loads = new Map<string, string>()
    if (!exerciseIds.length) return loads

    // Fetch in parallel using the RPC
    const results = await Promise.allSettled(
        exerciseIds.map(async (exerciseId) => {
            const { data } = await (supabase.rpc as any)('get_last_exercise_metrics', {
                p_student_id: studentId,
                p_exercise_id: exerciseId,
            })

            if (data?.length > 0 && data[0].max_weight) {
                return { exerciseId, load: `${Number(data[0].max_weight)}kg` }
            }

            // Fallback: query set_logs directly
            const { data: legacyData } = await supabase
                .from('set_logs')
                .select('weight, weight_unit')
                .eq('exercise_id', exerciseId)
                .not('weight', 'is', null)
                .order('completed_at', { ascending: false })
                .limit(1)
                .maybeSingle()

            if (legacyData?.weight) {
                return {
                    exerciseId,
                    load: `${Number(legacyData.weight)}${legacyData.weight_unit || 'kg'}`,
                }
            }

            return null
        }),
    )

    for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
            loads.set(result.value.exerciseId, result.value.load)
        }
    }

    return loads
}
