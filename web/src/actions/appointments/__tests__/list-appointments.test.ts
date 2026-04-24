import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMock, type SupabaseMock } from './supabase-mock'

let mockSupabase: SupabaseMock
vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}))

function baseRule(overrides: Record<string, unknown> = {}) {
    return {
        id: 'ra-1',
        trainer_id: 'trainer-1',
        student_id: 'student-1',
        day_of_week: 2,
        start_time: '07:00',
        duration_minutes: 60,
        frequency: 'weekly',
        starts_on: '2026-04-07',
        ends_on: null,
        status: 'active',
        notes: null,
        created_at: '2026-04-01T00:00:00Z',
        updated_at: '2026-04-01T00:00:00Z',
        ...overrides,
    }
}

describe('listAppointmentsInRange', () => {
    beforeEach(() => {
        vi.resetModules()
    })

    it('retorna ocorrências expandidas para uma rotina semanal', async () => {
        mockSupabase = createSupabaseMock({
            trainers: { single: { data: { id: 'trainer-1' }, error: null } },
            recurring_appointments: {
                select: { data: [baseRule()], error: null },
            },
            appointment_exceptions: { select: { data: [], error: null } },
        })

        const { listAppointmentsInRange } = await import('../list-appointments')
        const result = await listAppointmentsInRange({
            rangeStart: '2026-04-01',
            rangeEnd: '2026-04-30',
        })
        expect(result.success).toBe(true)
        expect(result.data?.length).toBe(4)
        expect(result.data?.map((o) => o.date)).toEqual([
            '2026-04-07',
            '2026-04-14',
            '2026-04-21',
            '2026-04-28',
        ])
    })

    it('aplica exceção canceled corretamente', async () => {
        mockSupabase = createSupabaseMock({
            trainers: { single: { data: { id: 'trainer-1' }, error: null } },
            recurring_appointments: {
                select: { data: [baseRule()], error: null },
            },
            appointment_exceptions: {
                select: {
                    data: [
                        {
                            id: 'exc-1',
                            recurring_appointment_id: 'ra-1',
                            trainer_id: 'trainer-1',
                            occurrence_date: '2026-04-14',
                            kind: 'canceled',
                            new_date: null,
                            new_start_time: null,
                            notes: null,
                            created_at: '2026-04-10T00:00:00Z',
                        },
                    ],
                    error: null,
                },
            },
        })

        const { listAppointmentsInRange } = await import('../list-appointments')
        const result = await listAppointmentsInRange({
            rangeStart: '2026-04-01',
            rangeEnd: '2026-04-30',
        })
        expect(result.success).toBe(true)
        expect(result.data?.map((o) => o.date)).toEqual([
            '2026-04-07',
            '2026-04-21',
            '2026-04-28',
        ])
    })

    it('rejeita rangeEnd < rangeStart', async () => {
        mockSupabase = createSupabaseMock({
            trainers: { single: { data: { id: 'trainer-1' }, error: null } },
        })
        const { listAppointmentsInRange } = await import('../list-appointments')
        const result = await listAppointmentsInRange({
            rangeStart: '2026-04-30',
            rangeEnd: '2026-04-01',
        })
        expect(result.success).toBe(false)
        expect(result.error).toMatch(/rangeEnd/)
    })

    it('rejeita não autenticado', async () => {
        mockSupabase = createSupabaseMock({
            auth: { data: { user: null }, error: null },
        })
        const { listAppointmentsInRange } = await import('../list-appointments')
        const result = await listAppointmentsInRange({
            rangeStart: '2026-04-01',
            rangeEnd: '2026-04-30',
        })
        expect(result.success).toBe(false)
    })

    it('rejeita rangeStart inválido via Zod', async () => {
        const { listAppointmentsInRange } = await import('../list-appointments')
        const result = await listAppointmentsInRange({
            rangeStart: '01/04/2026',
            rangeEnd: '2026-04-30',
        })
        expect(result.success).toBe(false)
    })

    it('retorna vazio quando não há regras ativas', async () => {
        mockSupabase = createSupabaseMock({
            trainers: { single: { data: { id: 'trainer-1' }, error: null } },
            recurring_appointments: { select: { data: [], error: null } },
            appointment_exceptions: { select: { data: [], error: null } },
        })
        const { listAppointmentsInRange } = await import('../list-appointments')
        const result = await listAppointmentsInRange({
            rangeStart: '2026-04-01',
            rangeEnd: '2026-04-30',
        })
        expect(result.success).toBe(true)
        expect(result.data).toEqual([])
    })
})
