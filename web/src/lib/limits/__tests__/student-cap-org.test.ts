import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@kinevo/shared/types/database'

vi.mock('@/lib/studio/org-access', () => ({
    getActiveBillingOrg: vi.fn(),
    hasOrgCoreAccess: vi.fn().mockResolvedValue(false),
}))
vi.mock('@/lib/studio/studio-tiers', () => ({
    studioLimitForOrg: (t: string | null) => (t === 'studio_50' ? 50 : t === 'studio_100' ? 100 : Infinity),
}))

import { getActiveBillingOrg } from '@/lib/studio/org-access'
import { assertCanCreateStudent, StudentCapError } from '../student-cap'

const mockedOrg = vi.mocked(getActiveBillingOrg)

/** admin fake: students.select(count).eq(org).eq(is_trainer_profile) → count fixo */
function fakeAdmin(count: number): SupabaseClient<Database> {
    return {
        from: () => ({
            select: () => ({
                eq: () => ({
                    eq: () => Promise.resolve({ count, error: null }),
                }),
            }),
        }),
    } as unknown as SupabaseClient<Database>
}

beforeEach(() => mockedOrg.mockReset())

describe('assertCanCreateStudent — cap por faixa do estúdio', () => {
    it('studio_50: bloqueia no 50º aluno da org', async () => {
        mockedOrg.mockResolvedValue({ id: 'org1', plan_tier: 'studio_50' })
        await expect(assertCanCreateStudent(fakeAdmin(50), 't1', 'free')).rejects.toBeInstanceOf(StudentCapError)
    })

    it('studio_50: permite com 49 alunos', async () => {
        mockedOrg.mockResolvedValue({ id: 'org1', plan_tier: 'studio_50' })
        await expect(assertCanCreateStudent(fakeAdmin(49), 't1', 'free')).resolves.toBeUndefined()
    })

    it('studio_100: permite com 50 (folga da faixa maior)', async () => {
        mockedOrg.mockResolvedValue({ id: 'org1', plan_tier: 'studio_100' })
        await expect(assertCanCreateStudent(fakeAdmin(50), 't1', 'free')).resolves.toBeUndefined()
    })

    it('org sem plan_tier (manual/comp) = ilimitado', async () => {
        mockedOrg.mockResolvedValue({ id: 'org1', plan_tier: null })
        await expect(assertCanCreateStudent(fakeAdmin(9999), 't1', 'free')).resolves.toBeUndefined()
    })
})
