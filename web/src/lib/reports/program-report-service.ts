// ============================================================================
// Program Report Service
// ============================================================================
// Generates, retrieves, and manages training program reports.
// Reports contain frozen metric snapshots (frequency, volume, RPE,
// progression, check-ins) computed from workout_sessions & set_logs.
//
// See: docs/program-report-spec.md

import { createClient } from '@/lib/supabase/server'

// ============================================================================
// Types
// ============================================================================

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

export interface ReportFrequency {
    completed_sessions: number
    planned_sessions: number
    percentage: number
    weekly_breakdown: number[]
    best_streak_weeks: number
}

export interface ReportVolume {
    total_tonnage_kg: number
    weekly_tonnage: number[]
    previous_program_tonnage_kg: number | null
}

export interface ReportRPE {
    weekly_avg: (number | null)[]
    overall_avg: number | null
}

export interface ReportExerciseProgression {
    exercise_id: string
    exercise_name: string
    weekly_max_weight: (number | null)[]
    start_weight: number
    end_weight: number
    change_kg: number
    change_pct: number
}

export interface ReportCheckins {
    averages: Array<{
        question_label: string
        avg_value: number
        scale_max: number
    }>
}

export interface ProgramReportMetrics {
    frequency: ReportFrequency
    volume: ReportVolume
    rpe: ReportRPE
    progression: { top_exercises: ReportExerciseProgression[] }
    checkins: ReportCheckins
}

export interface ProgramReport {
    id: string
    assigned_program_id: string
    student_id: string
    trainer_id: string
    status: 'draft' | 'published'
    program_name: string
    program_duration_weeks: number | null
    program_started_at: string | null
    program_completed_at: string | null
    metrics_json: ProgramReportMetrics
    trainer_notes: string | null
    generated_at: string
    published_at: string | null
    created_at: string
    updated_at: string
}

// ============================================================================
// Internal: assigned_programs row shape
// ============================================================================

interface AssignedProgram {
    id: string
    student_id: string
    trainer_id: string
    name: string
    duration_weeks: number | null
    started_at: string | null
    completed_at: string | null
    status: string
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Generates a new draft report for a completed (or active) program.
 * Returns the new report id, or null on failure.
 */
export async function generateReport(
    supabase: SupabaseClient,
    programId: string
): Promise<string | null> {
    try {
        // 1. Fetch the assigned program
        const { data: program, error: progError } = await supabase
            .from('assigned_programs')
            .select('id, student_id, trainer_id, name, duration_weeks, started_at, completed_at, status')
            .eq('id', programId)
            .single()

        if (progError || !program) {
            console.error('[program-report] Program not found:', progError?.message)
            return null
        }

        // 2. Check if report already exists
        const { data: existing } = await supabase
            .from('program_reports')
            .select('id')
            .eq('assigned_program_id', programId)
            .maybeSingle()

        if (existing) {
            console.error('[program-report] Report already exists for program:', programId)
            return null
        }

        const ap = program as AssignedProgram
        const duration = ap.duration_weeks ?? 8

        // 3. Compute all metrics in parallel
        const [frequency, volume, rpe, progression, checkins] = await Promise.all([
            computeFrequency(supabase, programId, ap.started_at, duration),
            computeVolume(supabase, programId, ap.student_id, ap.started_at, duration),
            computeRPE(supabase, programId, ap.started_at, duration),
            computeProgression(supabase, programId, ap.started_at, duration),
            computeCheckins(supabase, programId),
        ])

        const metrics: ProgramReportMetrics = {
            frequency,
            volume,
            rpe,
            progression,
            checkins,
        }

        // 4. Insert the report
        const { data: report, error: insertError } = await supabase
            .from('program_reports')
            .insert({
                assigned_program_id: programId,
                student_id: ap.student_id,
                trainer_id: ap.trainer_id,
                program_name: ap.name,
                program_duration_weeks: duration,
                program_started_at: ap.started_at,
                program_completed_at: ap.completed_at,
                metrics_json: metrics,
                status: 'draft',
            })
            .select('id')
            .single()

        if (insertError || !report) {
            console.error('[program-report] Insert failed:', insertError?.message)
            return null
        }

        return report.id
    } catch (err) {
        console.error('[program-report] Unexpected error in generateReport:', err)
        return null
    }
}

/**
 * Fetches a report by its id.
 */
export async function getReport(
    supabase: SupabaseClient,
    reportId: string
): Promise<ProgramReport | null> {
    try {
        const { data, error } = await supabase
            .from('program_reports')
            .select('*')
            .eq('id', reportId)
            .single()

        if (error || !data) {
            console.error('[program-report] getReport failed:', error?.message)
            return null
        }

        return data as ProgramReport
    } catch (err) {
        console.error('[program-report] Unexpected error in getReport:', err)
        return null
    }
}

/**
 * Fetches a report by its assigned program id.
 */
export async function getReportByProgram(
    supabase: SupabaseClient,
    programId: string
): Promise<ProgramReport | null> {
    try {
        const { data, error } = await supabase
            .from('program_reports')
            .select('*')
            .eq('assigned_program_id', programId)
            .maybeSingle()

        if (error) {
            console.error('[program-report] getReportByProgram failed:', error.message)
            return null
        }

        return (data as ProgramReport) ?? null
    } catch (err) {
        console.error('[program-report] Unexpected error in getReportByProgram:', err)
        return null
    }
}

/**
 * Updates the trainer notes on a report.
 */
export async function updateTrainerNotes(
    supabase: SupabaseClient,
    reportId: string,
    notes: string
): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('program_reports')
            .update({ trainer_notes: notes })
            .eq('id', reportId)

        if (error) {
            console.error('[program-report] updateTrainerNotes failed:', error.message)
            return false
        }

        return true
    } catch (err) {
        console.error('[program-report] Unexpected error in updateTrainerNotes:', err)
        return false
    }
}

/**
 * Publishes a draft report, making it visible to the student.
 */
export async function publishReport(
    supabase: SupabaseClient,
    reportId: string
): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('program_reports')
            .update({ status: 'published', published_at: new Date().toISOString() })
            .eq('id', reportId)
            .eq('status', 'draft')

        if (error) {
            console.error('[program-report] publishReport failed:', error.message)
            return false
        }

        return true
    } catch (err) {
        console.error('[program-report] Unexpected error in publishReport:', err)
        return false
    }
}

/**
 * Regenerates metrics for an existing report, preserving trainer_notes.
 */
export async function regenerateReport(
    supabase: SupabaseClient,
    reportId: string
): Promise<string | null> {
    try {
        // 1. Fetch existing report
        const { data: existing, error } = await supabase
            .from('program_reports')
            .select('assigned_program_id, trainer_notes')
            .eq('id', reportId)
            .single()

        if (error || !existing) {
            console.error('[program-report] Report not found for regeneration:', error?.message)
            return null
        }

        const { assigned_program_id: programId, trainer_notes: savedNotes } = existing

        // 2. Delete the existing report
        const { error: deleteError } = await supabase
            .from('program_reports')
            .delete()
            .eq('id', reportId)

        if (deleteError) {
            console.error('[program-report] Delete failed during regeneration:', deleteError.message)
            return null
        }

        // 3. Generate a fresh report
        const newReportId = await generateReport(supabase, programId)
        if (!newReportId) return null

        // 4. Restore trainer notes
        if (savedNotes) {
            await updateTrainerNotes(supabase, newReportId, savedNotes)
        }

        return newReportId
    } catch (err) {
        console.error('[program-report] Unexpected error in regenerateReport:', err)
        return null
    }
}

// ============================================================================
// Private: Helpers
// ============================================================================

/** Compute 1-indexed program week from session date and program start date. */
function calcProgramWeek(sessionDate: string | null, programStartedAt: string | null): number {
    if (!sessionDate || !programStartedAt) return 1
    const d = new Date(sessionDate)
    const start = new Date(programStartedAt)
    // Reset to start of day (UTC) for consistent diff
    d.setUTCHours(0, 0, 0, 0)
    start.setUTCHours(0, 0, 0, 0)
    if (d < start) return 1
    const diffDays = Math.floor((d.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    return Math.floor(diffDays / 7) + 1
}

// ============================================================================
// Private: Metric Computation
// ============================================================================

// -- Frequency ---------------------------------------------------------------

async function computeFrequency(
    supabase: SupabaseClient,
    programId: string,
    programStartedAt: string | null,
    durationWeeks: number
): Promise<ReportFrequency> {
    // Count assigned workouts (= distinct workout types in the program)
    const { count: numWorkouts } = await supabase
        .from('assigned_workouts')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_program_id', programId)

    const plannedSessions = (numWorkouts ?? 0) * durationWeeks

    // Count completed sessions
    const { count: completedSessions } = await supabase
        .from('workout_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_program_id', programId)
        .eq('status', 'completed')

    const completed = completedSessions ?? 0

    // Weekly breakdown: sessions per week (calculate week from dates)
    const { data: weeklyRows } = await supabase
        .from('workout_sessions')
        .select('started_at')
        .eq('assigned_program_id', programId)
        .eq('status', 'completed')

    const weekCounts = new Map<number, number>()
    console.log('[program-report][DEBUG] programStartedAt:', programStartedAt, '| durationWeeks:', durationWeeks)
    for (const row of weeklyRows ?? []) {
        const week = calcProgramWeek(row.started_at, programStartedAt)
        console.log('[program-report][DEBUG] session started_at:', row.started_at, '→ week:', week)
        weekCounts.set(week, (weekCounts.get(week) ?? 0) + 1)
    }
    console.log('[program-report][DEBUG] weekCounts:', Object.fromEntries(weekCounts))

    const weeklyBreakdown: number[] = []
    for (let w = 1; w <= durationWeeks; w++) {
        weeklyBreakdown.push(weekCounts.get(w) ?? 0)
    }

    // Best streak of consecutive weeks with at least 1 session
    const activeWeeks = new Set(weekCounts.keys())
    let bestStreak = 0
    let currentStreak = 0
    for (let w = 1; w <= durationWeeks; w++) {
        if (activeWeeks.has(w)) {
            currentStreak++
            if (currentStreak > bestStreak) bestStreak = currentStreak
        } else {
            currentStreak = 0
        }
    }

    const percentage = plannedSessions > 0
        ? Math.round((completed / plannedSessions) * 1000) / 10
        : 0

    return {
        completed_sessions: completed,
        planned_sessions: plannedSessions,
        percentage,
        weekly_breakdown: weeklyBreakdown,
        best_streak_weeks: bestStreak,
    }
}

// -- Volume ------------------------------------------------------------------

async function computeVolume(
    supabase: SupabaseClient,
    programId: string,
    studentId: string,
    programStartedAt: string | null,
    durationWeeks: number
): Promise<ReportVolume> {
    // Total tonnage for this program
    const { data: sessionIds } = await supabase
        .from('workout_sessions')
        .select('id, started_at')
        .eq('assigned_program_id', programId)
        .eq('status', 'completed')

    const sessions = sessionIds ?? []
    const ids = sessions.map(s => s.id)

    let totalTonnage = 0
    const weekTonnageMap = new Map<number, number>()

    if (ids.length > 0) {
        const { data: logs } = await supabase
            .from('set_logs')
            .select('workout_session_id, weight, reps_completed')
            .in('workout_session_id', ids)
            .eq('is_completed', true)
            .not('weight', 'is', null)
            .not('reps_completed', 'is', null)

        // Build a session → week lookup (calculated from dates)
        const sessionWeekMap = new Map<string, number>()
        for (const s of sessions) {
            sessionWeekMap.set(s.id, calcProgramWeek(s.started_at, programStartedAt))
        }

        for (const log of logs ?? []) {
            const tonnage = (log.weight ?? 0) * (log.reps_completed ?? 0)
            totalTonnage += tonnage
            const week = sessionWeekMap.get(log.workout_session_id) ?? 1
            weekTonnageMap.set(week, (weekTonnageMap.get(week) ?? 0) + tonnage)
        }
    }

    const weeklyTonnage: number[] = []
    for (let w = 1; w <= durationWeeks; w++) {
        weeklyTonnage.push(Math.round(weekTonnageMap.get(w) ?? 0))
    }

    // Previous program tonnage for comparison
    let previousTonnage: number | null = null
    if (programStartedAt) {
        const { data: prevProgram } = await supabase
            .from('assigned_programs')
            .select('id')
            .eq('student_id', studentId)
            .neq('id', programId)
            .eq('status', 'completed')
            .lt('completed_at', programStartedAt)
            .order('completed_at', { ascending: false })
            .limit(1)
            .maybeSingle()

        if (prevProgram) {
            const { data: prevSessions } = await supabase
                .from('workout_sessions')
                .select('id')
                .eq('assigned_program_id', prevProgram.id)
                .eq('status', 'completed')

            const prevIds = (prevSessions ?? []).map(s => s.id)
            if (prevIds.length > 0) {
                const { data: prevLogs } = await supabase
                    .from('set_logs')
                    .select('weight, reps_completed')
                    .in('workout_session_id', prevIds)
                    .eq('is_completed', true)
                    .not('weight', 'is', null)
                    .not('reps_completed', 'is', null)

                let prevTotal = 0
                for (const log of prevLogs ?? []) {
                    prevTotal += (log.weight ?? 0) * (log.reps_completed ?? 0)
                }
                if (prevTotal > 0) {
                    previousTonnage = Math.round(prevTotal)
                }
            }
        }
    }

    return {
        total_tonnage_kg: Math.round(totalTonnage),
        weekly_tonnage: weeklyTonnage,
        previous_program_tonnage_kg: previousTonnage,
    }
}

// -- RPE ---------------------------------------------------------------------

async function computeRPE(
    supabase: SupabaseClient,
    programId: string,
    programStartedAt: string | null,
    durationWeeks: number
): Promise<ReportRPE> {
    const { data: rows } = await supabase
        .from('workout_sessions')
        .select('started_at, rpe')
        .eq('assigned_program_id', programId)
        .eq('status', 'completed')
        .not('rpe', 'is', null)

    if (!rows || rows.length === 0) {
        return {
            weekly_avg: Array(durationWeeks).fill(null),
            overall_avg: null,
        }
    }

    // Group RPE values by week (calculated from dates)
    const weekRPEs = new Map<number, number[]>()
    let totalRPE = 0
    let rpeCount = 0

    for (const row of rows) {
        const week = calcProgramWeek(row.started_at, programStartedAt)
        const rpeVal = row.rpe as number
        if (!weekRPEs.has(week)) weekRPEs.set(week, [])
        weekRPEs.get(week)!.push(rpeVal)
        totalRPE += rpeVal
        rpeCount++
    }

    const weeklyAvg: (number | null)[] = []
    for (let w = 1; w <= durationWeeks; w++) {
        const vals = weekRPEs.get(w)
        if (vals && vals.length > 0) {
            const avg = vals.reduce((a, b) => a + b, 0) / vals.length
            weeklyAvg.push(Math.round(avg * 10) / 10)
        } else {
            weeklyAvg.push(null)
        }
    }

    return {
        weekly_avg: weeklyAvg,
        overall_avg: rpeCount > 0 ? Math.round((totalRPE / rpeCount) * 10) / 10 : null,
    }
}

// -- Progression -------------------------------------------------------------

async function computeProgression(
    supabase: SupabaseClient,
    programId: string,
    programStartedAt: string | null,
    durationWeeks: number
): Promise<{ top_exercises: ReportExerciseProgression[] }> {
    // Get all completed sessions for this program
    const { data: sessions } = await supabase
        .from('workout_sessions')
        .select('id, started_at')
        .eq('assigned_program_id', programId)
        .eq('status', 'completed')

    if (!sessions || sessions.length === 0) {
        return { top_exercises: [] }
    }

    const sessionIds = sessions.map(s => s.id)
    const sessionWeekMap = new Map<string, number>()
    for (const s of sessions) {
        sessionWeekMap.set(s.id, calcProgramWeek(s.started_at, programStartedAt))
    }

    // Get all set_logs with weight for these sessions
    const { data: logs } = await supabase
        .from('set_logs')
        .select('workout_session_id, exercise_id, executed_exercise_id, weight, reps_completed, assigned_workout_item_id')
        .in('workout_session_id', sessionIds)
        .eq('is_completed', true)
        .not('weight', 'is', null)

    if (!logs || logs.length === 0) {
        return { top_exercises: [] }
    }

    // Aggregate: exercise → { sessionCount, totalVolume, weeklyMaxWeight }
    const exerciseStats = new Map<string, {
        sessionIds: Set<string>
        totalVolume: number
        weeklyMax: Map<number, number>
    }>()

    for (const log of logs) {
        const exerciseId = log.executed_exercise_id ?? log.exercise_id
        if (!exerciseId) continue

        if (!exerciseStats.has(exerciseId)) {
            exerciseStats.set(exerciseId, {
                sessionIds: new Set(),
                totalVolume: 0,
                weeklyMax: new Map(),
            })
        }

        const stats = exerciseStats.get(exerciseId)!
        stats.sessionIds.add(log.workout_session_id)
        stats.totalVolume += (log.weight ?? 0) * (log.reps_completed ?? 0)

        const week = sessionWeekMap.get(log.workout_session_id) ?? 1
        const currentMax = stats.weeklyMax.get(week) ?? 0
        if ((log.weight ?? 0) > currentMax) {
            stats.weeklyMax.set(week, log.weight ?? 0)
        }
    }

    // Rank by session count, then by total volume — pick top 3
    const ranked = [...exerciseStats.entries()]
        .sort((a, b) => {
            const diff = b[1].sessionIds.size - a[1].sessionIds.size
            return diff !== 0 ? diff : b[1].totalVolume - a[1].totalVolume
        })
        .slice(0, 3)

    // Fetch exercise names
    const topExerciseIds = ranked.map(([id]) => id)
    const { data: exercises } = await supabase
        .from('exercises')
        .select('id, name')
        .in('id', topExerciseIds)

    // Also check assigned_workout_items for snapshot names (fallback)
    const exerciseNameMap = new Map<string, string>()
    for (const e of exercises ?? []) {
        exerciseNameMap.set(e.id, e.name)
    }

    // If exercise was deleted, try to find name from assigned_workout_items snapshots
    for (const [exerciseId] of ranked) {
        if (!exerciseNameMap.has(exerciseId)) {
            const { data: snapshot } = await supabase
                .from('assigned_workout_items')
                .select('exercise_name')
                .eq('exercise_id', exerciseId)
                .not('exercise_name', 'is', null)
                .limit(1)
                .maybeSingle()

            if (snapshot?.exercise_name) {
                exerciseNameMap.set(exerciseId, snapshot.exercise_name)
            }
        }
    }

    // Build progression arrays
    const topExercises: ReportExerciseProgression[] = ranked.map(([exerciseId, stats]) => {
        const weeklyMaxWeight: (number | null)[] = []
        let startWeight: number | null = null
        let endWeight: number | null = null

        for (let w = 1; w <= durationWeeks; w++) {
            const maxW = stats.weeklyMax.get(w) ?? null
            weeklyMaxWeight.push(maxW)

            if (maxW !== null && startWeight === null) {
                startWeight = maxW
            }
            if (maxW !== null) {
                endWeight = maxW
            }
        }

        const sw = startWeight ?? 0
        const ew = endWeight ?? 0
        const changeKg = ew - sw
        const changePct = sw > 0 ? Math.round((changeKg / sw) * 1000) / 10 : 0

        return {
            exercise_id: exerciseId,
            exercise_name: exerciseNameMap.get(exerciseId) ?? 'Exercício removido',
            weekly_max_weight: weeklyMaxWeight,
            start_weight: sw,
            end_weight: ew,
            change_kg: changeKg,
            change_pct: changePct,
        }
    })

    return { top_exercises: topExercises }
}

// -- Check-ins ---------------------------------------------------------------

interface SchemaQuestion {
    id: string
    type: string
    label: string
    scale?: { min: number; max: number }
}

async function computeCheckins(
    supabase: SupabaseClient,
    programId: string
): Promise<ReportCheckins> {
    // Fetch form submissions linked to workout sessions in this program
    const { data: sessions } = await supabase
        .from('workout_sessions')
        .select('pre_workout_submission_id, post_workout_submission_id')
        .eq('assigned_program_id', programId)
        .eq('status', 'completed')

    if (!sessions) return { averages: [] }

    // Collect all submission ids (pre + post)
    const submissionIds: string[] = []
    for (const s of sessions) {
        if (s.pre_workout_submission_id) submissionIds.push(s.pre_workout_submission_id)
        if (s.post_workout_submission_id) submissionIds.push(s.post_workout_submission_id)
    }

    if (submissionIds.length === 0) return { averages: [] }

    // Fetch the submissions
    const { data: submissions } = await supabase
        .from('form_submissions')
        .select('answers_json, schema_snapshot_json')
        .in('id', submissionIds)
        .eq('status', 'submitted')

    if (!submissions || submissions.length < 3) return { averages: [] }

    // Parse each submission: extract scale-type questions and their numeric values
    // Accumulate per question_id: { label, values[], scaleMax }
    const questionAcc = new Map<string, {
        label: string
        values: number[]
        scaleMax: number
    }>()

    for (const sub of submissions) {
        const questions = extractScaleQuestions(sub.schema_snapshot_json)
        const answers = extractAnswers(sub.answers_json)

        for (const q of questions) {
            const rawValue = answers[q.id]
            const numericValue = extractNumericValue(rawValue)
            if (numericValue === null) continue

            if (!questionAcc.has(q.id)) {
                questionAcc.set(q.id, {
                    label: q.label,
                    values: [],
                    scaleMax: q.scale?.max ?? 10,
                })
            }
            questionAcc.get(q.id)!.values.push(numericValue)
        }
    }

    // Compute averages (only include questions with >= 3 data points)
    const averages: ReportCheckins['averages'] = []
    for (const [, acc] of questionAcc) {
        if (acc.values.length < 3) continue
        const avg = acc.values.reduce((a, b) => a + b, 0) / acc.values.length
        averages.push({
            question_label: acc.label,
            avg_value: Math.round(avg * 10) / 10,
            scale_max: acc.scaleMax,
        })
    }

    return { averages }
}

// ============================================================================
// Private: Form Schema Helpers
// ============================================================================

function extractScaleQuestions(schemaSnapshot: unknown): SchemaQuestion[] {
    if (!schemaSnapshot || typeof schemaSnapshot !== 'object') return []
    const schema = schemaSnapshot as Record<string, unknown>
    const questions = schema.questions as SchemaQuestion[] | undefined
    if (!Array.isArray(questions)) return []

    return questions.filter(q => q.type === 'scale' && q.id && q.label)
}

function extractAnswers(answersJson: unknown): Record<string, unknown> {
    if (!answersJson || typeof answersJson !== 'object') return {}
    const obj = answersJson as Record<string, unknown>
    // answers_json may have { answers: { ... } } or be flat
    if (obj.answers && typeof obj.answers === 'object') {
        return obj.answers as Record<string, unknown>
    }
    return obj
}

function extractNumericValue(raw: unknown): number | null {
    if (raw === null || raw === undefined) return null

    // Direct number
    if (typeof raw === 'number') return raw

    // String that parses to number
    if (typeof raw === 'string') {
        const parsed = parseFloat(raw)
        return isNaN(parsed) ? null : parsed
    }

    // Object with .value property (e.g. { type: "scale", value: 7 })
    if (typeof raw === 'object') {
        const obj = raw as Record<string, unknown>
        if (obj.value !== undefined) return extractNumericValue(obj.value)
    }

    return null
}
