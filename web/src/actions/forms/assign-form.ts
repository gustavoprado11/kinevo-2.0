'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

interface AssignFormInput {
    formTemplateId: string
    studentIds: string[]
    dueAt?: string | null
    message?: string
}

export async function assignFormToStudents(input: AssignFormInput) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Não autorizado' }

    if (!input.formTemplateId) {
        return { success: false, error: 'Selecione um template' }
    }

    if (!input.studentIds || input.studentIds.length === 0) {
        return { success: false, error: 'Selecione ao menos um aluno' }
    }

    const normalizedStudentIds = Array.from(new Set(input.studentIds.filter(Boolean)))
    const dueAt = input.dueAt && input.dueAt.trim() !== ''
        ? new Date(input.dueAt).toISOString()
        : null

    const { data, error } = await supabase.rpc('assign_form_to_students', {
        p_form_template_id: input.formTemplateId,
        p_student_ids: normalizedStudentIds,
        p_due_at: dueAt,
        p_message: input.message?.trim() || null,
    })

    if (error) {
        console.error('[assignFormToStudents] error:', error)
        return { success: false, error: error.message || 'Erro ao enviar formulário', assignedCount: 0, skippedCount: 0 }
    }

    const assignedCount = data?.assigned_count ?? 0
    const skippedCount = data?.skipped_count ?? 0

    revalidatePath('/forms')

    if (assignedCount === 0) {
        return {
            success: false,
            error: skippedCount > 0
                ? `Nenhum formulário enviado — ${skippedCount === 1 ? 'o aluno selecionado já possui' : 'os alunos selecionados já possuem'} este formulário pendente.`
                : 'Nenhum formulário enviado. Verifique se os alunos selecionados estão vinculados à sua conta.',
            assignedCount: 0,
            skippedCount,
        }
    }

    return {
        success: true,
        assignedCount,
        skippedCount,
    }
}

