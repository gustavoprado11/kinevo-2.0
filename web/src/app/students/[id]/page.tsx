import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { generateCalendarDays } from '@kinevo/shared/utils/schedule-projection'
import { computeWeeklyAdherence } from '@/lib/students/weekly-adherence'
import { StudentDetailClient } from './student-detail-client'
import { getSessionsTonnage } from './actions/get-sessions-tonnage'
import { computeDisplayStatus } from '@/lib/utils/financial'
import { BODY_METRIC_FIELD_MAP, SUPPORTED_METRIC_SYSTEM_KEYS } from '@/lib/constants/body-metrics'
import { getAssessmentSessionList } from '@/actions/assessments/get-session-list'
import type { InsightItem, InsightActionMetadata } from '@/actions/insights'

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const { trainer } = await getTrainerWithSubscription()
    const supabase = await createClient()

    // Compute month range up front so the calendar query can run in parallel
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

    // ── STAGE 1: fire every independent query in parallel ──
    const [
        { data: student },
        { data: programCandidates },
        { data: scheduledPrograms },
        { data: completedProgramsRaw },
        { data: sessions },
        { data: monthSessions },
        { data: insightsData },
        { data: bodyMetricsHistoryData },
        { data: contractData },
        { data: lastSubmissionData },
        { data: pendingFormsData },
        { data: bodyMetricsData },
        { data: formTemplatesData },
        { data: formSchedulesData },
        { data: draftProgramsRaw },
        { data: aiDraftsRaw },
        presencialRes,
    ] = await Promise.all([
        supabase
            .from('students')
            .select('id, name, email, phone, status, modality, avatar_url, created_at, is_trainer_profile, trainer_notes, objective, management_tags, coach_id, is_private, max_heart_rate_bpm')
            .eq('id', id)
            .single(),

        // Active or expired program (show expired to trainer for action)
        supabase
            .from('assigned_programs')
            .select(`
                id, name, description, status, duration_weeks, current_week, started_at, created_at, expires_at,
                assigned_workouts (
                    id,
                    name,
                    scheduled_days,
                    workout_type,
                    order_index
                )
            `)
            .eq('student_id', id)
            .in('status', ['active', 'expired'])
            .order('started_at', { ascending: false })
            .limit(1),

        // Scheduled programs (include assigned_workouts for activation validation)
        supabase
            .from('assigned_programs')
            .select('id, name, description, status, duration_weeks, current_week, started_at, scheduled_start_date, created_at, assigned_workouts(id, name, scheduled_days)')
            .eq('student_id', id)
            .eq('status', 'scheduled')
            .order('scheduled_start_date', { ascending: true }),

        // Completed programs with aggregates
        supabase
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
            .order('completed_at', { ascending: false }),

        // Workout sessions summary — use completed_at as canonical timestamp
        supabase
            .from('workout_sessions')
            .select('id, completed_at, status')
            .eq('student_id', id)
            .eq('status', 'completed')
            .order('completed_at', { ascending: false }),

        // All sessions for the current month for the calendar (full history)
        supabase
            .from('workout_sessions')
            .select('id, assigned_workout_id, started_at, completed_at, status, rpe, assigned_program_id')
            .eq('student_id', id)
            .gte('started_at', monthStart.toISOString())
            .lte('started_at', monthEnd.toISOString())
            .order('started_at', { ascending: false }),

        // Student-specific AI insights
        supabase
            .from('assistant_insights')
            .select('id, student_id, category, priority, title, body, action_type, action_metadata, status, source, insight_key, created_at')
            .eq('student_id', id)
            .in('status', ['new', 'read'])
            .order('created_at', { ascending: false })
            .limit(10),

        // Body metrics history (last 5 submissions for trend).
        // Estúdio: sem filtro por trainer_id — a RLS org (form_submissions_org_select)
        // gate por aluno; solo continua restrito pela policy base por-treinador.
        supabase
            .from('form_submissions')
            .select('answers_json, submitted_at, form_templates!inner(system_key)')
            .eq('student_id', id)
            .in('status', ['submitted', 'reviewed'])
            .in('form_templates.system_key', SUPPORTED_METRIC_SYSTEM_KEYS)
            .order('submitted_at', { ascending: false })
            .limit(5),

        // Active contract (most relevant: active > past_due > pending)
        supabase
            .from('student_contracts')
            .select('id, status, billing_type, amount, current_period_end, cancel_at_period_end, canceled_by, canceled_at, trainer_plans(title, interval)')
            .eq('student_id', id)
            .eq('trainer_id', trainer.id)
            .neq('status', 'canceled')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),

        // Last submitted/reviewed form submission (RLS org/base gate por aluno)
        supabase
            .from('form_submissions')
            .select('id, status, submitted_at, form_templates(title, category)')
            .eq('student_id', id)
            .in('status', ['submitted', 'reviewed'])
            .order('submitted_at', { ascending: false })
            .limit(1)
            .maybeSingle(),

        // Pending form requests (inbox items not completed; RLS gate por aluno)
        supabase
            .from('student_inbox_items')
            .select('id, title, status, created_at')
            .eq('student_id', id)
            .eq('type', 'form_request')
            .in('status', ['unread', 'pending_action'])
            .order('created_at', { ascending: false }),

        // Latest body metrics from assessment submissions
        supabase
            .from('form_submissions')
            .select('answers_json, submitted_at, form_templates!inner(system_key)')
            .eq('student_id', id)
            .in('status', ['submitted', 'reviewed'])
            .in('form_templates.system_key', SUPPORTED_METRIC_SYSTEM_KEYS)
            .order('submitted_at', { ascending: false })
            .limit(1)
            .maybeSingle(),

        // Available form templates for the "Send assessment" dropdown
        supabase
            .from('form_templates')
            .select('id, title, category')
            .or(`trainer_id.eq.${trainer.id},trainer_id.is.null`)
            .eq('is_active', true)
            .order('title'),

        // Active recurring form schedules
        supabase
            .from('form_schedules')
            .select('id, student_id, form_template_id, frequency, is_active, next_due_at, last_sent_at, created_at, form_templates!inner(title)')
            .eq('student_id', id)
            .eq('is_active', true)
            .order('created_at', { ascending: false }),

        // Draft programs created outside the builder (ex.: assistente via MCP).
        // Não têm superfície própria → entram no card "Próximos Programas".
        supabase
            .from('assigned_programs')
            .select('id, name, description, status, duration_weeks, current_week, started_at, created_at, assigned_workouts(id, name, scheduled_days)')
            .eq('student_id', id)
            .eq('status', 'draft')
            .order('created_at', { ascending: false }),

        // PF11: dependem só do `id` do param — estavam SERIAIS depois dos
        // estágios paralelos (+2 roundtrips de TTFB pdx1↔us-west-2).
        supabase
            .from('prescription_generations')
            .select('id, created_at')
            .eq('student_id', id)
            .eq('status', 'pending_review')
            .order('created_at', { ascending: false }),

        getAssessmentSessionList({
            studentId: id,
            filter: 'completed',
            limit: 1,
        }),
    ])

    if (!student) {
        redirect('/students')
    }

    const activeProgram = programCandidates?.[0] ?? null
    const calendarInitialSessions = (monthSessions || []) as { id: string; assigned_workout_id: string; started_at: string; completed_at: string | null; status: string; rpe: number | null; assigned_program_id: string | null }[]

    // ── STAGE 2: queries that depend on Stage 1 results, fire in parallel ──
    const completedProgramIds = (completedProgramsRaw || []).map(p => p.id)
    const needsProgramSessions = !!(activeProgram?.started_at && activeProgram?.assigned_workouts)

    const [sessionCountsResult, programSessionsResult, recentSessionsResult] = await Promise.all([
        completedProgramIds.length > 0
            ? supabase
                .from('workout_sessions')
                .select('assigned_program_id')
                .in('assigned_program_id', completedProgramIds)
            : Promise.resolve({ data: null }),

        needsProgramSessions
            ? supabase
                .from('workout_sessions')
                .select('id, assigned_workout_id, started_at, completed_at, status')
                .eq('assigned_program_id', activeProgram!.id)
                .eq('status', 'completed')
                .order('completed_at', { ascending: false })
            : Promise.resolve({ data: null }),

        activeProgram
            ? supabase
                .from('workout_sessions')
                .select(`
                    id,
                    completed_at,
                    duration_seconds,
                    rpe,
                    feedback,
                    pre_workout_submission_id,
                    post_workout_submission_id,
                    assigned_workouts ( name )
                `)
                .eq('assigned_program_id', activeProgram.id)
                .eq('status', 'completed')
                .order('completed_at', { ascending: false })
                .limit(5)
            : Promise.resolve({ data: null }),
    ])

    const sessionCountsByProgram = new Map<string, number>()
    for (const s of sessionCountsResult.data || []) {
        if (!s.assigned_program_id) continue
        sessionCountsByProgram.set(s.assigned_program_id, (sessionCountsByProgram.get(s.assigned_program_id) || 0) + 1)
    }
    const completedPrograms = (completedProgramsRaw || []).map(program => ({
        id: program.id,
        name: program.name,
        description: program.description,
        started_at: program.started_at,
        completed_at: program.completed_at,
        duration_weeks: program.duration_weeks,
        workouts_count: program.assigned_workouts?.length || 0,
        sessions_count: sessionCountsByProgram.get(program.id) || 0,
    }))

    const recentSessions: any[] = recentSessionsResult.data || []

    // Calculate summary
    const totalSessions = sessions?.length || 0
    const lastSessionDate = sessions?.[0]?.completed_at || null

    // Weekly adherence (segunda→domingo, São Paulo) — cálculo compartilhado com o
    // painel de contexto do assistente (computeWeeklyAdherence). Mesma semântica:
    // done = sessões concluídas na semana; expected = soma de scheduled_days.
    const weekAdherence = computeWeeklyAdherence(
        sessions ?? [],
        (activeProgram?.assigned_workouts as { scheduled_days: number[] | null }[] | undefined) ?? [],
        { timeZone: 'America/Sao_Paulo' },
    )
    const completedThisWeek = weekAdherence.done
    const expectedPerWeek = weekAdherence.expected

    // Calculate streak + weekly adherence from calendar days
    let streak = 0
    let weeklyAdherence: { week: number; rate: number }[] = []
    const programSessions = programSessionsResult.data
    const activeProgramStartedAt = activeProgram?.started_at ?? null
    if (needsProgramSessions && programSessions && programSessions.length > 0 && activeProgramStartedAt) {
        const today = new Date()
        const programStart = new Date(activeProgramStartedAt)
        const days = generateCalendarDays(
            programStart,
            today,
            activeProgram!.assigned_workouts as any,
            programSessions as any,
            activeProgramStartedAt,
            activeProgram!.duration_weeks,
        )

        // Streak: consecutive completed/compensated scheduled days going backwards
        const scheduledPastDays = days
            .filter(d => d.isInProgram && d.date <= today && d.scheduledWorkouts.length > 0)
            .sort((a, b) => b.date.getTime() - a.date.getTime())
        // 'partial' (dual-day com 1 de 2 feitos) mantém a sequência — o aluno
        // treinou no dia; a cobrança do treino que faltou é visual, no calendário.
        for (const d of scheduledPastDays) {
            if (d.status === 'done' || d.status === 'partial' || d.status === 'compensated') streak++
            else break
        }

        // Weekly adherence: group past scheduled days by program week
        // Count both 'done' and 'compensated' as fulfilled
        const weekMap = new Map<number, { scheduled: number; done: number }>()
        for (const d of days) {
            if (!d.isInProgram || !d.programWeek || d.scheduledWorkouts.length === 0 || d.date > today) continue
            const entry = weekMap.get(d.programWeek) ?? { scheduled: 0, done: 0 }
            entry.scheduled++
            if (d.status === 'done' || d.status === 'partial' || d.status === 'compensated') entry.done++
            weekMap.set(d.programWeek, entry)
        }
        weeklyAdherence = Array.from(weekMap.entries())
            .sort(([a], [b]) => a - b)
            .map(([week, data]) => ({
                week,
                rate: data.scheduled > 0 ? Math.round((data.done / data.scheduled) * 100) : 0
            }))
    }

    const historySummary = {
        totalSessions,
        lastSessionDate,
        completedThisWeek,
        expectedPerWeek,
        streak,
    }

    // ── STAGE 3: tonnage (depends on recentSessions) ──
    let tonnageMap: Record<string, { tonnage: number; previousTonnage: number | null; percentChange: number | null }> = {}
    if (recentSessions.length > 0 && activeProgram) {
        const sessionIds = recentSessions.map((s: any) => s.id)
        const tonnageResult = await getSessionsTonnage(sessionIds, activeProgram.id)
        if (tonnageResult.success && tonnageResult.data) {
            tonnageMap = tonnageResult.data
        }
    }

    const studentInsights = (insightsData || []).map(row => ({
        ...row,
        category: row.category as InsightItem['category'],
        priority: row.priority as InsightItem['priority'],
        status: row.status as InsightItem['status'],
        source: row.source as InsightItem['source'],
        insight_key: row.insight_key ?? '',
        created_at: row.created_at ?? '',
        student_name: student.name,
        action_metadata: (row.action_metadata ?? {}) as InsightActionMetadata,
    }))

    // Compute financial display status
    const displayStatus = computeDisplayStatus(contractData ? {
        billing_type: contractData.billing_type,
        status: contractData.status,
        cancel_at_period_end: contractData.cancel_at_period_end,
        current_period_end: contractData.current_period_end,
    } : null)

    // Extract body metrics from answers_json
    let bodyMetrics: { weight: string | null; bodyFat: string | null; updatedAt: string | null } | null = null
    if (bodyMetricsData?.answers_json && bodyMetricsData.form_templates) {
        const systemKey = (bodyMetricsData.form_templates as any).system_key as string
        const fieldMap = BODY_METRIC_FIELD_MAP[systemKey]
        if (fieldMap) {
            const answers = (bodyMetricsData.answers_json as any)?.answers || {}
            const weight = answers[fieldMap.weight]?.value || null
            const bodyFat = answers[fieldMap.bodyFat]?.value || null
            if (weight || bodyFat) {
                bodyMetrics = {
                    weight: weight ? String(weight) : null,
                    bodyFat: bodyFat ? String(bodyFat) : null,
                    updatedAt: bodyMetricsData.submitted_at,
                }
            }
        }
    }

    // Shape body metrics history (last 5 submissions for trend) — fetched in Stage 1
    let bodyMetricsHistory: { weight: number | null; bodyFat: number | null; date: string }[] = []
    if (bodyMetricsHistoryData && bodyMetricsHistoryData.length > 0) {
        bodyMetricsHistory = bodyMetricsHistoryData
            .map(row => {
                const systemKey = (row.form_templates as any).system_key as string
                const fieldMap = BODY_METRIC_FIELD_MAP[systemKey]
                if (!fieldMap) return null
                const answers = (row.answers_json as any)?.answers || {}
                const w = answers[fieldMap.weight]?.value
                const bf = answers[fieldMap.bodyFat]?.value
                return {
                    weight: w ? parseFloat(String(w)) : null,
                    bodyFat: bf ? parseFloat(String(bf)) : null,
                    date: row.submitted_at || '',
                }
            })
            .filter(Boolean)
            .reverse() as typeof bodyMetricsHistory // chronological order
    }

    // Shape contract data for the sidebar card
    const sidebarContract = contractData ? {
        id: contractData.id,
        billing_type: contractData.billing_type as string,
        amount: contractData.amount,
        current_period_end: contractData.current_period_end,
        cancel_at_period_end: contractData.cancel_at_period_end,
        plan_title: (contractData.trainer_plans as any)?.title || null,
        plan_interval: (contractData.trainer_plans as any)?.interval || null,
    } : null

    // Shape last submission
    const lastSubmission = lastSubmissionData ? {
        id: lastSubmissionData.id,
        templateTitle: (lastSubmissionData.form_templates as any)?.title || '',
        templateCategory: (lastSubmissionData.form_templates as any)?.category || '',
        submittedAt: lastSubmissionData.submitted_at || '',
    } : null

    // Shape pending forms
    const pendingForms = (pendingFormsData || []).map(item => ({
        id: item.id,
        title: item.title,
        status: item.status,
        createdAt: item.created_at,
    }))

    // Shape form templates
    const formTemplates = (formTemplatesData || []).map(t => ({
        id: t.id,
        title: t.title,
        category: t.category,
    }))

    // Shape form schedules
    const formSchedules = (formSchedulesData || []).map((s: any) => ({
        id: s.id,
        student_id: s.student_id,
        form_template_id: s.form_template_id,
        frequency: s.frequency,
        is_active: s.is_active,
        next_due_at: s.next_due_at,
        last_sent_at: s.last_sent_at,
        created_at: s.created_at,
        form_template_title: s.form_templates?.title ?? 'Formulário',
    }))

    // M4 — Latest completed in-person assessment (fetched in Stage 1 — PF11).
    const latestPresencialSession =
        presencialRes.success && presencialRes.data && presencialRes.data.length > 0
            ? presencialRes.data[0]
            : null

    return (
        <StudentDetailClient
            trainer={trainer}
            student={{
                ...student,
                status: student.status as 'active' | 'pending' | 'inactive',
                modality: student.modality as 'online' | 'presential',
            }}
            activeProgram={activeProgram as any}
            scheduledPrograms={(scheduledPrograms || []).map(p => ({
                ...p,
                status: p.status as 'active' | 'scheduled' | 'completed' | 'paused',
                assigned_workouts: (p.assigned_workouts || []).map(w => ({
                    ...w,
                    scheduled_days: w.scheduled_days ?? [],
                })),
            }))}
            draftPrograms={(draftProgramsRaw || []).map(p => ({
                id: p.id,
                name: p.name,
                assigned_workouts: (p.assigned_workouts || []).map(w => ({
                    id: w.id,
                    name: w.name,
                    scheduled_days: w.scheduled_days ?? [],
                })),
            }))}
            aiDrafts={((aiDraftsRaw as Array<{ id: string; created_at: string }> | null) || []).map(g => ({
                id: g.id,
                createdAt: g.created_at,
            }))}
            historySummary={historySummary}
            recentSessions={recentSessions}
            calendarInitialSessions={calendarInitialSessions as any}
            completedPrograms={completedPrograms}
            weeklyAdherence={weeklyAdherence}
            tonnageMap={tonnageMap}
            sidebarContract={sidebarContract}
            displayStatus={displayStatus}
            lastSubmission={lastSubmission}
            pendingForms={pendingForms}
            bodyMetrics={bodyMetrics}
            formTemplates={formTemplates}
            formSchedules={formSchedules}
            studentInsights={studentInsights}
            bodyMetricsHistory={bodyMetricsHistory}
            latestPresencialSession={latestPresencialSession}
        />
    )
}
