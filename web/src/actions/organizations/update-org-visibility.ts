'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { revalidatePath } from 'next/cache'
import { getOrganizationContext } from '@/lib/studio/get-organization'

/**
 * Alterna a visibilidade cruzada da academia (PRD §8.4):
 *   - 'open'       → qualquer coach vê e atua nos atletas da academia.
 *   - 'restricted' → coaches veem todos, mas só atuam nos próprios (gestor atua em todos).
 *
 * Autorização: apenas gestor (owner/admin).
 */
export async function updateOrgVisibility(data: { visibility: 'open' | 'restricted' }) {
    try {
        if (data.visibility !== 'open' && data.visibility !== 'restricted') {
            return { success: false, error: 'Visibilidade inválida' }
        }
        const ctx = await getOrganizationContext()
        if (!ctx) return { success: false, error: 'Você não pertence a uma academia' }
        if (!ctx.isManager) return { success: false, error: 'Apenas o gestor pode alterar a visibilidade' }

        const { error } = await supabaseAdmin
            .from('organizations')
            // @ts-ignore - tabela de estúdio ainda não tipada no projeto
            .update({ visibility: data.visibility })
            .eq('id', ctx.organization.id)

        if (error) {
            console.error('Error updating org visibility:', error)
            return { success: false, error: 'Erro ao atualizar a visibilidade' }
        }

        revalidatePath('/settings')
        return { success: true }
    } catch (error) {
        console.error('Unexpected error in updateOrgVisibility:', error)
        return { success: false, error: 'Ocorreu um erro inesperado' }
    }
}
