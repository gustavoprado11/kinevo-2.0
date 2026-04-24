import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMock, type SupabaseMock } from './supabase-mock'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

let mockSupabase: SupabaseMock
vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}))

vi.mock('@/lib/supabase-admin', () => ({
    supabaseAdmin: {
        from: (...args: unknown[]) => mockSupabase.from(...args as [string]),
    },
}))


vi.mock('@/lib/google-calendar/sync-service', () => ({
    syncCreateAppointment: vi.fn().mockResolvedValue({ synced: false, skipped: true, pending: false, error: false }),
    syncUpdateAppointment: vi.fn().mockResolvedValue({ synced: false, skipped: true, pending: false, error: false }),
    syncDeleteAppointment: vi.fn().mockResolvedValue({ synced: false, skipped: true, pending: false, error: false }),
    syncRescheduleOccurrence: vi.fn().mockResolvedValue({ synced: false, skipped: true, pending: false, error: false }),
    syncCancelOccurrence: vi.fn().mockResolvedValue({ synced: false, skipped: true, pending: false, error: false }),
    withTimeout: vi.fn(),
}))


const VALID_INPUT = {
    studentId: '11111111-1111-1111-1111-111111111111',
    slots: [
        { dayOfWeek: 1, startTime: '07:00', durationMinutes: 60 },
        { dayOfWeek: 3, startTime: '07:00', durationMinutes: 60 },
        { dayOfWeek: 5, startTime: '18:00', durationMinutes: 60 },
    ],
    frequency: 'weekly' as const,
    startsOn: '2026-04-06', // Monday
}

function baseMock(overrides: Parameters<typeof createSupabaseMock>[0] = {}) {
    return createSupabaseMock({
        trainers: { single: { data: { id: 'trainer-1' }, error: null } },
        students: {
            single: {
                data: {
                    id: VALID_INPUT.studentId,
                    coach_id: 'trainer-1',
                    name: 'João',
                },
                error: null,
            },
        },
        recurring_appointments: {
            select: { data: [], error: null },
            insert: {
                data: [{ id: 'ra-a' }, { id: 'ra-b' }, { id: 'ra-c' }],
                error: null,
            },
        },
        ...overrides,
    })
}

describe('createRecurringAppointmentGroup', () => {
    beforeEach(() => {
        vi.resetModules()
        mockSupabase = baseMock()
    })

    it('cria grupo com 3 slots e retorna groupId + appointmentIds', async () => {
        const { createRecurringAppointmentGroup } = await import(
            '../create-recurring-group'
        )
        const result = await createRecurringAppointmentGroup(VALID_INPUT)
        expect(result.success).toBe(true)
        expect(result.data?.groupId).toMatch(/[0-9a-f-]{36}/)
        expect(result.data?.appointmentIds).toEqual(['ra-a', 'ra-b', 'ra-c'])
    })

    it('enfileira lembretes e envia UM único push agregado', async () => {
        const { createRecurringAppointmentGroup } = await import(
            '../create-recurring-group'
        )
        await createRecurringAppointmentGroup(VALID_INPUT)
        const tables = mockSupabase.from.mock.calls.map((c) => c[0])
        expect(tables).toContain('scheduled_notifications')
        const inboxCalls = tables.filter((t) => t === 'student_inbox_items')
        // Um push imediato agregado (não 1 por slot).
        expect(inboxCalls.length).toBe(1)
    })

    it('rejeita monthly + 2+ slots', async () => {
        const { createRecurringAppointmentGroup } = await import(
            '../create-recurring-group'
        )
        const result = await createRecurringAppointmentGroup({
            ...VALID_INPUT,
            frequency: 'monthly',
        })
        expect(result.success).toBe(false)
        expect(result.error).toMatch(/mensais permitem apenas um dia/i)
    })

    it('rejeita slots duplicados (mesmo dia + mesmo horário)', async () => {
        const { createRecurringAppointmentGroup } = await import(
            '../create-recurring-group'
        )
        const result = await createRecurringAppointmentGroup({
            ...VALID_INPUT,
            slots: [
                { dayOfWeek: 1, startTime: '07:00', durationMinutes: 60 },
                { dayOfWeek: 1, startTime: '07:00', durationMinutes: 60 },
            ],
        })
        expect(result.success).toBe(false)
        expect(result.error).toMatch(/duplicados/i)
    })

    it('retorna pendingConflicts quando há conflito e confirmConflicts=false', async () => {
        mockSupabase = createSupabaseMock({
            trainers: { single: { data: { id: 'trainer-1' }, error: null } },
            students: {
                single: {
                    data: {
                        id: VALID_INPUT.studentId,
                        coach_id: 'trainer-1',
                        name: 'João',
                    },
                    error: null,
                },
            },
            recurring_appointments: {
                select: {
                    data: [
                        {
                            id: 'ra-conflict',
                            day_of_week: 1,
                            start_time: '07:30',
                            duration_minutes: 60,
                            student_id: 'other-student',
                        },
                    ],
                    error: null,
                },
                insert: { data: [], error: null },
            },
        })

        const { createRecurringAppointmentGroup } = await import(
            '../create-recurring-group'
        )
        const result = await createRecurringAppointmentGroup(VALID_INPUT)
        expect(result.success).toBe(false)
        expect(result.pendingConflicts?.length).toBeGreaterThan(0)
        expect(result.pendingConflicts?.[0].slotIndex).toBe(0)
    })

    it('insere mesmo com conflitos quando confirmConflicts=true', async () => {
        mockSupabase = createSupabaseMock({
            trainers: { single: { data: { id: 'trainer-1' }, error: null } },
            students: {
                single: {
                    data: {
                        id: VALID_INPUT.studentId,
                        coach_id: 'trainer-1',
                        name: 'João',
                    },
                    error: null,
                },
            },
            recurring_appointments: {
                select: {
                    data: [
                        {
                            id: 'ra-conflict',
                            day_of_week: 1,
                            start_time: '07:30',
                            duration_minutes: 60,
                            student_id: 'other-student',
                        },
                    ],
                    error: null,
                },
                insert: {
                    data: [{ id: 'ra-a' }, { id: 'ra-b' }, { id: 'ra-c' }],
                    error: null,
                },
            },
        })
        const { createRecurringAppointmentGroup } = await import(
            '../create-recurring-group'
        )
        const result = await createRecurringAppointmentGroup(VALID_INPUT, {
            confirmConflicts: true,
        })
        expect(result.success).toBe(true)
        expect(result.data?.groupId).toBeDefined()
    })

    it('rejeita quando studentId não pertence ao trainer', async () => {
        mockSupabase = baseMock({
            students: {
                single: {
                    data: {
                        id: VALID_INPUT.studentId,
                        coach_id: 'outro-trainer',
                        name: 'João',
                    },
                    error: null,
                },
            },
        })
        const { createRecurringAppointmentGroup } = await import(
            '../create-recurring-group'
        )
        const result = await createRecurringAppointmentGroup(VALID_INPUT)
        expect(result.success).toBe(false)
        expect(result.error).toBe('Sem permissão')
    })

    it('rejeita usuário não autenticado', async () => {
        mockSupabase = baseMock({ auth: { data: { user: null }, error: null } })
        const { createRecurringAppointmentGroup } = await import(
            '../create-recurring-group'
        )
        const result = await createRecurringAppointmentGroup(VALID_INPUT)
        expect(result.success).toBe(false)
    })
})
