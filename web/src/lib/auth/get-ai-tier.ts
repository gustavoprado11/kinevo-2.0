/**
 * Resolução do tier de IA do treinador (Fase 0 — IA do Treinador).
 *
 * Precedência (decisão Gustavo + revisão 16/jun/2026):
 *   1. Override manual: `trainers.ai_tier != 'free'` (comp/beta/dogfooding).
 *   2. Tier derivado do `subscriptions.stripe_price_id` (plano pago ativo).
 *   3. 'free'.
 *
 * ⚠️ Correção crítica: `subscriptions.stripe_price_id` nasce NULL e só é
 * preenchido no PRÓXIMO evento do webhook. Se um pagante ativo resolvesse para
 * 'free', o STUDENT_CAP.free (=1) bloquearia adicionar alunos num treinador que
 * já paga e tem N alunos — regressão real. Por isso: pagante ATIVO com price
 * desconhecido → 'essencial' (nunca 'free'). E NÃO fazer backfill de `ai_tier`
 * para 'essencial' (congelaria upgrades futuros derivados do price).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@kinevo/shared/types/database'

export type AiTier = 'free' | 'essencial' | 'pro_ia' | 'premium_ia'

const VALID_TIERS: ReadonlySet<string> = new Set<AiTier>([
    'free',
    'essencial',
    'pro_ia',
    'premium_ia',
])

const ACTIVE_STATUSES: ReadonlySet<string> = new Set(['active', 'trialing'])

export interface AiTierTrainer {
    ai_tier?: string | null
}

export interface AiTierSubscription {
    status?: string | null
    stripe_price_id?: string | null
}

/**
 * Mapa price_id → tier, lido de env. Inclui o STRIPE_PRICE_ID legado (R$39,90
 * atual) como 'essencial' para que o price corrente resolva certo mesmo antes
 * de STRIPE_PRICE_ESSENCIAL ser configurado.
 */
export function buildPriceTierMap(): Record<string, AiTier> {
    const map: Record<string, AiTier> = {}
    const add = (priceId: string | undefined, tier: AiTier) => {
        if (priceId) map[priceId] = tier
    }
    // Legado: o price único atual (R$39,90) é o Essencial.
    add(process.env.STRIPE_PRICE_ID, 'essencial')
    add(process.env.STRIPE_PRICE_ESSENCIAL, 'essencial')
    add(process.env.STRIPE_PRICE_PRO, 'pro_ia')
    add(process.env.STRIPE_PRICE_PREMIUM, 'premium_ia')
    return map
}

/** Deriva o tier a partir do price do Stripe. Null se o price não está no mapa. */
export function priceToTier(priceId: string | null | undefined): AiTier | null {
    if (!priceId) return null
    return buildPriceTierMap()[priceId] ?? null
}

/** Price ID do Stripe para um tier pago (env). Null para free / não configurado. */
export function priceIdForTier(tier: AiTier): string | null {
    switch (tier) {
        case 'essencial':
            return process.env.STRIPE_PRICE_ESSENCIAL ?? process.env.STRIPE_PRICE_ID ?? null
        case 'pro_ia':
            return process.env.STRIPE_PRICE_PRO ?? null
        case 'premium_ia':
            return process.env.STRIPE_PRICE_PREMIUM ?? null
        case 'free':
            return null
    }
}

/**
 * Resolve o tier de IA. Puro/testável — recebe os registros já carregados.
 */
export function getAiTier(
    trainer: AiTierTrainer | null | undefined,
    subscription: AiTierSubscription | null | undefined,
): AiTier {
    // 1. Override manual explícito (qualquer tier válido != 'free').
    const override = trainer?.ai_tier
    if (override && override !== 'free' && VALID_TIERS.has(override)) {
        return override as AiTier
    }

    // 2. Sem assinatura ativa → free.
    const status = subscription?.status
    if (!subscription || !status || !ACTIVE_STATUSES.has(status)) {
        return 'free'
    }

    // 3. Pagante ativo: deriva do price; price desconhecido → essencial (nunca free).
    return priceToTier(subscription.stripe_price_id) ?? 'essencial'
}

type DBClient = SupabaseClient<Database>

/**
 * Versão DB-backed: busca o trainer + assinatura ativa e resolve o tier.
 * Usada onde só há `trainerId` em mãos (ex.: enforcement do student-cap).
 */
export async function getAiTierForTrainer(
    admin: DBClient,
    trainerId: string,
): Promise<AiTier> {
    const { data } = await admin
        .from('trainers')
        .select('ai_tier, subscriptions(status, stripe_price_id, created_at)')
        .eq('id', trainerId)
        .single()

    if (!data) return 'free'

    const { subscriptions: subs, ...trainer } = data as typeof data & {
        subscriptions: AiTierSubscriptionRow[] | AiTierSubscriptionRow | null
    }
    return getAiTier(trainer, pickActiveAiSubscription(subs))
}

interface AiTierSubscriptionRow extends AiTierSubscription {
    created_at?: string | null
}

/** Escolhe a assinatura ativa/trialing; senão a mais recente. */
function pickActiveAiSubscription(
    subs: AiTierSubscriptionRow[] | AiTierSubscriptionRow | null | undefined,
): AiTierSubscriptionRow | null {
    if (!subs) return null
    const arr = Array.isArray(subs) ? subs : [subs]
    if (arr.length === 0) return null
    const active = arr.find((s) => s?.status && ACTIVE_STATUSES.has(s.status))
    if (active) return active
    return [...arr].sort((a, b) => {
        const ad = a?.created_at ? new Date(a.created_at).getTime() : 0
        const bd = b?.created_at ? new Date(b.created_at).getTime() : 0
        return bd - ad
    })[0] ?? null
}
