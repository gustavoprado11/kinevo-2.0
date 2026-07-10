'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type {
    ComputedMetrics,
    FinalizeAssessmentResult,
} from '@kinevo/shared/types/assessments'

interface FinalizeAssessmentSessionInput {
    sessionId: string
    computedMetrics: ComputedMetrics
    notes?: string | null
}

export async function finalizeAssessmentSession(
    input: FinalizeAssessmentSessionInput,
): Promise<{ success: boolean; data?: FinalizeAssessmentResult; error?: string }> {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Não autorizado' }

    if (!input.sessionId) {
        return { success: false, error: 'sessionId é obrigatório' }
    }

    const { data, error } = await supabase.rpc('finalize_assessment_session' as never, {
        p_session_id: input.sessionId,
        p_computed_metrics: input.computedMetrics,
        p_notes: input.notes ?? null,
    } as never)

    if (error) {
        console.error('[finalizeAssessmentSession] error:', error)
        return { success: false, error: error.message }
    }

    revalidatePath('/avaliacoes')

    return { success: true, data: data as unknown as FinalizeAssessmentResult }
}
