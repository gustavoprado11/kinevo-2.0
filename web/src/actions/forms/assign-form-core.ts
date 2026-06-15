/**
 * Forms — núcleo de envio (server-only, SEM 'use server').
 *
 * assignFormCore recebe um client Supabase + o trainerId já resolvido e envia o
 * formulário (RPC assign_form_to_students de 5 args, com trainer explícito) +
 * dispara o push para cada aluno. A action ('use server') vira wrapper de auth;
 * a tool MCP chama o core direto com o admin client + trainerId do token OAuth.
 * Mesma lógica nos dois caminhos, sem duplicação.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@kinevo/shared/types/database'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendStudentPush } from '@/lib/push-notifications'

type DBClient = SupabaseClient<Database>

export interface AssignFormInput {
    formTemplateId: string
    studentIds: string[]
    dueAt?: string | null
    message?: string
}

export interface AssignFormResult {
    success: boolean
    error?: string
    assignedCount?: number
    skippedCount?: number
}

interface AssignFormRpcResult {
    assigned_count?: number
    skipped_count?: number
}

export async function assignFormCore(
    supabase: DBClient,
    trainerId: string,
    input: AssignFormInput,
): Promise<AssignFormResult> {
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

    // Marca o instante antes do RPC para escopar a query de push com precisão.
    const beforeRpc = new Date().toISOString()

    // Cast do nome até `npm run gen:types` incluir o overload de 5 args (mesma
    // convenção de save_assigned_program_tree). p_trainer_id: o MCP grava com
    // service-role (sem JWT), então current_trainer_id() seria NULL no banco.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await supabase.rpc('assign_form_to_students' as any, {
        p_trainer_id: trainerId,
        p_form_template_id: input.formTemplateId,
        p_student_ids: normalizedStudentIds,
        p_due_at: dueAt ?? undefined,
        p_message: input.message?.trim() || undefined,
    })

    if (error) {
        console.error('[assignFormCore] error:', error)
        return { success: false, error: error.message || 'Erro ao enviar formulário', assignedCount: 0, skippedCount: 0 }
    }

    const rpcResult = (data ?? {}) as AssignFormRpcResult
    const assignedCount = rpcResult.assigned_count ?? 0
    const skippedCount = rpcResult.skipped_count ?? 0

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

    // Fire-and-forget: push para cada aluno recém-atribuído (itens criados após beforeRpc).
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
        console.error('[assignFormCore] Push error (non-fatal):', pushErr)
    }

    return { success: true, assignedCount, skippedCount }
}
