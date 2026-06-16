'use server'

/**
 * Define a preferência de Início do treinador: dashboard 'classic' ou home do
 * Assistente ('assistant'). Persistida em trainers.home_style (migration 210).
 */

import { createClient } from '@/lib/supabase/server'

export async function setHomeStyle(style: 'classic' | 'assistant'): Promise<{ success: boolean }> {
    if (style !== 'classic' && style !== 'assistant') return { success: false }
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false }
    // Cast: coluna home_style (migration 210) ainda não está no database.ts gerado.
    const { error } = await supabase
        .from('trainers')
        .update({ home_style: style } as never)
        .eq('auth_user_id', user.id)
    return { success: !error }
}
