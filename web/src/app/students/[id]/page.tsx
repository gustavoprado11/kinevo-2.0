import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { getWeekRange } from '@kinevo/shared/utils/schedule-projection'
import { StudentDetailClient } from './student-detail-client'

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const { trainer } = await getTrainerWithSubscription()
    const supabase = await createClient()

    // Get student data
    const { data: student } = await supabase
        .from('students')
        .select('id, name, email, phone, status, modality, avatar_url, created_at')
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

    const historySummary = {
        totalSessions,
        lastSessionDate,
        completedThisWeek,
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

    // Get sessions for the current week (Sun–Sat) for the calendar
    let calendarInitialSessions: { id: string; assigned_workout_id: string; started_at: string; completed_at: string | null; status: string }[] = []
    if (activeProgram) {
        const weekRange = getWeekRange(new Date())
        const { data: weekSessions } = await supabase
            .from('workout_sessions')
            .select('id, assigned_workout_id, started_at, completed_at, status')
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
        />
    )
}
