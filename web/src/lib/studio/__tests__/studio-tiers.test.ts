import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
    STUDIO_TIERS,
    PURCHASABLE_STUDIO_TIERS,
    studioLimitForOrg,
    studioPriceIdForTier,
    studioPriceToTier,
    isStudioTier,
} from '../studio-tiers'

describe('studio-tiers', () => {
    const OLD = { ...process.env }
    beforeEach(() => {
        process.env.STRIPE_PRICE_STUDIO_50 = 'price_s50'
        process.env.STRIPE_PRICE_STUDIO_100 = 'price_s100'
        process.env.STRIPE_PRICE_STUDIO_200 = 'price_s200'
    })
    afterEach(() => { process.env = { ...OLD } })

    it('escada: 3 compráveis + 1 custom, preços corretos', () => {
        expect(STUDIO_TIERS.map(t => t.tier)).toEqual(['studio_50', 'studio_100', 'studio_200', 'studio_custom'])
        expect(PURCHASABLE_STUDIO_TIERS).toHaveLength(3)
        expect(STUDIO_TIERS[0]).toMatchObject({ monthlyBrl: 219.9, studentLimit: 50 })
        expect(STUDIO_TIERS[1]).toMatchObject({ monthlyBrl: 379.9, studentLimit: 100 })
        expect(STUDIO_TIERS[2]).toMatchObject({ monthlyBrl: 649.9, studentLimit: 200 })
        expect(STUDIO_TIERS[3]).toMatchObject({ custom: true, studentLimit: Infinity })
    })

    it('price↔tier via env', () => {
        expect(studioPriceIdForTier('studio_50')).toBe('price_s50')
        expect(studioPriceIdForTier('studio_200')).toBe('price_s200')
        expect(studioPriceIdForTier('studio_custom')).toBeNull()
        expect(studioPriceToTier('price_s100')).toBe('studio_100')
        expect(studioPriceToTier('price_desconhecido')).toBeNull()
        expect(studioPriceToTier(null)).toBeNull()
    })

    it('limite de aluno por plan_tier', () => {
        expect(studioLimitForOrg('studio_50')).toBe(50)
        expect(studioLimitForOrg('studio_200')).toBe(200)
        // manual/comp (sem plan_tier) → ilimitado
        expect(studioLimitForOrg(null)).toBe(Infinity)
        expect(studioLimitForOrg('')).toBe(Infinity)
        // plan_tier ruim → fail-open (ilimitado, nunca bloqueia por dado errado)
        expect(studioLimitForOrg('lixo')).toBe(Infinity)
    })

    it('isStudioTier', () => {
        expect(isStudioTier('studio_100')).toBe(true)
        expect(isStudioTier('essencial')).toBe(false)
        expect(isStudioTier(null)).toBe(false)
    })
})
