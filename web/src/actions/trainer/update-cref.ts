'use server'

// Atualiza só o CREF do treinador (trainers.landing_cref — mesma coluna que a
// landing pública usa). Chamado pelo formulário de perfil em Configurações e
// pelo CTA "cadastre seu CREF" do painel de Consultoria IA.

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

interface UpdateCrefResult {
    success: boolean
    error?: string
}

export async function updateTrainerCref(cref: string): Promise<UpdateCrefResult> {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { success: false, error: 'Não autorizado' }

        const trimmed = cref.trim()
        if (trimmed.length > 40) {
            return { success: false, error: 'CREF muito longo (máx. 40 caracteres).' }
        }

        const { error } = await supabase
            .from('trainers')
            .update({ landing_cref: trimmed || null })
            .eq('auth_user_id', user.id)

        if (error) {
            console.error('[updateTrainerCref] error:', error)
            return { success: false, error: 'Erro ao salvar o CREF.' }
        }

        revalidatePath('/settings')
        revalidatePath('/consultoria')
        return { success: true }
    } catch (err) {
        console.error('[updateTrainerCref] unexpected error:', err)
        return { success: false, error: 'Erro inesperado ao salvar o CREF.' }
    }
}
