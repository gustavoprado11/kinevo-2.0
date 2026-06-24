/**
 * Cota de crédito por plano + mecânica "1× cada ação" do Free (Fase 0).
 *
 * - Pago (essencial/pro/premium): balde de créditos por mês (PLAN_AI_QUOTA).
 *   Cotas (master SPEC §3.1 — prevalece sobre a chat-first): 20 / 300 / 1000.
 * - Free: NÃO usa o balde — usa `ai_free_trials` (cada action_class 1×).
 *
 * Estouro de cota NÃO trava o app (degrada pra GUI — decisão de produto); este
 * módulo só informa allow/block + reset. O handler decide a UX.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@kinevo/shared/types/database'
import type { AiTier } from '@/lib/auth/get-ai-tier'
import { currentPeriodStart, type PeriodType } from './metering'

export interface PlanQuota {
    period: PeriodType
    credits: number
}

/** Free = null (via free-trials). Master SPEC §3.1. */
export const PLAN_AI_QUOTA: Record<AiTier, PlanQuota | null> = {
    free: null,
    essencial: { period: 'month', credits: 20 },
    pro_ia: { period: 'month', credits: 300 },
    premium_ia: { period: 'month', credits: 1000 },
}

export function getQuotaForTier(tier: AiTier): PlanQuota | null {
    return PLAN_AI_QUOTA[tier]
}

/**
 * Franquia mensal de CONVERSAS de IA do tier Free (chat do dock). Esgotou → o chat
 * bate o muro (402) e mostra o upsell. As AÇÕES PESADAS (gerar programa, etc.) têm
 * um teste 1× à parte (ai_free_trials), checado no call-site. Contado em
 * `ai_usage_periods` (mês), com clamp atômico via consume_ai_usage.
 */
export const FREE_MONTHLY_CHAT_LIMIT = 25

type DBClient = SupabaseClient<Database>

export interface QuotaStatus {
    tier: AiTier
    isFreeTier: boolean
    allowed: boolean
    used: number
    limit: number
    remaining: number
    period: PeriodType | null
    periodStart: string | null
    /** ISO date do próximo reset (início do próximo período). */
    resetAt: string | null
}

function nextPeriodStart(period: PeriodType, periodStart: string): string {
    const [y, m, d] = periodStart.split('-').map(Number)
    if (period === 'month') {
        const next = new Date(Date.UTC(y, m, 1)) // m é 1-based → Date.UTC(y, m,...) = mês seguinte
        return next.toISOString().slice(0, 10)
    }
    const next = new Date(Date.UTC(y, m - 1, d + 7))
    return next.toISOString().slice(0, 10)
}

/**
 * Estado da cota de crédito do treinador no período corrente.
 * Para Free, retorna isFreeTier=true e allowed=false (sem balde — use o
 * caminho de free-trial por ação).
 */
export async function checkQuota(
    admin: DBClient,
    trainerId: string,
    tier: AiTier,
    now: Date = new Date(),
): Promise<QuotaStatus> {
    const quota = PLAN_AI_QUOTA[tier]

    if (!quota) {
        return {
            tier,
            isFreeTier: true,
            allowed: false,
            used: 0,
            limit: 0,
            remaining: 0,
            period: null,
            periodStart: null,
            resetAt: null,
        }
    }

    const periodStart = currentPeriodStart(quota.period, now)
    const { data } = await admin
        .from('ai_usage_periods')
        .select('credits_used')
        .eq('trainer_id', trainerId)
        .eq('period_type', quota.period)
        .eq('period_start', periodStart)
        .maybeSingle()

    const used = data?.credits_used ?? 0
    const remaining = Math.max(0, quota.credits - used)

    return {
        tier,
        isFreeTier: false,
        allowed: used < quota.credits,
        used,
        limit: quota.credits,
        remaining,
        period: quota.period,
        periodStart,
        resetAt: nextPeriodStart(quota.period, periodStart),
    }
}

// ----------------------------------------------------------------------------
// Free tier — "1× cada ação"
// ----------------------------------------------------------------------------
export interface FreeTrialStatus {
    allowed: boolean
    alreadyUsed: boolean
}

/** Verifica se o treinador Free já gastou o teste único daquela action_class. */
export async function checkFreeTrial(
    admin: DBClient,
    trainerId: string,
    actionClass: string,
): Promise<FreeTrialStatus> {
    const { data } = await admin
        .from('ai_free_trials')
        .select('action_class')
        .eq('trainer_id', trainerId)
        .eq('action_class', actionClass)
        .maybeSingle()

    const alreadyUsed = !!data
    return { allowed: !alreadyUsed, alreadyUsed }
}

/**
 * Marca o teste único como consumido (idempotente — PK (trainer_id, action_class)).
 * Service role. Ignora violação de unicidade (já consumido).
 */
export async function recordFreeTrial(
    admin: DBClient,
    trainerId: string,
    actionClass: string,
): Promise<void> {
    const { error } = await admin
        .from('ai_free_trials')
        .upsert(
            { trainer_id: trainerId, action_class: actionClass },
            { onConflict: 'trainer_id,action_class', ignoreDuplicates: true },
        )
    if (error) {
        console.error('[recordFreeTrial] error:', error)
    }
}
