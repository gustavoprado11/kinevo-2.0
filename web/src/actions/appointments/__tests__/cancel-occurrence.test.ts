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


const RULE_ID = '55555555-5555-5555-5555-555555555555'

describe('cancelOccurrence', () => {
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
                        start_time: '07:00',
                    },
                    error: null,
                },
            },
            appointment_exceptions: { upsert: { data: null, error: null } },
        })
    })

    it('cancela lembrete pendente e envia push imediato', async () => {
        const { cancelOccurrence } = await import('../cancel-occurrence')
        await cancelOccurrence({
            recurringAppointmentId: RULE_ID,
            occurrenceDate: '2026-04-14',
        })
        const tables = mockSupabase.from.mock.calls.map((c) => c[0])
        expect(tables).toContain('scheduled_notifications')
        expect(tables).toContain('student_inbox_items')
    })

    it('faz upsert com kind=canceled', async () => {
        const { cancelOccurrence } = await import('../cancel-occurrence')
        const result = await cancelOccurrence({
            recurringAppointmentId: RULE_ID,
            occurrenceDate: '2026-04-14',
        })
        expect(result.success).toBe(true)
        expect(mockSupabase.from).toHaveBeenCalledWith('appointment_exceptions')
    })

    it('rejeita data inválida via Zod', async () => {
        const { cancelOccurrence } = await import('../cancel-occurrence')
        const result = await cancelOccurrence({
            recurringAppointmentId: RULE_ID,
            occurrenceDate: '14/04/2026',
        })
        expect(result.success).toBe(false)
    })

    it('rejeita não autenticado', async () => {
        mockSupabase = createSupabaseMock({
            auth: { data: { user: null }, error: null },
        })
        const { cancelOccurrence } = await import('../cancel-occurrence')
        const result = await cancelOccurrence({
            recurringAppointmentId: RULE_ID,
            occurrenceDate: '2026-04-14',
        })
        expect(result.success).toBe(false)
    })
})
