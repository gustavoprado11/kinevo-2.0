'use server'

// Consultoria IA — passo 2: gerar o rascunho ("IA rascunha").
//
// ready_to_generate → generating → pending_validation (ou volta com erro).
//
// Sequência:
//   1. Re-triagem (defensiva — vermelho nunca gera rascunho)
//   2. Upsert do student_prescription_profiles derivado da anamnese
//      (deriveProfileFromAnamnese) — sem isso o pipeline recusa o input
//   3. generateProgram(studentId, null, [submissionId]) — o pipeline existente
//      (smart-v2/legacy) roda com a anamnese inteira como narrativa no prompt
//   4. O pipeline grava a generation com assigned_program_id NULL → materializa
//      o rascunho via RPC create_assigned_program_tree (mesma árvore do builder)
//      e linka generation ↔ programa ↔ pedido.
//
// O rascunho nasce status='draft' — INVISÍVEL ao aluno até o portão aprovar.

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateProgram } from '@/actions/prescription/generate-program'
import { deriveProfileFromAnamnese } from '@/lib/consultoria/profile-mapper'
import { extractAnswers } from '@/lib/consultoria/answers'
import {
    resolveTrainer,
    snapshotToTreePayload,
    triageSubmission,
} from './consultoria-core'
import type { Json } from '@kinevo/shared/types/database'
import type { PrescriptionOutputSnapshot } from '@kinevo/shared/types/prescription'

interface GenerateConsultoriaResult {
    success: boolean
    error?: string
    status?: string
    programId?: string
}

export async function generateConsultoriaDraft(requestId: string): Promise<GenerateConsultoriaResult> {
    const supabase = await createClient()
    const trainer = await resolveTrainer(supabase)
    if (!trainer) return { success: false, error: 'Não autorizado' }

    if (!trainer.aiPrescriptionsEnabled) {
        return {
            success: false,
            error: 'O módulo de prescrição IA não está habilitado para sua conta.',
        }
    }

    // Carrega o pedido garantindo posse + estado correto.
    const { data: request } = await supabase
        .from('consultoria_requests')
        .select('id, student_id, status, anamnese_submission_id')
        .eq('id', requestId)
        .eq('trainer_id', trainer.id)
        .single()

    if (!request) return { success: false, error: 'Consultoria não encontrada.' }
    if (request.status !== 'ready_to_generate') {
        return { success: false, error: `Consultoria não está pronta para gerar (status: ${request.status}).` }
    }
    if (!request.anamnese_submission_id) {
        return { success: false, error: 'Consultoria sem anamnese vinculada.' }
    }

    // Trava otimista: ready_to_generate → generating (evita geração dupla).
    const { data: locked } = await supabase
        .from('consultoria_requests')
        .update({ status: 'generating', error_message: null })
        .eq('id', requestId)
        .eq('status', 'ready_to_generate')
        .select('id')
        .maybeSingle()
    if (!locked) {
        return { success: false, error: 'Geração já em andamento.' }
    }

    // A partir daqui, qualquer falha devolve o pedido para ready_to_generate.
    const fail = async (message: string): Promise<GenerateConsultoriaResult> => {
        await supabase
            .from('consultoria_requests')
            .update({ status: 'ready_to_generate', error_message: message })
            .eq('id', requestId)
            .eq('status', 'generating')
        return { success: false, error: message }
    }

    try {
        // 1. Recarrega a anamnese e re-triagem defensiva.
        const { data: submission } = await supabase
            .from('form_submissions')
            .select('id, answers_json')
            .eq('id', request.anamnese_submission_id)
            .single()
        if (!submission) return await fail('Anamnese não encontrada.')

        const triage = triageSubmission(submission.answers_json)
        if (triage.level === 'red') {
            await supabase
                .from('consultoria_requests')
                .update({
                    status: 'blocked',
                    triage_level: triage.level,
                    triage_flags: triage.flags as unknown as Json,
                })
                .eq('id', requestId)
            return {
                success: false,
                status: 'blocked',
                error: 'Triagem vermelha: contraindicação PAR-Q. Rascunho não gerado — oriente liberação médica.',
            }
        }

        // 2. Perfil de prescrição derivado da anamnese (o pipeline exige a linha).
        const derived = deriveProfileFromAnamnese(extractAnswers(submission.answers_json))
        const { error: profileError } = await supabase
            .from('student_prescription_profiles')
            .upsert(
                {
                    student_id: request.student_id,
                    trainer_id: trainer.id,
                    training_level: derived.training_level,
                    goal: derived.goal,
                    available_days: derived.available_days,
                    session_duration_minutes: derived.session_duration_minutes,
                    medical_restrictions: derived.medical_restrictions as unknown as Json,
                },
                { onConflict: 'student_id' },
            )
        if (profileError) {
            console.error('[generateConsultoria] profile upsert error:', profileError)
            return await fail('Erro ao preparar o perfil de prescrição.')
        }

        // 3. Pipeline de prescrição existente (a anamnese inteira entra como
        //    narrativa via selectedFormIds).
        const generation = await generateProgram(request.student_id, null, [submission.id])
        if (!generation.success || !generation.generationId) {
            return await fail(generation.error ?? 'Falha na geração do programa.')
        }

        // 4. Materializa o rascunho a partir do output_snapshot.
        const { data: genRow } = await supabase
            .from('prescription_generations')
            .select('id, output_snapshot')
            .eq('id', generation.generationId)
            .single()

        const snapshot = genRow?.output_snapshot as unknown as PrescriptionOutputSnapshot | null
        if (!snapshot || !Array.isArray(snapshot.workouts) || snapshot.workouts.length === 0) {
            return await fail('Geração concluída sem programa válido.')
        }

        const payload = snapshotToTreePayload(snapshot)
        // RPC restrita a service_role (migration 214) — mesma trava do MCP.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: tree, error: treeError } = await supabaseAdmin.rpc('create_assigned_program_tree' as any, {
            p_trainer_id: trainer.id,
            p_student_id: request.student_id,
            p_payload: payload,
        })
        if (treeError || !tree) {
            console.error('[generateConsultoria] tree RPC error:', treeError)
            return await fail('Erro ao materializar o rascunho do programa.')
        }
        const programId = (tree as { assigned_program_id: string }).assigned_program_id

        // Linka generation → programa (necessário para o approveProgram existente).
        // Sem o link, o pedido avançaria para pending_validation mas TODO
        // approve falharia para sempre ("Nenhum programa vinculado") — dead-end.
        const { error: linkError } = await supabase
            .from('prescription_generations')
            .update({ assigned_program_id: programId })
            .eq('id', generation.generationId)
        if (linkError) {
            console.error('[generateConsultoria] generation link error:', linkError)
            return await fail('Erro ao vincular o rascunho gerado. Tente gerar novamente.')
        }

        // 5. Avança o pedido para o portão de validação.
        const { error: advanceError } = await supabase
            .from('consultoria_requests')
            .update({
                status: 'pending_validation',
                generation_id: generation.generationId,
                program_id: programId,
                triage_level: triage.level,
                triage_flags: triage.flags as unknown as Json,
                error_message: null,
            })
            .eq('id', requestId)
        if (advanceError) {
            console.error('[generateConsultoria] advance error:', advanceError)
            return await fail('Rascunho criado, mas houve erro ao atualizar a consultoria.')
        }

        revalidatePath('/consultoria')
        revalidatePath(`/students/${request.student_id}`)
        return { success: true, status: 'pending_validation', programId }
    } catch (err) {
        console.error('[generateConsultoria] unexpected error:', err)
        return await fail('Erro inesperado durante a geração.')
    }
}
