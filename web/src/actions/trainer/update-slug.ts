'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { validateSlug } from '@/lib/landing/slug'

export type UpdateSlugResult =
    | { success: true; slug: string }
    | { success: false; message: string }

/**
 * Define ou atualiza o `public_slug` do trainer logado.
 *
 *  - Valida formato/reservados.
 *  - Verifica colisão global (via supabaseAdmin, ignorando o próprio).
 *  - Faz o UPDATE — se passar pelo banco (UNIQUE), retorna sucesso.
 *  - Slug vazio = remove (`null`), o que despublica a landing
 *    automaticamente em M2 via gate `public_slug IS NOT NULL`.
 */
export async function updateTrainerSlug(slug: string | null): Promise<UpdateSlugResult> {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) return { success: false, message: 'Sessão inválida.' }

        // Trainer ID
        const { data: trainer, error: trainerError } = await supabase
            .from('trainers')
            .select('id')
            .eq('auth_user_id', user.id)
            .single()
        if (trainerError || !trainer) return { success: false, message: 'Treinador não encontrado.' }

        // Vazio/null → limpa o slug.
        if (slug === null || slug.trim() === '') {
            const { error: clearError } = await supabase
                .from('trainers')
                .update({ public_slug: null, landing_published: false } as never)
                .eq('id', trainer.id)
            if (clearError) {
                console.error('[updateTrainerSlug] clear error:', clearError)
                return { success: false, message: 'Não foi possível remover o slug.' }
            }
            revalidatePath('/settings')
            return { success: true, slug: '' }
        }

        const normalized = slug.trim().toLowerCase()
        const v = validateSlug(normalized)
        if (!v.valid) {
            const messages: Record<typeof v.reason, string> = {
                too_short: 'O slug precisa ter ao menos 3 caracteres.',
                too_long: 'O slug não pode passar de 40 caracteres.',
                invalid_format: 'Use apenas letras minúsculas, números e hífens (sem hífen no início/fim).',
                reserved: 'Esse slug é reservado pelo sistema. Escolha outro.',
            }
            return { success: false, message: messages[v.reason] }
        }

        // Colisão global (ignora o próprio trainer).
        const { data: existing } = await supabaseAdmin
            .from('trainers')
            .select('id')
            .eq('public_slug', normalized)
            .neq('id', trainer.id)
            .maybeSingle()
        if (existing) {
            return { success: false, message: 'Esse slug já está em uso. Tente outra variação.' }
        }

        // UPDATE
        const { error: updateError } = await supabase
            .from('trainers')
            .update({ public_slug: normalized } as never)
            .eq('id', trainer.id)
        if (updateError) {
            // Provavelmente conflito UNIQUE concorrente (segunda linha de defesa).
            console.error('[updateTrainerSlug] update error:', updateError)
            return { success: false, message: 'Esse slug já está em uso. Tente outra variação.' }
        }

        revalidatePath('/settings')
        return { success: true, slug: normalized }
    } catch (err) {
        console.error('[updateTrainerSlug] unexpected:', err)
        return { success: false, message: 'Erro inesperado ao salvar.' }
    }
}
