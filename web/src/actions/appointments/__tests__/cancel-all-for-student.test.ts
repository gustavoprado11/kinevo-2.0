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
    syncDeleteAppointment: vi.fn().mockResolvedValue({
        synced: false,
        skipped: true,
        pending: false,
        error: false,
    }),
    withTimeout: vi.fn(),
}))

const STUDENT_ID = '33333333-3333-3333-3333-333333333333'

describe('cancelAllAppointmentsForStudent', () => {
    beforeEach(() => {
        vi.resetModules()
        mockSupabase = createSupabaseMock({
            trainers: {
                single: {
                    data: { id: 'trainer-1', name: 'Gustavo' },
                    error: null,
                },
            },
            students: {
                single: {
                    data: { id: STUDENT_ID, coach_id: 'trainer-1' },
                    error: null,
                },
            },
            recurring_appointments: {
                select: {
                    data: [{ id: 'ra-a' }, { id: 'ra-b' }, { id: 'ra-c' }],
                    error: null,
                },
                update: { data: null, error: null },
            },
        })
    })

    it('cancela todas as rotinas ativas do aluno e retorna canceledCount', async () => {
        const { cancelAllAppointmentsForStudent } = await import(
            '../cancel-all-for-student'
        )
        const result = await cancelAllAppointmentsForStudent({ studentId: STUDENT_ID })
        expect(result.success).toBe(true)
        expect(result.data?.canceledCount).toBe(3)
    })

    it('cancela lembretes pendentes e dispara 1 push agregado (inbox_item único)', async () => {
        const { cancelAllAppointmentsForStudent } = await import(
            '../cancel-all-for-student'
        )
        await cancelAllAppointmentsForStudent({ studentId: STUDENT_ID })
        const tables = mockSupabase.from.mock.calls.map((c) => c[0])
        expect(tables).toContain('scheduled_notifications')
        // Um único insert em student_inbox_items (push agregado).
        const inboxCalls = tables.filter((t) => t === 'student_inbox_items')
        expect(inboxCalls.length).toBe(1)
    })

    it('retorna canceledCount=0 quando aluno não tem rotinas ativas', async () => {
        mockSupabase = createSupabaseMock({
            trainers: {
                single: {
                    data: { id: 'trainer-1', name: 'Gustavo' },
                    error: null,
                },
            },
            students: {
                single: {
                    data: { id: STUDENT_ID, coach_id: 'trainer-1' },
                    error: null,
                },
            },
            recurring_appointments: {
                select: { data: [], error: null },
                update: { data: null, error: null },
            },
        })
        const { cancelAllAppointmentsForStudent } = await import(
            '../cancel-all-for-student'
        )
        const result = await cancelAllAppointmentsForStudent({ studentId: STUDENT_ID })
        expect(result.success).toBe(true)
        expect(result.data?.canceledCount).toBe(0)
    })

    it('rejeita quando aluno pertence a outro trainer', async () => {
        mockSupabase = createSupabaseMock({
            trainers: {
                single: {
                    data: { id: 'trainer-1', name: 'Gustavo' },
                    error: null,
                },
            },
            students: {
                single: {
                    data: { id: STUDENT_ID, coach_id: 'outro-trainer' },
                    error: null,
                },
            },
        })
        const { cancelAllAppointmentsForStudent } = await import(
            '../cancel-all-for-student'
        )
        const result = await cancelAllAppointmentsForStudent({ studentId: STUDENT_ID })
        expect(result.success).toBe(false)
        expect(result.error).toBe('Sem permissão')
    })

    it('rejeita não autenticado', async () => {
        mockSupabase = createSupabaseMock({
            auth: { data: { user: null }, error: null },
        })
        const { cancelAllAppointmentsForStudent } = await import(
            '../cancel-all-for-student'
        )
        const result = await cancelAllAppointmentsForStudent({ studentId: STUDENT_ID })
        expect(result.success).toBe(false)
    })

    it('valida UUID inválido via Zod', async () => {
        const { cancelAllAppointmentsForStudent } = await import(
            '../cancel-all-for-student'
        )
        const result = await cancelAllAppointmentsForStudent({ studentId: 'not-uuid' })
        expect(result.success).toBe(false)
    })
})
