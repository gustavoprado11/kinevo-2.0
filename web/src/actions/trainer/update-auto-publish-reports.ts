'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type UpdateAutoPublishResult = {
    success: boolean
    message?: string
}

/**
 * Atualiza a preferência `trainers.auto_publish_reports`. Quando true,
 * relatórios gerados pelo treinador saem já publicados e o aluno recebe
 * notificação na hora (sem precisar do clique manual em "Publicar").
 */
export async function updateAutoPublishReports(
    enabled: boolean,
): Promise<UpdateAutoPublishResult> {
    const supabase = await createClient()
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
        return { success: false, message: 'Sessão inválida.' }
    }

    const { error } = await supabase
        .from('trainers')
        .update({ auto_publish_reports: enabled })
        .eq('auth_user_id', user.id)

    if (error) {
        console.error('[updateAutoPublishReports] Error:', error)
        return { success: false, message: 'Erro ao atualizar preferência.' }
    }

    revalidatePath('/settings')

    return { success: true }
}
