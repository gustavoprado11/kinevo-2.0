import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSupabaseAdminStub, type SupabaseAdminStub } from '@/test/supabase-admin-stub'

vi.mock('@/lib/contract-events', () => ({ logContractEvent: vi.fn() }))
// contracts-core importa stripe/asaas no topo (usados por create/cancel, não por
// markAsPaidCore). lib/stripe lança no load sem STRIPE_SECRET_KEY → mockamos.
// wallet-service importa supabase-admin no load (lança sem env) → mock também.
vi.mock('@/lib/stripe', () => ({ stripe: {} }))
vi.mock('@/lib/asaas/cancel-recurring', () => ({ cancelAsaasRecurring: vi.fn() }))
vi.mock('@/lib/asaas/wallet-service', () => ({ getDecryptedApiKey: vi.fn() }))
vi.mock('@/lib/asaas/payment-links', () => ({ deactivatePaymentLink: vi.fn() }))

import { markAsPaidCore } from '../contracts-core'

const TRAINER = 'trainer-1'
const CONTRACT = 'contract-1'
const STUDENT = 'student-1'
const PERIOD = '2026-07-01T00:00:00.000Z'

let stub: SupabaseAdminStub
// markAsPaidCore recebe o client por parâmetro — passamos o stub direto.
function db() {
    return stub as unknown as Parameters<typeof markAsPaidCore>[0]
}

function contractRow(over: Record<string, unknown> = {}) {
    return {
        id: CONTRACT,
        trainer_id: TRAINER,
        student_id: STUDENT,
        amount: 100,
        billing_type: 'manual_recurring',
        current_period_end: PERIOD,
        trainer_plans: { interval: 'month' },
        ...over,
    }
}

describe('markAsPaidCore — idempotência', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        stub = createSupabaseAdminStub()
    })

    it('recurring 1st call: inserts the tx with a DETERMINISTIC key and advances the period', async () => {
        stub.onQuery((q) => {
            if (q.table === 'student_contracts' && q.op === 'select') return { data: contractRow() }
            return undefined
        })

        const res = await markAsPaidCore(db(), TRAINER, { contractId: CONTRACT })
        expect(res.success).toBe(true)

        const inserts = stub.calls('financial_transactions', 'insert')
        expect(inserts.length).toBe(1)
        // Chave determinística pelo período liquidado — não aleatória.
        expect((inserts[0].payload as Record<string, unknown>).stripe_payment_id)
            .toBe(`manual_${CONTRACT}_${PERIOD}`)

        // Avançou o período (a partir do vencimento anterior, não de hoje).
        const updates = stub.calls('student_contracts', 'update')
        expect(updates.length).toBe(1)
        const period = (updates[0].payload as Record<string, unknown>).current_period_end
        expect(period).toBeDefined()
        expect(period).not.toBe(PERIOD)
    })

    it('recurring DOUBLE-CALL: 2nd insert hits 23505 → no duplicate tx AND no second period advance', async () => {
        stub.onQuery((q) => {
            if (q.table === 'student_contracts' && q.op === 'select') return { data: contractRow() }
            // Simula a unique parcial: o insert da MESMA chave manual viola unique.
            if (q.table === 'financial_transactions' && q.op === 'insert') {
                return { error: { code: '23505', message: 'duplicate key' } }
            }
            return undefined
        })

        const res = await markAsPaidCore(db(), TRAINER, { contractId: CONTRACT })
        expect(res.success).toBe(true) // no-op idempotente, não erro
        // Tentou inserir uma vez, mas NÃO atualizou o contrato → período NÃO avançou.
        expect(stub.calls('financial_transactions', 'insert').length).toBe(1)
        expect(stub.calls('student_contracts', 'update').length).toBe(0)
    })

    it('one_off: stable key, activates WITHOUT advancing any period', async () => {
        stub.onQuery((q) => {
            if (q.table === 'student_contracts' && q.op === 'select') {
                return { data: contractRow({ billing_type: 'manual_one_off' }) }
            }
            return undefined
        })

        const res = await markAsPaidCore(db(), TRAINER, { contractId: CONTRACT })
        expect(res.success).toBe(true)

        expect((stub.calls('financial_transactions', 'insert')[0].payload as Record<string, unknown>).stripe_payment_id)
            .toBe(`manual_${CONTRACT}_oneoff`)
        // Update só marca active — sem current_period_end.
        expect(stub.calls('student_contracts', 'update')[0].payload).toEqual({ status: 'active' })
    })

    it('asaas_auto_recurring: rejected with double-billing warning, nothing written', async () => {
        stub.onQuery((q) => {
            if (q.table === 'student_contracts' && q.op === 'select') {
                return { data: contractRow({ billing_type: 'asaas_auto_recurring' }) }
            }
            return undefined
        })

        const res = await markAsPaidCore(db(), TRAINER, { contractId: CONTRACT })
        expect(res.error).toMatch(/débito automático/i)
        expect(stub.calls('financial_transactions', 'insert').length).toBe(0)
        expect(stub.calls('student_contracts', 'update').length).toBe(0)
    })

    it('asaas_auto: rejected (Asaas se liquida sozinha) — nada é gravado', async () => {
        stub.onQuery((q) => {
            if (q.table === 'student_contracts' && q.op === 'select') {
                return { data: contractRow({ billing_type: 'asaas_auto' }) }
            }
            return undefined
        })

        const res = await markAsPaidCore(db(), TRAINER, { contractId: CONTRACT })
        expect(res.error).toMatch(/cobran[çc]a Asaas/i)
        expect(stub.calls('financial_transactions', 'insert').length).toBe(0)
        expect(stub.calls('student_contracts', 'update').length).toBe(0)
    })

    it('vigência nula: ancora no INÍCIO do contrato, nunca em "hoje"', async () => {
        // start no FUTURO isola a lógica de âncora (start + intervalo > agora sempre),
        // deixando o teste determinístico independente de quando roda.
        const FUTURE_START = '2099-01-01T00:00:00.000Z'
        stub.onQuery((q) => {
            if (q.table === 'student_contracts' && q.op === 'select') {
                return {
                    data: contractRow({
                        current_period_end: null,
                        start_date: FUTURE_START,
                        trainer_plans: { interval: 'month' },
                    }),
                }
            }
            return undefined
        })

        const res = await markAsPaidCore(db(), TRAINER, { contractId: CONTRACT })
        expect(res.success).toBe(true)

        // Idempotência ancorada no início (start), não em Date.now().
        const inserts = stub.calls('financial_transactions', 'insert')
        expect((inserts[0].payload as Record<string, unknown>).stripe_payment_id)
            .toBe(`manual_${CONTRACT}_${FUTURE_START}`)
        // A transação agora carrega o contract_id (não fica órfã).
        expect((inserts[0].payload as Record<string, unknown>).contract_id).toBe(CONTRACT)

        // Vigência resultante = início + 1 ciclo (mês) = 2099-02-01.
        const updates = stub.calls('student_contracts', 'update')
        expect((updates[0].payload as Record<string, unknown>).current_period_end)
            .toBe('2099-02-01T00:00:00.000Z')
    })

    it('rejects (and writes nothing) when the contract belongs to another trainer', async () => {
        stub.onQuery((q) => {
            if (q.table === 'student_contracts' && q.op === 'select') {
                return { data: contractRow({ trainer_id: 'someone-else' }) }
            }
            return undefined
        })

        const res = await markAsPaidCore(db(), TRAINER, { contractId: CONTRACT })
        expect(res.error).toBe('Sem permissão')
        expect(stub.calls('financial_transactions', 'insert').length).toBe(0)
        expect(stub.calls('student_contracts', 'update').length).toBe(0)
    })
})
