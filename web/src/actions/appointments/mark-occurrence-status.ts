'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
    markOccurrenceStatusInputSchema,
    type MarkOccurrenceStatusInput,
} from './schemas'

export interface MarkOccurrenceStatusResult {
    success: boolean
    error?: string
}

/**
 * Marca uma ocorrência como 'completed' ou 'no_show' via upsert em
 * appointment_exceptions.
 */
export async function markOccurrenceStatus(
    input: MarkOccurrenceStatusInput,
): Promise<MarkOccurrenceStatusResult> {
    const parsed = markOccurrenceStatusInputSchema.safeParse(input)
    if (!parsed.success) {
        return {
            success: false,
            error: parsed.error.issues[0]?.message ?? 'Dados inválidos',
        }
    }
    const payload = parsed.data

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

    const { data: rule } = await supabase
        .from('recurring_appointments')
        .select('id, trainer_id, student_id')
        .eq('id', payload.recurringAppointmentId)
        .single()
    if (!rule) return { success: false, error: 'Rotina não encontrada' }
    if (rule.trainer_id !== trainer.id) {
        return { success: false, error: 'Sem permissão' }
    }

    const { error: upsertError } = await supabase
        .from('appointment_exceptions')
        .upsert(
            {
                recurring_appointment_id: payload.recurringAppointmentId,
                trainer_id: trainer.id,
                occurrence_date: payload.occurrenceDate,
                kind: payload.status,
                new_date: null,
                new_start_time: null,
                notes: payload.notes ?? null,
            },
            { onConflict: 'recurring_appointment_id,occurrence_date' },
        )

    if (upsertError) {
        console.error('[markOccurrenceStatus] DB error:', upsertError)
        return { success: false, error: 'Erro ao atualizar status' }
    }

    revalidatePath('/dashboard')
    revalidatePath(`/students/${rule.student_id}`)
    return { success: true }
}
