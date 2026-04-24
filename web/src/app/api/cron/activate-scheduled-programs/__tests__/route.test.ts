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

vi.mock('@/lib/trainer-notifications', () => ({
    insertTrainerNotification: vi.fn(),
}))

import { supabaseAdmin } from '@/lib/supabase-admin'
import { activateAssignedProgram } from '@/lib/programs/activate-assigned-program'
import { insertTrainerNotification } from '@/lib/trainer-notifications'
import { GET } from '../route'

const supabaseAdminMock = vi.mocked(supabaseAdmin)
const activateAssignedProgramMock = vi.mocked(activateAssignedProgram)
const insertTrainerNotificationMock = vi.mocked(insertTrainerNotification)

interface DueProgramsChain {
    eq: () => DueProgramsChain
    not: () => DueProgramsChain
    lte: () => DueProgramsChain
    order: () => DueProgramsChain | Promise<{ data: Array<Record<string, string>>; error: null }>
}

interface NotificationLookupChain {
    eq: () => NotificationLookupChain
    contains: () => NotificationLookupChain
    gte: () => NotificationLookupChain
    limit: (_limit: number) => Promise<{ data: Array<{ id: string }>; error: null }>
}

interface StudentLookupChain {
    eq: () => StudentLookupChain
    single: () => Promise<{ data: { name: string } | null; error: null }>
}

function makeRequest(secret = 'secret'): NextRequest {
    return new NextRequest('http://localhost/api/cron/activate-scheduled-programs', {
        method: 'GET',
        headers: {
            authorization: `Bearer ${secret}`,
        },
    })
}

function stubDuePrograms(programs: Array<Record<string, string>>) {
    let orderCalls = 0
    const dueProgramsChain: DueProgramsChain = {
        eq: () => dueProgramsChain,
        not: () => dueProgramsChain,
        lte: () => dueProgramsChain,
        order: () => {
            orderCalls++
            if (orderCalls === 2) {
                return Promise.resolve({ data: programs, error: null })
            }
            return dueProgramsChain
        },
    }

    return dueProgramsChain
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
        const dueProgramsChain = stubDuePrograms([
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
        ])

        supabaseAdminMock.from = vi.fn((table: string) => {
            if (table === 'assigned_programs') {
                return {
                    select: () => dueProgramsChain,
                }
            }
            throw new Error(`Unexpected table ${table}`)
        }) as unknown as typeof supabaseAdminMock.from

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

    it('creates a trainer notification when activation is blocked by missing scheduled days', async () => {
        const dueProgramsChain = stubDuePrograms([
            {
                id: 'program-a1',
                student_id: 'student-a',
                trainer_id: 'trainer-1',
                scheduled_start_date: '2026-04-24',
                created_at: '2026-04-20T10:00:00Z',
            },
        ])

        const notificationLookupChain: NotificationLookupChain = {
            eq: () => notificationLookupChain,
            contains: () => notificationLookupChain,
            gte: () => notificationLookupChain,
            limit: () => Promise.resolve({ data: [], error: null }),
        }

        const studentLookupChain: StudentLookupChain = {
            eq: () => studentLookupChain,
            single: () => Promise.resolve({ data: { name: 'Marina' }, error: null }),
        }

        supabaseAdminMock.from = vi.fn((table: string) => {
            if (table === 'assigned_programs') {
                return {
                    select: () => dueProgramsChain,
                }
            }
            if (table === 'trainer_notifications') {
                return {
                    select: () => notificationLookupChain,
                }
            }
            if (table === 'students') {
                return {
                    select: () => studentLookupChain,
                }
            }
            throw new Error(`Unexpected table ${table}`)
        }) as unknown as typeof supabaseAdminMock.from

        activateAssignedProgramMock.mockResolvedValueOnce({
            success: false,
            activated: false,
            reason: 'missing_scheduled_days',
            workoutNames: ['Treino A', 'Treino B'],
        })

        const res = await GET(makeRequest())
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body).toMatchObject({
            processed: 1,
            activated: 0,
            skippedInvalid: 1,
            failed: 0,
        })
        expect(insertTrainerNotificationMock).toHaveBeenCalledWith({
            trainerId: 'trainer-1',
            type: 'program_activation_blocked',
            title: 'Programa não pôde ser ativado',
            message: 'O programa de Marina tem workouts sem dias agendados e precisa ser corrigido.',
            metadata: {
                program_id: 'program-a1',
                student_id: 'student-a',
                workoutNames: ['Treino A', 'Treino B'],
            },
        })
    })

    it('dedupes blocked activation notifications created in the last 24 hours', async () => {
        const dueProgramsChain = stubDuePrograms([
            {
                id: 'program-a1',
                student_id: 'student-a',
                trainer_id: 'trainer-1',
                scheduled_start_date: '2026-04-24',
                created_at: '2026-04-20T10:00:00Z',
            },
        ])

        const notificationLookupChain: NotificationLookupChain = {
            eq: () => notificationLookupChain,
            contains: () => notificationLookupChain,
            gte: () => notificationLookupChain,
            limit: () => Promise.resolve({ data: [{ id: 'notif-existing' }], error: null }),
        }

        supabaseAdminMock.from = vi.fn((table: string) => {
            if (table === 'assigned_programs') {
                return {
                    select: () => dueProgramsChain,
                }
            }
            if (table === 'trainer_notifications') {
                return {
                    select: () => notificationLookupChain,
                }
            }
            throw new Error(`Unexpected table ${table}`)
        }) as unknown as typeof supabaseAdminMock.from

        activateAssignedProgramMock.mockResolvedValueOnce({
            success: false,
            activated: false,
            reason: 'missing_scheduled_days',
            workoutNames: ['Treino A'],
        })

        const res = await GET(makeRequest())
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body).toMatchObject({
            processed: 1,
            skippedInvalid: 1,
            failed: 0,
        })
        expect(insertTrainerNotificationMock).not.toHaveBeenCalled()
    })
})
