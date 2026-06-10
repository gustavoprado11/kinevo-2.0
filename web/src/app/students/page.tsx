import { createClient } from '@/lib/supabase/server'
import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { getWeekRange } from '@kinevo/shared/utils/schedule-projection'
import { StudentsClient } from './students-client'

export default async function StudentsPage() {
    const { trainer } = await getTrainerWithSubscription()

    const supabase = await createClient()
    const [studentsResult, templatesResult] = await Promise.all([
        supabase
            .from('students')
            .select('id, name, email, phone, status, modality, avatar_url, created_at, is_trainer_profile')
            .eq('coach_id', trainer.id)
            .order('created_at', { ascending: false }),
        // M9 — `category` adicionado pra alimentar o NewStudentWizard:
        // step 1 filtra category='anamnese', step 2 filtra category='assessment'.
        supabase
            .from('form_templates')
            .select('id, title, trainer_id, category')
            .or(`trainer_id.eq.${trainer.id},trainer_id.is.null`)
            .or('system_key.is.null,system_key.neq.prescription_questionnaire')
            .eq('is_active', true)
            .order('created_at', { ascending: false }),
    ])

    const students = studentsResult.data
    // Mantém shape original (sem category) pra StudentModal que ainda usa
    // o dropdown atalho (decisão B do M9 — atalho preservado). Filtra
    // assessment fora pra não confundir com forms.
    const formTemplates = (templatesResult.data || [])
        .filter(t => t.category !== 'assessment')
        .map(t => ({
            id: t.id,
            title: t.title,
            trainer_id: t.trainer_id,
        }))
    // Wizard arrays
    const anamneseTemplates = (templatesResult.data || [])
        .filter(t => t.category === 'anamnese')
        .map(t => ({ id: t.id, title: t.title, category: t.category as string }))
    const assessmentTemplates = (templatesResult.data || [])
        .filter(t => t.category === 'assessment')
        .map(t => ({ id: t.id, title: t.title, category: t.category as string }))

    const studentIds = students?.map(s => s.id) || []

    if (studentIds.length === 0) {
        return (
            <StudentsClient
                trainer={trainer}
                initialStudents={[]}
                formTemplates={formTemplates}
                anamneseTemplates={anamneseTemplates}
                assessmentTemplates={assessmentTemplates}
            />
        )
    }

    // Fire both enrichment queries in parallel
    const sixtyDaysAgo = new Date()
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)
    const [{ data: activePrograms }, { data: allSessions }] = await Promise.all([
        // Active programs with scheduled days for expected-per-week calculation
        supabase
            .from('assigned_programs')
            .select(`
                id, name, student_id, duration_weeks, started_at,
                assigned_workouts(scheduled_days)
            `)
            .eq('trainer_id', trainer.id)
            .in('student_id', studentIds)
            .eq('status', 'active'),

        // Completed sessions (last 60 days — enough for last session + this week count)
        // Use completed_at as canonical "when workout happened" timestamp
        supabase
            .from('workout_sessions')
            .select('student_id, completed_at')
            .eq('trainer_id', trainer.id)
            .in('student_id', studentIds)
            .eq('status', 'completed')
            .gte('completed_at', sixtyDaysAgo.toISOString())
            .order('completed_at', { ascending: false }),
    ])

    // Build session stats per student
    const weekRange = getWeekRange(new Date(), 'America/Sao_Paulo')
    const sessionStats = new Map<string, { lastSession: string | null; thisWeekCount: number }>()

    for (const session of allSessions || []) {
        if (!session.completed_at) continue
        const existing = sessionStats.get(session.student_id)
        const inThisWeek = new Date(session.completed_at) >= weekRange.start && new Date(session.completed_at) <= weekRange.end
        if (!existing) {
            sessionStats.set(session.student_id, {
                lastSession: session.completed_at,
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
            status: student.status as 'active' | 'pending' | 'inactive',
            modality: student.modality as 'online' | 'presential',
            programName: program?.name || null,
            lastSessionDate: stats?.lastSession || null,
            sessionsThisWeek: stats?.thisWeekCount || 0,
            expectedPerWeek,
        }
    })

    return (
        <StudentsClient
            trainer={trainer}
            initialStudents={enrichedStudents}
            formTemplates={formTemplates}
            anamneseTemplates={anamneseTemplates}
            assessmentTemplates={assessmentTemplates}
        />
    )
}
