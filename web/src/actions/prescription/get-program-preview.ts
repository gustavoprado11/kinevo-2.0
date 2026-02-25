'use server'

import { createClient } from '@/lib/supabase/server'

// ============================================================================
// Types
// ============================================================================

export interface PreviewWorkoutItem {
    id: string
    exercise_name: string
    exercise_muscle_group: string
    exercise_equipment: string | null
    sets: number
    reps: string
    rest_seconds: number
    notes: string | null
    order_index: number
}

export interface PreviewWorkout {
    id: string
    name: string
    order_index: number
    items: PreviewWorkoutItem[]
}

export interface PreviewProgramData {
    id: string
    name: string
    description: string | null
    duration_weeks: number | null
    workouts: PreviewWorkout[]
}

interface GetProgramPreviewResult {
    success: boolean
    error?: string
    data?: PreviewProgramData
}

// ============================================================================
// Action
// ============================================================================

/**
 * Fetches a draft program with its workouts and items for the preview UI.
 * Only accessible by the owning trainer and only while the program is in draft status.
 */
export async function getProgramPreview(
    programId: string,
): Promise<GetProgramPreviewResult> {
    const supabase = await createClient()

    // 1. Auth check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Não autorizado' }

    // 2. Trainer lookup
    const { data: trainer } = await supabase
        .from('trainers')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()

    if (!trainer) return { success: false, error: 'Treinador não encontrado' }

    // 3. Fetch program
    const { data: program, error: programError } = await supabase
        .from('assigned_programs')
        .select('id, name, description, duration_weeks, status, trainer_id')
        .eq('id', programId)
        .single()

    if (programError || !program) {
        return { success: false, error: 'Programa não encontrado.' }
    }

    const prog = program as any
    if (prog.trainer_id !== trainer.id) {
        return { success: false, error: 'Este programa não pertence à sua conta.' }
    }

    // 4. Fetch workouts
    const { data: workouts, error: workoutsError } = await supabase
        .from('assigned_workouts')
        .select('id, name, order_index')
        .eq('assigned_program_id', programId)
        .order('order_index', { ascending: true })

    if (workoutsError || !workouts) {
        return { success: false, error: 'Erro ao carregar treinos.' }
    }

    // 5. Fetch all items for all workouts
    const workoutIds = workouts.map((w: any) => w.id)
    const { data: items, error: itemsError } = await supabase
        .from('assigned_workout_items')
        .select('id, assigned_workout_id, exercise_name, exercise_muscle_group, exercise_equipment, sets, reps, rest_seconds, notes, order_index')
        .in('assigned_workout_id', workoutIds)
        .order('order_index', { ascending: true })

    if (itemsError) {
        console.error('[getProgramPreview] items error:', itemsError)
    }

    // 6. Group items by workout
    const itemsByWorkout = new Map<string, PreviewWorkoutItem[]>()
    for (const item of (items || []) as any[]) {
        const workoutId = item.assigned_workout_id as string
        if (!itemsByWorkout.has(workoutId)) {
            itemsByWorkout.set(workoutId, [])
        }
        itemsByWorkout.get(workoutId)!.push({
            id: item.id,
            exercise_name: item.exercise_name || 'Exercício',
            exercise_muscle_group: item.exercise_muscle_group || '',
            exercise_equipment: item.exercise_equipment || null,
            sets: item.sets || 3,
            reps: item.reps || '10',
            rest_seconds: item.rest_seconds || 60,
            notes: item.notes || null,
            order_index: item.order_index || 0,
        })
    }

    const previewWorkouts: PreviewWorkout[] = (workouts as any[]).map(w => ({
        id: w.id,
        name: w.name,
        order_index: w.order_index,
        items: itemsByWorkout.get(w.id) || [],
    }))

    return {
        success: true,
        data: {
            id: prog.id,
            name: prog.name || 'Programa',
            description: prog.description || null,
            duration_weeks: prog.duration_weeks || null,
            workouts: previewWorkouts,
        },
    }
}
