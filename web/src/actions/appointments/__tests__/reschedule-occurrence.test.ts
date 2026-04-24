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


const RULE_ID = '44444444-4444-4444-4444-444444444444'

const rule = {
    id: RULE_ID,
    trainer_id: 'trainer-1',
    student_id: 'student-1',
    day_of_week: 2,
    duration_minutes: 60,
    frequency: 'weekly',
    notes: null,
}

describe('rescheduleOccurrence', () => {
    beforeEach(() => {
        vi.resetModules()
        mockSupabase = createSupabaseMock({
            trainers: { single: { data: { id: 'trainer-1' }, error: null } },
            recurring_appointments: {
                single: { data: rule, error: null },
                update: { data: null, error: null },
                insert: { data: { id: 'ra-new' }, error: null },
            },
            appointment_exceptions: {
                upsert: { data: null, error: null },
            },
        })
    })

    it('scope=only_this atualiza lembrete e envia push imediato', async () => {
        const { rescheduleOccurrence } = await import('../reschedule-occurrence')
        await rescheduleOccurrence({
            recurringAppointmentId: RULE_ID,
            originalDate: '2026-04-14',
            newDate: '2026-04-15',
            newStartTime: '08:30',
            scope: 'only_this',
        })
        const tables = mockSupabase.from.mock.calls.map((c) => c[0])
        expect(tables).toContain('scheduled_notifications')
        expect(tables).toContain('student_inbox_items')
    })

    it('scope=only_this faz upsert em appointment_exceptions', async () => {
        const { rescheduleOccurrence } = await import('../reschedule-occurrence')
        const result = await rescheduleOccurrence({
            recurringAppointmentId: RULE_ID,
            originalDate: '2026-04-14',
            newDate: '2026-04-15',
            newStartTime: '08:30',
            scope: 'only_this',
        })
        expect(result.success).toBe(true)
        expect(mockSupabase.from).toHaveBeenCalledWith('appointment_exceptions')
    })

    it('scope=this_and_future encerra rotina antiga + cria nova', async () => {
        const { rescheduleOccurrence } = await import('../reschedule-occurrence')
        const result = await rescheduleOccurrence({
            recurringAppointmentId: RULE_ID,
            originalDate: '2026-04-14',
            newDate: '2026-04-15',
            newStartTime: '08:30',
            scope: 'this_and_future',
        })
        expect(result.success).toBe(true)
        expect(result.data?.newRecurringAppointmentId).toBe('ra-new')
    })

    it('rejeita não autenticado', async () => {
        mockSupabase = createSupabaseMock({
            auth: { data: { user: null }, error: null },
        })
        const { rescheduleOccurrence } = await import('../reschedule-occurrence')
        const result = await rescheduleOccurrence({
            recurringAppointmentId: RULE_ID,
            originalDate: '2026-04-14',
            newDate: '2026-04-15',
            newStartTime: '08:30',
            scope: 'only_this',
        })
        expect(result.success).toBe(false)
    })

    it('rejeita scope inválido via Zod', async () => {
        const { rescheduleOccurrence } = await import('../reschedule-occurrence')
        const result = await rescheduleOccurrence({
            recurringAppointmentId: RULE_ID,
            originalDate: '2026-04-14',
            newDate: '2026-04-15',
            newStartTime: '08:30',
            // @ts-expect-error intentionally invalid scope
            scope: 'bogus',
        })
        expect(result.success).toBe(false)
    })

    it("remarcar rotina 'weekly' chama syncRescheduleOccurrence (instance override)", async () => {
        const syncModule = await import('@/lib/google-calendar/sync-service')
        ;(syncModule.syncRescheduleOccurrence as ReturnType<typeof vi.fn>).mockClear()
        ;(syncModule.syncUpdateAppointment as ReturnType<typeof vi.fn>).mockClear()

        const { rescheduleOccurrence } = await import('../reschedule-occurrence')
        const result = await rescheduleOccurrence({
            recurringAppointmentId: RULE_ID,
            originalDate: '2026-04-14',
            newDate: '2026-04-15',
            newStartTime: '08:30',
            scope: 'only_this',
        })
        expect(result.success).toBe(true)
        // Fire-and-forget — aguarda microtasks do void IIFE
        await new Promise((r) => setTimeout(r, 0))
        expect(syncModule.syncRescheduleOccurrence).toHaveBeenCalledTimes(1)
        expect(syncModule.syncUpdateAppointment).not.toHaveBeenCalled()
    })

    it("remarcar rotina 'once' chama syncUpdateAppointment (PATCH do evento inteiro) e não syncRescheduleOccurrence", async () => {
        mockSupabase = createSupabaseMock({
            trainers: { single: { data: { id: 'trainer-1' }, error: null } },
            recurring_appointments: {
                single: { data: { ...rule, frequency: 'once' }, error: null },
                update: { data: null, error: null },
            },
            appointment_exceptions: { upsert: { data: null, error: null } },
        })
        const syncModule = await import('@/lib/google-calendar/sync-service')
        ;(syncModule.syncRescheduleOccurrence as ReturnType<typeof vi.fn>).mockClear()
        ;(syncModule.syncUpdateAppointment as ReturnType<typeof vi.fn>).mockClear()

        const { rescheduleOccurrence } = await import('../reschedule-occurrence')
        const result = await rescheduleOccurrence({
            recurringAppointmentId: RULE_ID,
            originalDate: '2026-04-14',
            newDate: '2026-04-15',
            newStartTime: '08:30',
            scope: 'only_this',
        })
        expect(result.success).toBe(true)
        await new Promise((r) => setTimeout(r, 0))
        expect(syncModule.syncUpdateAppointment).toHaveBeenCalledTimes(1)
        expect(syncModule.syncUpdateAppointment).toHaveBeenCalledWith(RULE_ID)
        expect(syncModule.syncRescheduleOccurrence).not.toHaveBeenCalled()
    })

    it('rejeita quando rotina pertence a outro trainer', async () => {
        mockSupabase = createSupabaseMock({
            trainers: { single: { data: { id: 'trainer-1' }, error: null } },
            recurring_appointments: {
                single: { data: { ...rule, trainer_id: 'outro' }, error: null },
            },
            appointment_exceptions: { upsert: { data: null, error: null } },
        })
        const { rescheduleOccurrence } = await import('../reschedule-occurrence')
        const result = await rescheduleOccurrence({
            recurringAppointmentId: RULE_ID,
            originalDate: '2026-04-14',
            newDate: '2026-04-15',
            newStartTime: '08:30',
            scope: 'only_this',
        })
        expect(result.success).toBe(false)
        expect(result.error).toBe('Sem permissão')
    })
})
