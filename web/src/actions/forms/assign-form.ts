'use server'

import { isStudentManagementLockedForTrainer, STUDENT_MANAGEMENT_LOCKED_ERROR } from '@/lib/limits/student-readonly'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { assignFormCore, type AssignFormInput } from './assign-form-core'

/**
 * Envia um formulário a um ou mais alunos. Wrapper de auth: resolve o trainer e
 * delega ao núcleo compartilhado (RPC + push vivem lá; mesma lógica do MCP).
 */
export async function assignFormToStudents(input: AssignFormInput) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Não autorizado' }

    const { data: trainer } = await supabase
        .from('trainers')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()
    if (!trainer) return { success: false, error: 'Treinador não encontrado' }
    if (await isStudentManagementLockedForTrainer(trainer.id)) {
        return { success: false, error: STUDENT_MANAGEMENT_LOCKED_ERROR }
    }

    // RPC assign_form_to_students (5-arg) é service-role-only desde a migration
    // 204 (lockdown MCP). trainer.id vem da sessão autenticada acima (não é input
    // do usuário) e o RPC revalida coach_id internamente — mesmo caminho do MCP.
    const result = await assignFormCore(supabaseAdmin, trainer.id, input)

    if (result.success) {
        revalidatePath('/forms')
    }
    return result
}
