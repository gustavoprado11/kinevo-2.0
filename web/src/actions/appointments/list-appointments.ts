'use server'

import { createClient } from '@/lib/supabase/server'
import { listAppointmentsCore, type ListAppointmentsResult } from './core'
import { type ListAppointmentsInput } from './schemas'

export type { ListAppointmentsResult } from './core'

/**
 * Lista ocorrências de agendamentos do trainer autenticado dentro de um range.
 * Wrapper de auth: resolve o trainer e delega a lógica ao núcleo compartilhado.
 */
export async function listAppointmentsInRange(
    input: ListAppointmentsInput,
): Promise<ListAppointmentsResult> {
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

    return listAppointmentsCore(supabase, trainer.id, input)
}
