'use server'

import { createClient } from '@/lib/supabase/server'

export interface RangeSession {
    id: string
    assigned_workout_id: string
    started_at: string
    completed_at: string | null
    status: 'in_progress' | 'completed'
    rpe: number | null
}

interface GetSessionsForRangeResult {
    success: boolean
    data?: RangeSession[]
    error?: string
}

export async function getSessionsForRange(
    programId: string,
    rangeStart: string,
    rangeEnd: string,
): Promise<GetSessionsForRangeResult> {
    const supabase = await createClient()

    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { success: false, error: 'Não autorizado' }

        const { data, error } = await supabase
            .from('workout_sessions')
            .select('id, assigned_workout_id, started_at, completed_at, status, rpe')
            .eq('assigned_program_id', programId)
            .gte('completed_at', rangeStart)
            .lte('completed_at', rangeEnd)
            .order('completed_at', { ascending: false })

        if (error) throw error

        return { success: true, data: (data as RangeSession[]) || [] }
    } catch (error: any) {
        console.error('Error fetching sessions for range:', error)
        return { success: false, error: 'Erro ao buscar sessões' }
    }
}
