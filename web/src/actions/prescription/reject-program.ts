'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// ============================================================================
// Response
// ============================================================================

interface RejectProgramResult {
    success: boolean
    error?: string
}

// ============================================================================
// Action
// ============================================================================

/**
 * Rejects a generated prescription.
 * The assigned_program is kept as 'draft' for historical reference — NOT deleted.
 * The trainer can regenerate a new program after rejection.
 */
export async function rejectProgram(
    generationId: string,
    reason?: string,
): Promise<RejectProgramResult> {
    const supabase = await createClient()

    // 1. Auth check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Não autorizado' }

    // 2. Trainer lookup
    const { data: trainer } = await supabase
        .from('trainers')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()

    if (!trainer) return { success: false, error: 'Treinador não encontrado' }

    // 3. Fetch generation and verify ownership + status
    // @ts-ignore — table from migration 035
    const { data: generation, error: genError } = await supabase
        .from('prescription_generations')
        .select('id, trainer_id, student_id, status')
        .eq('id', generationId)
        .single()

    if (genError || !generation) {
        return { success: false, error: 'Geração não encontrada.' }
    }

    const gen = generation as any

    if (gen.trainer_id !== trainer.id) {
        return { success: false, error: 'Esta geração não pertence à sua conta.' }
    }

    if (gen.status !== 'pending_review') {
        return { success: false, error: `Geração já foi processada (status: ${gen.status}).` }
    }

    // 4. Reject the generation
    // @ts-ignore — table from migration 035
    const { error: rejectError } = await supabase
        .from('prescription_generations')
        .update({
            status: 'rejected',
            rejected_at: new Date().toISOString(),
            approval_notes: reason?.trim() || null,
        })
        .eq('id', generationId)

    if (rejectError) {
        console.error('[rejectProgram] failed to reject generation:', rejectError)
        return { success: false, error: 'Erro ao rejeitar prescrição.' }
    }

    revalidatePath(`/students/${gen.student_id}`)

    return { success: true }
}
