'use server'

import { createClient } from '@/lib/supabase/server'
import type {
    AssessmentSessionListItem,
    AssessmentSessionStatus,
    AssessmentSessionDetail,
} from '@kinevo/shared/types/assessments'

interface GetAssessmentSessionsArgs {
    studentId?: string
    status?: AssessmentSessionStatus
    limit?: number
}

export async function getAssessmentSessions(
    args: GetAssessmentSessionsArgs = {},
): Promise<{ success: boolean; data?: AssessmentSessionListItem[]; error?: string }> {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Não autorizado' }

    const { data, error } = await supabase.rpc('get_assessment_sessions' as never, {
        p_student_id: args.studentId ?? null,
        p_status: args.status ?? null,
        p_limit: args.limit ?? 50,
    } as never)

    if (error) {
        console.error('[getAssessmentSessions] error:', error)
        return { success: false, error: error.message }
    }

    return { success: true, data: (data as unknown as AssessmentSessionListItem[]) ?? [] }
}

export async function getAssessmentSession(
    sessionId: string,
): Promise<{ success: boolean; data?: AssessmentSessionDetail; error?: string }> {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Não autorizado' }

    const { data, error } = await supabase.rpc('get_assessment_session' as never, {
        p_session_id: sessionId,
    } as never)

    if (error) {
        console.error('[getAssessmentSession] error:', error)
        return { success: false, error: error.message }
    }

    return { success: true, data: data as unknown as AssessmentSessionDetail }
}
