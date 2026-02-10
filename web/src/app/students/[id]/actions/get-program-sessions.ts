'use server'

import { createClient } from '@/lib/supabase/server'

interface GetProgramSessionsResult {
    success: boolean
    data?: any[]
    error?: string
}

export async function getProgramSessions(programId: string): Promise<GetProgramSessionsResult> {
    const supabase = await createClient()

    try {
        const { data, error } = await supabase
            .from('workout_sessions')
            .select(`
                id,
                completed_at,
                rpe,
                feedback,
                assigned_workouts ( name )
            `)
            .eq('assigned_program_id', programId)
            .eq('status', 'completed')
            .order('completed_at', { ascending: false })

        if (error) throw error

        return { success: true, data }
    } catch (error: any) {
        console.error('Error fetching program sessions:', error)
        return { success: false, error: 'Erro ao buscar sessões do programa' }
    }
}
