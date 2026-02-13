'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

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
        return { success: false, error: error.message || 'Erro ao enviar feedback' }
    }

    revalidatePath('/forms')

    return {
        success: true,
        feedbackInboxItemId: data?.feedback_inbox_item_id ?? null,
    }
}

