'use server'

import { createClient } from '@/lib/supabase/server'

export interface MuscleGroupVolume {
    muscleGroup: string
    sets: number
}

export interface ProgramMuscleVolume {
    programId: string
    programName: string
    groups: MuscleGroupVolume[]
    totalSets: number
}

/**
 * Returns prescribed weekly volume (total sets) per primary muscle group for a program.
 * Uses assigned_workout_items snapshot data.
 */
export async function getProgramMuscleVolume(
    programId: string
): Promise<{ success: boolean; data?: ProgramMuscleVolume; error?: string }> {
    try {
        const supabase = await createClient()

        // Get program name
        const { data: program } = await supabase
            .from('assigned_programs')
            .select('name')
            .eq('id', programId)
            .single()

        if (!program) return { success: false, error: 'Programa não encontrado' }

        // Get all workouts with their weekly frequency (scheduled_days)
        const { data: workouts } = await supabase
            .from('assigned_workouts')
            .select('id, scheduled_days')
            .eq('assigned_program_id', programId)

        if (!workouts || workouts.length === 0) {
            return { success: true, data: { programId, programName: program.name, groups: [], totalSets: 0 } }
        }

        // Build a map of workout ID → weekly frequency
        const freqMap = new Map<string, number>()
        for (const w of workouts as { id: string; scheduled_days: number[] | null }[]) {
            const freq = Array.isArray(w.scheduled_days) ? w.scheduled_days.length : 1
            freqMap.set(w.id, freq)
        }

        const workoutIds = workouts.map((w: { id: string }) => w.id)

        const { data: items } = await supabase
            .from('assigned_workout_items')
            .select('assigned_workout_id, exercise_muscle_group, sets')
            .in('assigned_workout_id', workoutIds)
            .eq('item_type', 'exercise')
            .not('exercise_muscle_group', 'is', null)
            .not('sets', 'is', null)

        if (!items || items.length === 0) {
            return { success: true, data: { programId, programName: program.name, groups: [], totalSets: 0 } }
        }

        // Group by PRIMARY muscle group, multiplying sets by workout weekly frequency
        const volumeMap = new Map<string, number>()

        for (const item of items) {
            const primary = (item.exercise_muscle_group as string).split(',')[0].trim()
            const sets = typeof item.sets === 'number' ? item.sets : parseInt(String(item.sets), 10)
            if (isNaN(sets)) continue

            const freq = freqMap.get(item.assigned_workout_id as string) || 1
            volumeMap.set(primary, (volumeMap.get(primary) || 0) + (sets * freq))
        }

        // Sort by volume descending
        const groups: MuscleGroupVolume[] = Array.from(volumeMap.entries())
            .map(([muscleGroup, sets]) => ({ muscleGroup, sets }))
            .sort((a, b) => b.sets - a.sets)

        const totalSets = groups.reduce((sum, g) => sum + g.sets, 0)

        return {
            success: true,
            data: { programId, programName: program.name, groups, totalSets },
        }
    } catch (err) {
        console.error('getProgramMuscleVolume error:', err)
        return { success: false, error: 'Erro ao buscar volume muscular' }
    }
}
