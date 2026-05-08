'use server'

import { createClient } from '@/lib/supabase/server'
import type { AssessmentSessionDetail } from '@kinevo/shared/types/assessments'

export interface AssessmentSessionDetailResult {
    success: boolean
    data?: AssessmentSessionDetail
    error?: string
}

/**
 * Fetch a single assessment session with its template snapshot, measurements
 * and minimal student info. Thin wrapper over the get_assessment_session RPC
 * — same semantics as `getAssessmentSession` in get-sessions.ts, kept here as
 * the canonical M4 entry point for detail screens.
 */
export async function getAssessmentSessionDetail(
    sessionId: string,
): Promise<AssessmentSessionDetailResult> {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Não autorizado' }

    if (!sessionId) {
        return { success: false, error: 'sessionId é obrigatório' }
    }

    const { data, error } = await supabase.rpc('get_assessment_session' as never, {
        p_session_id: sessionId,
    } as never)

    if (error) {
        console.error('[getAssessmentSessionDetail] error:', error)
        return { success: false, error: error.message }
    }

    if (!data) {
        return { success: false, error: 'Sessão não encontrada' }
    }

    return { success: true, data: data as unknown as AssessmentSessionDetail }
}
