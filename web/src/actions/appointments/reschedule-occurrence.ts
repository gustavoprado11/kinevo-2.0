'use server'

import { createClient } from '@/lib/supabase/server'
import { rescheduleOccurrenceCore, type RescheduleOccurrenceResult } from './core'
import { type RescheduleOccurrenceInput } from './schemas'

export type { RescheduleOccurrenceResult } from './core'

/**
 * Remarca uma ocorrência. Wrapper de auth: resolve o trainer e delega ao núcleo.
 *
 * `only_this`: upsert em appointment_exceptions (kind='rescheduled').
 * `this_and_future`: encerra a rotina original (ends_on = originalDate - 1 dia)
 *   e cria nova rotina começando em newDate com os novos valores.
 */
export async function rescheduleOccurrence(
    input: RescheduleOccurrenceInput,
): Promise<RescheduleOccurrenceResult> {
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

    return rescheduleOccurrenceCore(supabase, trainer.id, input)
}
