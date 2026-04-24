'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { RecurringAppointment } from '@kinevo/shared/types/appointments'
import { buildReminderRowsForRule } from '@/lib/appointments/scheduled-notifications'
import {
    updateRecurringInputSchema,
    type UpdateRecurringInput,
} from './schemas'

export interface UpdateRecurringResult {
    success: boolean
    error?: string
}

function dayOfWeekFromDateKey(dateKey: string): number {
    const [y, m, d] = dateKey.split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/**
 * Edita uma rotina recorrente existente. Exceções pré-existentes ficam
 * intactas (Seção 4.4 do plano).
 */
export async function updateRecurringAppointment(
    input: UpdateRecurringInput,
): Promise<UpdateRecurringResult> {
    const parsed = updateRecurringInputSchema.safeParse(input)
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
        .select(
            'id, trainer_id, student_id, day_of_week, start_time, duration_minutes, frequency, starts_on, ends_on, notes, group_id',
        )
        .eq('id', payload.id)
        .single()
    if (!existing) return { success: false, error: 'Agendamento não encontrado' }
    if (existing.trainer_id !== trainer.id) {
        return { success: false, error: 'Sem permissão' }
    }

    // If studentId is changing, validate new ownership.
    if (payload.studentId && payload.studentId !== existing.student_id) {
        const { data: newStudent } = await supabase
            .from('students')
            .select('id, coach_id')
            .eq('id', payload.studentId)
            .single()
        if (!newStudent || newStudent.coach_id !== trainer.id) {
            return { success: false, error: 'Aluno inválido' }
        }
    }

    // Re-validate monthly/once consistency using the EFFECTIVE values after merge.
    const effectiveFrequency = payload.frequency ?? existing.frequency
    const effectiveDow = payload.dayOfWeek ?? existing.day_of_week
    const effectiveStartsOn = payload.startsOn ?? existing.starts_on
    const effectiveEndsOn = payload.endsOn !== undefined ? payload.endsOn : existing.ends_on
    if (
        effectiveFrequency === 'monthly' &&
        effectiveDow !== dayOfWeekFromDateKey(effectiveStartsOn)
    ) {
        return {
            success: false,
            error:
                'Para rotinas mensais, o dia da semana precisa coincidir com a data de início.',
        }
    }
    if (effectiveFrequency === 'once') {
        if (effectiveDow !== dayOfWeekFromDateKey(effectiveStartsOn)) {
            return {
                success: false,
                error:
                    'Para agendamento único, o dia da semana precisa coincidir com a data.',
            }
        }
        if (effectiveEndsOn && effectiveEndsOn !== effectiveStartsOn) {
            return {
                success: false,
                error: 'Agendamento único não tem data de término.',
            }
        }
    }

    const updates: Record<string, unknown> = {}
    if (payload.studentId !== undefined) updates.student_id = payload.studentId
    if (payload.dayOfWeek !== undefined) updates.day_of_week = payload.dayOfWeek
    if (payload.startTime !== undefined) updates.start_time = payload.startTime
    if (payload.durationMinutes !== undefined)
        updates.duration_minutes = payload.durationMinutes
    if (payload.frequency !== undefined) updates.frequency = payload.frequency
    if (payload.startsOn !== undefined) updates.starts_on = payload.startsOn
    if (payload.endsOn !== undefined) updates.ends_on = payload.endsOn
    if (payload.notes !== undefined) updates.notes = payload.notes

    if (Object.keys(updates).length === 0) {
        return { success: true }
    }

    const { error: updateError } = await supabase
        .from('recurring_appointments')
        .update(updates)
        .eq('id', payload.id)

    if (updateError) {
        console.error('[updateRecurringAppointment] DB error:', updateError)
        return { success: false, error: 'Erro ao atualizar agendamento' }
    }

    // Se a rotina pertence a um pacote e `notes` foi alterado, propagar a
    // nota pra todas as outras linhas do grupo (decisão UX Fase 3.5: notas
    // são compartilhadas no grupo).
    if (
        existing.group_id &&
        payload.notes !== undefined &&
        payload.notes !== existing.notes
    ) {
        const { error: propagateError } = await supabase
            .from('recurring_appointments')
            .update({ notes: payload.notes })
            .eq('group_id', existing.group_id)
            .eq('trainer_id', trainer.id)
            .neq('id', payload.id)
        if (propagateError) {
            console.error(
                '[updateRecurringAppointment] notes propagation error:',
                propagateError,
            )
            // Não falha a operação principal — a rotina editada já foi
            // atualizada. Apenas loga.
        }
    }

    // Se campos que afetam o horário do push mudaram, rebuild dos lembretes
    // futuros: cancela os pendentes da rotina e insere o novo bloco.
    // Não manda push imediato — trainer tá ajustando, aluno não precisa saber
    // a cada edição.
    const scheduleChanged =
        payload.dayOfWeek !== undefined ||
        payload.startTime !== undefined ||
        payload.durationMinutes !== undefined ||
        payload.frequency !== undefined ||
        payload.startsOn !== undefined ||
        payload.endsOn !== undefined
    if (scheduleChanged) {
        try {
            const { error: cancelReminderError } = await supabaseAdmin
                .from('scheduled_notifications')
                .update({ status: 'canceled' })
                .eq('recurring_appointment_id', payload.id)
                .eq('source', 'appointment_reminder')
                .eq('status', 'pending')
            if (cancelReminderError) {
                console.error(
                    '[updateRecurringAppointment] cancel reminders error:',
                    cancelReminderError,
                )
            }

            const { data: trainerRow } = await supabase
                .from('trainers')
                .select('name')
                .eq('id', trainer.id)
                .single()
            const trainerName = trainerRow?.name ?? 'seu treinador'

            const merged: RecurringAppointment = {
                id: payload.id,
                trainer_id: trainer.id,
                student_id: payload.studentId ?? existing.student_id,
                day_of_week: payload.dayOfWeek ?? existing.day_of_week,
                start_time: payload.startTime ?? existing.start_time,
                duration_minutes:
                    payload.durationMinutes ?? existing.duration_minutes,
                frequency: (payload.frequency ?? existing.frequency) as
                    | 'once'
                    | 'weekly'
                    | 'biweekly'
                    | 'monthly',
                starts_on: payload.startsOn ?? existing.starts_on,
                ends_on: payload.endsOn ?? existing.ends_on,
                status: 'active',
                notes: payload.notes ?? existing.notes,
                group_id: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }
            const reminderRows = buildReminderRowsForRule(
                merged,
                trainerName,
                new Date(),
            )
            if (reminderRows.length > 0) {
                const { error: reminderError } = await supabaseAdmin
                    .from('scheduled_notifications')
                    .upsert(reminderRows, {
                        onConflict:
                            'recurring_appointment_id,occurrence_date,source',
                        ignoreDuplicates: false,
                    })
                if (reminderError) {
                    console.error(
                        '[updateRecurringAppointment] reminders upsert error:',
                        reminderError,
                    )
                }
            }
        } catch (err) {
            console.error(
                '[updateRecurringAppointment] notifications error:',
                err,
            )
        }
    }

    // Google Calendar sync — PATCH no evento (fire-and-forget).
    void (async () => {
        const { syncUpdateAppointment } = await import(
            '@/lib/google-calendar/sync-service'
        )
        await syncUpdateAppointment(payload.id).catch((err) => {
            console.error('[updateRecurringAppointment] google sync error:', err)
        })
    })()

    revalidatePath('/dashboard')
    const studentId = payload.studentId ?? existing.student_id
    revalidatePath(`/students/${studentId}`)

    return { success: true }
}
