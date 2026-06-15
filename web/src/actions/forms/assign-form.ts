'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
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

    const result = await assignFormCore(supabase, trainer.id, input)

    if (result.success) {
        revalidatePath('/forms')
    }
    return result
}
