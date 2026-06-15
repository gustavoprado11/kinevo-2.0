'use server'

import { createClient } from '@/lib/supabase/server'
import { cancelRecurringCore, type CancelRecurringResult } from './core'
import { type CancelRecurringInput } from './schemas'

export type { CancelRecurringResult } from './core'

/**
 * Encerra uma rotina: seta status='canceled' e ends_on. Ocorrências após
 * ends_on param de aparecer na projeção. Wrapper de auth: resolve o trainer e
 * delega ao núcleo compartilhado.
 */
export async function cancelRecurringAppointment(
    input: CancelRecurringInput,
): Promise<CancelRecurringResult> {
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

    return cancelRecurringCore(supabase, trainer.id, input)
}
