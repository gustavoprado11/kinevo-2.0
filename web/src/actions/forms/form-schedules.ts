'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// ============================================================================
// Types
// ============================================================================

export type ScheduleFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly'

interface CreateScheduleInput {
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

// ============================================================================
// Create schedules (bulk — one per student)
// ============================================================================

export async function createFormSchedules(input: CreateScheduleInput) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Não autorizado' }

    if (!input.formTemplateId || !input.studentIds?.length || !input.frequency) {
        return { success: false, error: 'Dados incompletos' }
    }

    const nextDue = computeNextDue(input.frequency, new Date())

    const rows = input.studentIds.map(studentId => ({
        trainer_id: user.id,
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
        console.error('[createFormSchedules] error:', error)
        return { success: false, error: error.message }
    }

    revalidatePath('/forms')
    revalidatePath('/students')
    return { success: true, count: data?.length ?? 0 }
}

// ============================================================================
// Get schedules for a student
// ============================================================================

export async function getStudentFormSchedules(studentId: string): Promise<FormScheduleRow[]> {
    const supabase = await createClient()

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
        .eq('student_id', studentId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('[getStudentFormSchedules] error:', error)
        return []
    }

    return (data ?? []).map((row: any) => ({
        id: row.id,
        student_id: row.student_id,
        form_template_id: row.form_template_id,
        frequency: row.frequency,
        is_active: row.is_active,
        next_due_at: row.next_due_at,
        last_sent_at: row.last_sent_at,
        created_at: row.created_at,
        form_template_title: row.form_templates?.title ?? 'Formulário',
    }))
}

// ============================================================================
// Toggle schedule active/inactive
// ============================================================================

export async function toggleFormSchedule(scheduleId: string, isActive: boolean) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('form_schedules')
        .update({ is_active: isActive })
        .eq('id', scheduleId)

    if (error) {
        console.error('[toggleFormSchedule] error:', error)
        return { success: false, error: error.message }
    }

    revalidatePath('/students')
    return { success: true }
}

// ============================================================================
// Delete schedule
// ============================================================================

export async function deleteFormSchedule(scheduleId: string) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('form_schedules')
        .delete()
        .eq('id', scheduleId)

    if (error) {
        console.error('[deleteFormSchedule] error:', error)
        return { success: false, error: error.message }
    }

    revalidatePath('/students')
    return { success: true }
}

// ============================================================================
// Helpers
// ============================================================================

function computeNextDue(frequency: ScheduleFrequency, fromDate: Date): Date {
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
