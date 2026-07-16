import { createClient } from '@/lib/supabase/server'
import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { getWeekRange } from '@kinevo/shared/utils/schedule-projection'
import { getStudentScope } from '@/lib/studio/student-scope'
import { getOrgMembersDirectory } from '@/lib/studio/org-directory'
import { StudentsClient } from './students-client'

export default async function StudentsPage() {
    const { trainer, tier } = await getTrainerWithSubscription()
    const scope = await getStudentScope(trainer.id)
    // Alunos particulares (coach de estúdio): exigem plano solo PAGO do coach.
    const hasPaidSolo = tier !== 'free'

    const supabase = await createClient()

    // Estúdio: lista TODOS os alunos da org (visibilidade open) + os PRÓPRIOS
    // fora da org (alunos particulares, is_private) + selecionamos coach_id p/
    // mostrar o "Responsável". Solo: só os próprios (coach_id).
    const baseStudentQuery = supabase
        .from('students')
        .select('id, name, email, phone, status, modality, avatar_url, created_at, is_trainer_profile, coach_id, is_private, organization_id')
        .order('created_at', { ascending: false })

    const [studentsResult, templatesResult] = await Promise.all([
        scope.kind === 'org'
            ? baseStudentQuery.or(`organization_id.eq.${scope.orgId},coach_id.eq.${trainer.id}`)
            : baseStudentQuery.eq('coach_id', trainer.id),
        // M9 — `category` adicionado pra alimentar o NewStudentWizard:
        // step 1 filtra category='anamnese', step 2 filtra category='assessment'.
        supabase
            .from('form_templates')
            .select('id, title, trainer_id, category')
            // Estúdios (265): RLS = own + sistema + colegas (biblioteca compartilhada)
            
            .or('system_key.is.null,system_key.neq.prescription_questionnaire')
            .eq('is_active', true)
            .order('created_at', { ascending: false }),
    ])

    // Estúdio: o "perfil Eu" (is_trainer_profile) de CADA treinador entra na org
    // pelo backfill — mostrar o Eu dos colegas como aluno é ruído. Mantém só o meu.
    const students = (studentsResult.data ?? []).filter(
        s => !(s.is_trainer_profile && s.coach_id !== trainer.id),
    )
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

    // Estúdio: diretório de responsáveis (nome por coach) + lista de coaches p/
    // o filtro. Só o gestor reatribui pela lista; o card do perfil também.
    const isStudioView = scope.kind === 'org'
    const isStudioManager = scope.kind === 'org' && scope.isManager

    // Entrada no estúdio — alunos MEUS criados ANTES do vínculo ficam sem org e
    // sem is_private ("não classificados"; o trigger derive só roda no INSERT).
    // O banner + modal de classificação resolvem o limbo, aluno a aluno.
    const unclassifiedStudents = isStudioView
        ? students
              .filter(s => s.coach_id === trainer.id && !s.organization_id && !s.is_private && !s.is_trainer_profile && s.status !== 'archived')
              .map(s => ({ id: s.id, name: s.name, avatar_url: s.avatar_url }))
        : []
    const coachNameById = new Map<string, string>()
    let studioCoaches: { id: string; name: string }[] = []
    if (isStudioView && scope.kind === 'org') {
        const directory = await getOrgMembersDirectory(supabase, scope.orgId)
        for (const m of directory) coachNameById.set(m.trainer_id, m.name)
        studioCoaches = directory
            .filter(m => m.is_coach && m.status === 'active')
            .map(m => ({ id: m.trainer_id, name: m.name }))
    }

    if (studentIds.length === 0) {
        return (
            <StudentsClient
                trainer={trainer}
                initialStudents={[]}
                formTemplates={formTemplates}
                anamneseTemplates={anamneseTemplates}
                assessmentTemplates={assessmentTemplates}
                isStudioView={isStudioView}
                hasPaidSolo={hasPaidSolo}
                isStudioManager={isStudioManager}
                unclassifiedStudents={unclassifiedStudents}
                studioCoaches={studioCoaches}
            />
        )
    }

    // Fire both enrichment queries in parallel
    const sixtyDaysAgo = new Date()
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)
    // No estúdio, os programas/sessões podem ser de qualquer treinador da org —
    // a RLS org já restringe ao conjunto de alunos visíveis, então filtramos só
    // por student_id (não por trainer_id, que é o responsável, não o autor).
    const programsQuery = supabase
        .from('assigned_programs')
        .select(`
            id, name, student_id, duration_weeks, started_at,
            assigned_workouts(scheduled_days)
        `)
        .in('student_id', studentIds)
        .eq('status', 'active')
    const sessionsQuery = supabase
        .from('workout_sessions')
        .select('student_id, completed_at')
        .in('student_id', studentIds)
        .eq('status', 'completed')
        .gte('completed_at', sixtyDaysAgo.toISOString())
        .order('completed_at', { ascending: false })

    const [{ data: activePrograms }, { data: allSessions }] = await Promise.all([
        isStudioView ? programsQuery : programsQuery.eq('trainer_id', trainer.id),
        isStudioView ? sessionsQuery : sessionsQuery.eq('trainer_id', trainer.id),
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
            // AG5: conta OCORRÊNCIAS agendadas (soma dos scheduled_days por
            // treino), não dias únicos — alinhado com o dashboard/ranking e a
            // página do aluno (aluno com 2 treinos no mesmo dia mostrava 3/3
            // aqui e 3/4 no resto do app).
            expectedPerWeek = (program.assigned_workouts as any[]).reduce(
                (sum: number, w: any) => sum + (w.scheduled_days?.length ?? 0),
                0,
            )
        }

        return {
            ...student,
            status: student.status as 'active' | 'pending' | 'inactive',
            modality: student.modality as 'online' | 'presential',
            programName: program?.name || null,
            lastSessionDate: stats?.lastSession || null,
            sessionsThisWeek: stats?.thisWeekCount || 0,
            expectedPerWeek,
            responsibleCoachId: student.coach_id,
            responsibleCoachName: isStudioView ? (coachNameById.get(student.coach_id ?? '') ?? null) : null,
        }
    })

    return (
        <StudentsClient
            trainer={trainer}
            initialStudents={enrichedStudents}
            formTemplates={formTemplates}
            anamneseTemplates={anamneseTemplates}
            assessmentTemplates={assessmentTemplates}
            isStudioView={isStudioView}
                hasPaidSolo={hasPaidSolo}
                isStudioManager={isStudioManager}
                unclassifiedStudents={unclassifiedStudents}
            studioCoaches={studioCoaches}
        />
    )
}
