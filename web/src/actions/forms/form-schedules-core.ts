/**
 * Formulários recorrentes — núcleo compartilhado (server-only, SEM 'use server').
 *
 * Cada função recebe um client Supabase + o trainerId JÁ RESOLVIDO (trainers.id)
 * e escopa toda operação por ele. A action ('use server') vira wrapper de auth
 * que resolve trainers.id a partir do auth uid; a tool MCP chama o core direto
 * com o admin client + trainerId do token OAuth.
 *
 * BUG corrigido (jun/2026): a versão anterior gravava trainer_id = user.id (auth
 * uid), mas form_schedules.trainer_id tem FK para trainers(id) — todo insert
 * falhava (tabela tinha 0 linhas). O núcleo agora grava o trainers.id correto e
 * escopa toggle/delete por trainer_id (admin client bypassa RLS).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@kinevo/shared/types/database'

type DBClient = SupabaseClient<Database>

export type ScheduleFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly'

export interface CreateScheduleInput {
    formTemplateId: string
    studentIds: string[]
    frequency: ScheduleFrequency
}

export interface FormScheduleRow {
    id: string
    student_id: string
    form_template_id: string
    frequency: ScheduleFrequency
    is_active: boolean
    next_due_at: string
    last_sent_at: string | null
    created_at: string
    form_template_title?: string
}

export async function createFormSchedulesCore(
    supabase: DBClient,
    trainerId: string,
    input: CreateScheduleInput,
): Promise<{ success: boolean; error?: string; count?: number }> {
    if (!input.formTemplateId || !input.studentIds?.length || !input.frequency) {
        return { success: false, error: 'Dados incompletos' }
    }

    const nextDue = computeNextDue(input.frequency, new Date())

    const rows = input.studentIds.map(studentId => ({
        trainer_id: trainerId,
        student_id: studentId,
        form_template_id: input.formTemplateId,
        frequency: input.frequency,
        next_due_at: nextDue.toISOString(),
    }))

    const { data, error } = await supabase
        .from('form_schedules')
        .upsert(rows, {
            onConflict: 'student_id,form_template_id,frequency',
            ignoreDuplicates: false,
        })
        .select('id')

    if (error) {
        console.error('[createFormSchedulesCore] error:', error)
        return { success: false, error: error.message }
    }

    return { success: true, count: data?.length ?? 0 }
}

export async function getStudentFormSchedulesCore(
    supabase: DBClient,
    trainerId: string,
    studentId: string,
): Promise<FormScheduleRow[]> {
    const { data, error } = await supabase
        .from('form_schedules')
        .select(`
            id,
            student_id,
            form_template_id,
            frequency,
            is_active,
            next_due_at,
            last_sent_at,
            created_at,
            form_templates!inner ( title )
        `)
        .eq('trainer_id', trainerId)
        .eq('student_id', studentId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('[getStudentFormSchedulesCore] error:', error)
        return []
    }

    type ScheduleRow = {
        id: string
        student_id: string
        form_template_id: string
        frequency: ScheduleFrequency
        is_active: boolean
        next_due_at: string
        last_sent_at: string | null
        created_at: string
        form_templates: { title: string } | { title: string }[] | null
    }

    return ((data ?? []) as unknown as ScheduleRow[]).map(row => {
        const tpl = Array.isArray(row.form_templates) ? row.form_templates[0] : row.form_templates
        return {
            id: row.id,
            student_id: row.student_id,
            form_template_id: row.form_template_id,
            frequency: row.frequency,
            is_active: row.is_active,
            next_due_at: row.next_due_at,
            last_sent_at: row.last_sent_at,
            created_at: row.created_at,
            form_template_title: tpl?.title ?? 'Formulário',
        }
    })
}

export async function toggleFormScheduleCore(
    supabase: DBClient,
    trainerId: string,
    scheduleId: string,
    isActive: boolean,
): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
        .from('form_schedules')
        .update({ is_active: isActive })
        .eq('id', scheduleId)
        .eq('trainer_id', trainerId)

    if (error) {
        console.error('[toggleFormScheduleCore] error:', error)
        return { success: false, error: error.message }
    }
    return { success: true }
}

export async function deleteFormScheduleCore(
    supabase: DBClient,
    trainerId: string,
    scheduleId: string,
): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
        .from('form_schedules')
        .delete()
        .eq('id', scheduleId)
        .eq('trainer_id', trainerId)

    if (error) {
        console.error('[deleteFormScheduleCore] error:', error)
        return { success: false, error: error.message }
    }
    return { success: true }
}

export function computeNextDue(frequency: ScheduleFrequency, fromDate: Date): Date {
    const next = new Date(fromDate)
    switch (frequency) {
        case 'daily':
            next.setDate(next.getDate() + 1)
            break
        case 'weekly':
            next.setDate(next.getDate() + 7)
            break
        case 'biweekly':
            next.setDate(next.getDate() + 14)
            break
        case 'monthly':
            next.setMonth(next.getMonth() + 1)
            break
    }
    return next
}
