/**
 * Resumo de uso de IA do treinador — CONTRATO compartilhado (Fase 1).
 *
 * server-only (sem 'use server'): lê o estado de cota/free-trial via service
 * role e expõe um shape estável que TODAS as superfícies consomem (medidor de
 * créditos, banner de cota esgotada, gates de tier).
 *
 * Fonte da verdade do orçamento:
 *   - Pago (essencial/pro/premium): balde mensal de créditos (PLAN_AI_QUOTA) +
 *     `ai_usage_periods` do período corrente (via checkQuota).
 *   - Free: franquia mensal de 25 conversas de IA (chat) em `ai_usage_periods`. As
 *     ações pesadas (gerar programa, etc.) têm um teste 1× à parte (`ai_free_trials`).
 *
 * Estouro NÃO trava o app: `exhausted=true` só sinaliza pra UI degradar pra GUI
 * (banner/upsell). A decisão de UX é da superfície.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@kinevo/shared/types/database'
import type { AiTier } from '@/lib/auth/get-ai-tier'
import { getAiTierForTrainer } from '@/lib/auth/get-ai-tier'
import { checkQuota, PLAN_AI_QUOTA, FREE_MONTHLY_CHAT_LIMIT } from './quota'
import { currentPeriodStart } from './metering'

type DBClient = SupabaseClient<Database>

/**
 * Shape estável consumido por todas as superfícies de IA.
 *
 * - creditsUsed/creditsTotal/creditsRemaining: para o tier Free, refletem o
 *   modelo "1× cada ação" (quantas classes de ação já foram testadas).
 * - periodStart/periodEnd: janela do ciclo corrente (ISO date `YYYY-MM-DD`).
 *   No Free, é a janela simbólica do mês corrente (free-trials não resetam).
 * - exhausted: cota/testes acabaram → UI degrada pra GUI (não trava).
 */
export interface AiUsageSummary {
    tier: AiTier
    creditsUsed: number
    creditsTotal: number
    creditsRemaining: number
    periodStart: string
    periodEnd: string
    exhausted: boolean
}

/** Início do mês seguinte (ISO date) — fim da janela Free. */
function nextMonthStart(periodStart: string): string {
    const [y, m] = periodStart.split('-').map(Number)
    // periodStart é o dia 1 do mês; m é 1-based → Date.UTC(y, m, 1) = mês seguinte.
    return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10)
}

/**
 * Resumo de uso de IA do treinador no período corrente.
 *
 * Tenant isolation: opera só sobre `trainerId`. Service role (admin) — leitura
 * fora de RLS.
 */
export async function getAiUsageSummary(
    admin: DBClient,
    trainerId: string,
    now: Date = new Date(),
): Promise<AiUsageSummary> {
    const tier = await getAiTierForTrainer(admin, trainerId)

    // --- Pago: balde mensal de créditos. ---
    if (PLAN_AI_QUOTA[tier]) {
        const quota = await checkQuota(admin, trainerId, tier, now)
        return {
            tier,
            creditsUsed: quota.used,
            creditsTotal: quota.limit,
            creditsRemaining: quota.remaining,
            periodStart: quota.periodStart ?? currentPeriodStart('month', now),
            periodEnd: quota.resetAt ?? nextMonthStart(currentPeriodStart('month', now)),
            exhausted: !quota.allowed,
        }
    }

    // --- Free: franquia mensal de 25 CONVERSAS de IA (chat do dock), contada em
    //     ai_usage_periods. As AÇÕES PESADAS (gerar programa, etc.) têm um teste 1×
    //     à parte (ai_free_trials), checado no call-site. ---
    const periodStart = currentPeriodStart('month', now)
    const creditsTotal = FREE_MONTHLY_CHAT_LIMIT

    const { data } = await admin
        .from('ai_usage_periods')
        .select('credits_used')
        .eq('trainer_id', trainerId)
        .eq('period_type', 'month')
        .eq('period_start', periodStart)
        .maybeSingle()

    const creditsUsed = Math.min(data?.credits_used ?? 0, creditsTotal)

    return {
        tier,
        creditsUsed,
        creditsTotal,
        creditsRemaining: Math.max(0, creditsTotal - creditsUsed),
        periodStart,
        periodEnd: nextMonthStart(periodStart),
        exhausted: creditsUsed >= creditsTotal,
    }
}
