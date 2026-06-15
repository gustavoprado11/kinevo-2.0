'use server'

import { createClient } from '@/lib/supabase/server'
import { cancelOccurrenceCore, type CancelOccurrenceResult } from './core'
import { type CancelOccurrenceInput } from './schemas'

export type { CancelOccurrenceResult } from './core'

/**
 * Cancela uma única ocorrência (upsert em appointment_exceptions,
 * kind='canceled'). Wrapper de auth: resolve o trainer e delega ao núcleo.
 */
export async function cancelOccurrence(
    input: CancelOccurrenceInput,
): Promise<CancelOccurrenceResult> {
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

    return cancelOccurrenceCore(supabase, trainer.id, input)
}
