'use server'

import { createClient } from '@/lib/supabase/server'

interface CreateAssessmentSessionInput {
    studentId: string
    templateId: string
    scheduledAt?: string | null
    notes?: string | null
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

    return { success: true, sessionId: data as unknown as string }
}
