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
    dayOfWeek: 2,
    startTime: '07:00',
    durationMinutes: 60,
    frequency: 'weekly' as const,
    startsOn: '2026-04-07', // Tuesday
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
            insert: { data: { id: 'ra-1' }, error: null },
        },
        ...overrides,
    })
}

describe('createRecurringAppointment', () => {
    beforeEach(() => {
        vi.resetModules()
        mockSupabase = baseMock()
    })

    it('insere lembretes em scheduled_notifications e push imediato em student_inbox_items', async () => {
        const { createRecurringAppointment } = await import('../create-recurring')
        await createRecurringAppointment(VALID_INPUT)
        const tables = mockSupabase.from.mock.calls.map((c) => c[0])
        expect(tables).toContain('scheduled_notifications')
        expect(tables).toContain('student_inbox_items')
    })

    it('cria rotina válida e retorna id sem conflitos', async () => {
        const { createRecurringAppointment } = await import('../create-recurring')
        const result = await createRecurringAppointment(VALID_INPUT)
        expect(result.success).toBe(true)
        expect(result.data?.id).toBe('ra-1')
        expect(result.data?.conflicts).toEqual([])
    })

    it('rejeita usuário não autenticado', async () => {
        mockSupabase = baseMock({
            auth: { data: { user: null }, error: null },
        })
        const { createRecurringAppointment } = await import('../create-recurring')
        const result = await createRecurringAppointment(VALID_INPUT)
        expect(result.success).toBe(false)
        expect(result.error).toBe('Não autorizado')
    })

    it('rejeita input malformado via Zod', async () => {
        const { createRecurringAppointment } = await import('../create-recurring')
        const result = await createRecurringAppointment({
            ...VALID_INPUT,
            startTime: 'invalid-time',
        })
        expect(result.success).toBe(false)
        expect(result.error).toMatch(/Horário/)
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
        const { createRecurringAppointment } = await import('../create-recurring')
        const result = await createRecurringAppointment(VALID_INPUT)
        expect(result.success).toBe(false)
        expect(result.error).toBe('Sem permissão')
    })

    it('detecta conflitos e NÃO insere quando confirmConflicts=false (default)', async () => {
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
                            start_time: '07:30',
                            duration_minutes: 60,
                            student_id: 'other-student',
                        },
                    ],
                    error: null,
                },
                insert: { data: { id: 'ra-new' }, error: null },
            },
        })

        const { createRecurringAppointment } = await import('../create-recurring')
        const result = await createRecurringAppointment(VALID_INPUT)

        expect(result.success).toBe(false)
        expect(result.pendingConflicts?.length).toBeGreaterThan(0)
        expect(result.data).toBeUndefined()
    })

    it('insere quando há conflitos E confirmConflicts=true', async () => {
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
                            start_time: '07:30',
                            duration_minutes: 60,
                            student_id: 'other-student',
                        },
                    ],
                    error: null,
                },
                insert: { data: { id: 'ra-new' }, error: null },
            },
        })

        const { createRecurringAppointment } = await import('../create-recurring')
        const result = await createRecurringAppointment(VALID_INPUT, {
            confirmConflicts: true,
        })

        expect(result.success).toBe(true)
        expect(result.data?.id).toBe('ra-new')
    })

    it('monthly com day_of_week inconsistente retorna erro claro e não insere', async () => {
        // 2026-04-07 é terça (dayOfWeek=2). Passando dayOfWeek=3 (quarta).
        const { createRecurringAppointment } = await import('../create-recurring')
        const result = await createRecurringAppointment({
            ...VALID_INPUT,
            frequency: 'monthly',
            dayOfWeek: 3,
        })
        expect(result.success).toBe(false)
        expect(result.error).toMatch(/mensais.*dia da semana/i)
        expect(mockSupabase.from).not.toHaveBeenCalledWith('recurring_appointments')
    })

    it('monthly com day_of_week consistente cria normalmente', async () => {
        const { createRecurringAppointment } = await import('../create-recurring')
        const result = await createRecurringAppointment({
            ...VALID_INPUT,
            frequency: 'monthly',
            dayOfWeek: 2, // Terça, bate com 2026-04-07
        })
        expect(result.success).toBe(true)
        expect(result.data?.id).toBe('ra-1')
    })

    it('weekly aceita day_of_week diferente de starts_on (sem validação extra)', async () => {
        const { createRecurringAppointment } = await import('../create-recurring')
        const result = await createRecurringAppointment({
            ...VALID_INPUT,
            frequency: 'weekly',
            dayOfWeek: 5, // sexta, vs starts_on terça — permitido em weekly
        })
        expect(result.success).toBe(true)
    })
})
