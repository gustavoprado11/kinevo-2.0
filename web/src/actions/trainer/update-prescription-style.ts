'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type StyleActionResult = { success: boolean; message?: string }

/**
 * Apaga o estilo de prescrição do treinador. A partir daí o Assistente volta aos
 * defaults do playbook — o bloco <<ESTILO_DO_TREINADOR>> simplesmente deixa de
 * existir no prompt (loadStyleBlock devolve vazio).
 *
 * Reversível por definição: é só refazer a entrevista.
 */
export async function deletePrescriptionStyle(): Promise<StyleActionResult> {
    const supabase = await createClient()
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) return { success: false, message: 'Sessão inválida.' }

    const { error } = await supabase
        .from('trainers')
        .update({ prescription_style: null })
        .eq('auth_user_id', user.id)

    if (error) {
        console.error('[deletePrescriptionStyle]', error)
        return { success: false, message: 'Não foi possível remover o estilo agora.' }
    }

    revalidatePath('/settings')
    revalidatePath('/assistente')
    return { success: true }
}
