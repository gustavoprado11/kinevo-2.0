import type Stripe from 'stripe'
import { studioPriceToTier } from '@/lib/studio/studio-tiers'

/**
 * Estúdios — mapeamento subscription do Stripe → campos de organizations
 * (usado pelo webhook). Isolado do route handler para ser testável sem Stripe.
 *
 * Janela de graça: past_due mantém acesso até period_end + 14d (a coluna
 * organizations.grace_until é PERSISTIDA, ao contrário do solo). Espelha
 * DUNNING_GRACE_DAYS de get-ai-tier.
 */
export const ORG_GRACE_DAYS = 14

/** current_period_end (Stripe v20+: vive no SubscriptionItem). */
export function getPeriodEnd(subscription: Stripe.Subscription): string | null {
    const item = subscription.items?.data?.[0]
    if (item?.current_period_end) return new Date(item.current_period_end * 1000).toISOString()
    if (subscription.trial_end) return new Date(subscription.trial_end * 1000).toISOString()
    return null
}

export function getPriceId(subscription: Stripe.Subscription): string | null {
    return subscription.items?.data?.[0]?.price?.id ?? null
}

/**
 * Campos de organizations a partir da subscription. plan_tier só entra se o
 * price mapeia (não sobrescreve com null num update de status).
 */
export function orgFieldsFromSubscription(subscription: Stripe.Subscription): Record<string, unknown> {
    const periodEnd = getPeriodEnd(subscription)
    const st = subscription.status as string
    // Normaliza os status do Stripe para o CHECK de organizations.subscription_status
    // (trialing/active/past_due/blocked/canceled/incomplete): unpaid e
    // incomplete_expired → canceled; paused → past_due (com graça). active,
    // trialing e incomplete passam direto.
    let subscription_status = st
    let grace_until: string | null = null
    if (st === 'past_due' || st === 'paused') {
        subscription_status = 'past_due'
        grace_until = periodEnd ? new Date(new Date(periodEnd).getTime() + ORG_GRACE_DAYS * 86_400_000).toISOString() : null
    } else if (st === 'canceled' || st === 'unpaid' || st === 'incomplete_expired') {
        subscription_status = 'canceled'
    }
    const planTier = studioPriceToTier(getPriceId(subscription))
    return {
        subscription_status,
        current_period_end: periodEnd,
        cancel_at_period_end: subscription.cancel_at_period_end,
        grace_until,
        ...(planTier ? { plan_tier: planTier } : {}),
    }
}
