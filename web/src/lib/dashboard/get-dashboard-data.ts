import { supabaseAdmin } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase/server'
import { getWeekRange, getProgramEndDate, getProgramWeek, getScheduledWorkoutsForDate } from '@kinevo/shared/utils/schedule-projection'

// ── Types ──

export interface DashboardStats {
    activeStudentsCount: number
    sessionsThisWeek: number
    expectedSessionsThisWeek: number
    mrr: number
    adherencePercent: number
    hasActivePrograms: boolean
    sessionsPerDay: number[] // 7 elements [Sun, Mon, ..., Sat] for sparkline
    // Trends: comparison with previous week (null = not enough data)
    sessionsLastWeek: number | null
    mrrLastMonth: number | null
    adherenceLastWeek: number | null
    activeStudentsLastWeek: number | null
}

export interface PendingFinancialItem {
    id: string
    studentName: string
    studentId: string
    studentAvatar: string | null
    amount: number
    currentPeriodEnd: string | null
    billingType: string
    status: string
}

export interface PendingFormItem {
    id: string
    studentName: string
    studentAvatar: string | null
    templateTitle: string
    submittedAt: string
}

export interface ExpiredPlanItem {
    studentId: string
    studentName: string
    studentAvatar: string | null
    planTitle: string | null
    expiredAt: string
}

export interface ExpiringProgramItem {
    studentId: string
    studentName: string
    studentAvatar: string | null
    programId: string
    programName: string
    currentWeek: number
    totalWeeks: number
    endsInDays: number
}

export interface DailyActivityItem {
    id: string
    sessionId: string
    studentName: string
    studentId: string
    workoutName: string
    completedAt: string
    duration: string
    rpe: number | null
    feedback: string | null
}

export interface ScheduledTodayItem {
    studentName: string
    workoutName: string
}

export interface AssistantInsightItem {
    id: string
    student_id: string | null
    student_name: string | null
    category: 'alert' | 'progression' | 'suggestion' | 'summary'
    priority: 'critical' | 'high' | 'medium' | 'low'
    title: string
    body: string
    action_type: string | null
    action_metadata: Record<string, any>
    status: 'new' | 'read' | 'dismissed' | 'acted'
    source: 'rules' | 'llm'
    insight_key: string
    created_at: string
}

export interface DashboardData {
    stats: DashboardStats
    pendingFinancial: PendingFinancialItem[]
    pendingForms: PendingFormItem[]
    expiredPlans: ExpiredPlanItem[]
    expiringPrograms: ExpiringProgramItem[]
    scheduledToday: ScheduledTodayItem[]
    dailyActivity: DailyActivityItem[]
    assistantInsights: AssistantInsightItem[]
}

// ── Helpers ──

function formatDuration(seconds: number | null): string {
    if (!seconds) return '-'
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    if (hours > 0) return `${hours}h ${remainingMinutes}min`
    return `${minutes}min`
}

function daysDiff(from: Date, to: Date): number {
    return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
}

/** Returns the UTC instant that corresponds to 00:00 of `dateStr` (YYYY-MM-DD) in `tz`. */
function startOfDayInTZ(dateStr: string, tz: string): Date {
    // Build a formatter that outputs full date+time parts in the target tz
    const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
    })
    // Use noon UTC on that date to safely determine the tz offset (avoids DST boundary issues)
    const noon = new Date(`${dateStr}T12:00:00Z`)
    const parts = Object.fromEntries(fmt.formatToParts(noon).map(p => [p.type, p.value]))
    // The hour in tz when it's 12:00 UTC tells us the offset
    const tzHour = parseInt(parts.hour)
    const offsetMs = (tzHour - 12) * 60 * 60 * 1000
    // Midnight in tz = dateStr 00:00 in tz = dateStr 00:00 UTC minus offset
    return new Date(new Date(`${dateStr}T00:00:00Z`).getTime() - offsetMs)
}

// ── Main function ──

async function fetchDashboardData(trainerId: string): Promise<DashboardData> {
    const supabase = await createClient()
    const today = new Date()
    // Use Brazil timezone so "today" matches the trainer's local date, not UTC
    const TZ = 'America/Sao_Paulo'
    const brDateStr = today.toLocaleDateString('en-CA', { timeZone: TZ }) // YYYY-MM-DD
    const todayStart = startOfDayInTZ(brDateStr, TZ)
    const weekRange = getWeekRange(today, TZ)

    // Previous week range for trend comparison
    const prevWeekStart = new Date(weekRange.start.getTime() - 7 * 24 * 60 * 60 * 1000)
    const prevWeekEnd = new Date(weekRange.end.getTime() - 7 * 24 * 60 * 60 * 1000)

    // 12 parallel queries
    const [
        studentsResult,
        activeContractsResult,
        overdueContractsResult,
        expiredContractsResult,
        pendingFormsResult,
        activeProgramsResult,
        weekSessionsResult,
        todaySessionsResult,
        allSessionsResult,
        insightsResult,
        expiredProgramsResult,
        prevWeekSessionsResult,
    ] = await Promise.all([
        // 1. Students
        supabaseAdmin
            .from('students')
            .select('id, name, email, status, avatar_url, is_trainer_profile')
            .eq('coach_id', trainerId)
            .in('status', ['active', 'pending']),

        // 2. Active contracts → MRR
        supabaseAdmin
            .from('student_contracts')
            .select('amount')
            .eq('trainer_id', trainerId)
            .eq('status', 'active'),

        // 3. Overdue / pending contracts
        supabaseAdmin
            .from('student_contracts')
            .select('id, student_id, amount, current_period_end, billing_type, status, students!inner(name, avatar_url)')
            .eq('trainer_id', trainerId)
            .in('status', ['past_due', 'pending'])
            .order('current_period_end', { ascending: true })
            .limit(10),

        // 4. Expired contracts (canceled + period ended)
        supabaseAdmin
            .from('student_contracts')
            .select('id, student_id, plan_title, current_period_end, students!inner(name, avatar_url)')
            .eq('trainer_id', trainerId)
            .eq('status', 'canceled')
            .not('current_period_end', 'is', null)
            .lt('current_period_end', today.toISOString())
            .order('current_period_end', { ascending: false })
            .limit(10),

        // 5. Pending form submissions (submitted, no feedback)
        // Exclude workout check-ins — they are operational data shown in session context
        supabaseAdmin
            .from('form_submissions')
            .select('id, student_id, submitted_at, form_template_id')
            .eq('trainer_id', trainerId)
            .eq('status', 'submitted')
            .is('feedback_sent_at', null)
            .not('trigger_context', 'in', '("pre_workout","post_workout")')
            .order('submitted_at', { ascending: false })
            .limit(10),

        // 6. Active programs with workouts
        supabaseAdmin
            .from('assigned_programs')
            .select(`
                id, name, student_id, duration_weeks, started_at, status,
                assigned_workouts(id, name, scheduled_days)
            `)
            .eq('trainer_id', trainerId)
            .eq('status', 'active'),

        // 7. Completed sessions this week — use completed_at as canonical timestamp
        supabaseAdmin
            .from('workout_sessions')
            .select('id, student_id, completed_at')
            .eq('trainer_id', trainerId)
            .eq('status', 'completed')
            .gte('completed_at', weekRange.start.toISOString())
            .lte('completed_at', weekRange.end.toISOString()),

        // 8. Today's completed sessions (daily activity)
        supabase
            .from('workout_sessions')
            .select(`
                id, completed_at, duration_seconds, rpe, feedback,
                assigned_workouts:assigned_workout_id!inner(name, assigned_program_id),
                students:student_id!inner(id, name)
            `)
            .eq('status', 'completed')
            .gte('completed_at', todayStart.toISOString())
            .eq('trainer_id', trainerId)
            .order('completed_at', { ascending: false }),

        // 9. All completed sessions (for inactivity detection) — use completed_at
        supabaseAdmin
            .from('workout_sessions')
            .select('student_id, completed_at')
            .eq('trainer_id', trainerId)
            .eq('status', 'completed')
            .order('completed_at', { ascending: false }),

        // 10. Assistant insights (active, non-expired)
        supabaseAdmin
            .from('assistant_insights')
            .select('id, student_id, category, priority, title, body, action_type, action_metadata, status, source, insight_key, created_at')
            .eq('trainer_id', trainerId)
            .in('status', ['new', 'read'])
            .order('created_at', { ascending: false })
            .limit(20),

        // 11. Recently expired programs (last 30 days)
        supabaseAdmin
            .from('assigned_programs')
            .select('id, name, student_id, duration_weeks, started_at, status')
            .eq('trainer_id', trainerId)
            .eq('status', 'expired')
            .gte('updated_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),

        // 12. Previous week sessions (for trend comparison)
        supabaseAdmin
            .from('workout_sessions')
            .select('id')
            .eq('trainer_id', trainerId)
            .eq('status', 'completed')
            .gte('completed_at', prevWeekStart.toISOString())
            .lte('completed_at', prevWeekEnd.toISOString()),
    ])

    const students = studentsResult.data ?? []
    const activeStudents = students.filter(s => s.status === 'active' && !s.is_trainer_profile)
    const activePrograms = activeProgramsResult.data ?? []
    const weekSessions = weekSessionsResult.data ?? []
    const allSessions = allSessionsResult.data ?? []

    // ── Stats ──

    const activeStudentsCount = activeStudents.length

    const sessionsThisWeek = weekSessions.length

    // Sessions per day of week (sparkline data: [Sun, Mon, ..., Sat])
    const sessionsPerDay = [0, 0, 0, 0, 0, 0, 0]
    for (const s of weekSessions) {
        const day = new Date(s.completed_at).getDay()
        sessionsPerDay[day]++
    }

    // Expected sessions per week: sum unique scheduled_days across all active programs
    let expectedSessionsThisWeek = 0
    for (const program of activePrograms) {
        const uniqueDays = new Set<number>()
        const workouts = (program as any).assigned_workouts ?? []
        for (const w of workouts) {
            if (w.scheduled_days) {
                for (const d of w.scheduled_days) uniqueDays.add(d)
            }
        }
        expectedSessionsThisWeek += uniqueDays.size
    }

    // MRR
    const mrr = (activeContractsResult.data ?? []).reduce((sum, c) => sum + (c.amount || 0), 0)

    // Adherence: students with active program who trained in last 5 days
    const fiveDaysAgo = new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000)
    const studentsWithProgram = new Set(activePrograms.map(p => p.student_id))
    const lastSessionByStudent = new Map<string, Date>()
    for (const s of allSessions) {
        if (!lastSessionByStudent.has(s.student_id)) {
            lastSessionByStudent.set(s.student_id, new Date(s.completed_at))
        }
    }

    const totalWithProgram = [...studentsWithProgram].filter(id =>
        activeStudents.some(s => s.id === id)
    ).length

    const onTrack = [...studentsWithProgram].filter(id => {
        if (!activeStudents.some(s => s.id === id)) return false
        const lastDate = lastSessionByStudent.get(id)
        return lastDate && lastDate >= fiveDaysAgo
    }).length

    const adherencePercent = totalWithProgram > 0 ? Math.round((onTrack / totalWithProgram) * 100) : 0
    const hasActivePrograms = totalWithProgram > 0

    // ── Trends (previous week comparison) ──
    const sessionsLastWeek = prevWeekSessionsResult.data?.length ?? null

    // ── Pending Financial ──

    const pendingFinancial: PendingFinancialItem[] = (overdueContractsResult.data ?? []).map(c => ({
        id: c.id,
        studentName: (c.students as unknown as { name: string; avatar_url: string | null })?.name || 'Aluno',
        studentId: c.student_id,
        studentAvatar: (c.students as unknown as { name: string; avatar_url: string | null })?.avatar_url || null,
        amount: c.amount,
        currentPeriodEnd: c.current_period_end,
        billingType: c.billing_type,
        status: c.status,
    }))

    // ── Expired Plans (deduplicate students already in pendingFinancial) ──

    const financialStudentIds = new Set(pendingFinancial.map(f => f.studentId))
    const expiredPlans: ExpiredPlanItem[] = (expiredContractsResult.data ?? [])
        .filter(c => !financialStudentIds.has(c.student_id))
        .map(c => ({
            studentId: c.student_id,
            studentName: (c.students as unknown as { name: string; avatar_url: string | null })?.name || 'Aluno',
            studentAvatar: (c.students as unknown as { name: string; avatar_url: string | null })?.avatar_url || null,
            planTitle: c.plan_title,
            expiredAt: c.current_period_end!,
        }))

    // ── Pending Forms ──

    const rawForms = pendingFormsResult.data ?? []
    let pendingForms: PendingFormItem[] = []
    if (rawForms.length > 0) {
        const studentIds = [...new Set(rawForms.map(f => f.student_id))]
        const templateIds = [...new Set(rawForms.map(f => f.form_template_id))]

        const [studentsLookup, templatesLookup] = await Promise.all([
            supabaseAdmin.from('students').select('id, name, avatar_url').in('id', studentIds),
            supabaseAdmin.from('form_templates').select('id, title').in('id', templateIds),
        ])

        const studentMap = new Map((studentsLookup.data ?? []).map(s => [s.id, s]))
        const templateMap = new Map((templatesLookup.data ?? []).map(t => [t.id, t]))

        pendingForms = rawForms.map(f => ({
            id: f.id,
            studentName: studentMap.get(f.student_id)?.name || 'Aluno',
            studentAvatar: studentMap.get(f.student_id)?.avatar_url || null,
            templateTitle: templateMap.get(f.form_template_id)?.title || 'Formulário',
            submittedAt: f.submitted_at,
        }))
    }



    // ── Expiring Programs (active expiring soon + expired without replacement) ──

    const expiringPrograms: ExpiringProgramItem[] = []
    const studentsWithActiveProgram = new Set(activePrograms.map(p => p.student_id))

    // Active programs expiring within 7 days
    for (const program of activePrograms) {
        if (!program.started_at || !program.duration_weeks) continue
        const endDate = getProgramEndDate(program.started_at, program.duration_weeks)
        const endsInDays = daysDiff(today, endDate)
        if (endsInDays > 7) continue
        const currentWeek = getProgramWeek(today, program.started_at, program.duration_weeks) ?? program.duration_weeks
        const student = activeStudents.find(s => s.id === program.student_id)
        if (!student) continue
        expiringPrograms.push({
            studentId: program.student_id,
            studentName: student.name,
            studentAvatar: student.avatar_url,
            programId: program.id,
            programName: program.name,
            currentWeek,
            totalWeeks: program.duration_weeks,
            endsInDays,
        })
    }

    // Expired programs where student has no active replacement
    for (const program of expiredProgramsResult.data ?? []) {
        if (studentsWithActiveProgram.has(program.student_id)) continue // already has a new program
        const student = activeStudents.find(s => s.id === program.student_id)
        if (!student) continue
        const endDate = program.started_at && program.duration_weeks
            ? getProgramEndDate(program.started_at, program.duration_weeks)
            : today
        const endsInDays = daysDiff(today, endDate) // negative = days since expiry
        expiringPrograms.push({
            studentId: program.student_id,
            studentName: student.name,
            studentAvatar: student.avatar_url,
            programId: program.id,
            programName: program.name,
            currentWeek: program.duration_weeks || 0,
            totalWeeks: program.duration_weeks || 0,
            endsInDays,
        })
    }

    expiringPrograms.sort((a, b) => a.endsInDays - b.endsInDays)

    // ── Daily Activity ──

    const dailyActivity: DailyActivityItem[] = (todaySessionsResult.data ?? []).map((session: any) => ({
        id: session.id,
        sessionId: session.id,
        studentName: session.students.name,
        studentId: session.students.id,
        workoutName: session.assigned_workouts.name,
        completedAt: session.completed_at,
        duration: formatDuration(session.duration_seconds),
        rpe: session.rpe,
        feedback: session.feedback || null,
    }))

    // ── Scheduled Today (for empty state) ──

    const scheduledToday: ScheduledTodayItem[] = []
    for (const program of activePrograms) {
        if (!program.started_at) continue
        const workouts = (program as any).assigned_workouts ?? []
        const todayWorkouts = getScheduledWorkoutsForDate(
            today,
            workouts.map((w: any) => ({ id: w.id, name: w.name, scheduled_days: w.scheduled_days })),
            program.started_at,
            program.duration_weeks,
        )
        const student = activeStudents.find(s => s.id === program.student_id)
        if (!student) continue
        for (const w of todayWorkouts) {
            scheduledToday.push({
                studentName: student.name,
                workoutName: w.name,
            })
        }
    }

    // ── Assistant Insights ──

    const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
    const rawInsights = insightsResult.data ?? []

    // Resolve student names from already-fetched students
    const studentNameMap = new Map(activeStudents.map(s => [s.id, s.name]))
    const assistantInsights: AssistantInsightItem[] = rawInsights.map((row: any) => ({
        ...row,
        student_name: row.student_id ? (studentNameMap.get(row.student_id) || null) : null,
        action_metadata: row.action_metadata || {},
    }))
    assistantInsights.sort((a, b) => {
        const pa = PRIORITY_ORDER[a.priority] ?? 3
        const pb = PRIORITY_ORDER[b.priority] ?? 3
        if (pa !== pb) return pa - pb
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

    return {
        stats: {
            activeStudentsCount,
            sessionsThisWeek,
            expectedSessionsThisWeek,
            mrr,
            adherencePercent,
            hasActivePrograms,
            sessionsPerDay,
            sessionsLastWeek,
            mrrLastMonth: null, // TODO: requires historical contract data
            adherenceLastWeek: null, // TODO: requires historical adherence tracking
            activeStudentsLastWeek: null, // TODO: requires historical student count
        },
        pendingFinancial,
        pendingForms,
        expiredPlans,
        expiringPrograms,
        dailyActivity,
        scheduledToday,
        assistantInsights,
    }
}

// ── Public export ──
// Next.js 16 dynamic server components re-fetch on every navigation.
// Promise.all() parallelism keeps the 9 queries fast (~50-100ms total).

export const getDashboardData = fetchDashboardData
