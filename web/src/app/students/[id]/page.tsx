import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { getWeekRange, generateCalendarDays } from '@kinevo/shared/utils/schedule-projection'
import { StudentDetailClient } from './student-detail-client'
import { getSessionsTonnage } from './actions/get-sessions-tonnage'

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const { trainer } = await getTrainerWithSubscription()
    const supabase = await createClient()

    // Get student data
    const { data: student } = await supabase
        .from('students')
        .select('id, name, email, phone, status, modality, avatar_url, created_at, is_trainer_profile, trainer_notes')
        .eq('id', id)
        .single()

    if (!student) {
        redirect('/students')
    }

    // Get active program for this student
    const { data: activeProgram } = await supabase
        .from('assigned_programs')
        .select(`
            id, name, description, status, duration_weeks, current_week, started_at, created_at,
            assigned_workouts (
                id,
                name,
                scheduled_days
            )
        `)
        .eq('student_id', id)
        .eq('status', 'active')
        .single()

    // Get scheduled programs
    const { data: scheduledPrograms } = await supabase
        .from('assigned_programs')
        .select('id, name, description, status, duration_weeks, current_week, started_at, scheduled_start_date, created_at')
        .eq('student_id', id)
        .eq('status', 'scheduled')
        .order('scheduled_start_date', { ascending: true })

    // Get completed programs with aggregates
    const { data: completedProgramsRaw } = await supabase
        .from('assigned_programs')
        .select(`
            id,
            name,
            description,
            started_at,
            completed_at,
            duration_weeks,
            assigned_workouts(id)
        `)
        .eq('student_id', id)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })

    // Calculate aggregates for completed programs
    const completedPrograms = await Promise.all(
        (completedProgramsRaw || []).map(async (program) => {
            const { count: sessionsCount } = await supabase
                .from('workout_sessions')
                .select('id', { count: 'exact', head: true })
                .eq('assigned_program_id', program.id)

            return {
                id: program.id,
                name: program.name,
                description: program.description,
                started_at: program.started_at,
                completed_at: program.completed_at,
                duration_weeks: program.duration_weeks,
                workouts_count: program.assigned_workouts?.length || 0,
                sessions_count: sessionsCount || 0
            }
        })
    )

    // Get workout sessions summary
    const { data: sessions } = await supabase
        .from('workout_sessions')
        .select('id, started_at, status')
        .eq('student_id', id)
        .eq('status', 'completed')
        .order('started_at', { ascending: false })

    // Calculate summary
    const totalSessions = sessions?.length || 0
    const lastSessionDate = sessions?.[0]?.started_at || null

    // Calculate sessions this week (Sunday–Saturday)
    const currentWeekRange = getWeekRange(new Date())
    const completedThisWeek = sessions?.filter(s => {
        const d = new Date(s.started_at)
        return d >= currentWeekRange.start && d <= currentWeekRange.end
    }).length || 0

    // Calculate expected workouts per week from active program
    let expectedPerWeek = 0
    if (activeProgram?.assigned_workouts) {
        const uniqueDays = new Set<number>()
        activeProgram.assigned_workouts.forEach((w: any) => w.scheduled_days?.forEach((d: number) => uniqueDays.add(d)))
        expectedPerWeek = uniqueDays.size
    }

    // Calculate streak + weekly adherence from calendar days
    let streak = 0
    let weeklyAdherence: { week: number; rate: number }[] = []
    if (activeProgram?.started_at && activeProgram?.assigned_workouts) {
        // Get all completed sessions for active program
        const { data: programSessions } = await supabase
            .from('workout_sessions')
            .select('id, assigned_workout_id, started_at, completed_at, status')
            .eq('assigned_program_id', activeProgram.id)
            .eq('status', 'completed')
            .order('started_at', { ascending: false })

        if (programSessions && programSessions.length > 0) {
            const today = new Date()
            const programStart = new Date(activeProgram.started_at)
            const days = generateCalendarDays(
                programStart,
                today,
                activeProgram.assigned_workouts as any,
                programSessions as any,
                activeProgram.started_at,
                activeProgram.duration_weeks,
            )

            // Streak: consecutive completed scheduled days going backwards
            const scheduledPastDays = days
                .filter(d => d.isInProgram && d.date <= today && d.scheduledWorkouts.length > 0)
                .sort((a, b) => b.date.getTime() - a.date.getTime())
            for (const d of scheduledPastDays) {
                if (d.status === 'done') streak++
                else break
            }

            // Weekly adherence: group past scheduled days by program week
            const weekMap = new Map<number, { scheduled: number; done: number }>()
            for (const d of days) {
                if (!d.isInProgram || !d.programWeek || d.scheduledWorkouts.length === 0 || d.date > today) continue
                const entry = weekMap.get(d.programWeek) ?? { scheduled: 0, done: 0 }
                entry.scheduled++
                if (d.status === 'done') entry.done++
                weekMap.set(d.programWeek, entry)
            }
            weeklyAdherence = Array.from(weekMap.entries())
                .sort(([a], [b]) => a - b)
                .map(([week, data]) => ({
                    week,
                    rate: data.scheduled > 0 ? Math.round((data.done / data.scheduled) * 100) : 0
                }))
        }
    }

    const historySummary = {
        totalSessions,
        lastSessionDate,
        completedThisWeek,
        expectedPerWeek,
        streak,
    }

    // Get recent sessions for the active program (if any)
    let recentSessions: any[] = []
    if (activeProgram) {
        const { data: recent } = await supabase
            .from('workout_sessions')
            .select(`
                id,
                completed_at,
                duration_seconds,
                rpe,
                feedback,
                assigned_workouts ( name )
            `)
            .eq('assigned_program_id', activeProgram.id)
            .eq('status', 'completed')
            .order('completed_at', { ascending: false })
            .limit(5)

        recentSessions = recent || []
    }

    // Calculate load progression for recent sessions
    let tonnageMap: Record<string, { tonnage: number; previousTonnage: number | null; percentChange: number | null }> = {}
    if (recentSessions.length > 0 && activeProgram) {
        const sessionIds = recentSessions.map((s: any) => s.id)
        const tonnageResult = await getSessionsTonnage(sessionIds, activeProgram.id)
        if (tonnageResult.success && tonnageResult.data) {
            tonnageMap = tonnageResult.data
        }
    }

    // Get sessions for the current week (Sun–Sat) for the calendar
    let calendarInitialSessions: { id: string; assigned_workout_id: string; started_at: string; completed_at: string | null; status: string; rpe: number | null }[] = []
    if (activeProgram) {
        const weekRange = getWeekRange(new Date())
        const { data: weekSessions } = await supabase
            .from('workout_sessions')
            .select('id, assigned_workout_id, started_at, completed_at, status, rpe')
            .eq('assigned_program_id', activeProgram.id)
            .gte('started_at', weekRange.start.toISOString())
            .lte('started_at', weekRange.end.toISOString())
            .order('started_at', { ascending: false })

        calendarInitialSessions = (weekSessions || []) as any
    }

    return (
        <StudentDetailClient
            trainer={trainer}
            student={student}
            activeProgram={activeProgram as any}
            scheduledPrograms={scheduledPrograms || []}
            historySummary={historySummary}
            recentSessions={recentSessions}
            calendarInitialSessions={calendarInitialSessions as any}
            completedPrograms={completedPrograms}
            weeklyAdherence={weeklyAdherence}
            tonnageMap={tonnageMap}
        />
    )
}
