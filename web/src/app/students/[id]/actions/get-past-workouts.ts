'use server'

import { createClient } from '@/lib/supabase/server'

// ── Types ───────────────────────────────────────────────────────────────────

export interface PastWorkoutSummary {
    workoutId: string
    workoutName: string
    programId: string
    programName: string
    programStatus: string
    startedAt: string | null
}

export interface PastWorkoutItem {
    id: string
    item_type: 'exercise' | 'superset' | 'note'
    order_index: number
    parent_item_id: string | null
    exercise_name: string | null
    sets: number | null
    reps: string | null
    rest_seconds: number | null
    notes: string | null
    exercise_function: string | null
}

export interface PastWorkoutDetail {
    workoutId: string
    workoutName: string
    programName: string
    startedAt: string | null
    items: PastWorkoutItem[]
}

// ── Fetch list of past workouts for selector ────────────────────────────────

export async function getPastWorkoutsForStudent(
    studentId: string,
): Promise<{ success: boolean; data?: PastWorkoutSummary[]; error?: string }> {
    const supabase = await createClient()

    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { success: false, error: 'Não autorizado' }

        const { data, error } = await supabase
            .from('assigned_programs')
            .select(`
                id,
                name,
                status,
                started_at,
                assigned_workouts (
                    id,
                    name,
                    order_index
                )
            `)
            .eq('student_id', studentId)
            .in('status', ['active', 'completed', 'paused', 'expired'])
            .order('started_at', { ascending: false })
            .limit(10)

        if (error) throw error

        const summaries: PastWorkoutSummary[] = []
        for (const program of data || []) {
            const workouts = (program as any).assigned_workouts || []
            const sorted = [...workouts].sort((a: any, b: any) => a.order_index - b.order_index)
            for (const w of sorted) {
                summaries.push({
                    workoutId: w.id,
                    workoutName: w.name,
                    programId: program.id,
                    programName: program.name,
                    programStatus: program.status,
                    startedAt: program.started_at,
                })
            }
        }

        return { success: true, data: summaries }
    } catch (error: any) {
        console.error('Error fetching past workouts:', error)
        return { success: false, error: 'Erro ao carregar treinos anteriores' }
    }
}

// ── Fetch full workout detail ───────────────────────────────────────────────

export async function getPastWorkoutDetail(
    workoutId: string,
): Promise<{ success: boolean; data?: PastWorkoutDetail; error?: string }> {
    const supabase = await createClient()

    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { success: false, error: 'Não autorizado' }

        const { data: workout, error: wError } = await supabase
            .from('assigned_workouts')
            .select(`
                id,
                name,
                assigned_programs (
                    name,
                    started_at
                )
            `)
            .eq('id', workoutId)
            .single()

        if (wError || !workout) throw wError || new Error('Treino não encontrado')

        const { data: items, error: iError } = await supabase
            .from('assigned_workout_items')
            .select('id, item_type, order_index, parent_item_id, exercise_name, sets, reps, rest_seconds, notes, exercise_function')
            .eq('assigned_workout_id', workoutId)
            .order('order_index')

        if (iError) throw iError

        const program = (workout as any).assigned_programs
        return {
            success: true,
            data: {
                workoutId: workout.id,
                workoutName: workout.name,
                programName: program?.name || '',
                startedAt: program?.started_at || null,
                items: (items || []) as PastWorkoutItem[],
            },
        }
    } catch (error: any) {
        console.error('Error fetching past workout detail:', error)
        return { success: false, error: 'Erro ao carregar detalhes do treino' }
    }
}
