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

interface UpdateCompleteChain {
    eq: () => UpdateCompleteChain
    in: ReturnType<typeof vi.fn>
}

describe('activateAssignedProgram', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('activates the scheduled program and emits both student and trainer notifications for cron activation', async () => {
        let assignedProgramsCalls = 0
        const completeCurrentPrograms = vi.fn().mockResolvedValue({ error: null })
        const activateProgramUpdate = vi.fn().mockResolvedValue({ error: null })

        supabaseAdminMock.from = vi.fn((table: string) => {
            if (table === 'assigned_programs') {
                assignedProgramsCalls++

                if (assignedProgramsCalls === 1) {
                    return {
                        select: () => ({
                            eq: () => ({
                                eq: () => ({
                                    single: () =>
                                        Promise.resolve({
                                            data: {
                                                id: 'program-scheduled',
                                                student_id: 'student-1',
                                                status: 'scheduled',
                                                name: 'Treino Maio',
                                                trainer_id: 'trainer-1',
                                                duration_weeks: 4,
                                                assigned_workouts: [
                                                    { id: 'w1', name: 'Treino A', scheduled_days: [1, 3] },
                                                ],
                                            },
                                            error: null,
                                        }),
                                }),
                            }),
                        }),
                    }
                }

                if (assignedProgramsCalls === 2) {
                    const chain: UpdateCompleteChain = {
                        eq: vi.fn(() => chain),
                        in: completeCurrentPrograms,
                    }
                    return {
                        update: vi.fn(() => chain),
                    }
                }

                return {
                    update: vi.fn(() => ({
                        eq: () => ({
                            eq: activateProgramUpdate,
                        }),
                    })),
                }
            }

            if (table === 'students') {
                return {
                    select: () => ({
                        eq: () => ({
                            eq: () => ({
                                single: () =>
                                    Promise.resolve({
                                        data: { id: 'student-1', name: 'Marina' },
                                        error: null,
                                    }),
                            }),
                        }),
                    }),
                }
            }

            throw new Error(`Unexpected table ${table}`)
        }) as unknown as typeof supabaseAdminMock.from

        insertStudentNotificationMock.mockResolvedValue('inbox-1')
        insertTrainerNotificationMock.mockResolvedValue('trainer-notif-1')

        const result = await activateAssignedProgram({
            assignedProgramId: 'program-scheduled',
            trainerId: 'trainer-1',
            source: 'cron',
        })

        expect(result).toMatchObject({
            success: true,
            activated: true,
            studentId: 'student-1',
            trainerId: 'trainer-1',
            programName: 'Treino Maio',
        })
        expect(completeCurrentPrograms).toHaveBeenCalledTimes(1)
        expect(activateProgramUpdate).toHaveBeenCalledTimes(1)
        expect(insertStudentNotificationMock).toHaveBeenCalledWith(
            expect.objectContaining({
                studentId: 'student-1',
                trainerId: 'trainer-1',
                type: 'program_assigned',
            }),
        )
        expect(sendStudentPushMock).toHaveBeenCalledWith(
            expect.objectContaining({
                studentId: 'student-1',
                inboxItemId: 'inbox-1',
            }),
        )
        expect(insertTrainerNotificationMock).toHaveBeenCalledWith(
            expect.objectContaining({
                trainerId: 'trainer-1',
                type: 'program_auto_activated',
            }),
        )
        expect(sendTrainerPushMock).toHaveBeenCalledWith(
            expect.objectContaining({
                trainerId: 'trainer-1',
                notificationId: 'trainer-notif-1',
            }),
        )
    })

    it('refuses activation when any workout has no scheduled days', async () => {
        supabaseAdminMock.from = vi.fn((table: string) => {
            if (table === 'assigned_programs') {
                return {
                    select: () => ({
                        eq: () => ({
                            eq: () => ({
                                single: () =>
                                    Promise.resolve({
                                        data: {
                                            id: 'program-scheduled',
                                            student_id: 'student-1',
                                            status: 'scheduled',
                                            name: 'Treino Inválido',
                                            trainer_id: 'trainer-1',
                                            duration_weeks: 4,
                                            assigned_workouts: [
                                                { id: 'w1', name: 'Treino A', scheduled_days: [] },
                                            ],
                                        },
                                        error: null,
                                    }),
                            }),
                        }),
                    }),
                }
            }

            throw new Error(`Unexpected table ${table}`)
        }) as unknown as typeof supabaseAdminMock.from

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
        expect(sendStudentPushMock).not.toHaveBeenCalled()
        expect(sendTrainerPushMock).not.toHaveBeenCalled()
    })
})
