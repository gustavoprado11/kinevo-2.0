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


const GROUP_ID = '22222222-2222-2222-2222-222222222222'

describe('cancelRecurringGroup', () => {
    beforeEach(() => {
        vi.resetModules()
        mockSupabase = createSupabaseMock({
            trainers: { single: { data: { id: 'trainer-1' }, error: null } },
            recurring_appointments: {
                select: {
                    data: [
                        { id: 'ra-a', student_id: 'student-1' },
                        { id: 'ra-b', student_id: 'student-1' },
                        { id: 'ra-c', student_id: 'student-1' },
                    ],
                    error: null,
                },
                update: { data: null, error: null },
            },
        })
    })

    it('cancela lembretes do grupo e envia pushes por aluno', async () => {
        const { cancelRecurringGroup } = await import('../cancel-recurring-group')
        await cancelRecurringGroup({ groupId: GROUP_ID })
        const tables = mockSupabase.from.mock.calls.map((c) => c[0])
        expect(tables).toContain('scheduled_notifications')
        expect(tables).toContain('student_inbox_items')
    })

    it('encerra todas as rotinas do grupo', async () => {
        const { cancelRecurringGroup } = await import('../cancel-recurring-group')
        const result = await cancelRecurringGroup({ groupId: GROUP_ID })
        expect(result.success).toBe(true)
        expect(result.data?.canceledCount).toBe(3)
    })

    it('retorna erro quando grupo não existe ou sem permissão', async () => {
        mockSupabase = createSupabaseMock({
            trainers: { single: { data: { id: 'trainer-1' }, error: null } },
            recurring_appointments: {
                select: { data: [], error: null },
                update: { data: null, error: null },
            },
        })
        const { cancelRecurringGroup } = await import('../cancel-recurring-group')
        const result = await cancelRecurringGroup({ groupId: GROUP_ID })
        expect(result.success).toBe(false)
        expect(result.error).toMatch(/não encontrado/i)
    })

    it('rejeita não autenticado', async () => {
        mockSupabase = createSupabaseMock({
            auth: { data: { user: null }, error: null },
        })
        const { cancelRecurringGroup } = await import('../cancel-recurring-group')
        const result = await cancelRecurringGroup({ groupId: GROUP_ID })
        expect(result.success).toBe(false)
    })

    it('valida UUID inválido via Zod', async () => {
        const { cancelRecurringGroup } = await import('../cancel-recurring-group')
        const result = await cancelRecurringGroup({ groupId: 'not-a-uuid' })
        expect(result.success).toBe(false)
    })
})
