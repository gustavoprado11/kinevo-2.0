'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { appointmentMessages } from '@kinevo/shared/constants/notification-messages'
import type { RecurringAppointment } from '@kinevo/shared/types/appointments'
import {
    buildImmediateInboxItem,
    buildReminderRowsForRule,
    computeReminderAt,
    formatBrDateShort,
} from '@/lib/appointments/scheduled-notifications'
import {
    rescheduleOccurrenceInputSchema,
    type RescheduleOccurrenceInput,
} from './schemas'

export interface RescheduleOccurrenceResult {
    success: boolean
    error?: string
    data?: {
        /** Only present when scope='this_and_future' (the newly created rule). */
        newRecurringAppointmentId?: string
    }
}

function parseDateKey(key: string): Date {
    const [y, m, d] = key.split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, d))
}

function toDateKey(d: Date): string {
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, '0')
    const day = String(d.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
}

function addDays(d: Date, days: number): Date {
    const r = new Date(d)
    r.setUTCDate(r.getUTCDate() + days)
    return r
}

/**
 * Remarca uma ocorrência.
 *
 * `only_this`: upsert em appointment_exceptions (kind='rescheduled').
 * `this_and_future`: encerra a rotina original (ends_on = originalDate - 1 dia)
 *   e cria nova rotina começando em newDate com os novos valores.
 */
export async function rescheduleOccurrence(
    input: RescheduleOccurrenceInput,
): Promise<RescheduleOccurrenceResult> {
    const parsed = rescheduleOccurrenceInputSchema.safeParse(input)
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
        .select(
            'id, trainer_id, student_id, day_of_week, duration_minutes, frequency, notes',
        )
        .eq('id', payload.recurringAppointmentId)
        .single()
    if (!rule) return { success: false, error: 'Rotina não encontrada' }
    if (rule.trainer_id !== trainer.id) {
        return { success: false, error: 'Sem permissão' }
    }

    if (payload.scope === 'only_this') {
        const { error: upsertError } = await supabase
            .from('appointment_exceptions')
            .upsert(
                {
                    recurring_appointment_id: payload.recurringAppointmentId,
                    trainer_id: trainer.id,
                    occurrence_date: payload.originalDate,
                    kind: 'rescheduled',
                    new_date: payload.newDate,
                    new_start_time: payload.newStartTime,
                    notes: payload.notes ?? null,
                },
                { onConflict: 'recurring_appointment_id,occurrence_date' },
            )

        if (upsertError) {
            console.error('[rescheduleOccurrence only_this] DB error:', upsertError)
            return { success: false, error: 'Erro ao remarcar' }
        }

        // Pushes + lembretes: atualiza scheduled_notifications do slot e manda imediato
        try {
            const newReminderAt = computeReminderAt(payload.newDate, payload.newStartTime)
            const { error: updateError } = await supabaseAdmin
                .from('scheduled_notifications')
                .update({
                    scheduled_for: newReminderAt.toISOString(),
                    status: 'pending',
                })
                .eq('recurring_appointment_id', payload.recurringAppointmentId)
                .eq('occurrence_date', payload.originalDate)
                .eq('source', 'appointment_reminder')
                .eq('status', 'pending')
            if (updateError) {
                console.error(
                    '[rescheduleOccurrence only_this] reminder update error:',
                    updateError,
                )
            }

            const dateLabel = formatBrDateShort(payload.newDate)
            const msg = appointmentMessages.ocorrenciaRemarcada(
                dateLabel,
                payload.newStartTime,
            )
            const inbox = buildImmediateInboxItem(
                rule.student_id,
                trainer.id,
                msg,
                {
                    recurring_appointment_id: payload.recurringAppointmentId,
                    original_date: payload.originalDate,
                    new_date: payload.newDate,
                    new_start_time: payload.newStartTime,
                    event: 'ocorrencia_remarcada',
                },
            )
            const { error: inboxError } = await supabase
                .from('student_inbox_items')
                .insert(inbox)
            if (inboxError) {
                console.error(
                    '[rescheduleOccurrence only_this] inbox insert error:',
                    inboxError,
                )
            }
        } catch (err) {
            console.error('[rescheduleOccurrence only_this] notifications error:', err)
        }

        // Google Calendar sync:
        //  - Recorrente → instance override (PATCH numa ocorrência específica)
        //  - Once → PATCH do evento inteiro (single event, não tem "outras"
        //    instâncias). Atualizamos starts_on/start_time/day_of_week na
        //    própria rotina pra que `syncUpdateAppointment` gere o payload
        //    com os valores novos (ele lê de `recurring_appointments`).
        void (async () => {
            if (rule.frequency === 'once') {
                const newDow = parseDateKey(payload.newDate).getUTCDay()
                const { error: updateRuleError } = await supabaseAdmin
                    .from('recurring_appointments')
                    .update({
                        starts_on: payload.newDate,
                        start_time: payload.newStartTime,
                        day_of_week: newDow,
                    })
                    .eq('id', payload.recurringAppointmentId)
                if (updateRuleError) {
                    console.error(
                        '[rescheduleOccurrence only_this once] update rule error:',
                        updateRuleError,
                    )
                    return
                }
                const { syncUpdateAppointment } = await import(
                    '@/lib/google-calendar/sync-service'
                )
                await syncUpdateAppointment(payload.recurringAppointmentId).catch(
                    (err) => {
                        console.error(
                            '[rescheduleOccurrence only_this once] google sync error:',
                            err,
                        )
                    },
                )
                return
            }
            const { syncRescheduleOccurrence } = await import(
                '@/lib/google-calendar/sync-service'
            )
            await syncRescheduleOccurrence(payload.recurringAppointmentId, {
                occurrence_date: payload.originalDate,
                new_date: payload.newDate,
                new_start_time: payload.newStartTime,
            }).catch((err) => {
                console.error('[rescheduleOccurrence only_this] google sync error:', err)
            })
        })()

        revalidatePath('/dashboard')
        revalidatePath(`/students/${rule.student_id}`)
        return { success: true }
    }

    // scope === 'this_and_future'
    const endsOn = toDateKey(addDays(parseDateKey(payload.originalDate), -1))
    const newDow = parseDateKey(payload.newDate).getUTCDay()

    const { error: endError } = await supabase
        .from('recurring_appointments')
        .update({ ends_on: endsOn })
        .eq('id', payload.recurringAppointmentId)
    if (endError) {
        console.error('[rescheduleOccurrence this_and_future end] DB error:', endError)
        return { success: false, error: 'Erro ao encerrar rotina original' }
    }

    const { data: created, error: insertError } = await supabase
        .from('recurring_appointments')
        .insert({
            trainer_id: trainer.id,
            student_id: rule.student_id,
            day_of_week: newDow,
            start_time: payload.newStartTime,
            duration_minutes: rule.duration_minutes,
            frequency: rule.frequency,
            starts_on: payload.newDate,
            ends_on: null,
            status: 'active',
            notes: rule.notes,
        })
        .select('id')
        .single()

    if (insertError || !created) {
        console.error('[rescheduleOccurrence this_and_future insert] DB error:', insertError)
        return { success: false, error: 'Erro ao criar nova rotina' }
    }

    // Cancela lembretes pendentes da rotina antiga cuja data é >= originalDate,
    // gera lembretes da rotina nova, e envia push imediato de remarcação.
    try {
        const { error: cancelError } = await supabaseAdmin
            .from('scheduled_notifications')
            .update({ status: 'canceled' })
            .eq('recurring_appointment_id', payload.recurringAppointmentId)
            .eq('source', 'appointment_reminder')
            .eq('status', 'pending')
            .gte('occurrence_date', payload.originalDate)
        if (cancelError) {
            console.error(
                '[rescheduleOccurrence this_and_future] cancel reminders error:',
                cancelError,
            )
        }

        const now = new Date()
        const newRule: RecurringAppointment = {
            id: created.id,
            trainer_id: trainer.id,
            student_id: rule.student_id,
            day_of_week: newDow,
            start_time: payload.newStartTime,
            duration_minutes: rule.duration_minutes,
            frequency: rule.frequency,
            starts_on: payload.newDate,
            ends_on: null,
            status: 'active',
            notes: rule.notes,
            group_id: null,
            created_at: now.toISOString(),
            updated_at: now.toISOString(),
        }
        const { data: trainerRow } = await supabase
            .from('trainers')
            .select('name')
            .eq('id', trainer.id)
            .single()
        const trainerName = trainerRow?.name ?? 'seu treinador'
        const reminderRows = buildReminderRowsForRule(newRule, trainerName, now)
        if (reminderRows.length > 0) {
            const { error: reminderError } = await supabaseAdmin
                .from('scheduled_notifications')
                .upsert(reminderRows, {
                    onConflict: 'recurring_appointment_id,occurrence_date,source',
                    ignoreDuplicates: true,
                })
            if (reminderError) {
                console.error(
                    '[rescheduleOccurrence this_and_future] reminders insert error:',
                    reminderError,
                )
            }
        }

        const dateLabel = formatBrDateShort(payload.newDate)
        const msg = appointmentMessages.ocorrenciaRemarcada(
            dateLabel,
            payload.newStartTime,
        )
        const inbox = buildImmediateInboxItem(rule.student_id, trainer.id, msg, {
            original_recurring_appointment_id: payload.recurringAppointmentId,
            new_recurring_appointment_id: created.id,
            original_date: payload.originalDate,
            new_date: payload.newDate,
            new_start_time: payload.newStartTime,
            scope: 'this_and_future',
            event: 'ocorrencia_remarcada',
        })
        const { error: inboxError } = await supabase
            .from('student_inbox_items')
            .insert(inbox)
        if (inboxError) {
            console.error(
                '[rescheduleOccurrence this_and_future] inbox insert error:',
                inboxError,
            )
        }
    } catch (err) {
        console.error('[rescheduleOccurrence this_and_future] notifications error:', err)
    }

    // Google Calendar sync — PATCH UNTIL na rotina antiga, CREATE na nova.
    void (async () => {
        const { syncUpdateAppointment, syncCreateAppointment } = await import(
            '@/lib/google-calendar/sync-service'
        )
        await syncUpdateAppointment(payload.recurringAppointmentId).catch((err) => {
            console.error(
                '[rescheduleOccurrence this_and_future] google sync update error:',
                err,
            )
        })
        await syncCreateAppointment(created.id).catch((err) => {
            console.error(
                '[rescheduleOccurrence this_and_future] google sync create error:',
                err,
            )
        })
    })()

    revalidatePath('/dashboard')
    revalidatePath(`/students/${rule.student_id}`)
    return {
        success: true,
        data: { newRecurringAppointmentId: created.id },
    }
}
