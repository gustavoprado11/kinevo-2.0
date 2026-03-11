'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { sendStudentPush } from '@/lib/push-notifications'

interface SendFormFeedbackInput {
    submissionId: string
    message: string
}

export async function sendFormFeedback(input: SendFormFeedbackInput) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Não autorizado' }

    if (!input.submissionId) {
        return { success: false, error: 'Submission inválida' }
    }

    const message = input.message?.trim()
    if (!message) {
        return { success: false, error: 'Digite um feedback antes de enviar' }
    }

    // Fetch student_id before RPC (needed for push)
    const { data: submission } = await supabase
        .from('form_submissions')
        .select('student_id')
        .eq('id', input.submissionId)
        .single()

    const { data, error } = await supabase.rpc('send_submission_feedback', {
        p_submission_id: input.submissionId,
        p_feedback: {
            message,
            source: 'web_trainer',
            created_at: new Date().toISOString(),
        },
    })

    if (error) {
        console.error('[sendFormFeedback] error:', error)
        return { success: false, error: 'Erro ao enviar feedback.' }
    }

    const feedbackInboxItemId = data?.feedback_inbox_item_id ?? null

    // Fire-and-forget: send push to student
    if (submission?.student_id && feedbackInboxItemId) {
        sendStudentPush({
            studentId: submission.student_id,
            title: 'Feedback do treinador',
            body: 'Seu treinador comentou sua avaliação.',
            inboxItemId: feedbackInboxItemId,
            data: { type: 'feedback', inbox_item_id: feedbackInboxItemId },
        })
    }

    revalidatePath('/forms')

    return {
        success: true,
        feedbackInboxItemId,
    }
}
