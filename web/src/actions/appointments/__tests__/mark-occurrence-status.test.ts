import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMock, type SupabaseMock } from './supabase-mock'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

let mockSupabase: SupabaseMock
vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}))

const RULE_ID = '66666666-6666-6666-6666-666666666666'

describe('markOccurrenceStatus', () => {
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
                    },
                    error: null,
                },
            },
            appointment_exceptions: { upsert: { data: null, error: null } },
        })
    })

    it('marca como completed', async () => {
        const { markOccurrenceStatus } = await import('../mark-occurrence-status')
        const result = await markOccurrenceStatus({
            recurringAppointmentId: RULE_ID,
            occurrenceDate: '2026-04-14',
            status: 'completed',
        })
        expect(result.success).toBe(true)
    })

    it('marca como no_show', async () => {
        const { markOccurrenceStatus } = await import('../mark-occurrence-status')
        const result = await markOccurrenceStatus({
            recurringAppointmentId: RULE_ID,
            occurrenceDate: '2026-04-14',
            status: 'no_show',
        })
        expect(result.success).toBe(true)
    })

    it('rejeita status inválido via Zod', async () => {
        const { markOccurrenceStatus } = await import('../mark-occurrence-status')
        const result = await markOccurrenceStatus({
            recurringAppointmentId: RULE_ID,
            occurrenceDate: '2026-04-14',
            // @ts-expect-error intentionally invalid
            status: 'rescheduled',
        })
        expect(result.success).toBe(false)
    })
})
