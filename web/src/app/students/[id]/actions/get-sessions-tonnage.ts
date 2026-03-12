'use server'

import { createClient } from '@/lib/supabase/server'

interface TonnageResult {
    sessionId: string
    tonnage: number
    previousTonnage: number | null
    percentChange: number | null
}

interface GetSessionsTonnageResult {
    success: boolean
    data?: Record<string, TonnageResult>
    error?: string
}

const MAX_SESSION_IDS = 50

async function getSessionTonnage(supabase: any, sessionId: string): Promise<number> {
    const { data: logs } = await supabase
        .from('set_logs')
        .select('weight, reps_completed')
        .eq('workout_session_id', sessionId)

    if (!logs || logs.length === 0) return 0
    return logs.reduce((sum: number, log: any) => sum + ((log.weight || 0) * (log.reps_completed || 0)), 0)
}

export async function getSessionsTonnage(
    sessionIds: string[],
    programId: string,
): Promise<GetSessionsTonnageResult> {
    const supabase = await createClient()

    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { success: false, error: 'Não autorizado' }

        // Limit array size to prevent resource exhaustion
        const safeIds = sessionIds.slice(0, MAX_SESSION_IDS)

        const { data: sessions, error: sessionsError } = await supabase
            .from('workout_sessions')
            .select('id, assigned_workout_id, completed_at')
            .in('id', safeIds)

        if (sessionsError) throw sessionsError
        if (!sessions || sessions.length === 0) return { success: true, data: {} }

        const results: Record<string, TonnageResult> = {}

        for (const session of sessions) {
            const tonnage = await getSessionTonnage(supabase, session.id)

            const { data: prevSessions } = await supabase
                .from('workout_sessions')
                .select('id')
                .eq('assigned_program_id', programId)
                .eq('assigned_workout_id', session.assigned_workout_id)
                .eq('status', 'completed')
                .lt('completed_at', session.completed_at)
                .order('completed_at', { ascending: false })
                .limit(1)

            let previousTonnage: number | null = null
            let percentChange: number | null = null

            if (prevSessions && prevSessions.length > 0) {
                previousTonnage = await getSessionTonnage(supabase, prevSessions[0].id)
                if (previousTonnage > 0) {
                    percentChange = ((tonnage - previousTonnage) / previousTonnage) * 100
                }
            }

            results[session.id] = { sessionId: session.id, tonnage, previousTonnage, percentChange }
        }

        return { success: true, data: results }
    } catch (error: any) {
        console.error('Error calculating tonnage:', error)
        return { success: false, error: 'Erro ao calcular progressão de carga' }
    }
}
