import { createClient } from '@/lib/supabase/server'
import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { getWeekRange } from '@kinevo/shared/utils/schedule-projection'
import { StudentsClient } from './students-client'

export default async function StudentsPage() {
    const { trainer } = await getTrainerWithSubscription()

    const supabase = await createClient()
    const { data: students } = await supabase
        .from('students')
        .select('id, name, email, phone, status, modality, avatar_url, created_at, is_trainer_profile')
        .order('created_at', { ascending: false })

    const studentIds = students?.map(s => s.id) || []

    if (studentIds.length === 0) {
        return <StudentsClient trainer={trainer} initialStudents={[]} />
    }

    // Active programs with scheduled days for expected-per-week calculation
    const { data: activePrograms } = await supabase
        .from('assigned_programs')
        .select(`
            id, name, student_id, duration_weeks, started_at,
            assigned_workouts(scheduled_days)
        `)
        .in('student_id', studentIds)
        .eq('status', 'active')

    // All completed sessions for these students (for last session + this week count)
    const { data: allSessions } = await supabase
        .from('workout_sessions')
        .select('student_id, started_at')
        .in('student_id', studentIds)
        .eq('status', 'completed')
        .order('started_at', { ascending: false })

    // Build session stats per student
    const weekRange = getWeekRange(new Date())
    const sessionStats = new Map<string, { lastSession: string | null; thisWeekCount: number }>()

    for (const session of allSessions || []) {
        const existing = sessionStats.get(session.student_id)
        const inThisWeek = new Date(session.started_at) >= weekRange.start && new Date(session.started_at) <= weekRange.end
        if (!existing) {
            sessionStats.set(session.student_id, {
                lastSession: session.started_at,
                thisWeekCount: inThisWeek ? 1 : 0
            })
        } else {
            if (inThisWeek) existing.thisWeekCount++
        }
    }

    // Enrich students with program + session data
    const enrichedStudents = (students || []).map(student => {
        const program = activePrograms?.find(p => p.student_id === student.id)
        const stats = sessionStats.get(student.id)

        let expectedPerWeek = 0
        if (program?.assigned_workouts) {
            const uniqueDays = new Set<number>()
            ;(program.assigned_workouts as any[]).forEach((w: any) => w.scheduled_days?.forEach((d: number) => uniqueDays.add(d)))
            expectedPerWeek = uniqueDays.size
        }

        return {
            ...student,
            programName: program?.name || null,
            lastSessionDate: stats?.lastSession || null,
            sessionsThisWeek: stats?.thisWeekCount || 0,
            expectedPerWeek,
        }
    })

    return <StudentsClient trainer={trainer} initialStudents={enrichedStudents} />
}
