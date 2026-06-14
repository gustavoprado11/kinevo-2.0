import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMock, type SupabaseMock } from '../../appointments/__tests__/supabase-mock'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

let mockSupabase: SupabaseMock
vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}))
vi.mock('@/lib/supabase-admin', () => ({
    supabaseAdmin: { from: (...args: unknown[]) => mockSupabase.from(...(args as [string])) },
}))
// Evita inicializar o SDK real do Stripe / gerar checkout / logar evento.
vi.mock('@/lib/stripe', () => ({ stripe: { subscriptions: { cancel: vi.fn() } } }))
const generateCheckoutCore = vi.fn()
vi.mock('@/lib/stripe/generate-checkout', () => ({
    generateCheckoutCore: (...a: unknown[]) => generateCheckoutCore(...a),
}))
const logContractEvent = vi.fn()
vi.mock('@/lib/contract-events', () => ({
    logContractEvent: (...a: unknown[]) => logContractEvent(...a),
}))

const TRAINER = 'trainer-1'
const STUDENT_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' // aluno do contrato (do próprio trainer)
const STUDENT_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' // aluno de outro tenant
const CONTRACT = 'cccccccc-cccc-cccc-cccc-cccccccccccc'

function baseContract(overrides: Record<string, unknown> = {}) {
    return {
        id: CONTRACT,
        student_id: STUDENT_A,
        trainer_id: TRAINER,
        status: 'active',
        billing_type: 'manual_recurring',
        stripe_subscription_id: null,
        ...overrides,
    }
}

describe('migrateContract — isolamento de tenant (fix IDOR)', () => {
    beforeEach(() => {
        vi.resetModules()
        generateCheckoutCore.mockReset()
        logContractEvent.mockReset()
    })

    it('bloqueia studentId divergente do contrato (cross-tenant) sem cancelar/criar nada', async () => {
        mockSupabase = createSupabaseMock({
            trainers: { single: { data: { id: TRAINER }, error: null } },
            // o contrato é do trainer (passa a checagem de trainer_id), mas o aluno do corpo é outro
            student_contracts: { single: { data: baseContract(), error: null }, update: { data: null, error: null } },
            students: { single: { data: { id: STUDENT_B, coach_id: 'outro-trainer' }, error: null } },
        })
        const { migrateContract } = await import('../migrate-contract')
        const result = await migrateContract({ studentId: STUDENT_B, fromContractId: CONTRACT, toBillingType: 'courtesy' })

        expect(result.success).toBe(false)
        expect(result.error).toBe('Aluno não encontrado')
        const tables = mockSupabase.from.mock.calls.map((c) => c[0])
        // Guard 1 retorna antes de tocar em students e antes de cancelar/criar contrato.
        expect(tables).not.toContain('students')
        expect(tables.filter((t) => t === 'student_contracts').length).toBe(1) // só o SELECT do contrato atual
        expect(logContractEvent).not.toHaveBeenCalled()
    })

    it('bloqueia quando o aluno do contrato pertence a outro trainer (defense-in-depth)', async () => {
        mockSupabase = createSupabaseMock({
            trainers: { single: { data: { id: TRAINER }, error: null } },
            student_contracts: { single: { data: baseContract({ student_id: STUDENT_A }), error: null }, update: { data: null, error: null } },
            students: { single: { data: { id: STUDENT_A, coach_id: 'outro-trainer' }, error: null } },
        })
        const { migrateContract } = await import('../migrate-contract')
        const result = await migrateContract({ studentId: STUDENT_A, fromContractId: CONTRACT, toBillingType: 'courtesy' })

        expect(result.success).toBe(false)
        expect(result.error).toBe('Aluno não encontrado')
        expect(logContractEvent).not.toHaveBeenCalled()
    })

    it('permite o fluxo legítimo (studentId == contrato e aluno do próprio trainer)', async () => {
        mockSupabase = createSupabaseMock({
            trainers: { single: { data: { id: TRAINER }, error: null } },
            student_contracts: { single: { data: baseContract(), error: null }, update: { data: null, error: null } },
            students: { single: { data: { id: STUDENT_A, coach_id: TRAINER }, error: null } },
        })
        const { migrateContract } = await import('../migrate-contract')
        const result = await migrateContract({ studentId: STUDENT_A, fromContractId: CONTRACT, toBillingType: 'courtesy' })

        expect(result.success).toBe(true)
        // chegou ao fim do fluxo (log de migração) — as guardas não bloquearam o caminho válido
        expect(logContractEvent).toHaveBeenCalled()
    })
})
