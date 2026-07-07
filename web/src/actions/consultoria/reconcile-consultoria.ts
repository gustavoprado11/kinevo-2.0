/**
 * Consultoria IA — reconcile (server-only, SEM 'use server').
 *
 * O aluno responde a anamnese pelo mobile via RPC direta (submit_form_submission)
 * — não há hook server-side no submit. Este reconcile roda no load da página
 * /consultoria: para cada pedido awaiting_anamnese, procura uma Avaliação
 * Inicial respondida DEPOIS da criação do pedido, roda a triagem e avança a
 * máquina de estados (ready_to_generate ou blocked).
 *
 * Barato: curto-circuita sem query extra quando não há pedidos aguardando.
 */

import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@kinevo/shared/types/database'
import {
    findLatestSubmittedAnamnese,
    getInitialAssessmentTemplateId,
    triageSubmission,
} from './consultoria-core'

type DBClient = SupabaseClient<Database>

export async function reconcileConsultoriaRequests(
    supabase: DBClient,
    trainerId: string,
): Promise<void> {
    const { data: awaiting } = await supabase
        .from('consultoria_requests')
        .select('id, student_id, created_at')
        .eq('trainer_id', trainerId)
        .eq('status', 'awaiting_anamnese')

    if (!awaiting || awaiting.length === 0) return

    const templateId = await getInitialAssessmentTemplateId(supabase)
    if (!templateId) return

    for (const request of awaiting) {
        try {
            const submission = await findLatestSubmittedAnamnese(
                supabase,
                templateId,
                request.student_id,
                request.created_at,
            )
            if (!submission) continue

            const triage = triageSubmission(submission.answers_json)
            await supabase
                .from('consultoria_requests')
                .update({
                    status: triage.level === 'red' ? 'blocked' : 'ready_to_generate',
                    anamnese_submission_id: submission.id,
                    triage_level: triage.level,
                    triage_flags: triage.flags as unknown as Json,
                })
                .eq('id', request.id)
                .eq('status', 'awaiting_anamnese') // guarda otimista contra corrida
        } catch (err) {
            console.error('[reconcileConsultoria] request', request.id, err)
        }
    }
}
