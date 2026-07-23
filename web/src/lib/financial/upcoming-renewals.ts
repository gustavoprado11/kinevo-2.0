/**
 * Camada de dados dos VENCIMENTOS — a "parte administrativa" que separa, por
 * aluno, duas coisas que hoje se confundem:
 *   • Vigência do PLANO (comercial): assinatura recorrente (próxima cobrança) ×
 *     plano de prazo fixo (até quando vale). Fonte: student_contracts via RPC.
 *   • Vencimento do TREINO (programa): fim do programa ativo. Fonte:
 *     assigned_programs (started_at + duration_weeks). Totalmente separado.
 *
 * Reutilizada pela subaba /financial/vencimentos e pelo card do Dashboard.
 */
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { DisplayStatus } from '@/types/financial'
import { getContractKind } from '@/lib/utils/financial'
import { getProgramEndDate } from '@kinevo/shared/utils/schedule-projection'

export interface PlanRenewal {
    contractId: string
    /** 'subscription' (renova) | 'fixed_term' (prazo fixo). Cortesia é excluída. */
    kind: 'subscription' | 'fixed_term'
    displayStatus: DisplayStatus
    periodEnd: string // ISO
    daysUntil: number // negativo = já vencido
    planTitle: string | null
    amount: number | null
    interval: string | null
}

export interface ProgramExpiry {
    programId: string
    programName: string
    endDate: string // ISO
    daysUntil: number // negativo = já encerrou
    currentWeek: number | null
    totalWeeks: number | null
}

export interface StudentRenewal {
    studentId: string
    studentName: string
    avatarUrl: string | null
    plan: PlanRenewal | null
    program: ProgramExpiry | null
    /** menor daysUntil entre plano e treino — chave de ordenação. */
    soonestDays: number
}

const DAY_MS = 24 * 60 * 60 * 1000

export async function getUpcomingRenewals(trainerId: string): Promise<StudentRenewal[]> {
    const now = new Date()
    const startToday = new Date(now)
    startToday.setUTCHours(0, 0, 0, 0)
    const daysUntil = (iso: string): number =>
        Math.round((new Date(iso).getTime() - startToday.getTime()) / DAY_MS)

    // 1) PLANO — mesma RPC que alimenta a lista do Financeiro (status já resolvido).
    const { data: finRows, error: finErr } = await supabaseAdmin
        .rpc('get_financial_students', { p_trainer_id: trainerId })
    if (finErr) console.error('[upcoming-renewals] RPC error:', finErr)

    const rows = finRows ?? []
    const studentIds = rows.map((r) => r.student_id).filter(Boolean) as string[]

    // 2) TREINO — programas ativos dos alunos do treinador.
    const programByStudent = new Map<string, ProgramExpiry>()
    if (studentIds.length > 0) {
        const { data: programs } = await supabaseAdmin
            .from('assigned_programs')
            .select('id, name, student_id, started_at, duration_weeks, current_week')
            .in('student_id', studentIds)
            .eq('status', 'active')

        for (const p of programs ?? []) {
            // duration_weeks 0/null = programa sem prazo → não vence (migration 230).
            if (!p.started_at || !p.duration_weeks || !p.student_id) continue
            const endDate = getProgramEndDate(p.started_at, p.duration_weeks)
            const item: ProgramExpiry = {
                programId: p.id,
                programName: p.name,
                endDate: endDate.toISOString(),
                daysUntil: daysUntil(endDate.toISOString()),
                currentWeek: p.current_week ?? null,
                totalWeeks: p.duration_weeks,
            }
            // Se houver mais de um ativo, mantém o que vence primeiro.
            const prev = programByStudent.get(p.student_id)
            if (!prev || item.daysUntil < prev.daysUntil) programByStudent.set(p.student_id, item)
        }
    }

    const result: StudentRenewal[] = []
    for (const r of rows) {
        const studentId = r.student_id as string
        if (!studentId) continue

        // PLANO: só entra quando é cobrança de verdade (não cortesia) e tem vigência.
        let plan: PlanRenewal | null = null
        const kind = getContractKind(r.billing_type)
        if (kind !== 'courtesy' && r.current_period_end && r.contract_id) {
            plan = {
                contractId: r.contract_id as string,
                kind,
                displayStatus: (r.display_status ?? 'active') as DisplayStatus,
                periodEnd: r.current_period_end as string,
                daysUntil: daysUntil(r.current_period_end as string),
                planTitle: (r.plan_title as string | null) ?? null,
                amount: (r.amount as number | null) ?? null,
                interval: (r.plan_interval as string | null) ?? null,
            }
        }

        const program = programByStudent.get(studentId) ?? null
        if (!plan && !program) continue // nada que vença → fora da lista

        const candidates = [plan?.daysUntil, program?.daysUntil].filter(
            (d): d is number => typeof d === 'number',
        )
        result.push({
            studentId,
            studentName: r.student_name as string,
            avatarUrl: (r.avatar_url as string | null) ?? null,
            plan,
            program,
            soonestDays: candidates.length ? Math.min(...candidates) : Number.MAX_SAFE_INTEGER,
        })
    }

    result.sort((a, b) => a.soonestDays - b.soonestDays)
    return result
}
