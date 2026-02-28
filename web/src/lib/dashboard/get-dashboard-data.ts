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

export interface InactiveStudentItem {
    id: string
    name: string
    avatarUrl: string | null
    daysSinceLastSession: number
    programName: string
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

export interface DashboardData {
    stats: DashboardStats
    pendingFinancial: PendingFinancialItem[]
    pendingForms: PendingFormItem[]
    inactiveStudents: InactiveStudentItem[]
    expiringPrograms: ExpiringProgramItem[]
    scheduledToday: ScheduledTodayItem[]
    dailyActivity: DailyActivityItem[]
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

// ── Main function ──

async function fetchDashboardData(trainerId: string): Promise<DashboardData> {
    const supabase = await createClient()
    const today = new Date()
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const weekRange = getWeekRange(today)

    // 8 parallel queries
    const [
        studentsResult,
        activeContractsResult,
        overdueContractsResult,
        pendingFormsResult,
        activeProgramsResult,
        weekSessionsResult,
        todaySessionsResult,
        allSessionsResult,
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

        // 4. Pending form submissions (submitted, no feedback)
        supabaseAdmin
            .from('form_submissions')
            .select('id, student_id, submitted_at, form_template_id')
            .eq('trainer_id', trainerId)
            .eq('status', 'submitted')
            .is('feedback_sent_at', null)
            .order('submitted_at', { ascending: false })
            .limit(10),

        // 5. Active programs with workouts
        supabaseAdmin
            .from('assigned_programs')
            .select(`
                id, name, student_id, duration_weeks, started_at, status,
                assigned_workouts(id, name, scheduled_days)
            `)
            .eq('trainer_id', trainerId)
            .eq('status', 'active'),

        // 6. Completed sessions this week
        supabaseAdmin
            .from('workout_sessions')
            .select('id, student_id, started_at')
            .eq('trainer_id', trainerId)
            .eq('status', 'completed')
            .gte('started_at', weekRange.start.toISOString())
            .lte('started_at', weekRange.end.toISOString()),

        // 7. Today's completed sessions (daily activity)
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

        // 8. All completed sessions (for inactivity detection)
        supabaseAdmin
            .from('workout_sessions')
            .select('student_id, started_at')
            .eq('trainer_id', trainerId)
            .eq('status', 'completed')
            .order('started_at', { ascending: false }),
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
        const day = new Date(s.started_at).getDay()
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
            lastSessionByStudent.set(s.student_id, new Date(s.started_at))
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

    // ── Inactive Students ──

    const inactiveStudents: InactiveStudentItem[] = []
    for (const studentId of studentsWithProgram) {
        const student = activeStudents.find(s => s.id === studentId)
        if (!student) continue

        const lastSession = lastSessionByStudent.get(studentId)
        const daysInactive = lastSession ? daysDiff(lastSession, today) : 999

        if (daysInactive >= 5) {
            const program = activePrograms.find(p => p.student_id === studentId)
            inactiveStudents.push({
                id: studentId,
                name: student.name,
                avatarUrl: student.avatar_url,
                daysSinceLastSession: daysInactive,
                programName: program?.name || 'Programa',
            })
        }
    }
    inactiveStudents.sort((a, b) => b.daysSinceLastSession - a.daysSinceLastSession)

    // ── Expiring Programs ──

    const expiringPrograms: ExpiringProgramItem[] = []
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

    return {
        stats: {
            activeStudentsCount,
            sessionsThisWeek,
            expectedSessionsThisWeek,
            mrr,
            adherencePercent,
            hasActivePrograms,
            sessionsPerDay,
        },
        pendingFinancial,
        pendingForms,
        inactiveStudents,
        expiringPrograms,
        dailyActivity,
        scheduledToday,
    }
}

// ── Public export ──
// Next.js 16 dynamic server components re-fetch on every navigation.
// Promise.all() parallelism keeps the 8 queries fast (~50-100ms total).

export const getDashboardData = fetchDashboardData
