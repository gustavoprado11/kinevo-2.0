'use server'

import { createClient } from '@/lib/supabase/server'
import { getScheduledWorkoutsForDate } from '../../../../shared/utils/schedule-projection'

export interface WorkoutOption {
    id: string
    name: string
    isToday: boolean // true if scheduled for today
}

export interface TrainingRoomStudent {
    id: string
    name: string
    avatar_url: string | null
    program: {
        id: string
        name: string
        started_at: string
        duration_weeks: number | null
    } | null
    workoutOptions: WorkoutOption[] // all workouts in program
    todayWorkouts: WorkoutOption[]  // subset scheduled for today
}

/**
 * Lists active students for the trainer, each with their active program
 * and workout options (all + today's scheduled).
 */
export async function getTrainingRoomStudents(): Promise<{
    data: TrainingRoomStudent[] | null
    error: string | null
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { data: null, error: 'Não autorizado' }

    const { data: trainer } = await supabase
        .from('trainers')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()

    if (!trainer) return { data: null, error: 'Treinador não encontrado' }

    // Fetch active students
    const { data: students, error: studentsError } = await supabase
        .from('students')
        .select('id, name, avatar_url')
        .eq('coach_id', trainer.id)
        .eq('status', 'active')
        .neq('is_trainer_profile', true)
        .order('name')

    if (studentsError) return { data: null, error: studentsError.message }
    if (!students?.length) return { data: [], error: null }

    const studentIds = students.map((s) => s.id)

    // Fetch active programs for all students in one query
    const { data: programs } = await supabase
        .from('assigned_programs')
        .select('id, name, student_id, started_at, duration_weeks')
        .in('student_id', studentIds)
        .eq('status', 'active')

    // Fetch assigned workouts for those programs
    const programIds = (programs || []).map((p) => p.id)
    const { data: workouts } = programIds.length > 0
        ? await supabase
            .from('assigned_workouts')
            .select('id, name, assigned_program_id, scheduled_days')
            .in('assigned_program_id', programIds)
            .order('name')
        : { data: [] as any[] }

    // Build response
    const today = new Date()
    const result: TrainingRoomStudent[] = students.map((student) => {
        const program = programs?.find((p) => p.student_id === student.id) ?? null
        const programWorkouts = program
            ? (workouts || []).filter((w) => w.assigned_program_id === program.id)
            : []

        // Determine today's scheduled workouts using shared utility
        const todayScheduled = program?.started_at
            ? getScheduledWorkoutsForDate(
                today,
                programWorkouts.map((w) => ({
                    id: w.id,
                    name: w.name,
                    scheduled_days: w.scheduled_days || [],
                })),
                program.started_at,
                program.duration_weeks,
            )
            : []

        const todayIds = new Set(todayScheduled.map((w) => w.id))

        const workoutOptions: WorkoutOption[] = programWorkouts.map((w) => ({
            id: w.id,
            name: w.name,
            isToday: todayIds.has(w.id),
        }))

        const todayWorkouts = workoutOptions.filter((w) => w.isToday)

        return {
            id: student.id,
            name: student.name,
            avatar_url: student.avatar_url,
            program: program
                ? {
                    id: program.id,
                    name: program.name,
                    started_at: program.started_at,
                    duration_weeks: program.duration_weeks,
                }
                : null,
            workoutOptions,
            todayWorkouts,
        }
    })

    return { data: result, error: null }
}
