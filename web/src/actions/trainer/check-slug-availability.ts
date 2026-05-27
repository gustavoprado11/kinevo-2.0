'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { validateSlug, type SlugValidation } from '@/lib/landing/slug'

export type SlugAvailability =
    | { status: 'available' }
    | { status: 'taken' }
    | { status: 'invalid'; reason: Exclude<SlugValidation, { valid: true }>['reason'] }
    | { status: 'error'; message: string }

/**
 * Verifica em tempo real (input typing, debounce 400ms) se um slug está
 * disponível pro trainer logado.
 *
 *  - Valida formato + reservados localmente (validateSlug).
 *  - Faz lookup no banco (supabaseAdmin) ignorando o próprio trainer
 *    (`neq`), pra que o trainer não veja "indisponível" no slug que ele
 *    já tem.
 *
 * NÃO altera dados — apenas leitura. Pode ser chamada com frequência
 * sem efeito colateral.
 */
export async function checkSlugAvailability(slug: string): Promise<SlugAvailability> {
    const v = validateSlug(slug)
    if (!v.valid) return { status: 'invalid', reason: v.reason }

    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) return { status: 'error', message: 'Sessão inválida.' }

        const { data: ownTrainer } = await supabase
            .from('trainers')
            .select('id')
            .eq('auth_user_id', user.id)
            .single()

        if (!ownTrainer) return { status: 'error', message: 'Treinador não encontrado.' }

        // Lookup global por slug — usa admin pra bypassar RLS e ver mesmo
        // se for de outro trainer (sem expor dados, só checa existência).
        const { data: existing, error: lookupError } = await supabaseAdmin
            .from('trainers')
            .select('id')
            .eq('public_slug', slug)
            .neq('id', ownTrainer.id)
            .maybeSingle()

        if (lookupError) {
            console.error('[checkSlugAvailability] lookup error:', lookupError)
            return { status: 'error', message: 'Não foi possível verificar agora.' }
        }

        return existing ? { status: 'taken' } : { status: 'available' }
    } catch (err) {
        console.error('[checkSlugAvailability] unexpected:', err)
        return { status: 'error', message: 'Erro inesperado.' }
    }
}
