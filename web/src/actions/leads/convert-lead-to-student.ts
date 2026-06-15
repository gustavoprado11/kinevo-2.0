'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { convertLeadToStudentCore, type ConvertLeadResult } from './convert-lead-core'

export type { ConvertLeadResult }

/**
 * Converte um lead em aluno (M5). Wrapper de auth: resolve trainers.id e delega
 * para convertLeadToStudentCore.
 *
 *   Caminho "cortesia": cria o aluno SEM contrato (status active). O trainer
 *   vincula billing depois, no perfil do aluno, se quiser.
 *
 *   Dedup: se já existe um aluno com o mesmo e-mail sob esse trainer, vincula
 *   o lead a ele em vez de criar conta duplicada (e-mail é único no auth).
 *
 *   Idempotente: lead já convertido (converted_to_student_id setado) retorna
 *   o vínculo existente sem recriar nada.
 */
export async function convertLeadToStudent(
    leadId: string,
    opts: { modality: 'online' | 'presential' },
): Promise<ConvertLeadResult> {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, message: 'Sessão expirada.' }
    }

    const { data: trainer } = await supabase
        .from('trainers')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()
    if (!trainer) {
        return { success: false, message: 'Treinador não encontrado.' }
    }

    const result = await convertLeadToStudentCore(supabaseAdmin, trainer.id, leadId, opts)

    if (result.success) {
        revalidatePath('/marketing/leads')
        revalidatePath('/marketing')
        revalidatePath('/students')
    }

    return result
}
