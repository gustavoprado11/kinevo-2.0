'use server'

import { createClient } from '@/lib/supabase/server'

// ── Types ───────────────────────────────────────────────────────────────────

export interface CompareWorkoutItem {
    id: string
    item_type: 'exercise' | 'superset' | 'note' | 'warmup' | 'cardio'
    order_index: number
    parent_item_id: string | null
    exercise_name: string | null
    sets: number | null
    reps: string | null
    rest_seconds: number | null
    notes: string | null
    exercise_function: string | null
    item_config: Record<string, any> | null
}

export interface CompareWorkout {
    id: string
    name: string
    order_index: number
    scheduled_days: number[]
    items: CompareWorkoutItem[]
}

export interface CompareProgramData {
    programId: string
    programName: string
    status: string
    startedAt: string | null
    workouts: CompareWorkout[]
}

export interface CompareProgramSummary {
    programId: string
    programName: string
    status: string
    startedAt: string | null
    workoutCount: number
}

// ── Fetch list of past programs for selector ────────────────────────────────

export async function getPastProgramsForStudent(
    studentId: string,
): Promise<{ success: boolean; data?: CompareProgramSummary[]; error?: string }> {
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
                assigned_workouts ( id )
            `)
            .eq('student_id', studentId)
            .in('status', ['active', 'completed', 'paused'])
            .order('started_at', { ascending: false })
            .limit(15)

        if (error) throw error

        const summaries: CompareProgramSummary[] = (data || []).map((p: any) => ({
            programId: p.id,
            programName: p.name,
            status: p.status,
            startedAt: p.started_at,
            workoutCount: (p.assigned_workouts || []).length,
        }))

        return { success: true, data: summaries }
    } catch (error: any) {
        console.error('Error fetching past programs:', error)
        return { success: false, error: 'Erro ao carregar programas anteriores' }
    }
}

// ── Fetch full program with all workouts + items ────────────────────────────

export async function getFullProgramForCompare(
    programId: string,
): Promise<{ success: boolean; data?: CompareProgramData; error?: string }> {
    const supabase = await createClient()

    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { success: false, error: 'Não autorizado' }

        // 1. Program metadata
        const { data: program, error: pError } = await supabase
            .from('assigned_programs')
            .select('id, name, status, started_at')
            .eq('id', programId)
            .single()

        if (pError || !program) throw pError || new Error('Programa não encontrado')

        // 2. All workouts in the program
        const { data: workouts, error: wError } = await supabase
            .from('assigned_workouts')
            .select('id, name, order_index, scheduled_days')
            .eq('assigned_program_id', programId)
            .order('order_index')

        if (wError) throw wError

        // 3. All items for all workouts in a single query
        const workoutIds = (workouts || []).map((w: any) => w.id)

        let allItems: any[] = []
        if (workoutIds.length > 0) {
            const { data: items, error: iError } = await supabase
                .from('assigned_workout_items')
                .select('id, assigned_workout_id, item_type, order_index, parent_item_id, exercise_name, sets, reps, rest_seconds, notes, exercise_function, item_config')
                .in('assigned_workout_id', workoutIds)
                .order('order_index')

            if (iError) throw iError
            allItems = items || []
        }

        // 4. Group items by workout
        const itemsByWorkout = new Map<string, CompareWorkoutItem[]>()
        for (const item of allItems) {
            const wId = item.assigned_workout_id
            if (!itemsByWorkout.has(wId)) itemsByWorkout.set(wId, [])
            itemsByWorkout.get(wId)!.push({
                id: item.id,
                item_type: item.item_type,
                order_index: item.order_index,
                parent_item_id: item.parent_item_id,
                exercise_name: item.exercise_name,
                sets: item.sets,
                reps: item.reps,
                rest_seconds: item.rest_seconds,
                notes: item.notes,
                exercise_function: item.exercise_function,
                item_config: item.item_config,
            })
        }

        const compareWorkouts: CompareWorkout[] = (workouts || []).map((w: any) => ({
            id: w.id,
            name: w.name,
            order_index: w.order_index,
            scheduled_days: w.scheduled_days || [],
            items: itemsByWorkout.get(w.id) || [],
        }))

        return {
            success: true,
            data: {
                programId: program.id,
                programName: program.name,
                status: program.status,
                startedAt: program.started_at,
                workouts: compareWorkouts,
            },
        }
    } catch (error: any) {
        console.error('Error fetching program for compare:', error)
        return { success: false, error: 'Erro ao carregar programa para comparação' }
    }
}
