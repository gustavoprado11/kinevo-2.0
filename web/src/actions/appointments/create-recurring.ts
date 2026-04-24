'use server'

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
    createRecurringInputSchema,
    type CreateRecurringInput,
} from './schemas'

export interface CreateRecurringConflict {
    id: string
    studentName: string
    startTime: string
    durationMinutes: number
}

export interface CreateRecurringResult {
    success: boolean
    error?: string
    /**
     * Present when the server detected conflicts and is waiting for the
     * trainer to confirm. No row was inserted — caller should re-submit with
     * `confirmConflicts: true` if the trainer chooses to proceed.
     */
    pendingConflicts?: CreateRecurringConflict[]
    data?: {
        id: string
        conflicts: CreateRecurringConflict[]
    }
}

/** 0=Sun, 1=Mon, ... 6=Sat — same convention as Date.getDay() and the DB. */
function dayOfWeekFromDateKey(dateKey: string): number {
    const [y, m, d] = dateKey.split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/** Detects overlapping [start, end) intervals on the same weekday. */
function intervalsOverlap(
    aStart: string,
    aMinutes: number,
    bStart: string,
    bMinutes: number,
): boolean {
    const toMin = (hhmm: string): number => {
        const [h, m] = hhmm.slice(0, 5).split(':').map(Number)
        return h * 60 + m
    }
    const aS = toMin(aStart)
    const aE = aS + aMinutes
    const bS = toMin(bStart)
    const bE = bS + bMinutes
    return aS < bE && bS < aE
}

/**
 * Cria uma nova rotina recorrente.
 *
 * Fluxo de conflitos (decisão 12 da Seção 2 do plano — "avisa mas permite"):
 * - `confirmConflicts=false` (default): se houver conflitos, retorna a lista
 *   SEM inserir. UI mostra alerta e pede confirmação.
 * - `confirmConflicts=true`: insere mesmo com conflitos (trainer já confirmou).
 *
 * Quando não há conflitos, insere direto independente de `confirmConflicts`.
 */
export async function createRecurringAppointment(
    input: CreateRecurringInput,
    options: { confirmConflicts?: boolean } = {},
): Promise<CreateRecurringResult> {
    const parsed = createRecurringInputSchema.safeParse(input)
    if (!parsed.success) {
        return {
            success: false,
            error: parsed.error.issues[0]?.message ?? 'Dados inválidos',
        }
    }
    const payload = parsed.data

    // Monthly: day_of_week must match the weekday of starts_on.
    // The projection helper anchors monthly occurrences at starts_on and
    // ignores day_of_week — enforce consistency at write time.
    if (payload.frequency === 'monthly') {
        const expectedDow = dayOfWeekFromDateKey(payload.startsOn)
        if (payload.dayOfWeek !== expectedDow) {
            return {
                success: false,
                error:
                    'Para rotinas mensais, o dia da semana precisa coincidir com a data de início.',
            }
        }
    }

    // Once: mesma coerência (day_of_week = weekday de starts_on) +
    // rejeita ends_on preenchido (agendamento único não tem término).
    if (payload.frequency === 'once') {
        const expectedDow = dayOfWeekFromDateKey(payload.startsOn)
        if (payload.dayOfWeek !== expectedDow) {
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

    // Ownership check before insert (defense-in-depth — RLS already blocks).
    const { data: student } = await supabase
        .from('students')
        .select('id, coach_id, name')
        .eq('id', payload.studentId)
        .single()
    if (!student) return { success: false, error: 'Aluno não encontrado' }
    if (student.coach_id !== trainer.id) {
        return { success: false, error: 'Sem permissão' }
    }

    // Conflict detection: same day_of_week, overlapping time window, ativos.
    const { data: siblings } = await supabase
        .from('recurring_appointments')
        .select('id, start_time, duration_minutes, student_id')
        .eq('trainer_id', trainer.id)
        .eq('status', 'active')
        .eq('day_of_week', payload.dayOfWeek)

    const conflicts: CreateRecurringConflict[] = []
    if (siblings && siblings.length > 0) {
        const conflictingSiblings = siblings.filter((s) =>
            intervalsOverlap(
                payload.startTime,
                payload.durationMinutes,
                s.start_time,
                s.duration_minutes,
            ),
        )

        if (conflictingSiblings.length > 0) {
            const studentIds = Array.from(
                new Set(conflictingSiblings.map((s) => s.student_id)),
            )
            const { data: conflictStudents } = await supabase
                .from('students')
                .select('id, name')
                .in('id', studentIds)
            const nameById = new Map(
                (conflictStudents ?? []).map((s) => [s.id, s.name]),
            )
            for (const s of conflictingSiblings) {
                conflicts.push({
                    id: s.id,
                    studentName: nameById.get(s.student_id) ?? 'Aluno',
                    startTime: s.start_time.slice(0, 5),
                    durationMinutes: s.duration_minutes,
                })
            }
        }
    }

    // Conflicts exist and trainer hasn't confirmed: bail out before INSERT.
    if (conflicts.length > 0 && !options.confirmConflicts) {
        return { success: false, pendingConflicts: conflicts }
    }

    const { data: inserted, error: insertError } = await supabase
        .from('recurring_appointments')
        .insert({
            trainer_id: trainer.id,
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
        console.error('[createRecurringAppointment] DB error:', insertError)
        return { success: false, error: 'Erro ao criar agendamento' }
    }

    // Google Calendar sync — fire-and-forget com timeout interno (ver sync-service).
    // Nunca throw; marca status no banco.
    void (async () => {
        const { syncCreateAppointment } = await import(
            '@/lib/google-calendar/sync-service'
        )
        await syncCreateAppointment(inserted.id).catch((err) => {
            console.error('[createRecurringAppointment] google sync error:', err)
        })
    })()

    // Pushes + lembretes — resiliente: erros aqui NÃO revertem a rotina.
    // O cron de extensão reconstitui lembretes perdidos no próximo tick.
    await enqueueAppointmentNotifications({
        supabase,
        ruleId: inserted.id,
        trainerId: trainer.id,
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

    return { success: true, data: { id: inserted.id, conflicts } }
}

type SupabaseFromServer = Awaited<ReturnType<typeof createClient>>

async function enqueueAppointmentNotifications(args: {
    supabase: SupabaseFromServer
    ruleId: string
    trainerId: string
    studentId: string
    dayOfWeek: number
    startTime: string
    durationMinutes: number
    frequency: 'once' | 'weekly' | 'biweekly' | 'monthly'
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
                console.error(
                    '[createRecurringAppointment] reminders upsert error:',
                    reminderError,
                )
            }
        }

        const immediateMsg = appointmentMessages.rotinaCriada(
            args.dayOfWeek,
            args.startTime.slice(0, 5),
        )
        const inbox = buildImmediateInboxItem(
            args.studentId,
            args.trainerId,
            immediateMsg,
            {
                recurring_appointment_id: args.ruleId,
                event: 'rotina_criada',
            },
        )
        const { error: inboxError } = await args.supabase
            .from('student_inbox_items')
            .insert(inbox)
        if (inboxError) {
            console.error(
                '[createRecurringAppointment] inbox insert error:',
                inboxError,
            )
        }
    } catch (err) {
        console.error('[createRecurringAppointment] notifications error:', err)
    }
}
