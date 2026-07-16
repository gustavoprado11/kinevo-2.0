import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@kinevo/shared/types/database'

vi.mock('../get-organization', () => ({
    getOrganizationContext: vi.fn(),
}))

import { getOrganizationContext } from '../get-organization'
import {
    getStudentScope,
    assertStudentAccess,
    getVisibleStudentIds,
    type StudentScope,
} from '../student-scope'

const mockedCtx = vi.mocked(getOrganizationContext)

function orgCtx(overrides: Partial<{ status: string; grace: string | null; trainerId: string; isManager: boolean }> = {}) {
    return {
        organization: {
            id: 'org-1',
            name: 'Estúdio QA',
            logo_url: null,
            visibility: 'open' as const,
            seat_limit: null,
            subscription_status: overrides.status ?? 'active',
            grace_until: overrides.grace ?? null,
            plan_tier: null,
            current_period_end: null,
            cancel_at_period_end: false,
        },
        membership: { id: 'm-1', role: 'coach' as const, is_coach: true },
        trainerId: overrides.trainerId ?? 't1',
        isManager: overrides.isManager ?? false,
    }
}

/** Fake client para students.select(...).eq('id', ...).maybeSingle() */
function fakeStudentClient(row: { id: string; coach_id: string | null; organization_id: string | null } | null): SupabaseClient<Database> {
    return {
        from: () => ({
            select: () => ({
                eq: () => ({
                    maybeSingle: () => Promise.resolve({ data: row, error: null }),
                }),
            }),
        }),
    } as unknown as SupabaseClient<Database>
}

/** Fake client para getVisibleStudentIds — captura o filtro usado. */
function fakeListClient(ids: string[], captured: { or?: string; eq?: [string, string] }) {
    const rows = ids.map((id) => ({ id }))
    const thenable = { data: rows, error: null }
    const builder = {
        or(expr: string) {
            captured.or = expr
            return this
        },
        eq(col: string, val: string) {
            captured.eq = [col, val]
            return this
        },
        then(resolve: (v: typeof thenable) => void) {
            resolve(thenable)
        },
    }
    return {
        from: () => ({ select: () => builder }),
    } as unknown as SupabaseClient<Database>
}

beforeEach(() => {
    mockedCtx.mockReset()
})

describe('getStudentScope', () => {
    it('sem org → solo', async () => {
        mockedCtx.mockResolvedValue(null)
        expect(await getStudentScope('t1')).toEqual({ kind: 'solo', trainerId: 't1' })
    })

    it('org ativa → org com orgId e isManager', async () => {
        mockedCtx.mockResolvedValue(orgCtx({ status: 'active', isManager: true }))
        expect(await getStudentScope('t1')).toEqual({
            kind: 'org', trainerId: 't1', orgId: 'org-1', isManager: true,
        })
    })

    it('org bloqueada → degrada para solo', async () => {
        mockedCtx.mockResolvedValue(orgCtx({ status: 'blocked' }))
        expect((await getStudentScope('t1')).kind).toBe('solo')
    })

    it('past_due dentro da graça → org; fora da graça → solo', async () => {
        const future = new Date(Date.now() + 86400000).toISOString()
        const past = new Date(Date.now() - 86400000).toISOString()
        mockedCtx.mockResolvedValue(orgCtx({ status: 'past_due', grace: future }))
        expect((await getStudentScope('t1')).kind).toBe('org')
        mockedCtx.mockResolvedValue(orgCtx({ status: 'past_due', grace: past }))
        expect((await getStudentScope('t1')).kind).toBe('solo')
    })

    it('contexto de outra sessão (trainerId divergente) → solo', async () => {
        mockedCtx.mockResolvedValue(orgCtx({ trainerId: 'outro' }))
        expect((await getStudentScope('t1')).kind).toBe('solo')
    })

    it('erro de infra → solo (never-throw)', async () => {
        mockedCtx.mockRejectedValue(new Error('boom'))
        expect((await getStudentScope('t1')).kind).toBe('solo')
    })
})

describe('assertStudentAccess', () => {
    const solo: StudentScope = { kind: 'solo', trainerId: 't1' }
    const org: StudentScope = { kind: 'org', trainerId: 't1', orgId: 'org-1', isManager: false }

    it('solo: acessa o próprio aluno, nega o de outro coach', async () => {
        const own = { id: 's1', coach_id: 't1', organization_id: null }
        const foreign = { id: 's2', coach_id: 't2', organization_id: null }
        expect(await assertStudentAccess(fakeStudentClient(own), solo, 's1')).toEqual(own)
        expect(await assertStudentAccess(fakeStudentClient(foreign), solo, 's2')).toBeNull()
    })

    it('org: acessa aluno do estúdio de OUTRO coach', async () => {
        const colleague = { id: 's3', coach_id: 't2', organization_id: 'org-1' }
        expect(await assertStudentAccess(fakeStudentClient(colleague), org, 's3')).toEqual(colleague)
    })

    it('org: acessa o próprio aluno ainda sem organization_id (pré-backfill)', async () => {
        const ownLegacy = { id: 's4', coach_id: 't1', organization_id: null }
        expect(await assertStudentAccess(fakeStudentClient(ownLegacy), org, 's4')).toEqual(ownLegacy)
    })

    it('org: nega aluno de OUTRA org e aluno solo alheio', async () => {
        const otherOrg = { id: 's5', coach_id: 't9', organization_id: 'org-2' }
        const soloForeign = { id: 's6', coach_id: 't9', organization_id: null }
        expect(await assertStudentAccess(fakeStudentClient(otherOrg), org, 's5')).toBeNull()
        expect(await assertStudentAccess(fakeStudentClient(soloForeign), org, 's6')).toBeNull()
    })

    it('aluno inexistente → null', async () => {
        expect(await assertStudentAccess(fakeStudentClient(null), org, 'sX')).toBeNull()
    })
})

describe('getVisibleStudentIds', () => {
    it('solo filtra por coach_id', async () => {
        const captured: { or?: string; eq?: [string, string] } = {}
        const ids = await getVisibleStudentIds(
            fakeListClient(['s1'], captured),
            { kind: 'solo', trainerId: 't1' },
        )
        expect(ids).toEqual(['s1'])
        expect(captured.eq).toEqual(['coach_id', 't1'])
        expect(captured.or).toBeUndefined()
    })

    it('org filtra por organization_id OU coach_id próprio', async () => {
        const captured: { or?: string; eq?: [string, string] } = {}
        const ids = await getVisibleStudentIds(
            fakeListClient(['s1', 's2'], captured),
            { kind: 'org', trainerId: 't1', orgId: 'org-1', isManager: false },
        )
        expect(ids).toEqual(['s1', 's2'])
        expect(captured.or).toBe('organization_id.eq.org-1,coach_id.eq.t1')
    })
})
