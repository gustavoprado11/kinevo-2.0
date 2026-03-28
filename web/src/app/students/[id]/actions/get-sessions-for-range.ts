'use server'

import { createClient } from '@/lib/supabase/server'

export interface RangeSession {
    id: string
    assigned_workout_id: string
    started_at: string
    completed_at: string | null
    status: 'in_progress' | 'completed'
    rpe: number | null
    assigned_program_id?: string | null
}

interface GetSessionsForRangeResult {
    success: boolean
    data?: RangeSession[]
    error?: string
}

/**
 * Fetch sessions for a date range. Supports two modes:
 * - studentId: returns ALL sessions for the student (full history)
 * - programId (legacy): returns only sessions for a specific program
 */
export async function getSessionsForRange(
    programId: string,
    rangeStart: string,
    rangeEnd: string,
    studentId?: string,
): Promise<GetSessionsForRangeResult> {
    const supabase = await createClient()

    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { success: false, error: 'Não autorizado' }

        let query = supabase
            .from('workout_sessions')
            .select('id, assigned_workout_id, started_at, completed_at, status, rpe, assigned_program_id')

        // Use studentId for full history, fall back to programId
        if (studentId) {
            query = query.eq('student_id', studentId)
        } else {
            query = query.eq('assigned_program_id', programId)
        }

        const { data, error } = await query
            .gte('started_at', rangeStart)
            .lte('started_at', rangeEnd)
            .order('started_at', { ascending: false })

        if (error) throw error

        return { success: true, data: (data as RangeSession[]) || [] }
    } catch (error: any) {
        console.error('Error fetching sessions for range:', error)
        return { success: false, error: 'Erro ao buscar sessões' }
    }
}
