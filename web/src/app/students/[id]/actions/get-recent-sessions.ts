'use server'

import { createClient } from '@/lib/supabase/server'

interface GetRecentSessionsResult {
    success: boolean
    data?: any[]
    error?: string
}

export async function getRecentSessions(programId: string, limit: number = 5): Promise<GetRecentSessionsResult> {
    const supabase = await createClient()

    try {
        const { data, error } = await supabase
            .from('workout_sessions')
            .select(`
                id,
                completed_at,
                duration_seconds,
                rpe,
                feedback,
                assigned_workouts ( name )
            `)
            .eq('assigned_program_id', programId)
            .eq('status', 'completed')
            .order('completed_at', { ascending: false })
            .limit(limit)

        if (error) throw error

        return { success: true, data }
    } catch (error: any) {
        console.error('Error fetching recent sessions:', error)
        return { success: false, error: 'Erro ao carregar sessões recentes' }
    }
}
