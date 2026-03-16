'use server'

import { createClient } from '@/lib/supabase/server'
import { getScheduledWorkoutsForDate, getWeekRange } from '../../../../shared/utils/schedule-projection'

export interface WorkoutOption {
    id: string
    name: string
    isToday: boolean // true if scheduled for today
    lastCompletedAt: string | null // ISO date of last completed session
    weeklyExpected: number  // scheduled occurrences this week
    weeklyCompleted: number // completed sessions this week
    isPending: boolean      // completed < expected and past occurrences exist
    pendingFromDay: string | null // "Quarta" — original missed day
    scheduledDays: number[] // raw scheduled_days array
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
    weeklyCompleted: number  // total completed sessions this week
    weeklyExpected: number   // total expected sessions this week
    pendingCount: number     // number of pending (missed) workouts
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

    // Fetch last completed session per student+workout
    const { data: lastSessions } = studentIds.length > 0
        ? await supabase
            .from('workout_sessions')
            .select('student_id, assigned_workout_id, completed_at')
            .in('student_id', studentIds)
            .eq('status', 'completed')
            .order('completed_at', { ascending: false })
        : { data: [] as any[] }

    // Build lookup: student_id:workout_id → latest completed_at
    const lastSessionMap = new Map<string, string>()
    for (const s of lastSessions || []) {
        const key = `${s.student_id}:${s.assigned_workout_id}`
        if (!lastSessionMap.has(key)) {
            lastSessionMap.set(key, s.completed_at)
        }
    }

    // Build response
    const today = new Date()

    // Fetch this week's completed sessions for weekly progress
    const weekRange = getWeekRange(today)
    const { data: weekSessions } = studentIds.length > 0
        ? await supabase
            .from('workout_sessions')
            .select('student_id, assigned_workout_id, completed_at')
            .in('student_id', studentIds)
            .eq('status', 'completed')
            .gte('completed_at', weekRange.start.toISOString())
            .lte('completed_at', weekRange.end.toISOString())
        : { data: [] as any[] }

    // Build lookup: student_id:workout_id → count of completed sessions this week
    const weeklyCountMap = new Map<string, number>()
    for (const s of weekSessions || []) {
        const key = `${s.student_id}:${s.assigned_workout_id}`
        weeklyCountMap.set(key, (weeklyCountMap.get(key) || 0) + 1)
    }

    // Build response
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

        const WEEK_DAYS_PT = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
        const todayDow = today.getDay()
        const wkStartDow = weekRange.start.getDay()

        let totalWeeklyExpected = 0
        let totalWeeklyCompleted = 0

        const workoutOptions: WorkoutOption[] = programWorkouts.map((w) => {
            const scheduledDays: number[] = w.scheduled_days || []
            const weeklyExpected = scheduledDays.length
            const weeklyCompleted = weeklyCountMap.get(`${student.id}:${w.id}`) || 0
            const deficit = weeklyExpected - weeklyCompleted

            totalWeeklyExpected += weeklyExpected
            totalWeeklyCompleted += weeklyCompleted

            // Determine pending: find the oldest past occurrence that wasn't fulfilled
            let isPending = false
            let pendingFromDay: string | null = null
            if (deficit > 0) {
                // Find past scheduled days this week that are missed
                for (const dow of [...scheduledDays].sort((a, b) => a - b)) {
                    const daysFromStart = ((dow - wkStartDow) + 7) % 7
                    const occDate = new Date(weekRange.start)
                    occDate.setDate(occDate.getDate() + daysFromStart)
                    if (occDate <= today) {
                        isPending = true
                        pendingFromDay = WEEK_DAYS_PT[dow]
                        break // oldest first
                    }
                }
            }

            return {
                id: w.id,
                name: w.name,
                isToday: todayIds.has(w.id),
                lastCompletedAt: lastSessionMap.get(`${student.id}:${w.id}`) || null,
                weeklyExpected,
                weeklyCompleted,
                isPending,
                pendingFromDay,
                scheduledDays,
            }
        })

        const todayWorkouts = workoutOptions.filter((w) => w.isToday)
        const pendingCount = workoutOptions.filter((w) => w.isPending).length

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
            weeklyCompleted: totalWeeklyCompleted,
            weeklyExpected: totalWeeklyExpected,
            pendingCount,
        }
    })

    return { data: result, error: null }
}
