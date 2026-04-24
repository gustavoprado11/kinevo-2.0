'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { appointmentMessages } from '@kinevo/shared/constants/notification-messages'
import { buildImmediateInboxItem } from '@/lib/appointments/scheduled-notifications'
import {
    cancelRecurringGroupInputSchema,
    type CancelRecurringGroupInput,
} from './schemas'

export interface CancelRecurringGroupResult {
    success: boolean
    error?: string
    data?: { canceledCount: number }
}

function todayDateKey(): string {
    const now = new Date()
    const y = now.getUTCFullYear()
    const m = String(now.getUTCMonth() + 1).padStart(2, '0')
    const d = String(now.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
}

/**
 * Encerra todas as rotinas ativas de um pacote (group_id). Atualiza status
 * e ends_on em lote. Ownership é garantida via filtro `trainer_id` + RLS.
 */
export async function cancelRecurringGroup(
    input: CancelRecurringGroupInput,
): Promise<CancelRecurringGroupResult> {
    const parsed = cancelRecurringGroupInputSchema.safeParse(input)
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

    // Fetch rules of the group owned by this trainer. We need the
    // student_id for revalidation.
    const { data: rules } = await supabase
        .from('recurring_appointments')
        .select('id, student_id')
        .eq('group_id', payload.groupId)
        .eq('trainer_id', trainer.id)
        .eq('status', 'active')

    if (!rules || rules.length === 0) {
        return { success: false, error: 'Pacote não encontrado' }
    }

    const endsOn = payload.endsOn ?? todayDateKey()

    const { error: updateError } = await supabase
        .from('recurring_appointments')
        .update({ status: 'canceled', ends_on: endsOn })
        .eq('group_id', payload.groupId)
        .eq('trainer_id', trainer.id)
        .eq('status', 'active')

    if (updateError) {
        console.error('[cancelRecurringGroup] DB error:', updateError)
        return { success: false, error: 'Erro ao encerrar pacote' }
    }

    // Cancela todos lembretes pendentes do grupo + UM push imediato agregado.
    try {
        const ruleIds = rules.map((r) => r.id)
        const { error: cancelReminderError } = await supabaseAdmin
            .from('scheduled_notifications')
            .update({ status: 'canceled' })
            .in('recurring_appointment_id', ruleIds)
            .eq('source', 'appointment_reminder')
            .eq('status', 'pending')
        if (cancelReminderError) {
            console.error(
                '[cancelRecurringGroup] cancel reminders error:',
                cancelReminderError,
            )
        }

        const { data: trainerRow } = await supabase
            .from('trainers')
            .select('name')
            .eq('id', trainer.id)
            .single()
        const trainerName = trainerRow?.name ?? 'seu treinador'

        // Um push agregado por aluno (raramente > 1, mas protegemos).
        const studentIds = Array.from(new Set(rules.map((r) => r.student_id)))
        for (const sid of studentIds) {
            const msg = appointmentMessages.pacoteCancelado(trainerName)
            const inbox = buildImmediateInboxItem(sid, trainer.id, msg, {
                group_id: payload.groupId,
                event: 'pacote_cancelado',
            })
            const { error: inboxError } = await supabase
                .from('student_inbox_items')
                .insert(inbox)
            if (inboxError) {
                console.error(
                    '[cancelRecurringGroup] inbox insert error:',
                    inboxError,
                )
            }
        }
    } catch (err) {
        console.error('[cancelRecurringGroup] notifications error:', err)
    }

    // Google Calendar sync — DELETE em cada slot do grupo (fire-and-forget).
    void (async () => {
        const { syncDeleteAppointment } = await import(
            '@/lib/google-calendar/sync-service'
        )
        for (const r of rules) {
            await syncDeleteAppointment(r.id).catch((err) => {
                console.error('[cancelRecurringGroup] google sync error:', err)
            })
        }
    })()

    revalidatePath('/dashboard')
    const studentIds = Array.from(new Set(rules.map((r) => r.student_id)))
    for (const sid of studentIds) {
        revalidatePath(`/students/${sid}`)
    }

    return { success: true, data: { canceledCount: rules.length } }
}
