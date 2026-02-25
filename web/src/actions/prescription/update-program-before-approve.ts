'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// ============================================================================
// Input
// ============================================================================

interface WorkoutItemEdit {
    /** assigned_workout_items.id */
    item_id: string
    /** Fields to update (only non-undefined fields are applied) */
    exercise_id?: string
    exercise_name?: string
    exercise_muscle_group?: string
    exercise_equipment?: string | null
    sets?: number
    reps?: string
    rest_seconds?: number
    notes?: string | null
}

// ============================================================================
// Response
// ============================================================================

interface UpdateProgramResult {
    success: boolean
    error?: string
    updatedCount?: number
}

// ============================================================================
// Action
// ============================================================================

/**
 * Updates workout items in a draft program before trainer approval.
 * Only allowed while prescription_generations.status = 'pending_review'.
 * Increments trainer_edits_count on the generation record.
 */
export async function updateProgramBeforeApprove(
    generationId: string,
    edits: WorkoutItemEdit[],
): Promise<UpdateProgramResult> {
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

    // 3. Fetch generation and verify ownership + pending status
    // @ts-ignore — table from migration 035
    const { data: generation, error: genError } = await supabase
        .from('prescription_generations')
        .select('id, trainer_id, student_id, assigned_program_id, status, trainer_edits_count')
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
        return { success: false, error: 'Só é possível editar antes da aprovação.' }
    }

    if (!gen.assigned_program_id) {
        return { success: false, error: 'Nenhum programa vinculado a esta geração.' }
    }

    // 4. Validate edits input
    if (!edits || edits.length === 0) {
        return { success: false, error: 'Nenhuma edição fornecida.' }
    }

    // 5. Verify program is still draft
    const { data: program } = await supabase
        .from('assigned_programs')
        .select('id, status')
        .eq('id', gen.assigned_program_id)
        .single()

    if (!program || (program as any).status !== 'draft') {
        return { success: false, error: 'Programa não está em rascunho.' }
    }

    // 6. Apply edits to assigned_workout_items
    let updatedCount = 0

    for (const edit of edits) {
        if (!edit.item_id) continue

        // Build update payload with only defined fields
        const updatePayload: Record<string, unknown> = {}

        if (edit.exercise_id !== undefined) updatePayload.exercise_id = edit.exercise_id
        if (edit.exercise_name !== undefined) updatePayload.exercise_name = edit.exercise_name
        if (edit.exercise_muscle_group !== undefined) updatePayload.exercise_muscle_group = edit.exercise_muscle_group
        if (edit.exercise_equipment !== undefined) updatePayload.exercise_equipment = edit.exercise_equipment
        if (edit.sets !== undefined) updatePayload.sets = edit.sets
        if (edit.reps !== undefined) updatePayload.reps = edit.reps
        if (edit.rest_seconds !== undefined) updatePayload.rest_seconds = edit.rest_seconds
        if (edit.notes !== undefined) updatePayload.notes = edit.notes

        if (Object.keys(updatePayload).length === 0) continue

        const { error: updateError } = await supabase
            .from('assigned_workout_items')
            .update(updatePayload)
            .eq('id', edit.item_id)

        if (updateError) {
            console.error('[updateProgramBeforeApprove] item update error:', updateError)
        } else {
            updatedCount++
        }
    }

    // 7. Increment trainer_edits_count
    const currentCount = (gen.trainer_edits_count as number) || 0
    // @ts-ignore — table from migration 035
    const { error: countError } = await supabase
        .from('prescription_generations')
        .update({ trainer_edits_count: currentCount + updatedCount })
        .eq('id', generationId)

    if (countError) {
        console.error('[updateProgramBeforeApprove] edits count update error:', countError)
    }

    revalidatePath(`/students/${gen.student_id}`)

    return { success: true, updatedCount }
}
