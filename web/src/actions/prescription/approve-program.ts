'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { computeEditsDiff, convertAssignedToGeneratedWorkouts } from '@/lib/prescription/edits-diff'
import { refreshTrainerPatterns } from '@/lib/prescription/trainer-patterns'
import { insertStudentNotification } from '@/lib/student-notifications'
import { sendStudentPush } from '@/lib/push-notifications'

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
        .select('id, status, name, duration_weeks')
        .eq('id', programId)
        .single()

    if (!program) {
        return { success: false, error: 'Programa não encontrado.' }
    }

    if ((program as any).status !== 'draft') {
        return { success: false, error: `Programa não está em rascunho (status: ${(program as any).status}).` }
    }

    // 5. Complete existing active/expired program for this student
    // Same pattern as activate-program.ts — avoids unique constraint violation
    const { error: completeError } = await supabase
        .from('assigned_programs')
        .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq('student_id', studentId)
        .in('status', ['active', 'expired'])

    if (completeError) {
        console.error('[approveProgram] failed to complete active program:', completeError)
        return { success: false, error: 'Erro ao finalizar programa ativo atual.' }
    }

    // 6. Activate the draft program
    const now = new Date()
    const durationWeeks = (program as any).duration_weeks as number | null
    const expiresAt = durationWeeks
        ? new Date(now.getTime() + durationWeeks * 7 * 24 * 60 * 60 * 1000).toISOString()
        : null

    const { error: activateError } = await supabase
        .from('assigned_programs')
        .update({
            status: 'active',
            started_at: now.toISOString(),
            updated_at: now.toISOString(),
            expires_at: expiresAt,
        })
        .eq('id', programId)

    if (activateError) {
        console.error('[approveProgram] failed to activate program:', activateError)
        return { success: false, error: 'Erro ao ativar programa.' }
    }

    // 6.5. Compute trainer edits diff (original AI output vs final approved)
    let trainerEditsDiff = null
    try {
        // @ts-ignore — table from migration 035
        const { data: fullGen } = await supabase
            .from('prescription_generations')
            .select('output_snapshot')
            .eq('id', generationId)
            .single()

        const outputSnapshot = (fullGen as any)?.output_snapshot

        if (outputSnapshot) {
            const { data: workoutRows } = await supabase
                .from('assigned_workouts')
                .select('id, name, order_index, scheduled_days')
                .eq('assigned_program_id', programId)
                .order('order_index')

            const workoutIds = (workoutRows || []).map((w: any) => w.id)

            if (workoutIds.length > 0) {
                const { data: itemRows } = await supabase
                    .from('assigned_workout_items')
                    .select('id, assigned_workout_id, exercise_id, exercise_name, exercise_muscle_group, exercise_equipment, sets, reps, rest_seconds, notes, order_index, item_type')
                    .in('assigned_workout_id', workoutIds)
                    .order('order_index')

                if (workoutRows && itemRows) {
                    const finalWorkouts = convertAssignedToGeneratedWorkouts(workoutRows as any, itemRows as any)
                    trainerEditsDiff = computeEditsDiff(outputSnapshot, finalWorkouts)
                    console.log(`[approveProgram] Diff computed: ${trainerEditsDiff.total_edits} edits, ${trainerEditsDiff.volume_changes.length} volume changes`)
                }
            }
        }
    } catch (err) {
        console.error('[approveProgram] Failed to compute edits diff:', err)
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

    // 7.5. Save trainer edits diff separately (column from migration 064, may not exist yet)
    if (trainerEditsDiff) {
        try {
            // @ts-ignore — trainer_edits_diff from migration 064
            await supabase
                .from('prescription_generations')
                .update({ trainer_edits_diff: trainerEditsDiff })
                .eq('id', generationId)
        } catch {
            // Column doesn't exist yet — safe to ignore
        }
    }

    // Notify student (fire-and-forget)
    const programName = (program as any).name ?? 'Novo programa'
    insertStudentNotification({
        studentId,
        trainerId: trainer.id,
        type: 'program_assigned',
        title: 'Novo programa de treino!',
        subtitle: `${programName} está disponível no seu app.`,
        payload: { program_id: programId, program_name: programName },
    }).then((inboxItemId) => {
        sendStudentPush({
            studentId,
            title: 'Novo programa de treino!',
            body: `${programName} está disponível no seu app.`,
            inboxItemId: inboxItemId ?? undefined,
            data: { type: 'program_assigned', program_id: programId },
        })
    })

    revalidatePath(`/students/${studentId}`)

    // Fire-and-forget: refresh trainer patterns from accumulated diffs
    refreshTrainerPatterns(supabase, trainer.id).catch(err =>
        console.error('[approveProgram] Pattern refresh failed:', err)
    )

    return { success: true, programId }
}
