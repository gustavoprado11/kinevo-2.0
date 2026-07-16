/**
 * Payload da coluna de contexto do aluno no /assistente (F0).
 *
 * Monta, server-side e SEM LLM/crédito, o card rico do aluno: programa ativo +
 * semana, aderência da semana atual, alerta (insight de maior prioridade),
 * histórico recente e notas do treinador. Reusa os módulos compartilhados:
 * `computeWeeklyAdherence` (mesma fórmula da página do aluno) e
 * `attentionKind/KIND_TAG/attentionPrompt` (mesmo mapeamento visual/prompt da home).
 *
 * SEMPRE confirma que o aluno pertence ao treinador (students.coach_id) antes de
 * devolver dados — retorna null caso contrário (a rota traduz para 404).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@kinevo/shared/types/database'
import { computeWeeklyAdherence } from '@/lib/students/weekly-adherence'
import { attentionKind, attentionPrompt, KIND_TAG, PRIORITY_RANK, type AttentionKind } from '@/lib/assistant/attention'
import type { AttentionItem } from '@/lib/assistant/home-data'

type Client = SupabaseClient<Database>

const WEEK_TZ = 'America/Sao_Paulo'

export interface StudentContextPayload {
    student: { id: string; name: string; avatarUrl: string | null; status: string }
    program: {
        id: string
        name: string
        currentWeek: number | null
        durationWeeks: number | null
        startedAt: string | null
    } | null
    adherence: { done: number; expected: number; pct: number } | null
    alert: {
        insightId: string
        kind: AttentionKind
        label: string
        prompt: string
    } | null
    history: Array<{ id: string; text: string; dateLabel: string; completedAt: string }>
    notes: string | null
    readOnly: boolean
}

/** Dia civil no fuso dado (nº de dias desde a época) — o server roda em UTC. */
function civilDay(d: Date, timeZone: string): number {
    // en-CA formata YYYY-MM-DD, parseável direto como UTC-midnight.
    const ymd = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
    return Date.parse(`${ymd}T00:00:00Z`) / 86_400_000
}

/** Data relativa curta: "Hoje", "Ontem", "há N dias" — no fuso do produto. */
function relativeDayLabel(iso: string, now: Date, timeZone: string): string {
    const diff = civilDay(now, timeZone) - civilDay(new Date(iso), timeZone)
    if (diff <= 0) return 'Hoje'
    if (diff === 1) return 'Ontem'
    return `há ${diff} dias`
}

interface Opts {
    now?: Date
    timeZone?: string
    /** Estado read-only da gestão de alunos (free ex-pagante). Calculado pela rota. */
    readOnly?: boolean
}

export async function getStudentPanelData(
    sb: Client,
    trainerId: string,
    studentId: string,
    opts: Opts = {},
): Promise<StudentContextPayload | null> {
    const now = opts.now ?? new Date()
    const timeZone = opts.timeZone ?? WEEK_TZ

    // Acesso: dono (coach_id) OU membro ATIVO do estúdio do aluno (decisão
    // 16/jul — o assistente enxerga os alunos do estúdio). null → 404 na rota.
    const { data: student } = await sb
        .from('students')
        .select('id, name, avatar_url, status, trainer_notes, coach_id, organization_id')
        .eq('id', studentId)
        .maybeSingle()

    if (!student) return null
    const sRow = student as { coach_id: string | null; organization_id: string | null }
    let allowed = sRow.coach_id === trainerId
    if (!allowed && sRow.organization_id) {
        const { data: member } = await sb
            .from('organization_members')
            .select('id')
            .eq('organization_id', sRow.organization_id)
            .eq('trainer_id', trainerId)
            .eq('status', 'active')
            .maybeSingle()
        allowed = !!member
    }
    if (!allowed) return null

    const [programRes, sessionsRes, insightsRes] = await Promise.all([
        // Programa ATIVO (mais recente) + treinos p/ o cálculo de aderência.
        sb
            .from('assigned_programs')
            .select('id, name, current_week, duration_weeks, started_at, assigned_workouts(scheduled_days)')
            .eq('student_id', studentId)
            .eq('status', 'active')
            .order('started_at', { ascending: false })
            .limit(1),
        // Sessões concluídas recentes: alimentam histórico (3) + aderência (janela da semana).
        sb
            .from('workout_sessions')
            .select('id, completed_at, assigned_workouts(name)')
            .eq('student_id', studentId)
            .eq('status', 'completed')
            .order('completed_at', { ascending: false })
            .limit(60),
        // Insights ativos do aluno; o de maior prioridade vira o badge de alerta.
        sb
            .from('assistant_insights')
            .select('id, category, priority, title, body, insight_key')
            .eq('student_id', studentId)
            .eq('trainer_id', trainerId)
            .in('status', ['new', 'read'])
            .order('created_at', { ascending: false })
            .limit(10),
    ])

    const programRow = (programRes.data as
        | { id: string; name: string; current_week: number | null; duration_weeks: number | null; started_at: string | null; assigned_workouts: { scheduled_days: number[] | null }[] | null }[]
        | null)?.[0] ?? null

    const program = programRow
        ? {
              id: programRow.id,
              name: programRow.name,
              currentWeek: programRow.current_week,
              durationWeeks: programRow.duration_weeks,
              startedAt: programRow.started_at,
          }
        : null

    const sessionRows = (sessionsRes.data as
        | { id: string; completed_at: string | null; assigned_workouts: { name: string } | { name: string }[] | null }[]
        | null) ?? []

    // Aderência só faz sentido com programa ativo E dias agendados; "0/0 esta
    // semana" não informa nada → null esconde a seção no card.
    const rawAdherence = programRow
        ? computeWeeklyAdherence(sessionRows, programRow.assigned_workouts ?? [], { now, timeZone })
        : null
    const adherence = rawAdherence && rawAdherence.expected > 0 ? rawAdherence : null

    const history = sessionRows
        .filter((s) => !!s.completed_at)
        .slice(0, 3)
        .map((s) => {
            // O join pode vir como objeto ou array conforme a cardinalidade inferida.
            const w = Array.isArray(s.assigned_workouts) ? s.assigned_workouts[0] : s.assigned_workouts
            const name = w?.name?.trim() || 'Treino'
            return {
                id: s.id,
                text: `${name} concluído`,
                dateLabel: relativeDayLabel(s.completed_at as string, now, timeZone),
                completedAt: s.completed_at as string,
            }
        })

    // Alerta: insight de maior prioridade (critical > high > medium > low), como na home.
    const insightRows = (insightsRes.data as
        | { id: string; category: string | null; priority: string | null; title: string | null; body: string | null; insight_key: string | null }[]
        | null) ?? []
    const topInsight = [...insightRows].sort(
        (a, b) => (PRIORITY_RANK[a.priority ?? 'medium'] ?? 2) - (PRIORITY_RANK[b.priority ?? 'medium'] ?? 2),
    )[0]

    let alert: StudentContextPayload['alert'] = null
    if (topInsight) {
        const item: AttentionItem = {
            id: topInsight.id,
            category: topInsight.category ?? '',
            priority: topInsight.priority ?? 'medium',
            title: topInsight.title ?? '',
            body: topInsight.body ?? '',
            studentId,
            studentName: student.name,
            insightKey: topInsight.insight_key,
        }
        const kind = attentionKind(item)
        alert = {
            insightId: topInsight.id,
            kind,
            label: item.title.trim() || KIND_TAG[kind].label,
            prompt: attentionPrompt(item),
        }
    }

    const notes = student.trainer_notes?.trim() ? student.trainer_notes : null

    return {
        student: {
            id: student.id,
            name: student.name,
            avatarUrl: student.avatar_url ?? null,
            status: student.status ?? 'active',
        },
        program,
        adherence,
        alert,
        history,
        notes,
        readOnly: opts.readOnly ?? false,
    }
}
