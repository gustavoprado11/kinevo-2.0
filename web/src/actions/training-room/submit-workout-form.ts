'use server'

import { createClient } from '@/lib/supabase/server'

interface SubmitWorkoutFormInput {
    formTemplateId: string
    studentId: string
    trainerId: string
    answers: Record<string, any>
    triggerContext: 'pre_workout' | 'post_workout'
}

export async function submitWorkoutForm(
    input: SubmitWorkoutFormInput,
): Promise<{ success: boolean; submissionId?: string; error?: string }> {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Não autorizado' }

    const { data, error } = await supabase.rpc('submit_inline_form', {
        p_form_template_id: input.formTemplateId,
        p_student_id: input.studentId,
        p_trainer_id: input.trainerId,
        p_answers_json: { answers: input.answers },
        p_trigger_context: input.triggerContext,
    })

    if (error) {
        // Extract readable message from RPC exception
        const msg = error.message?.replace(/^.*RAISE EXCEPTION:\s*/, '') || error.message
        return { success: false, error: msg }
    }

    const result = data as { ok: boolean; submission_id: string }
    if (!result?.ok) return { success: false, error: 'Erro ao submeter formulário' }

    return { success: true, submissionId: result.submission_id }
}
