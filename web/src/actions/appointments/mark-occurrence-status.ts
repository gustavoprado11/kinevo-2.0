'use server'

import { createClient } from '@/lib/supabase/server'
import { markOccurrenceStatusCore, type MarkOccurrenceStatusResult } from './core'
import { type MarkOccurrenceStatusInput } from './schemas'

export type { MarkOccurrenceStatusResult } from './core'

/**
 * Marca uma ocorrência como 'completed' ou 'no_show' (upsert em
 * appointment_exceptions). Wrapper de auth: resolve o trainer e delega ao núcleo.
 */
export async function markOccurrenceStatus(
    input: MarkOccurrenceStatusInput,
): Promise<MarkOccurrenceStatusResult> {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Não autorizado' }

    const { data: trainer } = await supabase
        .from('trainers')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()
    if (!trainer) return { success: false, error: 'Treinador não encontrado' }

    return markOccurrenceStatusCore(supabase, trainer.id, input)
}
