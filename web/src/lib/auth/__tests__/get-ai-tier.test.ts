import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getAiTier, priceToTier, priceIdForTier } from '../get-ai-tier'

describe('get-ai-tier — precedência override > price > free', () => {
    beforeEach(() => {
        vi.stubEnv('STRIPE_PRICE_ID', 'price_legacy_3990')
        vi.stubEnv('STRIPE_PRICE_ESSENCIAL', 'price_essencial')
        vi.stubEnv('STRIPE_PRICE_PRO', 'price_pro')
        vi.stubEnv('STRIPE_PRICE_PREMIUM', 'price_premium')
    })
    afterEach(() => vi.unstubAllEnvs())

    it('override manual (ai_tier != free) vence tudo', () => {
        expect(getAiTier({ ai_tier: 'pro_ia' }, null)).toBe('pro_ia')
        // override vence price
        expect(
            getAiTier(
                { ai_tier: 'premium_ia' },
                { status: 'active', stripe_price_id: 'price_essencial' },
            ),
        ).toBe('premium_ia')
    })

    it('sem override + assinatura ativa com price conhecido → tier do price', () => {
        expect(
            getAiTier({ ai_tier: 'free' }, { status: 'active', stripe_price_id: 'price_pro' }),
        ).toBe('pro_ia')
        expect(
            getAiTier(null, { status: 'trialing', stripe_price_id: 'price_premium' }),
        ).toBe('premium_ia')
    })

    it('🔴 pagante ativo com price desconhecido/NULL → essencial (NUNCA free)', () => {
        expect(
            getAiTier({ ai_tier: 'free' }, { status: 'active', stripe_price_id: null }),
        ).toBe('essencial')
        expect(
            getAiTier({ ai_tier: 'free' }, { status: 'active', stripe_price_id: 'price_desconhecido' }),
        ).toBe('essencial')
    })

    it('price legado (STRIPE_PRICE_ID) resolve para essencial', () => {
        expect(
            getAiTier(null, { status: 'active', stripe_price_id: 'price_legacy_3990' }),
        ).toBe('essencial')
    })

    it('sem assinatura ativa → free', () => {
        expect(getAiTier({ ai_tier: 'free' }, null)).toBe('free')
        expect(getAiTier(null, { status: 'canceled', stripe_price_id: 'price_pro' })).toBe('free')
        // past_due SEM current_period_end → free (fail-safe; não dá pra computar a graça).
        expect(getAiTier(null, { status: 'past_due', stripe_price_id: 'price_pro' })).toBe('free')
    })

    it('past_due DENTRO da graça do dunning (period_end recente) → mantém o tier pago', () => {
        const now = new Date('2026-06-24T12:00:00Z')
        // period_end há 3 dias → dentro dos 14 dias de graça.
        expect(
            getAiTier(
                null,
                { status: 'past_due', stripe_price_id: 'price_pro', current_period_end: '2026-06-21T00:00:00Z' },
                now,
            ),
        ).toBe('pro_ia')
    })

    it('past_due FORA da graça (period_end > 14 dias) → free', () => {
        const now = new Date('2026-06-24T12:00:00Z')
        // period_end há 23 dias → graça (período + 14d) já expirou.
        expect(
            getAiTier(
                null,
                { status: 'past_due', stripe_price_id: 'price_pro', current_period_end: '2026-06-01T00:00:00Z' },
                now,
            ),
        ).toBe('free')
    })

    it('ai_tier inválido é tratado como sem override', () => {
        expect(getAiTier({ ai_tier: 'lixo' }, null)).toBe('free')
    })

    it('priceToTier mapeia via env', () => {
        expect(priceToTier('price_pro')).toBe('pro_ia')
        expect(priceToTier('price_premium')).toBe('premium_ia')
        expect(priceToTier('price_legacy_3990')).toBe('essencial')
        expect(priceToTier('nope')).toBeNull()
        expect(priceToTier(null)).toBeNull()
    })

    it('priceIdForTier devolve o env certo', () => {
        expect(priceIdForTier('essencial')).toBe('price_essencial')
        expect(priceIdForTier('pro_ia')).toBe('price_pro')
        expect(priceIdForTier('premium_ia')).toBe('price_premium')
        expect(priceIdForTier('free')).toBeNull()
    })
})
