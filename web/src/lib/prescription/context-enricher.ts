import { createClient } from '@/lib/supabase/server'

// ============================================================================
// Enriched Student Context — deep context for the AI agent
// ============================================================================

export interface PreviousProgramSummary {
    name: string
    duration_weeks: number | null
    status: string
    created_at: string
    workouts: Array<{
        name: string
        exercise_names: string[]
        muscle_groups: string[]
    }>
    completion_rate: number
}

export interface LoadProgressionEntry {
    exercise_id: string
    exercise_name: string
    trend: 'progressing' | 'stalled' | 'regressing'
    weeks_at_current: number
    last_weight: number | null
}

export interface SessionPatterns {
    preferred_days: number[]
    avg_session_duration_minutes: number | null
    dropout_rate_by_workout: Record<string, number>
    total_sessions_4w: number
    completed_sessions_4w: number
}

export interface EnrichedStudentContext {
    student_name: string
    previous_programs: PreviousProgramSummary[]
    load_progression: LoadProgressionEntry[]
    session_patterns: SessionPatterns
    /** Exercise IDs from the last 2 programs (for novelty scoring) */
    previous_exercise_ids: string[]
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

// ============================================================================
// Main function
// ============================================================================

export async function enrichStudentContext(
    supabase: SupabaseClient,
    studentId: string,
): Promise<EnrichedStudentContext> {
    const [studentName, previousPrograms, loadProgression, sessionPatterns] = await Promise.all([
        fetchStudentName(supabase, studentId),
        fetchPreviousPrograms(supabase, studentId),
        fetchLoadProgression(supabase, studentId),
        fetchSessionPatterns(supabase, studentId),
    ])

    // Extract exercise IDs from last 2 programs for novelty scoring
    const previousExerciseIds = await fetchPreviousExerciseIds(supabase, studentId)

    return {
        student_name: studentName,
        previous_programs: previousPrograms,
        load_progression: loadProgression,
        session_patterns: sessionPatterns,
        previous_exercise_ids: previousExerciseIds,
    }
}

// ============================================================================
// Student name
// ============================================================================

async function fetchStudentName(
    supabase: SupabaseClient,
    studentId: string,
): Promise<string> {
    const { data } = await supabase
        .from('students')
        .select('name')
        .eq('id', studentId)
        .single()

    return (data as any)?.name || 'Aluno'
}

// ============================================================================
// Previous programs (last 2)
// ============================================================================

async function fetchPreviousPrograms(
    supabase: SupabaseClient,
    studentId: string,
): Promise<PreviousProgramSummary[]> {
    const { data: programs, error } = await supabase
        .from('assigned_programs')
        .select('id, name, duration_weeks, status, created_at')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(2)

    if (error || !programs || programs.length === 0) return []

    const summaries: PreviousProgramSummary[] = []

    for (const prog of programs) {
        const p = prog as any

        // Fetch workouts with items
        const { data: workouts } = await supabase
            .from('assigned_workouts')
            .select('id, name')
            .eq('assigned_program_id', p.id)
            .order('order_index', { ascending: true })

        const workoutSummaries: PreviousProgramSummary['workouts'] = []

        if (workouts) {
            for (const w of workouts) {
                const wo = w as any
                const { data: items } = await supabase
                    .from('assigned_workout_items')
                    .select('exercise_name, exercise_muscle_group')
                    .eq('assigned_workout_id', wo.id)
                    .order('order_index', { ascending: true })

                const exerciseNames = (items || []).map((i: any) => i.exercise_name).filter(Boolean)
                const muscleGroups = [...new Set((items || []).map((i: any) => i.exercise_muscle_group).filter(Boolean))]

                workoutSummaries.push({
                    name: wo.name,
                    exercise_names: exerciseNames,
                    muscle_groups: muscleGroups,
                })
            }
        }

        // Calculate completion rate from sessions
        const { data: sessions } = await supabase
            .from('workout_sessions')
            .select('status')
            .eq('assigned_program_id', p.id)

        const total = sessions?.length || 0
        const completed = (sessions || []).filter((s: any) => s.status === 'completed').length
        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0

        summaries.push({
            name: p.name,
            duration_weeks: p.duration_weeks,
            status: p.status,
            created_at: p.created_at,
            workouts: workoutSummaries,
            completion_rate: completionRate,
        })
    }

    return summaries
}

// ============================================================================
// Load progression (last 8 weeks of set_logs)
// ============================================================================

async function fetchLoadProgression(
    supabase: SupabaseClient,
    studentId: string,
): Promise<LoadProgressionEntry[]> {
    const eightWeeksAgo = new Date()
    eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56)

    // Get sessions for this student in the last 8 weeks
    const { data: sessions } = await supabase
        .from('workout_sessions')
        .select('id, started_at')
        .eq('student_id', studentId)
        .eq('status', 'completed')
        .gte('started_at', eightWeeksAgo.toISOString())
        .order('started_at', { ascending: true })

    if (!sessions || sessions.length === 0) return []

    const sessionIds = sessions.map((s: any) => s.id)

    // Fetch set_logs for these sessions
    const { data: logs } = await supabase
        .from('set_logs')
        .select('exercise_id, weight, completed_at, workout_session_id')
        .in('workout_session_id', sessionIds)
        .eq('is_completed', true)
        .not('weight', 'is', null)
        .order('completed_at', { ascending: true })

    if (!logs || logs.length === 0) return []

    // Get exercise names
    const exerciseIds = [...new Set((logs as any[]).map(l => l.exercise_id))]
    const { data: exercises } = await supabase
        .from('exercises')
        .select('id, name')
        .in('id', exerciseIds)

    const exerciseNameMap = new Map(
        (exercises || []).map((e: any) => [e.id, e.name])
    )

    // Build session date map
    const sessionDateMap = new Map(
        sessions.map((s: any) => [s.id, new Date(s.started_at)])
    )

    // Group logs by exercise, then by week
    const exerciseWeeklyMaxes = new Map<string, Map<number, number>>()

    for (const log of logs as any[]) {
        const exId = log.exercise_id
        const sessionDate = sessionDateMap.get(log.workout_session_id)
        if (!sessionDate) continue

        const weekNum = Math.floor((sessionDate.getTime() - eightWeeksAgo.getTime()) / (7 * 24 * 60 * 60 * 1000))

        if (!exerciseWeeklyMaxes.has(exId)) {
            exerciseWeeklyMaxes.set(exId, new Map())
        }
        const weekMap = exerciseWeeklyMaxes.get(exId)!
        const currentMax = weekMap.get(weekNum) || 0
        if (log.weight > currentMax) {
            weekMap.set(weekNum, log.weight)
        }
    }

    // Analyze trends
    const progressionEntries: LoadProgressionEntry[] = []

    for (const [exerciseId, weekMap] of exerciseWeeklyMaxes) {
        const weeks = [...weekMap.entries()].sort((a, b) => a[0] - b[0])
        if (weeks.length < 2) continue

        const lastWeight = weeks[weeks.length - 1][1]
        const prevWeight = weeks[weeks.length - 2][1]

        let trend: LoadProgressionEntry['trend']
        if (lastWeight > prevWeight) {
            trend = 'progressing'
        } else if (lastWeight < prevWeight) {
            trend = 'regressing'
        } else {
            trend = 'stalled'
        }

        // Count weeks at current weight
        let weeksAtCurrent = 1
        for (let i = weeks.length - 2; i >= 0; i--) {
            if (weeks[i][1] === lastWeight) {
                weeksAtCurrent++
            } else {
                break
            }
        }

        progressionEntries.push({
            exercise_id: exerciseId,
            exercise_name: exerciseNameMap.get(exerciseId) || 'Desconhecido',
            trend,
            weeks_at_current: weeksAtCurrent,
            last_weight: lastWeight,
        })
    }

    return progressionEntries
}

// ============================================================================
// Session patterns (last 4 weeks)
// ============================================================================

async function fetchSessionPatterns(
    supabase: SupabaseClient,
    studentId: string,
): Promise<SessionPatterns> {
    const fourWeeksAgo = new Date()
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28)

    const { data: sessions } = await supabase
        .from('workout_sessions')
        .select('id, status, started_at, completed_at, duration_seconds, assigned_workout_id')
        .eq('student_id', studentId)
        .gte('started_at', fourWeeksAgo.toISOString())
        .order('started_at', { ascending: false })

    if (!sessions || sessions.length === 0) {
        return {
            preferred_days: [],
            avg_session_duration_minutes: null,
            dropout_rate_by_workout: {},
            total_sessions_4w: 0,
            completed_sessions_4w: 0,
        }
    }

    const completed = (sessions as any[]).filter(s => s.status === 'completed')
    const abandoned = (sessions as any[]).filter(s => s.status === 'abandoned')

    // Preferred days (days of week with most completed sessions)
    const dayCount: Record<number, number> = {}
    for (const s of completed) {
        const day = new Date(s.started_at).getDay()
        dayCount[day] = (dayCount[day] || 0) + 1
    }
    const preferred_days = Object.entries(dayCount)
        .sort((a, b) => b[1] - a[1])
        .map(([day]) => Number(day))

    // Average session duration
    const durations = completed
        .filter((s: any) => s.duration_seconds != null && s.duration_seconds > 0)
        .map((s: any) => s.duration_seconds as number)
    const avg_session_duration_minutes = durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length / 60)
        : null

    // Dropout rate by workout
    const workoutIds = [...new Set((sessions as any[]).map(s => s.assigned_workout_id).filter(Boolean))]
    const dropout_rate_by_workout: Record<string, number> = {}

    if (workoutIds.length > 0) {
        // Get workout names
        const { data: workouts } = await supabase
            .from('assigned_workouts')
            .select('id, name')
            .in('id', workoutIds)

        const workoutNameMap = new Map(
            (workouts || []).map((w: any) => [w.id, w.name])
        )

        // Calculate dropout per workout
        const workoutStats = new Map<string, { total: number; abandoned: number }>()
        for (const s of sessions as any[]) {
            const wid = s.assigned_workout_id
            if (!wid) continue
            const name = workoutNameMap.get(wid) || wid
            const stats = workoutStats.get(name) || { total: 0, abandoned: 0 }
            stats.total++
            if (s.status === 'abandoned') stats.abandoned++
            workoutStats.set(name, stats)
        }

        for (const [name, stats] of workoutStats) {
            if (stats.total > 0) {
                dropout_rate_by_workout[name] = Math.round((stats.abandoned / stats.total) * 100)
            }
        }
    }

    return {
        preferred_days,
        avg_session_duration_minutes,
        dropout_rate_by_workout,
        total_sessions_4w: sessions.length,
        completed_sessions_4w: completed.length,
    }
}

// ============================================================================
// Previous exercise IDs (last 2 programs, for novelty scoring)
// ============================================================================

async function fetchPreviousExerciseIds(
    supabase: SupabaseClient,
    studentId: string,
): Promise<string[]> {
    // Get last 2 program IDs
    const { data: programs } = await supabase
        .from('assigned_programs')
        .select('id')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(2)

    if (!programs || programs.length === 0) return []

    const programIds = programs.map((p: any) => p.id)

    // Get workout IDs for these programs
    const { data: workouts } = await supabase
        .from('assigned_workouts')
        .select('id')
        .in('assigned_program_id', programIds)

    if (!workouts || workouts.length === 0) return []

    const workoutIds = workouts.map((w: any) => w.id)

    // Get distinct exercise IDs from workout items
    const { data: items } = await supabase
        .from('assigned_workout_items')
        .select('exercise_id')
        .in('assigned_workout_id', workoutIds)

    if (!items) return []

    return [...new Set((items as any[]).map(i => i.exercise_id).filter(Boolean))]
}
