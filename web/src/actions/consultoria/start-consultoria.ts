'use server'

// Consultoria IA — passo 1: iniciar o pedido para um aluno.
//
// Se o aluno já tem uma Avaliação Inicial respondida nos últimos 60 dias, o
// pedido nasce triado (ready_to_generate ou blocked). Senão, envia o formulário
// pelo fluxo de inbox existente (push incluso) e o pedido fica awaiting_anamnese
// até o reconcile detectar a resposta.

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { assignFormCore } from '@/actions/forms/assign-form-core'
import {
    RECENT_ANAMNESE_DAYS,
    findLatestSubmittedAnamnese,
    getInitialAssessmentTemplateId,
    resolveTrainer,
    triageSubmission,
} from './consultoria-core'
import type { Json } from '@kinevo/shared/types/database'

interface StartConsultoriaResult {
    success: boolean
    error?: string
    requestId?: string
    status?: string
}

export async function startConsultoria(studentId: string): Promise<StartConsultoriaResult> {
    try {
        const supabase = await createClient()
        const trainer = await resolveTrainer(supabase)
        if (!trainer) return { success: false, error: 'Não autorizado' }

        // Posse do aluno (RLS já filtra; single() confirma).
        const { data: student } = await supabase
            .from('students')
            .select('id, name')
            .eq('id', studentId)
            .single()
        if (!student) return { success: false, error: 'Aluno não encontrado' }

        // Pedido em aberto? (o índice único também protege — checagem amistosa)
        const { data: open } = await supabase
            .from('consultoria_requests')
            .select('id, status')
            .eq('student_id', studentId)
            .in('status', ['awaiting_anamnese', 'ready_to_generate', 'generating', 'blocked', 'pending_validation'])
            .maybeSingle()
        if (open) {
            return { success: false, error: 'Este aluno já tem uma consultoria em andamento.' }
        }

        const templateId = await getInitialAssessmentTemplateId(supabase)
        if (!templateId) {
            return { success: false, error: 'Template "Avaliação Inicial" não encontrado.' }
        }

        // Anamnese recente? Reaproveita sem reenviar o formulário.
        const since = new Date(Date.now() - RECENT_ANAMNESE_DAYS * 24 * 60 * 60 * 1000).toISOString()
        const recent = await findLatestSubmittedAnamnese(supabase, templateId, studentId, since)

        if (recent) {
            const triage = triageSubmission(recent.answers_json)
            const { data: request, error } = await supabase
                .from('consultoria_requests')
                .insert({
                    trainer_id: trainer.id,
                    student_id: studentId,
                    status: triage.level === 'red' ? 'blocked' : 'ready_to_generate',
                    anamnese_submission_id: recent.id,
                    triage_level: triage.level,
                    triage_flags: triage.flags as unknown as Json,
                })
                .select('id, status')
                .single()

            if (error || !request) {
                console.error('[startConsultoria] insert error:', error)
                return { success: false, error: 'Erro ao criar a consultoria.' }
            }

            revalidatePath('/consultoria')
            revalidatePath(`/students/${studentId}`)
            return { success: true, requestId: request.id, status: request.status }
        }

        // Sem anamnese recente → cria o pedido e envia o formulário (inbox + push).
        const { data: request, error } = await supabase
            .from('consultoria_requests')
            .insert({
                trainer_id: trainer.id,
                student_id: studentId,
                status: 'awaiting_anamnese',
            })
            .select('id, status')
            .single()

        if (error || !request) {
            console.error('[startConsultoria] insert error:', error)
            return { success: false, error: 'Erro ao criar a consultoria.' }
        }

        // O overload de 5 args da RPC é restrito a service_role (migration 204):
        // auth já validada acima; o core recebe o admin client — mesmo padrão do
        // wrapper oficial (actions/forms/assign-form.ts).
        const assign = await assignFormCore(supabaseAdmin, trainer.id, {
            formTemplateId: templateId,
            studentIds: [studentId],
            message:
                'Sua consultoria começa aqui! Responda esta avaliação para eu montar seu programa de treino personalizado.',
        })

        // skipped > 0 = o aluno JÁ tem esta avaliação pendente no inbox — o pedido
        // fica aguardando a mesma resposta; não é falha.
        if (!assign.success && (assign.skippedCount ?? 0) === 0) {
            // Envio realmente falhou → desfaz o pedido para não travar o aluno.
            await supabase.from('consultoria_requests').delete().eq('id', request.id)
            return { success: false, error: assign.error ?? 'Erro ao enviar a anamnese.' }
        }

        revalidatePath('/consultoria')
        revalidatePath(`/students/${studentId}`)
        return { success: true, requestId: request.id, status: request.status }
    } catch (err) {
        console.error('[startConsultoria] unexpected error:', err)
        return { success: false, error: 'Erro inesperado ao iniciar a consultoria.' }
    }
}
