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

/** admin fake: builder encadeável e thenable — resolve { count } após qualquer
 *  nº de .eq() (cobre o caminho org, 2 eq, e o solo, 1 eq). */
function fakeAdmin(count: number): SupabaseClient<Database> {
    const builder: Record<string, unknown> = {}
    builder.eq = () => builder
    builder.then = (resolve: (v: { count: number; error: null }) => void) =>
        resolve({ count, error: null })
    return {
        from: () => ({ select: () => builder }),
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

describe('assertCanCreateStudent — aluno PARTICULAR de coach de estúdio', () => {
    it('coach de estúdio SEM plano solo pago: particular é bloqueado', async () => {
        mockedOrg.mockResolvedValue({ id: 'org1', plan_tier: 'studio_50' })
        await expect(
            assertCanCreateStudent(fakeAdmin(0), 't1', 'free', { isPrivate: true }),
        ).rejects.toBeInstanceOf(StudentCapError)
    })

    it('coach de estúdio COM plano pago: particulares ilimitados (não conta na faixa)', async () => {
        mockedOrg.mockResolvedValue({ id: 'org1', plan_tier: 'studio_50' })
        // fakeAdmin(50) = faixa LOTADA; o particular passa mesmo assim (eixo pessoal).
        await expect(
            assertCanCreateStudent(fakeAdmin(50), 't1', 'essencial', { isPrivate: true }),
        ).resolves.toBeUndefined()
    })

    it('treinador solo: isPrivate é inócuo (cai no cap solo normal)', async () => {
        mockedOrg.mockResolvedValue(null)
        // solo free com 1 aluno → 2º bloqueado, com ou sem isPrivate
        await expect(
            assertCanCreateStudent(fakeAdmin(1), 't1', 'free', { isPrivate: true }),
        ).rejects.toBeInstanceOf(StudentCapError)
        await expect(
            assertCanCreateStudent(fakeAdmin(0), 't1', 'free', { isPrivate: true }),
        ).resolves.toBeUndefined()
    })
})
