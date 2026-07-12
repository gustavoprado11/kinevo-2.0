import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMock, type SupabaseMock } from './supabase-mock'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

let mockSupabase: SupabaseMock
vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}))

// O núcleo (core.ts) importa supabaseAdmin no topo — mock para não lançar no
// ambiente de teste (sem SERVICE_ROLE_KEY).
vi.mock('@/lib/supabase-admin', () => ({
    supabaseAdmin: {
        from: (...args: unknown[]) => mockSupabase.from(...(args as [string])),
    },
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
            appointment_exceptions: {
                // Lookup da exceção existente (D1) — default: sem exceção prévia.
                maybeSingle: { data: null, error: null },
                upsert: { data: null, error: null },
            },
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

    it('D1: presença numa REMARCADA preserva new_date/new_start_time', async () => {
        mockSupabase = createSupabaseMock({
            trainers: { single: { data: { id: 'trainer-1' }, error: null } },
            recurring_appointments: {
                single: {
                    data: { id: RULE_ID, trainer_id: 'trainer-1', student_id: 'student-1' },
                    error: null,
                },
            },
            appointment_exceptions: {
                maybeSingle: {
                    data: { new_date: '2026-04-20', new_start_time: '10:00' },
                    error: null,
                },
                upsert: { data: null, error: null },
            },
        })

        const { markOccurrenceStatus } = await import('../mark-occurrence-status')
        const result = await markOccurrenceStatus({
            recurringAppointmentId: RULE_ID,
            occurrenceDate: '2026-04-14',
            status: 'completed',
        })
        expect(result.success).toBe(true)

        // O upsert NÃO pode zerar a remarcação (antes gravava new_date: null).
        const from = mockSupabase.from as ReturnType<typeof vi.fn>
        const excChains = from.mock.results
            .filter((_, i) => from.mock.calls[i][0] === 'appointment_exceptions')
            .map((r) => r.value)
        const upsertPayload = excChains.flatMap(
            (c) => (c.upsert as ReturnType<typeof vi.fn>).mock.calls,
        )[0]?.[0]
        expect(upsertPayload).toMatchObject({
            kind: 'completed',
            new_date: '2026-04-20',
            new_start_time: '10:00',
        })
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
