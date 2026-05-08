'use server'

import { createClient } from '@/lib/supabase/server'
import type { MeasurementInput } from '@kinevo/shared/types/assessments'
import { SUBJECT_SEX_KEY, SUBJECT_AGE_KEY } from '@/lib/assessments-constants'

interface CreateAssessmentSessionInput {
    studentId: string
    templateId: string
    scheduledAt?: string | null
    notes?: string | null
    subjectSex?: 'male' | 'female' | null
    subjectAgeYears?: number | null
}

export async function createAssessmentSession(
    input: CreateAssessmentSessionInput,
): Promise<{ success: boolean; sessionId?: string; error?: string }> {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Não autorizado' }

    if (!input.studentId || !input.templateId) {
        return { success: false, error: 'studentId e templateId são obrigatórios' }
    }

    if (input.subjectSex != null && input.subjectSex !== 'male' && input.subjectSex !== 'female') {
        return { success: false, error: 'subjectSex deve ser "male" ou "female"' }
    }

    if (input.subjectAgeYears != null) {
        if (
            !Number.isFinite(input.subjectAgeYears)
            || input.subjectAgeYears < 5
            || input.subjectAgeYears > 120
        ) {
            return { success: false, error: 'subjectAgeYears deve estar entre 5 e 120' }
        }
    }

    const { data, error } = await supabase.rpc('create_assessment_session' as never, {
        p_student_id: input.studentId,
        p_template_id: input.templateId,
        p_scheduled_at: input.scheduledAt ?? null,
        p_notes: input.notes ?? null,
    } as never)

    if (error) {
        console.error('[createAssessmentSession] error:', error)
        return { success: false, error: error.message }
    }

    const sessionId = data as unknown as string

    const subjectMeasurements: MeasurementInput[] = []
    if (input.subjectSex) {
        subjectMeasurements.push({
            metric_key: SUBJECT_SEX_KEY,
            value_text: input.subjectSex,
            is_selected: true,
        })
    }
    if (input.subjectAgeYears != null) {
        subjectMeasurements.push({
            metric_key: SUBJECT_AGE_KEY,
            value_numeric: input.subjectAgeYears,
            is_selected: true,
        })
    }

    if (subjectMeasurements.length > 0) {
        const { error: mErr } = await supabase.rpc('save_assessment_measurements' as never, {
            p_session_id: sessionId,
            p_measurements: subjectMeasurements,
        } as never)
        if (mErr) {
            console.error('[createAssessmentSession] subject context save failed:', mErr)
            return { success: false, error: `Sessão criada mas contexto não salvo: ${mErr.message}` }
        }
    }

    return { success: true, sessionId }
}
