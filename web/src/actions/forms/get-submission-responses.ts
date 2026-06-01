'use server'

import { createClient } from '@/lib/supabase/server'

export interface SubmissionResponses {
    id: string
    title: string
    category: string
    submittedAt: string | null
    /** answers_json da submissão (mapa pergunta_id → resposta). */
    answers: Record<string, unknown>
    /** schema_snapshot_json (perguntas no momento do envio). */
    schema: { questions?: unknown[] } | null
    /** Feedback já enviado pelo treinador (vazio se ainda não enviou). */
    feedback: string
    /** Quando o feedback foi enviado (null se ainda não enviou). */
    feedbackSentAt: string | null
}

/**
 * Busca as respostas de UMA submissão de formulário do aluno para exibição
 * inline no dashboard do treinador (card "Saúde & métricas"), sem precisar
 * sair da tela.
 *
 * Escopado ao treinador autenticado (RLS + filtro explícito por trainer_id),
 * então um treinador só lê submissões dos próprios alunos.
 */
export async function getSubmissionResponses(
    submissionId: string,
): Promise<{ success: boolean; error?: string; data?: SubmissionResponses }> {
    if (!submissionId) return { success: false, error: 'Submissão inválida' }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Não autenticado' }

    const { data: trainer } = await supabase
        .from('trainers')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()
    if (!trainer) return { success: false, error: 'Trainer não encontrado' }

    const { data, error } = await supabase
        .from('form_submissions')
        .select('id, submitted_at, answers_json, schema_snapshot_json, trainer_feedback, feedback_sent_at, form_templates(title, category)')
        .eq('id', submissionId)
        .eq('trainer_id', trainer.id)
        .maybeSingle()

    if (error) return { success: false, error: error.message }
    if (!data) return { success: false, error: 'Avaliação não encontrada' }

    const template = data.form_templates as unknown as { title?: string; category?: string } | null
    const trainerFeedback = data.trainer_feedback as { message?: string } | null

    return {
        success: true,
        data: {
            id: data.id,
            title: template?.title || 'Avaliação',
            category: template?.category || '',
            submittedAt: data.submitted_at,
            answers: (data.answers_json as Record<string, unknown>) || {},
            schema: (data.schema_snapshot_json as { questions?: unknown[] } | null) || null,
            feedback: trainerFeedback?.message || '',
            feedbackSentAt: data.feedback_sent_at,
        },
    }
}
