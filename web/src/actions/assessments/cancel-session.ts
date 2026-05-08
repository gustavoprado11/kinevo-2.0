'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

interface CancelAssessmentSessionInput {
    sessionId: string
    reason?: string | null
}

/**
 * Soft-cancel an assessment session. Allowed from `scheduled` and
 * `in_progress`; refuses on `completed` or already-cancelled. RLS ensures
 * only the owning trainer can perform the update.
 */
export async function cancelAssessmentSession(
    input: CancelAssessmentSessionInput,
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Não autorizado' }

    if (!input.sessionId) {
        return { success: false, error: 'sessionId é obrigatório' }
    }

    const { data: existing, error: readErr } = await supabase
        .from('assessment_sessions')
        .select('id, status, notes')
        .eq('id', input.sessionId)
        .single()

    if (readErr) {
        console.error('[cancelAssessmentSession] read error:', readErr)
        return { success: false, error: readErr.message }
    }

    if (!existing) {
        return { success: false, error: 'Sessão não encontrada' }
    }

    if (existing.status === 'cancelled') {
        return { success: false, error: 'Sessão já cancelada' }
    }

    if (existing.status === 'completed') {
        return { success: false, error: 'Não é possível cancelar uma sessão concluída' }
    }

    const mergedNotes =
        input.reason && input.reason.trim().length > 0
            ? `${existing.notes ? `${existing.notes}\n\n` : ''}[Cancelada] ${input.reason.trim()}`
            : existing.notes

    const { error: updErr } = await supabase
        .from('assessment_sessions')
        .update({
            status: 'cancelled',
            cancelled_at: new Date().toISOString(),
            notes: mergedNotes,
        })
        .eq('id', input.sessionId)

    if (updErr) {
        console.error('[cancelAssessmentSession] update error:', updErr)
        return { success: false, error: updErr.message }
    }

    revalidatePath('/forms')

    return { success: true }
}
