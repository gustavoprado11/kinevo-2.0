'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendStudentPush } from '@/lib/push-notifications'

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

    // Capture timestamp before RPC to scope the push query precisely
    const beforeRpc = new Date().toISOString()

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

    // Fire-and-forget: send push to each assigned student
    // Query the inbox items just created by the RPC (created after beforeRpc) to get their IDs
    try {
        const { data: createdItems } = await supabaseAdmin
            .from('student_inbox_items')
            .select('id, student_id, title')
            .in('student_id', normalizedStudentIds)
            .eq('type', 'form_request')
            .is('push_sent_at', null)
            .gte('created_at', beforeRpc)
            .order('created_at', { ascending: false })
            .limit(normalizedStudentIds.length)

        if (createdItems && createdItems.length > 0) {
            for (const item of createdItems) {
                sendStudentPush({
                    studentId: item.student_id,
                    title: 'Nova avaliação disponível',
                    body: 'Seu treinador enviou uma avaliação para você preencher.',
                    inboxItemId: item.id,
                    data: { type: 'form_request', inbox_item_id: item.id },
                })
            }
        }
    } catch (pushErr) {
        console.error('[assignFormToStudents] Push error (non-fatal):', pushErr)
    }

    return {
        success: true,
        assignedCount,
        skippedCount,
    }
}
