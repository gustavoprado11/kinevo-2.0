'use server'

import { createClient } from '@/lib/supabase/server'
import { PRESCRIPTION_QUESTIONNAIRE_KEY } from '@/lib/prescription/questionnaire-constants'

// ============================================================================
// Types
// ============================================================================

export interface QuestionnaireSubmission {
    id: string
    answers_json: Record<string, any>
    submitted_at: string
}

export interface FetchQuestionnaireResult {
    success: boolean
    error?: string
    submission?: QuestionnaireSubmission
    templateId?: string
}

export interface SendQuestionnaireResult {
    success: boolean
    error?: string
    assignedCount?: number
    skippedCount?: number
}

// ============================================================================
// Fetch Prescription Questionnaire
// ============================================================================

/**
 * Fetches the most recent submitted prescription questionnaire for a student.
 * Also returns the template ID for sending if no submission exists.
 */
export async function fetchPrescriptionQuestionnaire(
    studentId: string,
): Promise<FetchQuestionnaireResult> {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Não autorizado' }

    // Get the system template ID
    // @ts-ignore — system_key from migration 062
    const { data: template } = await supabase
        .from('form_templates')
        .select('id')
        .eq('system_key', PRESCRIPTION_QUESTIONNAIRE_KEY)
        .eq('is_active', true)
        .maybeSingle()

    if (!template) {
        return { success: true, templateId: undefined, submission: undefined }
    }

    // Find the most recent submitted questionnaire for this student
    const { data: submission, error } = await supabase
        .from('form_submissions')
        .select('id, answers_json, submitted_at')
        .eq('form_template_id', template.id)
        .eq('student_id', studentId)
        .eq('status', 'submitted')
        .order('submitted_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    if (error) {
        console.error('[fetchPrescriptionQuestionnaire] Error:', error)
        return { success: false, error: 'Erro ao buscar questionário' }
    }

    return {
        success: true,
        templateId: template.id,
        submission: submission
            ? {
                id: submission.id,
                answers_json: submission.answers_json as Record<string, any>,
                submitted_at: submission.submitted_at as string,
            }
            : undefined,
    }
}

// ============================================================================
// Send Prescription Questionnaire to Student
// ============================================================================

/**
 * Assigns the prescription questionnaire to a student via the inbox system.
 * Uses the existing assign_form_to_students RPC (updated in migration 062
 * to accept system templates).
 */
export async function sendPrescriptionQuestionnaire(
    studentId: string,
): Promise<SendQuestionnaireResult> {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Não autorizado' }

    // Get the system template ID
    // @ts-ignore — system_key from migration 062
    const { data: template } = await supabase
        .from('form_templates')
        .select('id')
        .eq('system_key', PRESCRIPTION_QUESTIONNAIRE_KEY)
        .eq('is_active', true)
        .maybeSingle()

    if (!template) {
        return { success: false, error: 'Template de questionário não encontrado' }
    }

    // Call the RPC to assign the form
    const { data, error } = await supabase.rpc('assign_form_to_students', {
        p_form_template_id: template.id,
        p_student_ids: [studentId],
        p_message: 'Por favor, responda o questionário de prescrição para personalizar seu programa de treino.',
    })

    if (error) {
        console.error('[sendPrescriptionQuestionnaire] RPC error:', error)
        return { success: false, error: 'Erro ao enviar questionário.' }
    }

    const result = data as { assigned_count: number; skipped_count: number } | null
    return {
        success: true,
        assignedCount: result?.assigned_count ?? 0,
        skippedCount: result?.skipped_count ?? 0,
    }
}
