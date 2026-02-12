import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
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

    // Calculate sessions this week
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
    const completedThisWeek = sessions?.filter(s =>
        new Date(s.started_at) >= oneWeekAgo
    ).length || 0

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

    // Get sessions from the last 7 days for the tracker
    const sessionsLast7Days = sessions?.filter(s =>
        new Date(s.started_at) >= oneWeekAgo
    ) || []

    return (
        <StudentDetailClient
            trainer={trainer}
            student={student}
            activeProgram={activeProgram as any}
            scheduledPrograms={scheduledPrograms || []}
            historySummary={historySummary}
            recentSessions={recentSessions}
            sessionsLast7Days={sessionsLast7Days}
            completedPrograms={completedPrograms}
        />
    )
}
