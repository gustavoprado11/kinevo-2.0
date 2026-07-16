import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type Stripe from 'stripe'
import { orgFieldsFromSubscription, ORG_GRACE_DAYS } from '../org-billing-sync'

// Constrói uma subscription mínima do Stripe (só o que o mapeamento lê).
function sub(overrides: {
    status: string
    priceId?: string
    periodEndSec?: number
    cancelAtPeriodEnd?: boolean
}): Stripe.Subscription {
    return {
        status: overrides.status,
        cancel_at_period_end: overrides.cancelAtPeriodEnd ?? false,
        trial_end: null,
        items: { data: [{ current_period_end: overrides.periodEndSec ?? null, price: { id: overrides.priceId ?? null } }] },
    } as unknown as Stripe.Subscription
}

describe('orgFieldsFromSubscription', () => {
    const OLD = { ...process.env }
    beforeEach(() => { process.env.STRIPE_PRICE_STUDIO_50 = 'price_s50'; process.env.STRIPE_PRICE_STUDIO_100 = 'price_s100' })
    afterEach(() => { process.env = { ...OLD } })

    const periodEndSec = Math.floor(Date.parse('2026-08-01T00:00:00Z') / 1000)

    it('active: status active, grace null, plan_tier do price, period gravado', () => {
        const f = orgFieldsFromSubscription(sub({ status: 'active', priceId: 'price_s50', periodEndSec }))
        expect(f.subscription_status).toBe('active')
        expect(f.grace_until).toBeNull()
        expect(f.plan_tier).toBe('studio_50')
        expect(f.current_period_end).toBe('2026-08-01T00:00:00.000Z')
        expect(f.cancel_at_period_end).toBe(false)
    })

    it('past_due: grave grace_until = period_end + 14d, mantém past_due', () => {
        const f = orgFieldsFromSubscription(sub({ status: 'past_due', priceId: 'price_s100', periodEndSec }))
        expect(f.subscription_status).toBe('past_due')
        const expected = new Date(periodEndSec * 1000 + ORG_GRACE_DAYS * 86_400_000).toISOString()
        expect(f.grace_until).toBe(expected)
        expect(f.plan_tier).toBe('studio_100')
    })

    it('canceled e unpaid → subscription_status canceled', () => {
        expect(orgFieldsFromSubscription(sub({ status: 'canceled', priceId: 'price_s50', periodEndSec })).subscription_status).toBe('canceled')
        expect(orgFieldsFromSubscription(sub({ status: 'unpaid', priceId: 'price_s50', periodEndSec })).subscription_status).toBe('canceled')
    })

    it('price desconhecido → NÃO inclui plan_tier (não sobrescreve com null)', () => {
        const f = orgFieldsFromSubscription(sub({ status: 'active', priceId: 'price_desconhecido', periodEndSec }))
        expect('plan_tier' in f).toBe(false)
        expect(f.subscription_status).toBe('active')
    })

    it('cancel_at_period_end propagado', () => {
        const f = orgFieldsFromSubscription(sub({ status: 'active', priceId: 'price_s50', periodEndSec, cancelAtPeriodEnd: true }))
        expect(f.cancel_at_period_end).toBe(true)
    })
})
