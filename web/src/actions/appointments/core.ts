/**
 * Appointments — núcleo compartilhado (server-only, SEM 'use server').
 *
 * Cada função recebe um client Supabase + o trainerId já resolvido e executa
 * toda a lógica de negócio (incluindo lembretes, inbox e Google Calendar sync).
 * Os arquivos de action ('use server') são wrappers finos: resolvem auth →
 * trainer.id e delegam aqui. As tools MCP chamam estas funções direto, passando
 * o admin client + o trainerId do token OAuth. Garante PARIDADE total entre os
 * dois caminhos sem duplicar lógica.
 */

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@kinevo/shared/types/database'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { runAfterResponse } from '@/lib/run-after-response'
import { expandAppointments } from '@kinevo/shared/utils/appointments-projection'
import { appointmentMessages } from '@kinevo/shared/constants/notification-messages'
import type {
    AppointmentException,
    AppointmentFrequency,
    AppointmentOccurrence,
    RecurringAppointment,
} from '@kinevo/shared/types/appointments'
import {
    buildImmediateInboxItem,
    buildReminderRowsForRule,
    computeReminderAt,
    formatBrDateShort,
} from '@/lib/appointments/scheduled-notifications'
import {
    cancelOccurrenceInputSchema,
    type CancelOccurrenceInput,
    cancelRecurringInputSchema,
    type CancelRecurringInput,
    createRecurringInputSchema,
    type CreateRecurringInput,
    listAppointmentsInputSchema,
    type ListAppointmentsInput,
    markOccurrenceStatusInputSchema,
    type MarkOccurrenceStatusInput,
    rescheduleOccurrenceInputSchema,
    type RescheduleOccurrenceInput,
} from './schemas'

export type DBClient = SupabaseClient<Database>

// ----------------------------------------------------------------------------
// Result types (movidos das actions; re-exportados por elas p/ retrocompat)
// ----------------------------------------------------------------------------

export interface ListAppointmentsResult {
    success: boolean
    error?: string
    data?: AppointmentOccurrence[]
}
export interface CreateRecurringResult {
    success: boolean
    error?: string
    data?: { id: string }
}
export interface RescheduleOccurrenceResult {
    success: boolean
    error?: string
    data?: { newRecurringAppointmentId?: string }
}
export interface CancelOccurrenceResult {
    success: boolean
    error?: string
}
export interface MarkOccurrenceStatusResult {
    success: boolean
    error?: string
}
export interface CancelRecurringResult {
    success: boolean
    error?: string
}

// ----------------------------------------------------------------------------
// Date helpers (UTC, date-key "YYYY-MM-DD")
// ----------------------------------------------------------------------------

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
/** 0=Sun … 6=Sat — same convention as Date.getDay() and the DB. */
function dayOfWeekFromDateKey(dateKey: string): number {
    const [y, m, d] = dateKey.split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}
function todayDateKey(): string {
    // AG4: "hoje" do NEGÓCIO é São Paulo — toDateKey(new Date()) usava o fuso
    // do runtime (UTC na Vercel): encerrar uma rotina entre 21h e 00h BRT
    // gravava ends_on de AMANHÃ e deixava 1 dia extra de treinos ativos.
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

// ----------------------------------------------------------------------------
// list
// ----------------------------------------------------------------------------

export async function listAppointmentsCore(
    supabase: DBClient,
    trainerId: string,
    input: ListAppointmentsInput,
): Promise<ListAppointmentsResult> {
    const parsed = listAppointmentsInputSchema.safeParse(input)
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
    }
    const { rangeStart, rangeEnd } = parsed.data

    const rangeStartDate = parseDateKey(rangeStart)
    const rangeEndDate = parseDateKey(rangeEnd)
    if (rangeEndDate.getTime() < rangeStartDate.getTime()) {
        return { success: false, error: 'rangeEnd deve ser >= rangeStart' }
    }

    const { data: rulesRows, error: rulesError } = await supabase
        .from('recurring_appointments')
        .select('*')
        .eq('trainer_id', trainerId)
        .eq('status', 'active')
        .lte('starts_on', rangeEnd)
        .or(`ends_on.is.null,ends_on.gte.${rangeStart}`)

    if (rulesError) {
        console.error('[listAppointmentsCore] rules error:', rulesError)
        return { success: false, error: 'Erro ao carregar agendamentos' }
    }

    const rules = (rulesRows ?? []) as unknown as RecurringAppointment[]

    const ruleIds = rules.map((r) => r.id)
    let exceptions: AppointmentException[] = []
    if (ruleIds.length > 0) {
        const { data: excRows, error: excError } = await supabase
            .from('appointment_exceptions')
            .select('*')
            .eq('trainer_id', trainerId)
            .in('recurring_appointment_id', ruleIds)
            .or(
                `and(occurrence_date.gte.${rangeStart},occurrence_date.lte.${rangeEnd}),and(new_date.gte.${rangeStart},new_date.lte.${rangeEnd})`,
            )

        if (excError) {
            console.error('[listAppointmentsCore] exceptions error:', excError)
            return { success: false, error: 'Erro ao carregar ocorrências' }
        }
        exceptions = (excRows ?? []) as unknown as AppointmentException[]
    }

    const occurrences = expandAppointments(rules, exceptions, rangeStartDate, rangeEndDate)
    return { success: true, data: occurrences }
}

// ----------------------------------------------------------------------------
// create recurring (also covers 'once')
// ----------------------------------------------------------------------------

export async function createRecurringCore(
    supabase: DBClient,
    trainerId: string,
    input: CreateRecurringInput,
): Promise<CreateRecurringResult> {
    const parsed = createRecurringInputSchema.safeParse(input)
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
    }
    const payload = parsed.data

    if (payload.frequency === 'monthly') {
        const expectedDow = dayOfWeekFromDateKey(payload.startsOn)
        if (payload.dayOfWeek !== expectedDow) {
            return { success: false, error: 'Para rotinas mensais, o dia da semana precisa coincidir com a data de início.' }
        }
    }
    if (payload.frequency === 'once') {
        const expectedDow = dayOfWeekFromDateKey(payload.startsOn)
        if (payload.dayOfWeek !== expectedDow) {
            return { success: false, error: 'Para agendamento único, o dia da semana precisa coincidir com a data.' }
        }
        if (payload.endsOn && payload.endsOn !== payload.startsOn) {
            return { success: false, error: 'Agendamento único não tem data de término.' }
        }
    }

    // Ownership check (defense-in-depth — RLS já bloqueia quando o client respeita RLS).
    const { data: student } = await supabase
        .from('students')
        .select('id, coach_id, name')
        .eq('id', payload.studentId)
        .single()
    if (!student) return { success: false, error: 'Aluno não encontrado' }
    if (student.coach_id !== trainerId) {
        return { success: false, error: 'Sem permissão' }
    }

    const { data: inserted, error: insertError } = await supabase
        .from('recurring_appointments')
        .insert({
            trainer_id: trainerId,
            student_id: payload.studentId,
            day_of_week: payload.dayOfWeek,
            start_time: payload.startTime,
            duration_minutes: payload.durationMinutes,
            frequency: payload.frequency,
            starts_on: payload.startsOn,
            ends_on: payload.endsOn ?? null,
            notes: payload.notes ?? null,
        })
        .select('id')
        .single()

    if (insertError || !inserted) {
        console.error('[createRecurringCore] DB error:', insertError)
        return { success: false, error: 'Erro ao criar agendamento' }
    }

    // AG2: after() — fire-and-forget congelava com a lambda e o sync podia
    // nunca rodar (o cron reconcile-google-sync cobre o que ainda escapar).
    runAfterResponse(async () => {
        const { syncCreateAppointment } = await import('@/lib/google-calendar/sync-service')
        await syncCreateAppointment(inserted.id).catch((err) => {
            console.error('[createRecurringCore] google sync error:', err)
        })
    })

    await enqueueAppointmentNotifications({
        supabase,
        ruleId: inserted.id,
        trainerId,
        studentId: payload.studentId,
        dayOfWeek: payload.dayOfWeek,
        startTime: payload.startTime,
        durationMinutes: payload.durationMinutes,
        frequency: payload.frequency,
        startsOn: payload.startsOn,
        endsOn: payload.endsOn ?? null,
        notes: payload.notes ?? null,
    })

    revalidatePath('/dashboard')
    revalidatePath(`/students/${payload.studentId}`)
    return { success: true, data: { id: inserted.id } }
}

async function enqueueAppointmentNotifications(args: {
    supabase: DBClient
    ruleId: string
    trainerId: string
    studentId: string
    dayOfWeek: number
    startTime: string
    durationMinutes: number
    frequency: AppointmentFrequency
    startsOn: string
    endsOn: string | null
    notes: string | null
}) {
    try {
        const { data: trainer } = await args.supabase
            .from('trainers')
            .select('name')
            .eq('id', args.trainerId)
            .single()
        const trainerName = trainer?.name ?? 'seu treinador'

        const rule: RecurringAppointment = {
            id: args.ruleId,
            trainer_id: args.trainerId,
            student_id: args.studentId,
            day_of_week: args.dayOfWeek,
            start_time: args.startTime,
            duration_minutes: args.durationMinutes,
            frequency: args.frequency,
            starts_on: args.startsOn,
            ends_on: args.endsOn,
            status: 'active',
            notes: args.notes,
            group_id: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        }

        const reminderRows = buildReminderRowsForRule(rule, trainerName, new Date())
        if (reminderRows.length > 0) {
            const { error: reminderError } = await supabaseAdmin
                .from('scheduled_notifications')
                .upsert(reminderRows, {
                    onConflict: 'recurring_appointment_id,occurrence_date,source',
                    ignoreDuplicates: true,
                })
            if (reminderError) {
                console.error('[createRecurringCore] reminders upsert error:', reminderError)
            }
        }

        const immediateMsg = appointmentMessages.rotinaCriada(args.dayOfWeek, args.startTime.slice(0, 5))
        const inbox = buildImmediateInboxItem(args.studentId, args.trainerId, immediateMsg, {
            recurring_appointment_id: args.ruleId,
            event: 'rotina_criada',
        })
        const { error: inboxError } = await args.supabase.from('student_inbox_items').insert(inbox)
        if (inboxError) {
            console.error('[createRecurringCore] inbox insert error:', inboxError)
        }
    } catch (err) {
        console.error('[createRecurringCore] notifications error:', err)
    }
}

// ----------------------------------------------------------------------------
// reschedule occurrence
// ----------------------------------------------------------------------------

export async function rescheduleOccurrenceCore(
    supabase: DBClient,
    trainerId: string,
    input: RescheduleOccurrenceInput,
): Promise<RescheduleOccurrenceResult> {
    const parsed = rescheduleOccurrenceInputSchema.safeParse(input)
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
    }
    const payload = parsed.data

    const { data: rule } = await supabase
        .from('recurring_appointments')
        .select('id, trainer_id, student_id, day_of_week, duration_minutes, frequency, notes')
        .eq('id', payload.recurringAppointmentId)
        .single()
    if (!rule) return { success: false, error: 'Rotina não encontrada' }
    if (rule.trainer_id !== trainerId) {
        return { success: false, error: 'Sem permissão' }
    }

    if (payload.scope === 'only_this') {
        const { error: upsertError } = await supabase
            .from('appointment_exceptions')
            .upsert(
                {
                    recurring_appointment_id: payload.recurringAppointmentId,
                    trainer_id: trainerId,
                    occurrence_date: payload.originalDate,
                    kind: 'rescheduled',
                    new_date: payload.newDate,
                    new_start_time: payload.newStartTime,
                    notes: payload.notes ?? null,
                },
                { onConflict: 'recurring_appointment_id,occurrence_date' },
            )

        if (upsertError) {
            console.error('[rescheduleOccurrenceCore only_this] DB error:', upsertError)
            return { success: false, error: 'Erro ao remarcar' }
        }

        try {
            const newReminderAt = computeReminderAt(payload.newDate, payload.newStartTime)
            const { error: updateError } = await supabaseAdmin
                .from('scheduled_notifications')
                .update({ scheduled_for: newReminderAt.toISOString(), status: 'pending' })
                .eq('recurring_appointment_id', payload.recurringAppointmentId)
                .eq('occurrence_date', payload.originalDate)
                .eq('source', 'appointment_reminder')
                .eq('status', 'pending')
            if (updateError) {
                console.error('[rescheduleOccurrenceCore only_this] reminder update error:', updateError)
            }

            const dateLabel = formatBrDateShort(payload.newDate)
            const msg = appointmentMessages.ocorrenciaRemarcada(dateLabel, payload.newStartTime)
            const inbox = buildImmediateInboxItem(rule.student_id, trainerId, msg, {
                recurring_appointment_id: payload.recurringAppointmentId,
                original_date: payload.originalDate,
                new_date: payload.newDate,
                new_start_time: payload.newStartTime,
                event: 'ocorrencia_remarcada',
            })
            const { error: inboxError } = await supabase.from('student_inbox_items').insert(inbox)
            if (inboxError) {
                console.error('[rescheduleOccurrenceCore only_this] inbox insert error:', inboxError)
            }
        } catch (err) {
            console.error('[rescheduleOccurrenceCore only_this] notifications error:', err)
        }

        // AG2: este bloco também MUTA a regra (once) — com fire-and-forget a
        // mutação podia congelar junto com a lambda e nunca persistir.
        runAfterResponse(async () => {
            if (rule.frequency === 'once') {
                const newDow = parseDateKey(payload.newDate).getUTCDay()
                const { error: updateRuleError } = await supabaseAdmin
                    .from('recurring_appointments')
                    .update({ starts_on: payload.newDate, start_time: payload.newStartTime, day_of_week: newDow })
                    .eq('id', payload.recurringAppointmentId)
                if (updateRuleError) {
                    console.error('[rescheduleOccurrenceCore only_this once] update rule error:', updateRuleError)
                    return
                }
                // AG6: a regra `once` MOVE starts_on — a exceção rescheduled
                // recém-upsertada (e as de remarcações anteriores) vira órfã e,
                // se o trainer remarcar de volta pra data original, a exceção
                // velha redirecionava a ocorrência de novo (A→B→A reaparecia
                // em B). Regra movida = exceções antigas não fazem sentido.
                const { error: cleanupError } = await supabaseAdmin
                    .from('appointment_exceptions')
                    .delete()
                    .eq('recurring_appointment_id', payload.recurringAppointmentId)
                    .eq('kind', 'rescheduled')
                if (cleanupError) {
                    console.error('[rescheduleOccurrenceCore only_this once] exception cleanup error:', cleanupError)
                }
                const { syncUpdateAppointment } = await import('@/lib/google-calendar/sync-service')
                await syncUpdateAppointment(payload.recurringAppointmentId).catch((err) => {
                    console.error('[rescheduleOccurrenceCore only_this once] google sync error:', err)
                })
                return
            }
            const { syncRescheduleOccurrence } = await import('@/lib/google-calendar/sync-service')
            await syncRescheduleOccurrence(payload.recurringAppointmentId, {
                occurrence_date: payload.originalDate,
                new_date: payload.newDate,
                new_start_time: payload.newStartTime,
            }).catch((err) => {
                console.error('[rescheduleOccurrenceCore only_this] google sync error:', err)
            })
        })

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
        console.error('[rescheduleOccurrenceCore this_and_future end] DB error:', endError)
        return { success: false, error: 'Erro ao encerrar rotina original' }
    }

    const { data: created, error: insertError } = await supabase
        .from('recurring_appointments')
        .insert({
            trainer_id: trainerId,
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
        console.error('[rescheduleOccurrenceCore this_and_future insert] DB error:', insertError)
        return { success: false, error: 'Erro ao criar nova rotina' }
    }

    try {
        const { error: cancelError } = await supabaseAdmin
            .from('scheduled_notifications')
            .update({ status: 'canceled' })
            .eq('recurring_appointment_id', payload.recurringAppointmentId)
            .eq('source', 'appointment_reminder')
            .eq('status', 'pending')
            .gte('occurrence_date', payload.originalDate)
        if (cancelError) {
            console.error('[rescheduleOccurrenceCore this_and_future] cancel reminders error:', cancelError)
        }

        const now = new Date()
        const newRule: RecurringAppointment = {
            id: created.id,
            trainer_id: trainerId,
            student_id: rule.student_id,
            day_of_week: newDow,
            start_time: payload.newStartTime,
            duration_minutes: rule.duration_minutes,
            frequency: rule.frequency as AppointmentFrequency,
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
            .eq('id', trainerId)
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
                console.error('[rescheduleOccurrenceCore this_and_future] reminders insert error:', reminderError)
            }
        }

        const dateLabel = formatBrDateShort(payload.newDate)
        const msg = appointmentMessages.ocorrenciaRemarcada(dateLabel, payload.newStartTime)
        const inbox = buildImmediateInboxItem(rule.student_id, trainerId, msg, {
            original_recurring_appointment_id: payload.recurringAppointmentId,
            new_recurring_appointment_id: created.id,
            original_date: payload.originalDate,
            new_date: payload.newDate,
            new_start_time: payload.newStartTime,
            scope: 'this_and_future',
            event: 'ocorrencia_remarcada',
        })
        const { error: inboxError } = await supabase.from('student_inbox_items').insert(inbox)
        if (inboxError) {
            console.error('[rescheduleOccurrenceCore this_and_future] inbox insert error:', inboxError)
        }
    } catch (err) {
        console.error('[rescheduleOccurrenceCore this_and_future] notifications error:', err)
    }

    runAfterResponse(async () => {
        const { syncUpdateAppointment, syncCreateAppointment } = await import('@/lib/google-calendar/sync-service')
        await syncUpdateAppointment(payload.recurringAppointmentId).catch((err) => {
            console.error('[rescheduleOccurrenceCore this_and_future] google sync update error:', err)
        })
        await syncCreateAppointment(created.id).catch((err) => {
            console.error('[rescheduleOccurrenceCore this_and_future] google sync create error:', err)
        })
    })

    revalidatePath('/dashboard')
    revalidatePath(`/students/${rule.student_id}`)
    return { success: true, data: { newRecurringAppointmentId: created.id } }
}

// ----------------------------------------------------------------------------
// cancel occurrence
// ----------------------------------------------------------------------------

export async function cancelOccurrenceCore(
    supabase: DBClient,
    trainerId: string,
    input: CancelOccurrenceInput,
): Promise<CancelOccurrenceResult> {
    const parsed = cancelOccurrenceInputSchema.safeParse(input)
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
    }
    const payload = parsed.data

    const { data: rule } = await supabase
        .from('recurring_appointments')
        .select('id, trainer_id, student_id, start_time, frequency')
        .eq('id', payload.recurringAppointmentId)
        .single()
    if (!rule) return { success: false, error: 'Rotina não encontrada' }
    if (rule.trainer_id !== trainerId) {
        return { success: false, error: 'Sem permissão' }
    }

    const { error: upsertError } = await supabase
        .from('appointment_exceptions')
        .upsert(
            {
                recurring_appointment_id: payload.recurringAppointmentId,
                trainer_id: trainerId,
                occurrence_date: payload.occurrenceDate,
                kind: 'canceled',
                new_date: null,
                new_start_time: null,
                notes: payload.notes ?? null,
            },
            { onConflict: 'recurring_appointment_id,occurrence_date' },
        )

    if (upsertError) {
        console.error('[cancelOccurrenceCore] DB error:', upsertError)
        return { success: false, error: 'Erro ao cancelar ocorrência' }
    }

    try {
        const { error: cancelReminderError } = await supabaseAdmin
            .from('scheduled_notifications')
            .update({ status: 'canceled' })
            .eq('recurring_appointment_id', payload.recurringAppointmentId)
            .eq('occurrence_date', payload.occurrenceDate)
            .eq('source', 'appointment_reminder')
            .eq('status', 'pending')
        if (cancelReminderError) {
            console.error('[cancelOccurrenceCore] cancel reminder error:', cancelReminderError)
        }

        const dateLabel = formatBrDateShort(payload.occurrenceDate)
        const startHHMM = rule.start_time.slice(0, 5)
        const msg = appointmentMessages.ocorrenciaCancelada(dateLabel, startHHMM)
        const inbox = buildImmediateInboxItem(rule.student_id, trainerId, msg, {
            recurring_appointment_id: payload.recurringAppointmentId,
            occurrence_date: payload.occurrenceDate,
            event: 'ocorrencia_cancelada',
        })
        const { error: inboxError } = await supabase.from('student_inbox_items').insert(inbox)
        if (inboxError) {
            console.error('[cancelOccurrenceCore] inbox insert error:', inboxError)
        }
    } catch (err) {
        console.error('[cancelOccurrenceCore] notifications error:', err)
    }

    runAfterResponse(async () => {
        if (rule.frequency === 'once') {
            const { syncDeleteAppointment } = await import('@/lib/google-calendar/sync-service')
            await syncDeleteAppointment(payload.recurringAppointmentId).catch((err) => {
                console.error('[cancelOccurrenceCore] google sync error:', err)
            })
            return
        }
        const { syncCancelOccurrence } = await import('@/lib/google-calendar/sync-service')
        await syncCancelOccurrence(payload.recurringAppointmentId, payload.occurrenceDate).catch((err) => {
            console.error('[cancelOccurrenceCore] google sync error:', err)
        })
    })

    revalidatePath('/dashboard')
    revalidatePath(`/students/${rule.student_id}`)
    return { success: true }
}

// ----------------------------------------------------------------------------
// mark occurrence status (completed / no_show)
// ----------------------------------------------------------------------------

export async function markOccurrenceStatusCore(
    supabase: DBClient,
    trainerId: string,
    input: MarkOccurrenceStatusInput,
): Promise<MarkOccurrenceStatusResult> {
    const parsed = markOccurrenceStatusInputSchema.safeParse(input)
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
    }
    const payload = parsed.data

    const { data: rule } = await supabase
        .from('recurring_appointments')
        .select('id, trainer_id, student_id')
        .eq('id', payload.recurringAppointmentId)
        .single()
    if (!rule) return { success: false, error: 'Rotina não encontrada' }
    if (rule.trainer_id !== trainerId) {
        return { success: false, error: 'Sem permissão' }
    }

    // D1: presença numa ocorrência REMARCADA preserva a remarcação — antes o
    // upsert zerava new_date/new_start_time e o atendimento "voltava" pro dia
    // original com o status (histórico no dia errado). A projeção posiciona
    // completed/no_show em new_date quando presente.
    const { data: existingExc } = await supabase
        .from('appointment_exceptions')
        .select('new_date, new_start_time')
        .eq('recurring_appointment_id', payload.recurringAppointmentId)
        .eq('occurrence_date', payload.occurrenceDate)
        .maybeSingle()

    const { error: upsertError } = await supabase
        .from('appointment_exceptions')
        .upsert(
            {
                recurring_appointment_id: payload.recurringAppointmentId,
                trainer_id: trainerId,
                occurrence_date: payload.occurrenceDate,
                kind: payload.status,
                new_date: existingExc?.new_date ?? null,
                new_start_time: existingExc?.new_start_time ?? null,
                notes: payload.notes ?? null,
            },
            { onConflict: 'recurring_appointment_id,occurrence_date' },
        )

    if (upsertError) {
        console.error('[markOccurrenceStatusCore] DB error:', upsertError)
        return { success: false, error: 'Erro ao atualizar status' }
    }

    revalidatePath('/dashboard')
    revalidatePath(`/students/${rule.student_id}`)
    return { success: true }
}

// ----------------------------------------------------------------------------
// cancel recurring (end whole series)
// ----------------------------------------------------------------------------

export async function cancelRecurringCore(
    supabase: DBClient,
    trainerId: string,
    input: CancelRecurringInput,
): Promise<CancelRecurringResult> {
    const parsed = cancelRecurringInputSchema.safeParse(input)
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
    }
    const payload = parsed.data

    const { data: existing } = await supabase
        .from('recurring_appointments')
        .select('id, trainer_id, student_id, day_of_week, group_id')
        .eq('id', payload.id)
        .single()
    if (!existing) return { success: false, error: 'Agendamento não encontrado' }
    if (existing.trainer_id !== trainerId) {
        return { success: false, error: 'Sem permissão' }
    }

    const endsOn = payload.endsOn ?? todayDateKey()

    const { error: updateError } = await supabase
        .from('recurring_appointments')
        .update({ status: 'canceled', ends_on: endsOn })
        .eq('id', payload.id)

    if (updateError) {
        console.error('[cancelRecurringCore] DB error:', updateError)
        return { success: false, error: 'Erro ao encerrar rotina' }
    }

    try {
        const { error: cancelReminderError } = await supabaseAdmin
            .from('scheduled_notifications')
            .update({ status: 'canceled' })
            .eq('recurring_appointment_id', payload.id)
            .eq('source', 'appointment_reminder')
            .eq('status', 'pending')
        if (cancelReminderError) {
            console.error('[cancelRecurringCore] cancel reminders error:', cancelReminderError)
        }

        const msg = appointmentMessages.rotinaCancelada(existing.day_of_week)
        const inbox = buildImmediateInboxItem(existing.student_id, trainerId, msg, {
            recurring_appointment_id: payload.id,
            group_id: existing.group_id,
            event: 'rotina_cancelada',
        })
        const { error: inboxError } = await supabase.from('student_inbox_items').insert(inbox)
        if (inboxError) {
            console.error('[cancelRecurringCore] inbox insert error:', inboxError)
        }
    } catch (err) {
        console.error('[cancelRecurringCore] notifications error:', err)
    }

    runAfterResponse(async () => {
        const { syncDeleteAppointment } = await import('@/lib/google-calendar/sync-service')
        await syncDeleteAppointment(payload.id).catch((err) => {
            console.error('[cancelRecurringCore] google sync error:', err)
        })
    })

    revalidatePath('/dashboard')
    revalidatePath(`/students/${existing.student_id}`)
    return { success: true }
}
