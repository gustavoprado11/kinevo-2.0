'use server'

import { createClient } from '@/lib/supabase/server'
import { createRecurringCore, type CreateRecurringResult } from './core'
import { type CreateRecurringInput } from './schemas'

export type { CreateRecurringResult } from './core'

/**
 * Cria uma nova rotina recorrente (ou agendamento único). Wrapper de auth:
 * resolve o trainer e delega ao núcleo compartilhado (regras de coerência,
 * lembretes, inbox e Google Calendar sync vivem lá).
 *
 * Sobreposição com outras rotinas no mesmo horário é permitida por design —
 * aula em dupla/grupo é caso comum em personal trainer.
 */
export async function createRecurringAppointment(
    input: CreateRecurringInput,
): Promise<CreateRecurringResult> {
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

    return createRecurringCore(supabase, trainer.id, input)
}
