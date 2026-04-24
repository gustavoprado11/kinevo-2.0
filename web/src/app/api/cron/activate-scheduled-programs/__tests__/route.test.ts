import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase-admin', () => ({
    supabaseAdmin: {
        from: vi.fn(),
    },
}))

vi.mock('@/lib/programs/activate-assigned-program', () => ({
    activateAssignedProgram: vi.fn(),
}))

import { supabaseAdmin } from '@/lib/supabase-admin'
import { activateAssignedProgram } from '@/lib/programs/activate-assigned-program'
import { GET } from '../route'

const supabaseAdminMock = vi.mocked(supabaseAdmin)
const activateAssignedProgramMock = vi.mocked(activateAssignedProgram)

interface DueProgramsChain {
    eq: () => DueProgramsChain
    not: () => DueProgramsChain
    lte: () => DueProgramsChain
    order: () => DueProgramsChain | Promise<{ data: Array<Record<string, string>>; error: null }>
}

function makeRequest(secret = 'secret'): NextRequest {
    return new NextRequest('http://localhost/api/cron/activate-scheduled-programs', {
        method: 'GET',
        headers: {
            authorization: `Bearer ${secret}`,
        },
    })
}

describe('GET /api/cron/activate-scheduled-programs', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.stubEnv('CRON_SECRET', 'secret')
    })

    it('returns 401 when authorization is invalid', async () => {
        const res = await GET(makeRequest('wrong'))

        expect(res.status).toBe(401)
        expect(activateAssignedProgramMock).not.toHaveBeenCalled()
    })

    it('activates only the earliest due program per student', async () => {
        let orderCalls = 0
        const chain: DueProgramsChain = {
            eq: vi.fn(() => chain),
            not: vi.fn(() => chain),
            lte: vi.fn(() => chain),
            order: vi.fn(() => {
                orderCalls++
                if (orderCalls === 2) {
                    return Promise.resolve({
                        data: [
                            {
                                id: 'program-b1',
                                student_id: 'student-b',
                                trainer_id: 'trainer-2',
                                scheduled_start_date: '2026-04-23',
                                created_at: '2026-04-19T10:00:00Z',
                            },
                            {
                                id: 'program-a1',
                                student_id: 'student-a',
                                trainer_id: 'trainer-1',
                                scheduled_start_date: '2026-04-24',
                                created_at: '2026-04-20T10:00:00Z',
                            },
                            {
                                id: 'program-a2',
                                student_id: 'student-a',
                                trainer_id: 'trainer-1',
                                scheduled_start_date: '2026-04-24',
                                created_at: '2026-04-21T10:00:00Z',
                            },
                        ],
                        error: null,
                    })
                }
                return chain
            }),
        }

        supabaseAdminMock.from = vi.fn(() => ({
            select: vi.fn(() => chain),
        })) as unknown as typeof supabaseAdminMock.from

        activateAssignedProgramMock
            .mockResolvedValueOnce({ success: true, activated: true })
            .mockResolvedValueOnce({ success: true, activated: true })

        const res = await GET(makeRequest())
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(activateAssignedProgramMock).toHaveBeenCalledTimes(2)
        expect(activateAssignedProgramMock).toHaveBeenNthCalledWith(1, {
            assignedProgramId: 'program-b1',
            trainerId: 'trainer-2',
            source: 'cron',
        })
        expect(activateAssignedProgramMock).toHaveBeenNthCalledWith(2, {
            assignedProgramId: 'program-a1',
            trainerId: 'trainer-1',
            source: 'cron',
        })
        expect(body).toMatchObject({
            processed: 2,
            activated: 2,
            skippedDuplicates: 1,
            skippedInvalid: 0,
            failed: 0,
        })
    })
})
