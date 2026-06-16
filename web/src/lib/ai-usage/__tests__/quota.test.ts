import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@kinevo/shared/types/database'
import {
    PLAN_AI_QUOTA,
    getQuotaForTier,
    checkQuota,
    checkFreeTrial,
} from '../quota'

// Fake admin chainável: qualquer .select().eq()....maybeSingle() resolve { data }.
function fakeAdmin(data: unknown): SupabaseClient<Database> {
    const chain: Record<string, unknown> = {}
    chain.select = () => chain
    chain.eq = () => chain
    chain.maybeSingle = () => Promise.resolve({ data, error: null })
    return { from: () => chain } as unknown as SupabaseClient<Database>
}

describe('quota — cotas por plano', () => {
    it('cotas master: free=null, essencial 20, pro 300, premium 1000', () => {
        expect(PLAN_AI_QUOTA.free).toBeNull()
        expect(getQuotaForTier('essencial')).toEqual({ period: 'month', credits: 20 })
        expect(getQuotaForTier('pro_ia')).toEqual({ period: 'month', credits: 300 })
        expect(getQuotaForTier('premium_ia')).toEqual({ period: 'month', credits: 1000 })
    })
})

describe('quota — allow / block + reset', () => {
    const now = new Date('2026-06-16T12:00:00Z')

    it('dentro da cota → allowed, remaining correto', async () => {
        const q = await checkQuota(fakeAdmin({ credits_used: 5 }), 't1', 'essencial', now)
        expect(q.allowed).toBe(true)
        expect(q.used).toBe(5)
        expect(q.limit).toBe(20)
        expect(q.remaining).toBe(15)
        expect(q.periodStart).toBe('2026-06-01')
        expect(q.resetAt).toBe('2026-07-01')
    })

    it('estourou a cota → blocked, remaining 0', async () => {
        const q = await checkQuota(fakeAdmin({ credits_used: 20 }), 't1', 'essencial', now)
        expect(q.allowed).toBe(false)
        expect(q.remaining).toBe(0)
    })

    it('sem linha de período → used 0, allowed', async () => {
        const q = await checkQuota(fakeAdmin(null), 't1', 'pro_ia', now)
        expect(q.used).toBe(0)
        expect(q.allowed).toBe(true)
        expect(q.remaining).toBe(300)
    })

    it('free → isFreeTier, sem balde de crédito', async () => {
        const q = await checkQuota(fakeAdmin(null), 't1', 'free', now)
        expect(q.isFreeTier).toBe(true)
        expect(q.allowed).toBe(false)
        expect(q.period).toBeNull()
    })
})

describe('quota — free trial (1× cada ação)', () => {
    it('ação não usada → allowed', async () => {
        const r = await checkFreeTrial(fakeAdmin(null), 't1', 'write')
        expect(r.allowed).toBe(true)
        expect(r.alreadyUsed).toBe(false)
    })

    it('ação já usada → bloqueada', async () => {
        const r = await checkFreeTrial(fakeAdmin({ action_class: 'write' }), 't1', 'write')
        expect(r.allowed).toBe(false)
        expect(r.alreadyUsed).toBe(true)
    })
})
