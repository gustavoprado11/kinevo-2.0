/**
 * Smart Banner — regras puras de priorização.
 *
 * Dado um contexto fechado (`BannerContext`), `pickBanner` decide qual UM
 * banner mostrar acima do dashboard do aluno. Função sem side-effects:
 * todos os dados são argumentos, todos os retornos derivam deles. Isso
 * deixa o módulo testável sem React/Supabase e força o caller a montar
 * o contexto de forma explícita.
 *
 * Ordem de prioridade:
 *   level: critical > high > info  (ordinal asc, ver `LEVEL_ORDER`)
 *   weight desempata dentro do mesmo level.
 */

export type BannerLevel = 'critical' | 'high' | 'info'

export type BannerKey =
    | 'churn_risk'
    | 'program_expired'
    | 'financial_overdue'
    | 'progression_ready'
    | 'reassessment_due'
    | 'cycle_ending'
    | 'first_session_pending'

export interface BannerAction {
    label: string
    actionId: string
}

export interface BannerCandidate {
    key: BannerKey
    level: BannerLevel
    weight: number
    title: string
    detail: string
    primary: BannerAction
    secondary?: BannerAction
}

export interface BannerContext {
    studentName: string
    studentPhone: string | null
    activeProgram: {
        status: string
        started_at: string | null
        duration_weeks: number | null
    } | null
    historySummary: {
        totalSessions: number
        lastSessionDate: string | null
        completedThisWeek: number
        expectedPerWeek: number
        streak: number
    }
    recentSessions: Array<{ id?: string; rpe: number | null }>
    tonnageMap: Record<string, { percentChange: number | null }>
    weeklyAdherence: { week: number | string; rate: number }[]
    financialStatus: string
    hasPendingForms: boolean
    /** dias até a próxima reavaliação periódica. null = sem reavaliação. */
    daysUntilReassessment: number | null
    /** Permite injetar `Date.now()` em testes (default: agora). */
    now?: Date
}

const LEVEL_ORDER: Record<BannerLevel, number> = {
    critical: 0,
    high: 1,
    info: 2,
}

const FINANCIAL_OVERDUE_STATUSES = new Set(['expired', 'past_due', 'overdue'])

const MS_PER_DAY = 24 * 60 * 60 * 1000

// ────────────────────────────────────────────────────────────────────────
// Helpers (exportados para teste)
// ────────────────────────────────────────────────────────────────────────

export function daysSinceLastSession(
    lastSessionDate: string | null,
    now: Date = new Date(),
): number | null {
    if (!lastSessionDate) return null
    const last = new Date(lastSessionDate).getTime()
    if (!Number.isFinite(last)) return null
    return Math.floor((now.getTime() - last) / MS_PER_DAY)
}

/**
 * Média das últimas N taxas de adesão. Aceita rates 0–1 e 0–100; normaliza
 * para 0–100. Retorna `null` quando não há pontos suficientes.
 */
export function avgRate(
    adherence: { rate: number }[],
    lastN: number,
): number | null {
    if (!Array.isArray(adherence) || adherence.length === 0) return null
    const slice = adherence.slice(-lastN)
    if (slice.length === 0) return null
    const norm = slice.map((p) => (p.rate <= 1 ? p.rate * 100 : p.rate))
    return norm.reduce((a, b) => a + b, 0) / norm.length
}

/**
 * Média de RPE nas últimas N sessões. Ignora `null` e valores ≤ 0.
 * Retorna `null` quando não restam valores válidos.
 */
export function avgRpe(
    sessions: Array<{ rpe: number | null }>,
    lastN: number,
): number | null {
    if (!Array.isArray(sessions)) return null
    const valid = sessions
        .slice(0, lastN)
        .map((s) => s.rpe)
        .filter((v): v is number => v != null && v > 0)
    if (valid.length === 0) return null
    return valid.reduce((a, b) => a + b, 0) / valid.length
}

/**
 * Dias até o fim do programa: `(started_at + duration_weeks*7) - now`.
 * Retorna `null` quando faltam started_at ou duration_weeks.
 */
export function daysToProgramEnd(
    activeProgram: BannerContext['activeProgram'],
    now: Date = new Date(),
): number | null {
    if (!activeProgram?.started_at || !activeProgram?.duration_weeks) return null
    const start = new Date(activeProgram.started_at).getTime()
    if (!Number.isFinite(start)) return null
    const end = start + activeProgram.duration_weeks * 7 * MS_PER_DAY
    return Math.ceil((end - now.getTime()) / MS_PER_DAY)
}

/**
 * Média de `tonnageMap[session.id].percentChange` nas últimas N sessões.
 * Ignora entradas sem `id` e sem entrada no mapa. Retorna `null` se vazio.
 */
export function avgTonnageChange(
    recentSessions: Array<{ id?: string }>,
    tonnageMap: Record<string, { percentChange: number | null }>,
    lastN: number,
): number | null {
    if (!Array.isArray(recentSessions) || recentSessions.length === 0) return null
    const values = recentSessions
        .slice(0, lastN)
        .map((s) => (s.id ? tonnageMap[s.id]?.percentChange : null))
        .filter((v): v is number => v != null && Number.isFinite(v))
    if (values.length === 0) return null
    return values.reduce((a, b) => a + b, 0) / values.length
}

// ────────────────────────────────────────────────────────────────────────
// pickBanner
// ────────────────────────────────────────────────────────────────────────

export function pickBanner(ctx: BannerContext): BannerCandidate | null {
    const now = ctx.now ?? new Date()
    const candidates: BannerCandidate[] = []

    const firstName = ctx.studentName?.split(' ')[0] ?? 'Aluno'
    const hasActiveProgram = !!ctx.activeProgram
    const daysSince = daysSinceLastSession(ctx.historySummary.lastSessionDate, now)
    const last2Avg = avgRate(ctx.weeklyAdherence, 2)

    // CRITICAL — churn_risk (weight 100)
    if (
        hasActiveProgram &&
        daysSince != null &&
        daysSince >= 7 &&
        last2Avg != null &&
        last2Avg < 50
    ) {
        candidates.push({
            key: 'churn_risk',
            level: 'critical',
            weight: 100,
            title: `${firstName} pode estar desengajando`,
            detail: `Sem treinar há ${daysSince} dias e adesão média de ${Math.round(last2Avg)}% nas últimas 2 semanas.`,
            primary: { label: 'Enviar mensagem', actionId: 'send_message' },
            secondary: ctx.studentPhone
                ? { label: 'WhatsApp', actionId: 'open_whatsapp' }
                : undefined,
        })
    }

    // CRITICAL — program_expired (weight 90)
    if (ctx.activeProgram?.status === 'expired') {
        candidates.push({
            key: 'program_expired',
            level: 'critical',
            weight: 90,
            title: 'Programa expirado',
            detail: `O programa ativo de ${firstName} expirou. Atribua um novo ou prorrogue para manter a continuidade.`,
            primary: { label: 'Atribuir programa', actionId: 'assign_program' },
            secondary: { label: 'Prorrogar', actionId: 'extend_program' },
        })
    }

    // CRITICAL — financial_overdue (weight 80)
    if (FINANCIAL_OVERDUE_STATUSES.has(ctx.financialStatus)) {
        candidates.push({
            key: 'financial_overdue',
            level: 'critical',
            weight: 80,
            title: 'Pagamento em atraso',
            detail: `Há cobranças em aberto para ${firstName}. Resolver para evitar bloqueio de acesso.`,
            primary: { label: 'Ver financeiro', actionId: 'view_finance' },
        })
    }

    // HIGH — progression_ready (weight 70)
    if (ctx.recentSessions.length >= 3) {
        const recentAvgRpe = avgRpe(ctx.recentSessions, 3)
        const recentAvgTonnage = avgTonnageChange(ctx.recentSessions, ctx.tonnageMap, 3)
        if (
            recentAvgRpe != null &&
            recentAvgRpe >= 7 &&
            recentAvgRpe <= 8.5 &&
            recentAvgTonnage != null &&
            recentAvgTonnage > 0
        ) {
            candidates.push({
                key: 'progression_ready',
                level: 'high',
                weight: 70,
                title: 'Pronto para progredir',
                detail: `${firstName} está com PSE controlado e tonelagem subindo. Bom momento para ajustar a carga.`,
                primary: { label: 'Ajustar carga', actionId: 'adjust_load' },
            })
        }
    }

    // HIGH — reassessment_due (weight 60)
    if (ctx.daysUntilReassessment != null && ctx.daysUntilReassessment <= 7) {
        const isOverdue = ctx.daysUntilReassessment < 0
        candidates.push({
            key: 'reassessment_due',
            level: 'high',
            weight: 60,
            title: isOverdue ? 'Reavaliação vencida' : 'Reavaliação se aproximando',
            detail: isOverdue
                ? `A reavaliação de ${firstName} venceu há ${Math.abs(ctx.daysUntilReassessment)} dia(s).`
                : ctx.daysUntilReassessment === 0
                    ? `A reavaliação de ${firstName} é hoje.`
                    : `A reavaliação de ${firstName} é em ${ctx.daysUntilReassessment} dia(s).`,
            primary: { label: 'Enviar reavaliação', actionId: 'send_reassessment' },
        })
    }

    // HIGH — first_session_pending (weight 55)
    if (
        hasActiveProgram &&
        ctx.historySummary.totalSessions === 0 &&
        ctx.historySummary.lastSessionDate === null
    ) {
        candidates.push({
            key: 'first_session_pending',
            level: 'high',
            weight: 55,
            title: 'Primeira sessão pendente',
            detail: `${firstName} ainda não realizou nenhum treino do programa atual. Considere um lembrete.`,
            primary: { label: 'Enviar mensagem', actionId: 'send_message' },
            secondary: ctx.studentPhone
                ? { label: 'WhatsApp', actionId: 'open_whatsapp' }
                : undefined,
        })
    }

    // INFO — cycle_ending (weight 50)
    const daysToEnd = daysToProgramEnd(ctx.activeProgram, now)
    if (daysToEnd != null && daysToEnd > 0 && daysToEnd <= 7) {
        candidates.push({
            key: 'cycle_ending',
            level: 'info',
            weight: 50,
            title: 'Ciclo terminando',
            detail: `O programa de ${firstName} encerra em ${daysToEnd} dia${daysToEnd === 1 ? '' : 's'}. Hora de planejar o próximo.`,
            primary: { label: 'Planejar próximo', actionId: 'assign_program' },
        })
    }

    if (candidates.length === 0) return null

    candidates.sort((a, b) => {
        const levelDiff = LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]
        if (levelDiff !== 0) return levelDiff
        return b.weight - a.weight
    })

    return candidates[0]
}
