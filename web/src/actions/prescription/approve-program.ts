'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// ============================================================================
// Response
// ============================================================================

interface ApproveProgramResult {
    success: boolean
    error?: string
    programId?: string
}

// ============================================================================
// Action
// ============================================================================

/**
 * Approves a generated prescription, activating the program for the student.
 * Flow:
 *   1. Validate ownership + pending_review status
 *   2. Complete existing active program (if any)
 *   3. Activate the draft program
 *   4. Mark generation as approved
 */
export async function approveProgram(
    generationId: string,
): Promise<ApproveProgramResult> {
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
        .select('id, trainer_id, student_id, assigned_program_id, status')
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

    if (!gen.assigned_program_id) {
        return { success: false, error: 'Nenhum programa vinculado a esta geração.' }
    }

    const programId = gen.assigned_program_id as string
    const studentId = gen.student_id as string

    // 4. Verify the program is still in draft status
    const { data: program } = await supabase
        .from('assigned_programs')
        .select('id, status')
        .eq('id', programId)
        .single()

    if (!program) {
        return { success: false, error: 'Programa não encontrado.' }
    }

    if ((program as any).status !== 'draft') {
        return { success: false, error: `Programa não está em rascunho (status: ${(program as any).status}).` }
    }

    // 5. Complete existing active program for this student
    // Same pattern as activate-program.ts — avoids unique constraint violation
    const { error: completeError } = await supabase
        .from('assigned_programs')
        .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq('student_id', studentId)
        .eq('status', 'active')

    if (completeError) {
        console.error('[approveProgram] failed to complete active program:', completeError)
        return { success: false, error: 'Erro ao finalizar programa ativo atual.' }
    }

    // 6. Activate the draft program
    const { error: activateError } = await supabase
        .from('assigned_programs')
        .update({
            status: 'active',
            started_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq('id', programId)

    if (activateError) {
        console.error('[approveProgram] failed to activate program:', activateError)
        return { success: false, error: 'Erro ao ativar programa.' }
    }

    // 7. Mark generation as approved
    // @ts-ignore — table from migration 035
    const { error: approveError } = await supabase
        .from('prescription_generations')
        .update({
            status: 'approved',
            approved_at: new Date().toISOString(),
        })
        .eq('id', generationId)

    if (approveError) {
        console.error('[approveProgram] failed to update generation status:', approveError)
        // Non-fatal: the program is already active
    }

    revalidatePath(`/students/${studentId}`)

    return { success: true, programId }
}
