'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { appointmentMessages } from '@kinevo/shared/constants/notification-messages'
import { buildImmediateInboxItem } from '@/lib/appointments/scheduled-notifications'
import {
    cancelRecurringInputSchema,
    type CancelRecurringInput,
} from './schemas'

export interface CancelRecurringResult {
    success: boolean
    error?: string
}

function todayDateKey(): string {
    const now = new Date()
    const y = now.getUTCFullYear()
    const m = String(now.getUTCMonth() + 1).padStart(2, '0')
    const d = String(now.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
}

/**
 * Encerra uma rotina: seta status='canceled' e ends_on. Ocorrências após
 * ends_on param de aparecer na projeção (helper da Fase 1).
 */
export async function cancelRecurringAppointment(
    input: CancelRecurringInput,
): Promise<CancelRecurringResult> {
    const parsed = cancelRecurringInputSchema.safeParse(input)
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

    const { data: existing } = await supabase
        .from('recurring_appointments')
        .select('id, trainer_id, student_id, day_of_week, group_id')
        .eq('id', payload.id)
        .single()
    if (!existing) return { success: false, error: 'Agendamento não encontrado' }
    if (existing.trainer_id !== trainer.id) {
        return { success: false, error: 'Sem permissão' }
    }

    const endsOn = payload.endsOn ?? todayDateKey()

    const { error: updateError } = await supabase
        .from('recurring_appointments')
        .update({ status: 'canceled', ends_on: endsOn })
        .eq('id', payload.id)

    if (updateError) {
        console.error('[cancelRecurringAppointment] DB error:', updateError)
        return { success: false, error: 'Erro ao encerrar rotina' }
    }

    // Cancela lembretes pendentes + envia push imediato.
    // Se a rotina faz parte de um grupo, NÃO disparamos push aqui — o
    // componente UI que encerra o pacote chama cancelRecurringGroup
    // (que manda 1 push agregado). Quando o trainer cancela um "slot" de
    // pacote pela seção do perfil, mandamos mesmo assim — é uma rotina
    // individual sendo encerrada do ponto de vista do aluno.
    try {
        const { error: cancelReminderError } = await supabaseAdmin
            .from('scheduled_notifications')
            .update({ status: 'canceled' })
            .eq('recurring_appointment_id', payload.id)
            .eq('source', 'appointment_reminder')
            .eq('status', 'pending')
        if (cancelReminderError) {
            console.error(
                '[cancelRecurringAppointment] cancel reminders error:',
                cancelReminderError,
            )
        }

        const msg = appointmentMessages.rotinaCancelada(existing.day_of_week)
        const inbox = buildImmediateInboxItem(
            existing.student_id,
            trainer.id,
            msg,
            {
                recurring_appointment_id: payload.id,
                group_id: existing.group_id,
                event: 'rotina_cancelada',
            },
        )
        const { error: inboxError } = await supabase
            .from('student_inbox_items')
            .insert(inbox)
        if (inboxError) {
            console.error(
                '[cancelRecurringAppointment] inbox insert error:',
                inboxError,
            )
        }
    } catch (err) {
        console.error('[cancelRecurringAppointment] notifications error:', err)
    }

    // Google Calendar sync — DELETE no evento (fire-and-forget).
    void (async () => {
        const { syncDeleteAppointment } = await import(
            '@/lib/google-calendar/sync-service'
        )
        await syncDeleteAppointment(payload.id).catch((err) => {
            console.error('[cancelRecurringAppointment] google sync error:', err)
        })
    })()

    revalidatePath('/dashboard')
    revalidatePath(`/students/${existing.student_id}`)

    return { success: true }
}
