'use server'

import { createClient } from '@/lib/supabase/server'

export interface ProgramTemplate {
    id: string
    name: string
    description: string | null
    duration_weeks: number | null
    workout_count: number
}

export async function getTrainerPrograms(): Promise<{ success: boolean; data?: ProgramTemplate[]; error?: string }> {
    const supabase = await createClient()

    try {
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
            return { success: false, error: 'Unauthorized' }
        }

        // Get trainer ID
        const { data: trainer, error: trainerError } = await supabase
            .from('trainers')
            .select('id')
            .eq('auth_user_id', user.id)
            .single()

        if (trainerError || !trainer) {
            return { success: false, error: 'Trainer not found' }
        }

        // Fetch programs with filters
        const { data: programs, error: programsError } = await supabase
            .from('program_templates')
            .select(`
                id,
                name,
                description,
                duration_weeks,
                workout_templates(id)
            `)
            .eq('trainer_id', trainer.id)
            .eq('is_archived', false)
            .eq('is_template', true) // Only show reusable templates
            .order('name')

        if (programsError) {
            console.error('Error fetching programs:', programsError)
            return { success: false, error: 'Failed to fetch programs' }
        }

        // Transform data
        const formattedPrograms = programs.map(p => ({
            id: p.id,
            name: p.name,
            description: p.description,
            duration_weeks: p.duration_weeks,
            workout_count: Array.isArray(p.workout_templates) ? p.workout_templates.length : 0
        }))

        return { success: true, data: formattedPrograms }

    } catch (error) {
        console.error('Unexpected error in getTrainerPrograms:', error)
        return { success: false, error: 'An unexpected error occurred' }
    }
}
