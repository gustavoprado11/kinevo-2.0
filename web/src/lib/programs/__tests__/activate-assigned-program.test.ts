import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase-admin', () => ({
    supabaseAdmin: {
        from: vi.fn(),
    },
}))

vi.mock('@/lib/student-notifications', () => ({
    insertStudentNotification: vi.fn(),
}))

vi.mock('@/lib/trainer-notifications', () => ({
    insertTrainerNotification: vi.fn(),
}))

vi.mock('@/lib/push-notifications', () => ({
    sendStudentPush: vi.fn(),
    sendTrainerPush: vi.fn(),
}))

import { supabaseAdmin } from '@/lib/supabase-admin'
import { insertStudentNotification } from '@/lib/student-notifications'
import { insertTrainerNotification } from '@/lib/trainer-notifications'
import { sendStudentPush, sendTrainerPush } from '@/lib/push-notifications'
import { activateAssignedProgram } from '../activate-assigned-program'

const supabaseAdminMock = vi.mocked(supabaseAdmin)
const insertStudentNotificationMock = vi.mocked(insertStudentNotification)
const insertTrainerNotificationMock = vi.mocked(insertTrainerNotification)
const sendStudentPushMock = vi.mocked(sendStudentPush)
const sendTrainerPushMock = vi.mocked(sendTrainerPush)

type ProgramStatus = 'scheduled' | 'active'

type SelectResponse = {
    data: {
        id: string
        student_id: string
        status: ProgramStatus
        name: string
        trainer_id: string
        duration_weeks: number
        assigned_workouts: Array<{ id: string; name: string; scheduled_days: number[] | null }>
    } | null
    error: null
}

type StudentResponse = {
    data: { id: string; name: string } | null
    error: null
}

type ActivationUpdateResponse = {
    data: Array<{ id: string }>
    error: null
}

type CompletionUpdateResponse = {
    error: null
}

interface AssignedProgramsSelectChain {
    eq: () => AssignedProgramsSelectChain
    single: () => Promise<SelectResponse>
}

interface StudentsSelectChain {
    eq: () => StudentsSelectChain
    single: () => Promise<StudentResponse>
}

interface ActivationUpdateChain {
    eq: () => ActivationUpdateChain
    select: (_columns: string) => Promise<ActivationUpdateResponse>
}

interface CompletionUpdateChain {
    eq: () => CompletionUpdateChain
    neq: () => CompletionUpdateChain
    in: (_column: string, _values: string[]) => Promise<CompletionUpdateResponse>
}

function makeProgramResponse(status: ProgramStatus = 'scheduled'): SelectResponse {
    return {
        data: {
            id: 'program-scheduled',
            student_id: 'student-1',
            status,
            name: 'Treino Maio',
            trainer_id: 'trainer-1',
            duration_weeks: 4,
            assigned_workouts: [{ id: 'w1', name: 'Treino A', scheduled_days: [1, 3] }],
        },
        error: null,
    }
}

function stubSuccessfulActivation(options?: {
    programStatus?: ProgramStatus
    activationResponses?: ActivationUpdateResponse[]
    workouts?: Array<{ id: string; name: string; scheduled_days: number[] | null }>
}) {
    const activationResponses = options?.activationResponses ?? [{ data: [{ id: 'program-scheduled' }], error: null }]
    const completionUpdate = vi.fn<(_column: string, _values: string[]) => Promise<CompletionUpdateResponse>>()
    completionUpdate.mockResolvedValue({ error: null })

    const activationUpdate = vi.fn<(_columns: string) => Promise<ActivationUpdateResponse>>()
    for (const response of activationResponses) {
        activationUpdate.mockResolvedValueOnce(response)
    }

    const programResponse = makeProgramResponse(options?.programStatus ?? 'scheduled')
    if (options?.workouts) {
        programResponse.data!.assigned_workouts = options.workouts
    }

    supabaseAdminMock.from = vi.fn((table: string) => {
        if (table === 'assigned_programs') {
            return {
                select: () => {
                    const chain: AssignedProgramsSelectChain = {
                        eq: () => chain,
                        single: () => Promise.resolve(programResponse),
                    }
                    return chain
                },
                update: (payload: { status: string }) => {
                    if (payload.status === 'active') {
                        const chain: ActivationUpdateChain = {
                            eq: () => chain,
                            select: activationUpdate,
                        }
                        return chain
                    }

                    const chain: CompletionUpdateChain = {
                        eq: () => chain,
                        neq: () => chain,
                        in: completionUpdate,
                    }
                    return chain
                },
            }
        }

        if (table === 'students') {
            return {
                select: () => {
                    const chain: StudentsSelectChain = {
                        eq: () => chain,
                        single: () => Promise.resolve({ data: { id: 'student-1', name: 'Marina' }, error: null }),
                    }
                    return chain
                },
            }
        }

        throw new Error(`Unexpected table ${table}`)
    }) as unknown as typeof supabaseAdminMock.from

    return { activationUpdate, completionUpdate }
}

describe('activateAssignedProgram', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        insertStudentNotificationMock.mockResolvedValue('inbox-1')
        insertTrainerNotificationMock.mockResolvedValue('trainer-notif-1')
    })

    it('returns already_active idempotently when the program is already active', async () => {
        stubSuccessfulActivation({ programStatus: 'active' })

        const result = await activateAssignedProgram({
            assignedProgramId: 'program-scheduled',
            trainerId: 'trainer-1',
            source: 'manual',
        })

        expect(result).toMatchObject({
            success: true,
            activated: false,
            reason: 'already_active',
        })
        expect(insertStudentNotificationMock).not.toHaveBeenCalled()
        expect(insertTrainerNotificationMock).not.toHaveBeenCalled()
        expect(sendStudentPushMock).not.toHaveBeenCalled()
        expect(sendTrainerPushMock).not.toHaveBeenCalled()
    })

    it('activates successfully from manual source without notifying the trainer', async () => {
        const { completionUpdate } = stubSuccessfulActivation()

        const result = await activateAssignedProgram({
            assignedProgramId: 'program-scheduled',
            trainerId: 'trainer-1',
            source: 'manual',
        })

        expect(result).toMatchObject({
            success: true,
            activated: true,
            studentId: 'student-1',
        })
        expect(completionUpdate).toHaveBeenCalledTimes(1)
        expect(insertStudentNotificationMock).toHaveBeenCalledTimes(1)
        expect(sendStudentPushMock).toHaveBeenCalledTimes(1)
        expect(insertTrainerNotificationMock).not.toHaveBeenCalled()
        expect(sendTrainerPushMock).not.toHaveBeenCalled()
    })

    it('returns missing_scheduled_days when any workout has no scheduled days', async () => {
        stubSuccessfulActivation({
            workouts: [{ id: 'w1', name: 'Treino A', scheduled_days: [] }],
        })

        const result = await activateAssignedProgram({
            assignedProgramId: 'program-scheduled',
            trainerId: 'trainer-1',
            source: 'cron',
        })

        expect(result).toMatchObject({
            success: false,
            activated: false,
            reason: 'missing_scheduled_days',
            workoutNames: ['Treino A'],
        })
        expect(insertStudentNotificationMock).not.toHaveBeenCalled()
        expect(insertTrainerNotificationMock).not.toHaveBeenCalled()
    })

    it('treats an optimistic activation update with zero rows as already_active', async () => {
        const { completionUpdate } = stubSuccessfulActivation({
            activationResponses: [{ data: [], error: null }],
        })

        const result = await activateAssignedProgram({
            assignedProgramId: 'program-scheduled',
            trainerId: 'trainer-1',
            source: 'manual',
        })

        expect(result).toMatchObject({
            success: true,
            activated: false,
            reason: 'already_active',
        })
        expect(completionUpdate).not.toHaveBeenCalled()
        expect(insertStudentNotificationMock).not.toHaveBeenCalled()
        expect(insertTrainerNotificationMock).not.toHaveBeenCalled()
    })

    it('allows only one winner when two activations race in parallel', async () => {
        const { completionUpdate } = stubSuccessfulActivation({
            activationResponses: [
                { data: [{ id: 'program-scheduled' }], error: null },
                { data: [], error: null },
            ],
        })

        const [winner, loser] = await Promise.all([
            activateAssignedProgram({
                assignedProgramId: 'program-scheduled',
                trainerId: 'trainer-1',
                source: 'manual',
            }),
            activateAssignedProgram({
                assignedProgramId: 'program-scheduled',
                trainerId: 'trainer-1',
                source: 'manual',
            }),
        ])

        expect([winner.activated, loser.activated].sort()).toEqual([false, true])
        expect(completionUpdate).toHaveBeenCalledTimes(1)
        expect(insertStudentNotificationMock).toHaveBeenCalledTimes(1)
        expect(sendStudentPushMock).toHaveBeenCalledTimes(1)
        expect(insertTrainerNotificationMock).not.toHaveBeenCalled()
    })
})
