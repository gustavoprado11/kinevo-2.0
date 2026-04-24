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


const RULE_ID = '22222222-2222-2222-2222-222222222222'

function baseRule(overrides: Record<string, unknown> = {}) {
    return {
        id: RULE_ID,
        trainer_id: 'trainer-1',
        student_id: 'student-1',
        day_of_week: 2,
        start_time: '07:00',
        duration_minutes: 60,
        frequency: 'weekly',
        starts_on: '2026-04-07',
        ...overrides,
    }
}

describe('updateRecurringAppointment', () => {
    beforeEach(() => {
        vi.resetModules()
        mockSupabase = createSupabaseMock({
            trainers: { single: { data: { id: 'trainer-1' }, error: null } },
            recurring_appointments: {
                single: { data: baseRule(), error: null },
                update: { data: null, error: null },
            },
        })
    })

    it('atualiza campos parciais com sucesso', async () => {
        const { updateRecurringAppointment } = await import('../update-recurring')
        const result = await updateRecurringAppointment({
            id: RULE_ID,
            startTime: '08:00',
        })
        expect(result.success).toBe(true)
    })

    it('rejeita usuário não autenticado', async () => {
        mockSupabase = createSupabaseMock({
            auth: { data: { user: null }, error: null },
        })
        const { updateRecurringAppointment } = await import('../update-recurring')
        const result = await updateRecurringAppointment({
            id: RULE_ID,
            startTime: '08:00',
        })
        expect(result.success).toBe(false)
        expect(result.error).toBe('Não autorizado')
    })

    it('rejeita quando rotina pertence a outro trainer', async () => {
        mockSupabase = createSupabaseMock({
            trainers: { single: { data: { id: 'trainer-1' }, error: null } },
            recurring_appointments: {
                single: {
                    data: baseRule({ trainer_id: 'outro-trainer' }),
                    error: null,
                },
                update: { data: null, error: null },
            },
        })
        const { updateRecurringAppointment } = await import('../update-recurring')
        const result = await updateRecurringAppointment({
            id: RULE_ID,
            startTime: '08:00',
        })
        expect(result.success).toBe(false)
        expect(result.error).toBe('Sem permissão')
    })

    it('valida monthly consistency no merge (muda dayOfWeek sem mudar startsOn)', async () => {
        // Regra original: weekly. Se o update mudar pra monthly sem ajustar
        // dayOfWeek, deve bloquear.
        mockSupabase = createSupabaseMock({
            trainers: { single: { data: { id: 'trainer-1' }, error: null } },
            recurring_appointments: {
                single: {
                    data: baseRule({ frequency: 'weekly', day_of_week: 3 }), // quarta
                    error: null,
                },
                update: { data: null, error: null },
            },
        })
        const { updateRecurringAppointment } = await import('../update-recurring')
        const result = await updateRecurringAppointment({
            id: RULE_ID,
            frequency: 'monthly', // starts_on herdado = 2026-04-07 (terça), dayOfWeek herdado = 3 → inconsistente
        })
        expect(result.success).toBe(false)
        expect(result.error).toMatch(/mensais.*dia da semana/i)
    })

    it('retorna success sem fazer DB call quando nenhum campo é passado', async () => {
        const { updateRecurringAppointment } = await import('../update-recurring')
        const result = await updateRecurringAppointment({ id: RULE_ID })
        expect(result.success).toBe(true)
    })
})
