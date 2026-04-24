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


const RULE_ID = '33333333-3333-3333-3333-333333333333'

describe('cancelRecurringAppointment', () => {
    beforeEach(() => {
        vi.resetModules()
        mockSupabase = createSupabaseMock({
            trainers: { single: { data: { id: 'trainer-1' }, error: null } },
            recurring_appointments: {
                single: {
                    data: {
                        id: RULE_ID,
                        trainer_id: 'trainer-1',
                        student_id: 'student-1',
                        day_of_week: 2,
                        group_id: null,
                    },
                    error: null,
                },
                update: { data: null, error: null },
            },
        })
    })

    it('encerra rotina com endsOn default (hoje)', async () => {
        const { cancelRecurringAppointment } = await import('../cancel-recurring')
        const result = await cancelRecurringAppointment({ id: RULE_ID })
        expect(result.success).toBe(true)
    })

    it('cancela lembretes pendentes e envia push imediato', async () => {
        const { cancelRecurringAppointment } = await import('../cancel-recurring')
        await cancelRecurringAppointment({ id: RULE_ID })
        const tables = mockSupabase.from.mock.calls.map((c) => c[0])
        expect(tables).toContain('scheduled_notifications')
        expect(tables).toContain('student_inbox_items')
    })

    it('encerra rotina com endsOn explícito', async () => {
        const { cancelRecurringAppointment } = await import('../cancel-recurring')
        const result = await cancelRecurringAppointment({
            id: RULE_ID,
            endsOn: '2026-05-31',
        })
        expect(result.success).toBe(true)
    })

    it('rejeita não autenticado', async () => {
        mockSupabase = createSupabaseMock({
            auth: { data: { user: null }, error: null },
        })
        const { cancelRecurringAppointment } = await import('../cancel-recurring')
        const result = await cancelRecurringAppointment({ id: RULE_ID })
        expect(result.success).toBe(false)
    })

    it('rejeita se rotina pertence a outro trainer', async () => {
        mockSupabase = createSupabaseMock({
            trainers: { single: { data: { id: 'trainer-1' }, error: null } },
            recurring_appointments: {
                single: {
                    data: {
                        id: RULE_ID,
                        trainer_id: 'outro',
                        student_id: 'student-1',
                    },
                    error: null,
                },
                update: { data: null, error: null },
            },
        })
        const { cancelRecurringAppointment } = await import('../cancel-recurring')
        const result = await cancelRecurringAppointment({ id: RULE_ID })
        expect(result.success).toBe(false)
        expect(result.error).toBe('Sem permissão')
    })
})
