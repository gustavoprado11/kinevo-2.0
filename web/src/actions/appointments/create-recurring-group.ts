'use server'

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { appointmentMessages } from '@kinevo/shared/constants/notification-messages'
import type { RecurringAppointment } from '@kinevo/shared/types/appointments'
import {
    buildImmediateInboxItem,
    buildReminderRowsForRule,
} from '@/lib/appointments/scheduled-notifications'
import {
    createRecurringGroupInputSchema,
    type CreateRecurringGroupInput,
} from './schemas'

export interface CreateRecurringGroupResult {
    success: boolean
    error?: string
    data?: {
        groupId: string
        appointmentIds: string[]
    }
}

function dayOfWeekFromDateKey(dateKey: string): number {
    const [y, m, d] = dateKey.split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/**
 * Cria um pacote de rotinas recorrentes multi-slot: N linhas em
 * recurring_appointments compartilhando o mesmo `group_id`.
 *
 * - monthly/once + 2+ slots é rejeitado (só suportam 1 dia).
 * - Sobreposição com outras rotinas é permitida por design (aula em dupla).
 */
export async function createRecurringAppointmentGroup(
    input: CreateRecurringGroupInput,
): Promise<CreateRecurringGroupResult> {
    const parsed = createRecurringGroupInputSchema.safeParse(input)
    if (!parsed.success) {
        return {
            success: false,
            error: parsed.error.issues[0]?.message ?? 'Dados inválidos',
        }
    }
    const payload = parsed.data

    if (payload.frequency === 'monthly' && payload.slots.length > 1) {
        return {
            success: false,
            error: 'Rotinas mensais permitem apenas um dia.',
        }
    }

    if (payload.frequency === 'once' && payload.slots.length > 1) {
        return {
            success: false,
            error: 'Agendamento único permite apenas 1 dia.',
        }
    }

    // Monthly + 1 slot: same coherence check as createRecurringAppointment.
    if (payload.frequency === 'monthly' && payload.slots.length === 1) {
        const expectedDow = dayOfWeekFromDateKey(payload.startsOn)
        if (payload.slots[0].dayOfWeek !== expectedDow) {
            return {
                success: false,
                error:
                    'Para rotinas mensais, o dia da semana precisa coincidir com a data de início.',
            }
        }
    }

    // Once + 1 slot: day_of_week = weekday de starts_on + sem ends_on.
    if (payload.frequency === 'once' && payload.slots.length === 1) {
        const expectedDow = dayOfWeekFromDateKey(payload.startsOn)
        if (payload.slots[0].dayOfWeek !== expectedDow) {
            return {
                success: false,
                error:
                    'Para agendamento único, o dia da semana precisa coincidir com a data.',
            }
        }
        if (payload.endsOn && payload.endsOn !== payload.startsOn) {
            return {
                success: false,
                error: 'Agendamento único não tem data de término.',
            }
        }
    }

    // Duplicate detection: same dayOfWeek + same startTime isn't useful.
    const slotKeys = new Set<string>()
    for (const s of payload.slots) {
        const key = `${s.dayOfWeek}::${s.startTime}`
        if (slotKeys.has(key)) {
            return {
                success: false,
                error: 'Há dois horários duplicados no pacote.',
            }
        }
        slotKeys.add(key)
    }

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

    const { data: student } = await supabase
        .from('students')
        .select('id, coach_id')
        .eq('id', payload.studentId)
        .single()
    if (!student) return { success: false, error: 'Aluno não encontrado' }
    if (student.coach_id !== trainer.id) {
        return { success: false, error: 'Sem permissão' }
    }

    // Insert N rows sharing the same group_id.
    const groupId = randomUUID()
    const rows = payload.slots.map((slot) => ({
        trainer_id: trainer.id,
        student_id: payload.studentId,
        day_of_week: slot.dayOfWeek,
        start_time: slot.startTime,
        duration_minutes: slot.durationMinutes,
        frequency: payload.frequency,
        starts_on: payload.startsOn,
        ends_on: payload.endsOn ?? null,
        notes: payload.notes ?? null,
        group_id: groupId,
    }))

    const { data: inserted, error: insertError } = await supabase
        .from('recurring_appointments')
        .insert(rows)
        .select('id')

    if (insertError || !inserted) {
        console.error('[createRecurringAppointmentGroup] DB error:', insertError)
        return { success: false, error: 'Erro ao criar pacote de rotinas' }
    }

    // Google Calendar sync — 1 evento por slot (fire-and-forget).
    void (async () => {
        const { syncCreateAppointment } = await import(
            '@/lib/google-calendar/sync-service'
        )
        for (const row of inserted) {
            await syncCreateAppointment(row.id).catch((err) => {
                console.error('[createRecurringAppointmentGroup] google sync error:', err)
            })
        }
    })()

    // Pushes + lembretes — resiliente, não reverte a criação.
    // 1 push imediato agregado + 1 bloco de lembretes POR slot.
    await enqueueGroupNotifications({
        supabase,
        trainerId: trainer.id,
        studentId: payload.studentId,
        groupId,
        slots: payload.slots,
        frequency: payload.frequency,
        startsOn: payload.startsOn,
        endsOn: payload.endsOn ?? null,
        notes: payload.notes ?? null,
        insertedIds: inserted.map((r) => r.id),
    })

    revalidatePath('/dashboard')
    revalidatePath(`/students/${payload.studentId}`)

    return {
        success: true,
        data: {
            groupId,
            appointmentIds: inserted.map((r) => r.id),
        },
    }
}

type SupabaseFromServer = Awaited<ReturnType<typeof createClient>>

async function enqueueGroupNotifications(args: {
    supabase: SupabaseFromServer
    trainerId: string
    studentId: string
    groupId: string
    slots: Array<{ dayOfWeek: number; startTime: string; durationMinutes: number }>
    frequency: 'once' | 'weekly' | 'biweekly' | 'monthly'
    startsOn: string
    endsOn: string | null
    notes: string | null
    insertedIds: string[]
}) {
    try {
        const { data: trainer } = await args.supabase
            .from('trainers')
            .select('name')
            .eq('id', args.trainerId)
            .single()
        const trainerName = trainer?.name ?? 'seu treinador'

        const now = new Date()
        const allReminders = args.slots.flatMap((slot, idx) => {
            const ruleId = args.insertedIds[idx]
            if (!ruleId) return []
            const rule: RecurringAppointment = {
                id: ruleId,
                trainer_id: args.trainerId,
                student_id: args.studentId,
                day_of_week: slot.dayOfWeek,
                start_time: slot.startTime,
                duration_minutes: slot.durationMinutes,
                frequency: args.frequency,
                starts_on: args.startsOn,
                ends_on: args.endsOn,
                status: 'active',
                notes: args.notes,
                group_id: args.groupId,
                created_at: now.toISOString(),
                updated_at: now.toISOString(),
            }
            return buildReminderRowsForRule(rule, trainerName, now)
        })

        if (allReminders.length > 0) {
            const { error: reminderError } = await supabaseAdmin
                .from('scheduled_notifications')
                .upsert(allReminders, {
                    onConflict: 'recurring_appointment_id,occurrence_date,source',
                    ignoreDuplicates: true,
                })
            if (reminderError) {
                console.error(
                    '[createRecurringAppointmentGroup] reminders upsert error:',
                    reminderError,
                )
            }
        }

        // Push imediato agregado — 1 só, não N.
        const immediateMsg = appointmentMessages.pacoteCriado(
            args.slots.map((s) => s.dayOfWeek),
        )
        const inbox = buildImmediateInboxItem(
            args.studentId,
            args.trainerId,
            immediateMsg,
            {
                group_id: args.groupId,
                recurring_appointment_ids: args.insertedIds,
                event: 'pacote_criado',
            },
        )
        const { error: inboxError } = await args.supabase
            .from('student_inbox_items')
            .insert(inbox)
        if (inboxError) {
            console.error(
                '[createRecurringAppointmentGroup] inbox insert error:',
                inboxError,
            )
        }
    } catch (err) {
        console.error('[createRecurringAppointmentGroup] notifications error:', err)
    }
}
