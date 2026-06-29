import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import {
    createSupabaseAdminStub,
    hasFilter,
    type SupabaseAdminStub,
    type RecordedQuery,
    type StubResult,
} from '@/test/supabase-admin-stub'

// Holder mutável pro stub — factories de vi.mock são hoisted e não podem
// referenciar variáveis top-level; vi.hoisted resolve isso.
const h = vi.hoisted(() => ({
    stub: null as unknown as {
        from: (table: string) => unknown
        rpc: (fn: string, args?: unknown) => Promise<unknown>
    },
    getPayment: vi.fn(),
    getKey: vi.fn(),
}))

vi.mock('@/lib/supabase-admin', () => ({
    supabaseAdmin: {
        from: (table: string) => h.stub.from(table),
        rpc: (fn: string, args?: unknown) => h.stub.rpc(fn, args),
    },
}))

// O route importa do barrel '@/lib/asaas'. Mantemos os reais de webhook
// (verifyWebhookSecret/parseWebhookEvent/PermanentWebhookError) e a AsaasApiError
// (classe REAL — o route faz instanceof + checa .status), e SÓ mockamos
// getPayment (o re-fetch autoritativo) pra testar a verificação anti-forja sem rede.
vi.mock('@/lib/asaas', async () => {
    const webhook = await vi.importActual<typeof import('@/lib/asaas/webhook')>('@/lib/asaas/webhook')
    const client = await vi.importActual<typeof import('@/lib/asaas/client')>('@/lib/asaas/client')
    return { ...webhook, AsaasApiError: client.AsaasApiError, getPayment: h.getPayment }
})

// A credencial da subconta (re-fetch) — mockada pra não decriptar nada real.
vi.mock('@/lib/asaas/wallet-service', () => ({
    getDecryptedApiKey: h.getKey,
}))

vi.mock('@/lib/financial/notify', () => ({
    notifyFinancial: vi.fn(),
    resolveTrainerByAsaasAccount: vi.fn(),
    resolveTrainerByAsaasPayment: vi.fn(),
    resolveTrainerByAsaasTransfer: vi.fn(),
}))

vi.mock('@/lib/contract-events', () => ({
    logContractEvent: vi.fn(),
}))

import {
    notifyFinancial,
    resolveTrainerByAsaasAccount,
    resolveTrainerByAsaasPayment,
    resolveTrainerByAsaasTransfer,
} from '@/lib/financial/notify'
import { logContractEvent } from '@/lib/contract-events'
import { PermanentWebhookError, AsaasApiError, type AsaasPayment } from '@/lib/asaas'
import { POST } from '../route'

const notifyMock = vi.mocked(notifyFinancial)
const resolveByPaymentMock = vi.mocked(resolveTrainerByAsaasPayment)
const resolveByTransferMock = vi.mocked(resolveTrainerByAsaasTransfer)
const resolveByAccountMock = vi.mocked(resolveTrainerByAsaasAccount)
const logEventMock = vi.mocked(logContractEvent)

const WEBHOOK_TOKEN = 'test-webhook-token'
const TRAINER_ID = 'trainer-1'
const STUDENT_ID = 'student-1'
const CONTRACT_ID = 'contract-1'

let stub: SupabaseAdminStub
let originalToken: string | undefined

function makeRequest(body: unknown, token: string | null = WEBHOOK_TOKEN): NextRequest {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token !== null) headers['asaas-access-token'] = token
    return new NextRequest('http://localhost/api/webhooks/asaas', {
        method: 'POST',
        headers,
        body: typeof body === 'string' ? body : JSON.stringify(body),
    })
}

function paymentEvent(
    event: string,
    payment: Record<string, unknown>,
    id = 'evt_1',
): Record<string, unknown> {
    return { id, event, dateCreated: '2026-06-11T10:00:00Z', payment }
}

// ── Helpers da verificação autoritativa (Fase 1) ───────────────────────────
const OWNER = {
    id: CONTRACT_ID,
    trainer_id: TRAINER_ID,
    student_id: STUDENT_ID,
    asaas_payment_id: null as string | null,
    asaas_payment_link_id: null as string | null,
    installment_count: null as number | null,
}

/** Pagamento AUTORITATIVO (o que o re-fetch devolve). Default: pago e amarrado
 *  ao CONTRACT_ID via externalReference. */
function paid(over: Partial<AsaasPayment> = {}): AsaasPayment {
    return {
        id: 'pay_auth',
        status: 'RECEIVED',
        value: 0,
        netValue: 0,
        billingType: 'PIX',
        externalReference: CONTRACT_ID,
        ...over,
    } as AsaasPayment
}

/** Faz o resolveOwnerContract (e o SELECT de detalhe do contrato) enxergarem o
 *  contrato dono: intercepta SELECT maybeSingle em student_contracts e devolve
 *  o superset `owner`; o resto vai pro resolver `inner` do teste. */
function withOwner(
    owner: Record<string, unknown>,
    inner: (q: RecordedQuery) => StubResult | undefined = () => undefined,
): (q: RecordedQuery) => StubResult | undefined {
    return (q) => {
        if (q.table === 'student_contracts' && q.op === 'select' && q.maybeSingle) {
            return { data: owner }
        }
        return inner(q)
    }
}

describe('POST /api/webhooks/asaas', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        stub = createSupabaseAdminStub()
        h.stub = stub
        originalToken = process.env.ASAAS_WEBHOOK_TOKEN
        process.env.ASAAS_WEBHOOK_TOKEN = WEBHOOK_TOKEN
        resolveByPaymentMock.mockResolvedValue(null)
        resolveByTransferMock.mockResolvedValue(null)
        resolveByAccountMock.mockResolvedValue(null)
        // Defaults da verificação: key disponível + pagamento pago amarrado.
        h.getKey.mockResolvedValue('sk-subaccount')
        h.getPayment.mockResolvedValue(paid())
    })

    afterEach(() => {
        if (originalToken === undefined) delete process.env.ASAAS_WEBHOOK_TOKEN
        else process.env.ASAAS_WEBHOOK_TOKEN = originalToken
    })

    describe('auth and payload validation', () => {
        it('returns 401 when the asaas-access-token header is missing', async () => {
            const res = await POST(makeRequest(paymentEvent('PAYMENT_RECEIVED', { id: 'pay_1' }), null))
            expect(res.status).toBe(401)
            expect(stub.queries.length).toBe(0)
        })

        it('returns 401 when the token does not match', async () => {
            const res = await POST(makeRequest(paymentEvent('PAYMENT_RECEIVED', { id: 'pay_1' }), 'wrong-token-value'))
            expect(res.status).toBe(401)
        })

        it('returns 401 when ASAAS_WEBHOOK_TOKEN is not set (fail closed)', async () => {
            delete process.env.ASAAS_WEBHOOK_TOKEN
            const res = await POST(makeRequest(paymentEvent('PAYMENT_RECEIVED', { id: 'pay_1' })))
            expect(res.status).toBe(401)
        })

        it('returns 400 when the body is not valid JSON', async () => {
            const res = await POST(makeRequest('not-json-at-all'))
            expect(res.status).toBe(400)
        })

        it('returns 400 when the payload misses id or event', async () => {
            const res = await POST(makeRequest({ event: 'PAYMENT_RECEIVED' }))
            expect(res.status).toBe(400)
            expect(stub.queries.length).toBe(0)
        })
    })

    describe('idempotency', () => {
        it('stores the event with an asaas- prefixed event_id before processing', async () => {
            const res = await POST(makeRequest({ id: 'evt_42', event: 'SOME_UNKNOWN', dateCreated: 'x' }))
            expect(res.status).toBe(200)
            const inserts = stub.calls('webhook_events', 'insert')
            expect(inserts.length).toBe(1)
            expect(inserts[0].payload).toMatchObject({
                event_id: 'asaas-evt_42',
                event_type: 'SOME_UNKNOWN',
            })
        })

        it('returns 200 and skips processing on duplicate delivery (unique violation)', async () => {
            stub.onQuery((q) => {
                if (q.table === 'webhook_events' && q.op === 'insert') {
                    return { error: { code: '23505', message: 'duplicate key' } }
                }
                return undefined
            })
            const res = await POST(makeRequest(paymentEvent('PAYMENT_RECEIVED', { id: 'pay_1', value: 100 })))
            expect(res.status).toBe(200)
            // Só a tentativa de insert — nenhum handler rodou.
            expect(stub.queries.length).toBe(1)
        })

        it('returns 500 without processing when the idempotency store fails (transient, not a duplicate)', async () => {
            // Erro transitório (não-unique) ao gravar a idempotência: como o
            // insert acontece ANTES do dispatch, nada foi processado — devolver
            // 500 faz o Asaas reentregar com segurança (sem duplicar). Mesmo
            // padrão do Stripe. O caso de duplicata (23505) continua 200 — ver
            // o teste acima.
            stub.onQuery((q) => {
                if (q.table === 'webhook_events' && q.op === 'insert') {
                    return { error: { code: '08006', message: 'connection failure' } }
                }
                return undefined
            })
            const res = await POST(makeRequest(paymentEvent('PAYMENT_RECEIVED', { id: 'pay_1', value: 100 })))
            expect(res.status).toBe(500)
            // Não processou nada além da tentativa de insert.
            expect(stub.queries.length).toBe(1)
        })
    })

    describe('PAYMENT_RECEIVED (com verificação autoritativa)', () => {
        it('activates the contract, records the AUTHORITATIVE transaction (not the forged payload), unblocks and notifies', async () => {
            resolveByPaymentMock.mockResolvedValue(TRAINER_ID)
            // Re-fetch traz os valores REAIS (150/145.5/PIX); o payload abaixo
            // traz lixo forjado (9999/BOLETO) que NÃO pode ser gravado.
            h.getPayment.mockResolvedValue(paid({ value: 150, netValue: 145.5, billingType: 'PIX' }))
            stub.onQuery(withOwner({ ...OWNER, asaas_payment_id: 'pay_1' }, (q) => {
                if (q.table === 'student_contracts' && q.op === 'update' && hasFilter(q, 'eq', 'asaas_payment_id', 'pay_1')) {
                    return { data: [{ id: CONTRACT_ID, student_id: STUDENT_ID }] }
                }
                if (q.table === 'students') return { data: { name: 'Maria' } }
                return undefined
            }))

            const res = await POST(makeRequest(paymentEvent('PAYMENT_RECEIVED', {
                id: 'pay_1', value: 9999, netValue: 9999, billingType: 'BOLETO',
            })))
            expect(res.status).toBe(200)

            const activation = stub.calls('student_contracts', 'update')[0]
            expect(activation.payload).toMatchObject({ status: 'active' })
            expect(hasFilter(activation, 'in', 'status')).toBe(true)

            const upserts = stub.calls('financial_transactions', 'upsert')
            expect(upserts.length).toBe(1)
            expect(upserts[0].payload).toMatchObject({
                coach_id: TRAINER_ID,
                student_id: STUDENT_ID,
                provider: 'asaas',
                asaas_payment_id: 'pay_1',
                amount_gross: 150,    // autoritativo, não 9999
                amount_net: 145.5,    // autoritativo
                type: 'charge',
                status: 'completed',
                payment_method: 'PIX', // autoritativo, não BOLETO
                contract_id: CONTRACT_ID,
            })
            expect(upserts[0].options).toEqual({ onConflict: 'asaas_payment_id' })

            expect(stub.rpcCalls).toContainEqual({
                fn: 'unblock_student_access',
                args: { p_student_id: STUDENT_ID },
            })
            expect(logEventMock).toHaveBeenCalledWith(expect.objectContaining({
                contractId: CONTRACT_ID,
                eventType: 'payment_received',
                metadata: expect.objectContaining({ provider: 'asaas', paymentId: 'pay_1' }),
            }))
            expect(notifyMock).toHaveBeenCalledWith(expect.objectContaining({
                trainerId: TRAINER_ID,
                event: 'payment_received',
            }))
        })

        it('falls back to asaas_payment_link_id and backfills the payment id on the contract', async () => {
            h.getPayment.mockResolvedValue(paid({ value: 99, paymentLink: 'pl_1' }))
            stub.onQuery(withOwner({ ...OWNER, asaas_payment_link_id: 'pl_1' }, (q) => {
                if (q.table === 'student_contracts' && q.op === 'update' && hasFilter(q, 'eq', 'asaas_payment_link_id', 'pl_1')) {
                    return { data: [{ id: CONTRACT_ID, student_id: STUDENT_ID }] }
                }
                return undefined
            }))

            const res = await POST(makeRequest(paymentEvent('PAYMENT_CONFIRMED', {
                id: 'pay_2', value: 99, paymentLink: 'pl_1', customer: 'cus_9',
            })))
            expect(res.status).toBe(200)

            const byLink = stub
                .calls('student_contracts', 'update')
                .find((q) => hasFilter(q, 'eq', 'asaas_payment_link_id', 'pl_1'))
            expect(byLink).toBeDefined()
            // Backfill: payment id + customer (identificador do payload) colados.
            expect(byLink!.payload).toMatchObject({
                status: 'active',
                asaas_payment_id: 'pay_2',
                asaas_customer_id: 'cus_9',
            })
            expect(stub.calls('financial_transactions', 'upsert').length).toBe(1)
        })

        it('falls back to externalReference as the contract id', async () => {
            h.getPayment.mockResolvedValue(paid({ value: 80, externalReference: CONTRACT_ID }))
            stub.onQuery(withOwner(OWNER, (q) => {
                if (q.table === 'student_contracts' && q.op === 'update' && hasFilter(q, 'eq', 'id', CONTRACT_ID)) {
                    return { data: [{ id: CONTRACT_ID, student_id: STUDENT_ID }] }
                }
                return undefined
            }))

            const res = await POST(makeRequest(paymentEvent('PAYMENT_RECEIVED', {
                id: 'pay_3', value: 80, externalReference: CONTRACT_ID,
            })))
            expect(res.status).toBe(200)
            expect(stub.calls('financial_transactions', 'upsert').length).toBe(1)
        })

        it('FIRST-CLASS: a legit recurring installment (N>1) applies with the AUTHORITATIVE installment value', async () => {
            // Parcela 2: contrato já está active (UPDATEs não casam nada), achado
            // por paymentLink pro registro. Re-fetch traz o valor REAL da parcela
            // (100); o payload traz lixo (9999). Cruza Fase 1 + #9: grava o
            // autoritativo, não o do payload.
            h.getPayment.mockResolvedValue(paid({ value: 100, netValue: 100, paymentLink: 'pl_inst', installmentNumber: 2 }))
            stub.onQuery(withOwner({ ...OWNER, asaas_payment_link_id: 'pl_inst', installment_count: 12 }, (q) => {
                if (q.table === 'student_contracts' && q.op === 'select' && hasFilter(q, 'eq', 'asaas_payment_link_id', 'pl_inst')) {
                    return { data: [{ id: CONTRACT_ID, student_id: STUDENT_ID }] }
                }
                return undefined
            }))

            const res = await POST(makeRequest(paymentEvent('PAYMENT_RECEIVED', {
                id: 'pay_inst_2', value: 9999, paymentLink: 'pl_inst', installmentNumber: 2,
            })))
            expect(res.status).toBe(200)

            // Parcela N>1: as estratégias de ativação TENTAM o UPDATE, mas com
            // filtro status IN (pending_payment, past_due) — não reativam um
            // contrato já active. A prova do registro é o upsert autoritativo:
            const upserts = stub.calls('financial_transactions', 'upsert')
            expect(upserts.length).toBe(1)
            expect(upserts[0].payload).toMatchObject({
                asaas_payment_id: 'pay_inst_2',
                amount_gross: 100,    // AUTORITATIVO (parcela real), não 9999
                installment_number: 2,
                installment_total: 12,
            })
        })

        it('dedupes contract_events by paymentId (RECEIVED followed by CONFIRMED)', async () => {
            h.getPayment.mockResolvedValue(paid({ value: 150 }))
            stub.onQuery(withOwner({ ...OWNER, asaas_payment_id: 'pay_1' }, (q) => {
                if (q.table === 'student_contracts' && q.op === 'update' && hasFilter(q, 'eq', 'asaas_payment_id', 'pay_1')) {
                    return { data: [{ id: CONTRACT_ID, student_id: STUDENT_ID }] }
                }
                if (q.table === 'contract_events' && q.op === 'select') {
                    return { data: { id: 'existing-event' } }
                }
                return undefined
            }))

            const res = await POST(makeRequest(paymentEvent('PAYMENT_CONFIRMED', { id: 'pay_1', value: 150 })))
            expect(res.status).toBe(200)
            expect(logEventMock).not.toHaveBeenCalled()
        })

        it('backfills asaas_subscription_id only when still null', async () => {
            h.getPayment.mockResolvedValue(paid({ value: 50 }))
            stub.onQuery(withOwner({ ...OWNER, asaas_payment_id: 'pay_sub' }, (q) => {
                if (q.table === 'student_contracts' && q.op === 'update' && hasFilter(q, 'eq', 'asaas_payment_id', 'pay_sub')) {
                    return { data: [{ id: CONTRACT_ID, student_id: STUDENT_ID }] }
                }
                return undefined
            }))

            await POST(makeRequest(paymentEvent('PAYMENT_RECEIVED', {
                id: 'pay_sub', value: 50, subscription: 'asaas-sub-1',
            })))

            const subUpdate = stub
                .calls('student_contracts', 'update')
                .find((q) => (q.payload as Record<string, unknown>)?.asaas_subscription_id === 'asaas-sub-1')
            expect(subUpdate).toBeDefined()
            expect(hasFilter(subUpdate!, 'is', 'asaas_subscription_id', null)).toBe(true)
        })

        it('routes PAYMENT_RECEIVED_IN_CASH through the same received handler', async () => {
            h.getPayment.mockResolvedValue(paid({ status: 'RECEIVED_IN_CASH', value: 70 }))
            stub.onQuery(withOwner({ ...OWNER, asaas_payment_id: 'pay_cash' }, (q) => {
                if (q.table === 'student_contracts' && q.op === 'update' && hasFilter(q, 'eq', 'asaas_payment_id', 'pay_cash')) {
                    return { data: [{ id: CONTRACT_ID, student_id: STUDENT_ID }] }
                }
                return undefined
            }))

            const res = await POST(makeRequest(paymentEvent('PAYMENT_RECEIVED_IN_CASH', { id: 'pay_cash', value: 70 })))
            expect(res.status).toBe(200)
            expect(stub.calls('financial_transactions', 'upsert').length).toBe(1)
        })

        it('no contract AND no transaction → acks without verifying or mutating', async () => {
            const res = await POST(makeRequest(paymentEvent('PAYMENT_RECEIVED', { id: 'pay_orphan', value: 10 })))
            expect(res.status).toBe(200)
            expect(stub.calls('financial_transactions', 'upsert').length).toBe(0)
            expect(stub.calls('financial_transactions', 'update').length).toBe(0)
            expect(h.getPayment).not.toHaveBeenCalled()
        })

        it('legacy: no contract but an existing transaction → verifies via the tx trainer, completes it with the AUTHORITATIVE net value', async () => {
            h.getPayment.mockResolvedValue(paid({ id: 'pay_legacy', value: 60, netValue: 58 }))
            stub.onQuery((q) => {
                // resolveOwnerContract → null (sem contrato), mas há transação legada.
                if (q.table === 'financial_transactions' && q.op === 'select' && hasFilter(q, 'eq', 'asaas_payment_id', 'pay_legacy')) {
                    return { data: { coach_id: TRAINER_ID } }
                }
                return undefined
            })

            const res = await POST(makeRequest(paymentEvent('PAYMENT_RECEIVED', { id: 'pay_legacy', value: 9999, netValue: 9999 })))
            expect(res.status).toBe(200)
            expect(h.getPayment).toHaveBeenCalledWith('sk-subaccount', 'pay_legacy')
            const fallback = stub.calls('financial_transactions', 'update')
            expect(fallback.length).toBe(1)
            expect(fallback[0].payload).toMatchObject({ status: 'completed', amount_net: 58 }) // autoritativo, não 9999
        })

        it('does nothing beyond idempotency when the event carries no payment object', async () => {
            const res = await POST(makeRequest({ id: 'evt_np', event: 'PAYMENT_RECEIVED', dateCreated: 'x' }))
            expect(res.status).toBe(200)
            expect(stub.queries.length).toBe(1) // só webhook_events
        })
    })

    describe('PAYMENT_RECEIVED — verificação anti-forja', () => {
        function forge(extra: Record<string, unknown> = {}) {
            return makeRequest(paymentEvent('PAYMENT_RECEIVED', { id: 'pay_forged', value: 500, ...extra }))
        }
        function expectNoMutation() {
            expect(stub.calls('student_contracts', 'update').length).toBe(0)
            expect(stub.calls('financial_transactions', 'upsert').length).toBe(0)
            expect(stub.calls('financial_transactions', 'update').length).toBe(0)
            expect(stub.rpcCalls.length).toBe(0)
        }

        it('PERMANENT: payment not found in the owner subaccount (404) → 200, keeps row, NO mutation', async () => {
            h.getPayment.mockRejectedValue(new AsaasApiError(404, { errors: [{ description: 'not found' }] }))
            stub.onQuery(withOwner({ ...OWNER, asaas_payment_id: 'pay_forged' }))
            const res = await POST(forge())
            expect(res.status).toBe(200)
            expect(stub.calls('webhook_events', 'delete').length).toBe(0) // não soltou a idempotência
            expectNoMutation()
        })

        it('PERMANENT: a malformed id rejected by Asaas (400) → 200, NO mutation', async () => {
            h.getPayment.mockRejectedValue(new AsaasApiError(400, { errors: [{ description: 'invalid id' }] }))
            stub.onQuery(withOwner({ ...OWNER, asaas_payment_id: 'pay_forged' }))
            const res = await POST(forge())
            expect(res.status).toBe(200)
            expect(stub.calls('webhook_events', 'delete').length).toBe(0)
            expectNoMutation()
        })

        it('PERMANENT: payment exists but is NOT paid (PENDING) → 200, NO mutation', async () => {
            h.getPayment.mockResolvedValue(paid({ status: 'PENDING' }))
            stub.onQuery(withOwner({ ...OWNER, asaas_payment_id: 'pay_forged' }))
            const res = await POST(forge())
            expect(res.status).toBe(200)
            expectNoMutation()
        })

        it('PERMANENT: a real paid payment that ties to ANOTHER contract → 200, NO mutation', async () => {
            // Existe e pago, mas o externalReference autoritativo é de outro
            // contrato (e nenhum link/id casa) → ativar contrato alheio.
            h.getPayment.mockResolvedValue(paid({ externalReference: 'other-contract', paymentLink: null, id: 'pay_other' }))
            stub.onQuery(withOwner({ ...OWNER, asaas_payment_id: 'pay_forged' }))
            const res = await POST(forge())
            expect(res.status).toBe(200)
            expectNoMutation()
        })

        it('TRANSIENT: Asaas 5xx on re-fetch → 500 + releases the idempotency row (redeliver)', async () => {
            h.getPayment.mockRejectedValue(new AsaasApiError(503, { errors: [{ description: 'unavailable' }] }))
            stub.onQuery(withOwner({ ...OWNER, asaas_payment_id: 'pay_forged' }))
            const res = await POST(forge())
            expect(res.status).toBe(500)
            const releases = stub.calls('webhook_events', 'delete')
            expect(releases.length).toBe(1)
            expect(hasFilter(releases[0], 'eq', 'event_id', 'asaas-evt_1')).toBe(true)
            expectNoMutation()
        })

        it('TRANSIENT: subaccount key unavailable → 500 + releases the idempotency row', async () => {
            h.getKey.mockRejectedValue(new Error('wallet not approved'))
            stub.onQuery(withOwner({ ...OWNER, asaas_payment_id: 'pay_forged' }))
            const res = await POST(forge())
            expect(res.status).toBe(500)
            expect(stub.calls('webhook_events', 'delete').length).toBe(1)
            expectNoMutation()
        })
    })

    describe('PAYMENT_OVERDUE', () => {
        it('marks the transaction overdue, the contract past_due, logs and notifies', async () => {
            stub.onQuery((q) => {
                if (q.table === 'student_contracts' && q.op === 'update' && hasFilter(q, 'eq', 'asaas_payment_id', 'pay_late')) {
                    return { data: [{ id: CONTRACT_ID, trainer_id: TRAINER_ID, student_id: STUDENT_ID }] }
                }
                if (q.table === 'students') return { data: { name: 'João' } }
                return undefined
            })

            const res = await POST(makeRequest(paymentEvent('PAYMENT_OVERDUE', { id: 'pay_late', value: 200 })))
            expect(res.status).toBe(200)

            const txUpdate = stub.calls('financial_transactions', 'update')[0]
            expect(txUpdate.payload).toEqual({ status: 'overdue' })

            const contractUpdate = stub.calls('student_contracts', 'update')[0]
            expect(contractUpdate.payload).toEqual({ status: 'past_due' })

            expect(logEventMock).toHaveBeenCalledWith(expect.objectContaining({
                contractId: CONTRACT_ID,
                eventType: 'contract_overdue',
            }))
            expect(notifyMock).toHaveBeenCalledWith(expect.objectContaining({
                trainerId: TRAINER_ID,
                event: 'payment_overdue',
            }))
        })

        it('falls back to the paymentLink and backfills the payment id when nothing matches directly', async () => {
            stub.onQuery((q) => {
                if (q.table === 'student_contracts' && q.op === 'update' && hasFilter(q, 'eq', 'asaas_payment_link_id', 'pl_late')) {
                    return { data: [{ id: CONTRACT_ID, trainer_id: TRAINER_ID, student_id: STUDENT_ID }] }
                }
                return undefined
            })

            const res = await POST(makeRequest(paymentEvent('PAYMENT_OVERDUE', {
                id: 'pay_late2', value: 90, paymentLink: 'pl_late',
            })))
            expect(res.status).toBe(200)

            const byLink = stub
                .calls('student_contracts', 'update')
                .find((q) => hasFilter(q, 'eq', 'asaas_payment_link_id', 'pl_late'))
            expect(byLink).toBeDefined()
            expect(byLink!.payload).toMatchObject({ status: 'past_due', asaas_payment_id: 'pay_late2' })
            expect(logEventMock).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'contract_overdue' }))
        })
    })

    describe('PAYMENT_REFUNDED / PAYMENT_DELETED', () => {
        it('marks the transaction refunded and notifies the trainer', async () => {
            resolveByPaymentMock.mockResolvedValue(TRAINER_ID)
            const res = await POST(makeRequest(paymentEvent('PAYMENT_REFUNDED', { id: 'pay_ref', value: 60 })))
            expect(res.status).toBe(200)

            const txUpdate = stub.calls('financial_transactions', 'update')[0]
            expect(txUpdate.payload).toEqual({ status: 'refunded' })
            expect(hasFilter(txUpdate, 'eq', 'asaas_payment_id', 'pay_ref')).toBe(true)
            expect(notifyMock).toHaveBeenCalledWith(expect.objectContaining({ event: 'payment_refunded' }))
        })

        it('treats PAYMENT_DELETED the same way', async () => {
            const res = await POST(makeRequest(paymentEvent('PAYMENT_DELETED', { id: 'pay_del', value: 60 })))
            expect(res.status).toBe(200)
            expect(stub.calls('financial_transactions', 'update')[0].payload).toEqual({ status: 'refunded' })
        })
    })

    describe('chargebacks', () => {
        it('marks the transaction disputed and always alerts the trainer', async () => {
            resolveByPaymentMock.mockResolvedValue(TRAINER_ID)
            const res = await POST(makeRequest(paymentEvent('PAYMENT_CHARGEBACK_REQUESTED', { id: 'pay_cb', value: 300 })))
            expect(res.status).toBe(200)

            expect(stub.calls('financial_transactions', 'update')[0].payload).toEqual({ status: 'disputed' })
            expect(notifyMock).toHaveBeenCalledWith(expect.objectContaining({
                event: 'chargeback_alert',
                title: 'Chargeback aberto',
            }))
        })

        it('uses the reversal wording for PAYMENT_AWAITING_CHARGEBACK_REVERSAL', async () => {
            resolveByPaymentMock.mockResolvedValue(TRAINER_ID)
            await POST(makeRequest(paymentEvent('PAYMENT_AWAITING_CHARGEBACK_REVERSAL', { id: 'pay_cb2', value: 300 })))
            expect(notifyMock).toHaveBeenCalledWith(expect.objectContaining({
                event: 'chargeback_alert',
                title: 'Chargeback contestado',
            }))
        })
    })

    describe('transfers (payouts)', () => {
        function transferEvent(event: string, transfer: Record<string, unknown>) {
            return { id: 'evt_tr', event, dateCreated: 'x', transfer }
        }

        it('TRANSFER_DONE completes the payout with end_to_end_id and notifies', async () => {
            resolveByTransferMock.mockResolvedValue(TRAINER_ID)
            const res = await POST(makeRequest(transferEvent('TRANSFER_DONE', {
                id: 'tr_1', value: 500, netValue: 498, endToEndIdentifier: 'E2E123',
            })))
            expect(res.status).toBe(200)

            const update = stub.calls('payouts', 'update')[0]
            expect(update.payload).toMatchObject({ status: 'completed', end_to_end_id: 'E2E123' })
            expect(hasFilter(update, 'eq', 'asaas_transfer_id', 'tr_1')).toBe(true)
            expect(notifyMock).toHaveBeenCalledWith(expect.objectContaining({ event: 'payout_completed' }))
        })

        it('TRANSFER_FAILED marks the payout failed with the failure reason and always notifies', async () => {
            resolveByTransferMock.mockResolvedValue(TRAINER_ID)
            const res = await POST(makeRequest(transferEvent('TRANSFER_FAILED', {
                id: 'tr_2', value: 500, failReason: 'Chave PIX inválida',
            })))
            expect(res.status).toBe(200)

            const update = stub.calls('payouts', 'update')[0]
            expect(update.payload).toEqual({ status: 'failed', failure_reason: 'Chave PIX inválida' })
            expect(notifyMock).toHaveBeenCalledWith(expect.objectContaining({
                event: 'payout_failed',
                title: 'Saque falhou',
            }))
        })

        it('TRANSFER_CANCELLED (transfer.status=CANCELLED) marks the payout cancelled', async () => {
            const res = await POST(makeRequest(transferEvent('TRANSFER_CANCELLED', {
                id: 'tr_3', value: 500, status: 'CANCELLED',
            })))
            expect(res.status).toBe(200)
            expect(stub.calls('payouts', 'update')[0].payload).toMatchObject({ status: 'cancelled' })
        })

        it('TRANSFER_PENDING marks the payout processing without notifying', async () => {
            const res = await POST(makeRequest(transferEvent('TRANSFER_PENDING', { id: 'tr_4', value: 500 })))
            expect(res.status).toBe(200)
            expect(stub.calls('payouts', 'update')[0].payload).toEqual({ status: 'processing' })
            expect(notifyMock).not.toHaveBeenCalled()
        })
    })

    describe('account status (KYC)', () => {
        function accountEvent(event: string, account: Record<string, unknown>) {
            return { id: 'evt_acc', event, dateCreated: 'x', account }
        }

        it('APPROVED sets activated_at and notifies the trainer', async () => {
            resolveByAccountMock.mockResolvedValue(TRAINER_ID)
            const res = await POST(makeRequest(accountEvent('ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED', {
                id: 'acc_1', accountStatus: 'APPROVED',
            })))
            expect(res.status).toBe(200)

            const update = stub.calls('trainer_payment_accounts', 'update')[0]
            expect(update.payload).toMatchObject({ status: 'approved', rejection_reason: null })
            expect((update.payload as Record<string, unknown>).activated_at).toBeTruthy()
            expect(hasFilter(update, 'eq', 'asaas_account_id', 'acc_1')).toBe(true)
            expect(notifyMock).toHaveBeenCalledWith(expect.objectContaining({
                event: 'kyc_alert',
                title: 'Sua Carteira foi liberada',
            }))
        })

        it('REJECTED stores the rejection reason and notifies', async () => {
            resolveByAccountMock.mockResolvedValue(TRAINER_ID)
            await POST(makeRequest(accountEvent('ACCOUNT_STATUS_GENERAL_APPROVAL_REJECTED', {
                id: 'acc_2', accountStatus: 'REJECTED', rejectReason: 'Documento ilegível',
            })))

            const update = stub.calls('trainer_payment_accounts', 'update')[0]
            expect(update.payload).toEqual({ status: 'rejected', rejection_reason: 'Documento ilegível' })
            expect(notifyMock).toHaveBeenCalledWith(expect.objectContaining({
                event: 'kyc_alert',
                body: 'Documento ilegível',
            }))
        })

        it('AWAITING updates the status without notifying', async () => {
            const res = await POST(makeRequest(accountEvent('ACCOUNT_STATUS_UPDATED', {
                id: 'acc_3', accountStatus: 'AWAITING',
            })))
            expect(res.status).toBe(200)
            expect(stub.calls('trainer_payment_accounts', 'update')[0].payload).toMatchObject({ status: 'awaiting' })
            expect(notifyMock).not.toHaveBeenCalled()
        })
    })

    describe('error tolerance', () => {
        it('returns 200 for unhandled event types', async () => {
            const res = await POST(makeRequest({ id: 'evt_u', event: 'PAYMENT_CREATED', dateCreated: 'x' }))
            expect(res.status).toBe(200)
            expect(await res.json()).toEqual({ received: true })
        })

        it('releases the idempotency row and returns 500 when a handler throws a retryable error', async () => {
            // Erro inesperado / falha transitória de DB: o webhook precisa
            // LIBERAR a linha de idempotência e responder 500 para o Asaas
            // re-entregar — senão o pagamento real se perde e o aluno fica
            // preso em pending_payment. Mesmo padrão do webhook do Stripe.
            stub.onQuery((q) => {
                if (q.table === 'student_contracts') throw new Error('db exploded')
                return undefined
            })
            const res = await POST(makeRequest(paymentEvent('PAYMENT_RECEIVED', { id: 'pay_boom', value: 1 })))
            expect(res.status).toBe(500)

            const releases = stub.calls('webhook_events', 'delete')
            expect(releases.length).toBe(1)
            expect(hasFilter(releases[0], 'eq', 'event_id', 'asaas-evt_1')).toBe(true)
        })

        it('acks with 200 and keeps the idempotency row on a permanent error (no retry loop)', async () => {
            // Erro PERMANENTE (mensagem-veneno): ACK 200 e MANTÉM a linha de
            // idempotência — não adianta reprocessar, e qualquer reentrega do
            // mesmo event.id deve cair no skip por 23505.
            stub.onQuery((q) => {
                if (q.table === 'student_contracts') throw new PermanentWebhookError('poison')
                return undefined
            })
            const res = await POST(makeRequest(paymentEvent('PAYMENT_RECEIVED', { id: 'pay_perm', value: 1 })))
            expect(res.status).toBe(200)
            expect(await res.json()).toEqual({ received: true })
            // Não liberou a idempotência.
            expect(stub.calls('webhook_events', 'delete').length).toBe(0)
        })
    })
})
