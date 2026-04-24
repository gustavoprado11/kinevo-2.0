'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { appointmentMessages } from '@kinevo/shared/constants/notification-messages'
import {
    buildImmediateInboxItem,
    formatBrDateShort,
} from '@/lib/appointments/scheduled-notifications'
import {
    cancelOccurrenceInputSchema,
    type CancelOccurrenceInput,
} from './schemas'

export interface CancelOccurrenceResult {
    success: boolean
    error?: string
}

/**
 * Cancela uma única ocorrência. Upsert em appointment_exceptions com
 * kind='canceled'.
 */
export async function cancelOccurrence(
    input: CancelOccurrenceInput,
): Promise<CancelOccurrenceResult> {
    const parsed = cancelOccurrenceInputSchema.safeParse(input)
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
        .select('id, trainer_id, student_id, start_time, frequency')
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
                kind: 'canceled',
                new_date: null,
                new_start_time: null,
                notes: payload.notes ?? null,
            },
            { onConflict: 'recurring_appointment_id,occurrence_date' },
        )

    if (upsertError) {
        console.error('[cancelOccurrence] DB error:', upsertError)
        return { success: false, error: 'Erro ao cancelar ocorrência' }
    }

    // Pushes + lembretes — resiliente.
    try {
        const { error: cancelReminderError } = await supabaseAdmin
            .from('scheduled_notifications')
            .update({ status: 'canceled' })
            .eq('recurring_appointment_id', payload.recurringAppointmentId)
            .eq('occurrence_date', payload.occurrenceDate)
            .eq('source', 'appointment_reminder')
            .eq('status', 'pending')
        if (cancelReminderError) {
            console.error(
                '[cancelOccurrence] cancel reminder error:',
                cancelReminderError,
            )
        }

        const dateLabel = formatBrDateShort(payload.occurrenceDate)
        const startHHMM = rule.start_time.slice(0, 5)
        const msg = appointmentMessages.ocorrenciaCancelada(dateLabel, startHHMM)
        const inbox = buildImmediateInboxItem(rule.student_id, trainer.id, msg, {
            recurring_appointment_id: payload.recurringAppointmentId,
            occurrence_date: payload.occurrenceDate,
            event: 'ocorrencia_cancelada',
        })
        const { error: inboxError } = await supabase
            .from('student_inbox_items')
            .insert(inbox)
        if (inboxError) {
            console.error('[cancelOccurrence] inbox insert error:', inboxError)
        }
    } catch (err) {
        console.error('[cancelOccurrence] notifications error:', err)
    }

    // Google Calendar sync — `once` é single event no Google, então cancelar
    // a ocorrência = deletar o evento inteiro. Recorrentes usam instance delete.
    void (async () => {
        if (rule.frequency === 'once') {
            const { syncDeleteAppointment } = await import(
                '@/lib/google-calendar/sync-service'
            )
            await syncDeleteAppointment(payload.recurringAppointmentId).catch(
                (err) => {
                    console.error('[cancelOccurrence] google sync error:', err)
                },
            )
            return
        }
        const { syncCancelOccurrence } = await import(
            '@/lib/google-calendar/sync-service'
        )
        await syncCancelOccurrence(
            payload.recurringAppointmentId,
            payload.occurrenceDate,
        ).catch((err) => {
            console.error('[cancelOccurrence] google sync error:', err)
        })
    })()

    revalidatePath('/dashboard')
    revalidatePath(`/students/${rule.student_id}`)
    return { success: true }
}
