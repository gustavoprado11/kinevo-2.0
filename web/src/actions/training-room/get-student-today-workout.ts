'use server'

import { createClient } from '@/lib/supabase/server'
import type { ExerciseData, WorkoutSetData, WorkoutNote, PreviousSetData } from '@/stores/training-room-store'

interface GetStudentWorkoutResult {
    data: {
        assignedProgramId: string
        workoutName: string
        exercises: ExerciseData[]
        workoutNotes: WorkoutNote[]
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

    // Fetch ALL workout items (exercises, supersets, notes)
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
            item_type,
            parent_item_id,
            notes,
            exercise_function,
            item_config,
            exercises:exercise_id (id, name, video_url)
        `)
        .eq('assigned_workout_id', assignedWorkoutId)
        .order('order_index')

    if (itemsError) return { data: null, error: itemsError.message }
    if (!items?.length) return { data: null, error: 'Nenhum exercício encontrado neste treino' }

    // Build superset map and extract workout notes
    const supersetMap = new Map<string, { rest_seconds: number; order_index: number }>()
    const workoutNotes: WorkoutNote[] = []

    for (const item of items) {
        if (item.item_type === 'superset') {
            supersetMap.set(item.id, { rest_seconds: item.rest_seconds || 60, order_index: item.order_index })
        } else if (item.item_type === 'note' && item.notes?.trim()) {
            workoutNotes.push({ id: item.id, notes: item.notes, order_index: item.order_index })
        }
    }

    // Fetch previous loads for exercise items
    const exerciseItems = items.filter((item) => item.item_type === 'exercise')
    const warmupCardioItems = items.filter((item) => item.item_type === 'warmup' || item.item_type === 'cardio')
    const exerciseIds = exerciseItems
        .map((item) => item.exercise_id)
        .filter(Boolean) as string[]

    const previousData = await fetchPreviousData(supabase, studentId, exerciseIds)

    // Build ExerciseData array — same structure as mobile
    const exercises: ExerciseData[] = exerciseItems.map((item) => {
        const exerciseRef = item.exercises as any
        const exerciseId = item.exercise_id || ''
        const setsCount = item.sets || 3
        const prev = previousData.get(exerciseId)
        const parentSuperset = item.parent_item_id ? supersetMap.get(item.parent_item_id) : null

        return {
            id: item.id,
            item_type: 'exercise' as const,
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
            previousLoad: prev?.load,
            previousSets: prev?.sets,
            notes: item.notes || null,
            supersetId: item.parent_item_id || null,
            supersetRestSeconds: parentSuperset?.rest_seconds,
            order_index: item.order_index,
            exercise_function: item.exercise_function || null,
            item_config: (item as any).item_config || {},
        }
    })

    // Add warmup/cardio items — no set tracking, just config display
    for (const item of warmupCardioItems) {
        exercises.push({
            id: item.id,
            item_type: item.item_type as 'warmup' | 'cardio',
            planned_exercise_id: '',
            exercise_id: '',
            name: item.notes || (item.item_type === 'warmup' ? 'Aquecimento' : 'Aeróbio'),
            sets: 0,
            reps: '0',
            rest_seconds: 0,
            substitute_exercise_ids: [],
            swap_source: 'none' as const,
            setsData: [],
            order_index: item.order_index,
            exercise_function: item.exercise_function || null,
            item_config: (item as any).item_config || {},
        })
    }

    return {
        data: {
            assignedProgramId: workout.assigned_program_id,
            workoutName: workout.name,
            exercises,
            workoutNotes,
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
 * Fetches previous per-set data and max weight for each exercise.
 * Uses get_previous_exercise_sets RPC first (per-set), falls back to
 * get_last_exercise_metrics (aggregated), then direct set_logs query.
 */
async function fetchPreviousData(
    supabase: Awaited<ReturnType<typeof createClient>>,
    studentId: string,
    exerciseIds: string[],
): Promise<Map<string, { load?: string; sets?: PreviousSetData[] }>> {
    const result = new Map<string, { load?: string; sets?: PreviousSetData[] }>()
    if (!exerciseIds.length) return result

    const results = await Promise.allSettled(
        exerciseIds.map(async (exerciseId) => {
            // Try per-set RPC first (same as mobile)
            const { data: sets, error: setsError } = await (supabase.rpc as any)(
                'get_previous_exercise_sets',
                { p_student_id: studentId, p_exercise_id: exerciseId },
            )

            if (!setsError && Array.isArray(sets) && sets.length > 0) {
                const previousSets: PreviousSetData[] = sets.map((s: any) => ({
                    set_number: s.set_number,
                    weight: Number(s.weight) || 0,
                    reps: Number(s.reps) || 0,
                }))
                const maxWeight = Math.max(...previousSets.map((s) => s.weight))
                return {
                    exerciseId,
                    load: `${maxWeight}kg`,
                    sets: previousSets,
                }
            }

            // Fallback: aggregated RPC
            const { data } = await (supabase.rpc as any)('get_last_exercise_metrics', {
                p_student_id: studentId,
                p_exercise_id: exerciseId,
            })

            if (data?.length > 0 && data[0].max_weight) {
                return { exerciseId, load: `${Number(data[0].max_weight)}kg` }
            }

            // Final fallback: direct set_logs query
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

    for (const r of results) {
        if (r.status === 'fulfilled' && r.value) {
            result.set(r.value.exerciseId, {
                load: r.value.load,
                sets: r.value.sets,
            })
        }
    }

    return result
}
