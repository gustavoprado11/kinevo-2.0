'use server'

import { createClient } from '@/lib/supabase/server'
import { expandAppointments } from '@kinevo/shared/utils/appointments-projection'
import type {
    AppointmentException,
    AppointmentOccurrence,
    RecurringAppointment,
} from '@kinevo/shared/types/appointments'
import {
    listAppointmentsInputSchema,
    type ListAppointmentsInput,
} from './schemas'

export interface ListAppointmentsResult {
    success: boolean
    error?: string
    data?: AppointmentOccurrence[]
}

function parseDateKey(key: string): Date {
    const [y, m, d] = key.split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, d))
}

/**
 * Lista ocorrências de agendamentos do trainer autenticado dentro de um range.
 * Busca regras ativas + exceções no range, delega a expansão pro helper de
 * projeção (Fase 1).
 */
export async function listAppointmentsInRange(
    input: ListAppointmentsInput,
): Promise<ListAppointmentsResult> {
    const parsed = listAppointmentsInputSchema.safeParse(input)
    if (!parsed.success) {
        return {
            success: false,
            error: parsed.error.issues[0]?.message ?? 'Dados inválidos',
        }
    }
    const { rangeStart, rangeEnd } = parsed.data

    const rangeStartDate = parseDateKey(rangeStart)
    const rangeEndDate = parseDateKey(rangeEnd)
    if (rangeEndDate.getTime() < rangeStartDate.getTime()) {
        return { success: false, error: 'rangeEnd deve ser >= rangeStart' }
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

    // Active rules: status='active' AND (ends_on IS NULL OR ends_on >= rangeStart)
    // AND starts_on <= rangeEnd
    const { data: rulesRows, error: rulesError } = await supabase
        .from('recurring_appointments')
        .select('*')
        .eq('trainer_id', trainer.id)
        .eq('status', 'active')
        .lte('starts_on', rangeEnd)
        .or(`ends_on.is.null,ends_on.gte.${rangeStart}`)

    if (rulesError) {
        console.error('[listAppointmentsInRange] rules error:', rulesError)
        return { success: false, error: 'Erro ao carregar agendamentos' }
    }

    const rules = (rulesRows ?? []) as unknown as RecurringAppointment[]

    // Exceptions may reference occurrence_date (the original slot, inside the
    // range) OR new_date (rescheduled slot, possibly landing in the range).
    // Fetch any exception whose either date sits inside range.
    const ruleIds = rules.map((r) => r.id)
    let exceptions: AppointmentException[] = []
    if (ruleIds.length > 0) {
        const { data: excRows, error: excError } = await supabase
            .from('appointment_exceptions')
            .select('*')
            .eq('trainer_id', trainer.id)
            .in('recurring_appointment_id', ruleIds)
            .or(
                `and(occurrence_date.gte.${rangeStart},occurrence_date.lte.${rangeEnd}),and(new_date.gte.${rangeStart},new_date.lte.${rangeEnd})`,
            )

        if (excError) {
            console.error('[listAppointmentsInRange] exceptions error:', excError)
            return { success: false, error: 'Erro ao carregar ocorrências' }
        }
        exceptions = (excRows ?? []) as unknown as AppointmentException[]
    }

    const occurrences = expandAppointments(
        rules,
        exceptions,
        rangeStartDate,
        rangeEndDate,
    )

    return { success: true, data: occurrences }
}
