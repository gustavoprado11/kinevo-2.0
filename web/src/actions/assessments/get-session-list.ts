'use server'

import { createClient } from '@/lib/supabase/server'
import type {
    AssessmentSessionListItem,
    AssessmentSessionStatus,
} from '@kinevo/shared/types/assessments'

export type AssessmentListFilter = 'all' | 'overdue' | 'upcoming' | 'completed'

interface GetAssessmentSessionListArgs {
    filter?: AssessmentListFilter
    studentId?: string
    limit?: number
}

export interface AssessmentSessionListResult {
    success: boolean
    data?: AssessmentSessionListItem[]
    error?: string
}

/**
 * Listing tailored to the web Assessments tab. Wraps the existing
 * get_assessment_sessions RPC and applies filter semantics in JS so we
 * can reuse what the RPC already returns (the RPC only exposes a single
 * status param). The client-side counts depend on this filter taxonomy:
 *
 * - all       → todas exceto cancelled
 * - overdue   → scheduled with scheduled_at < now()
 * - upcoming  → scheduled with scheduled_at >= now() OR status='in_progress'
 * - completed → completed only
 */
export async function getAssessmentSessionList(
    args: GetAssessmentSessionListArgs = {},
): Promise<AssessmentSessionListResult> {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Não autorizado' }

    const filter = args.filter ?? 'all'

    // Map filter → optional status hint for the RPC. For 'all' we pass null
    // to fetch every status, then drop cancelled in JS.
    const statusHint: AssessmentSessionStatus | null =
        filter === 'completed' ? 'completed' : null

    const { data, error } = await supabase.rpc('get_assessment_sessions' as never, {
        p_student_id: args.studentId ?? null,
        p_status: statusHint,
        p_limit: args.limit ?? 100,
    } as never)

    if (error) {
        console.error('[getAssessmentSessionList] error:', error)
        return { success: false, error: error.message }
    }

    const rows = (data as unknown as AssessmentSessionListItem[]) ?? []
    const now = Date.now()

    const filtered = rows.filter(row => {
        if (row.status === 'cancelled') return false
        if (filter === 'all') return true
        if (filter === 'completed') return row.status === 'completed'
        if (filter === 'overdue') {
            return (
                row.status === 'scheduled'
                && row.scheduled_at != null
                && new Date(row.scheduled_at).getTime() < now
            )
        }
        if (filter === 'upcoming') {
            if (row.status === 'in_progress') return true
            return (
                row.status === 'scheduled'
                && row.scheduled_at != null
                && new Date(row.scheduled_at).getTime() >= now
            )
        }
        return true
    })

    return { success: true, data: filtered }
}
