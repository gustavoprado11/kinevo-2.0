'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
    createFormSchedulesCore,
    getStudentFormSchedulesCore,
    toggleFormScheduleCore,
    deleteFormScheduleCore,
    type CreateScheduleInput,
    type FormScheduleRow,
    type ScheduleFrequency,
} from './form-schedules-core'

// Re-export para retrocompat com quem importa daqui.
export type { ScheduleFrequency, FormScheduleRow }

async function resolveTrainerId(): Promise<{ trainerId?: string; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Não autorizado' }

    const { data: trainer } = await supabase
        .from('trainers')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()

    if (!trainer) return { error: 'Treinador não encontrado' }
    return { trainerId: trainer.id }
}

// ============================================================================
// Create schedules (bulk — one per student)
// ============================================================================

export async function createFormSchedules(input: CreateScheduleInput) {
    const { trainerId, error } = await resolveTrainerId()
    if (!trainerId) return { success: false, error }

    const supabase = await createClient()
    const result = await createFormSchedulesCore(supabase, trainerId, input)
    if (!result.success) return result

    revalidatePath('/forms')
    revalidatePath('/students')
    return result
}

// ============================================================================
// Get schedules for a student
// ============================================================================

export async function getStudentFormSchedules(studentId: string): Promise<FormScheduleRow[]> {
    const { trainerId } = await resolveTrainerId()
    if (!trainerId) return []

    const supabase = await createClient()
    return getStudentFormSchedulesCore(supabase, trainerId, studentId)
}

// ============================================================================
// Toggle schedule active/inactive
// ============================================================================

export async function toggleFormSchedule(scheduleId: string, isActive: boolean) {
    const { trainerId, error } = await resolveTrainerId()
    if (!trainerId) return { success: false, error }

    const supabase = await createClient()
    const result = await toggleFormScheduleCore(supabase, trainerId, scheduleId, isActive)
    if (result.success) revalidatePath('/students')
    return result
}

// ============================================================================
// Delete schedule
// ============================================================================

export async function deleteFormSchedule(scheduleId: string) {
    const { trainerId, error } = await resolveTrainerId()
    if (!trainerId) return { success: false, error }

    const supabase = await createClient()
    const result = await deleteFormScheduleCore(supabase, trainerId, scheduleId)
    if (result.success) revalidatePath('/students')
    return result
}
