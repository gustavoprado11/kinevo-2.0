import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import type Stripe from 'stripe'
import {
    createSupabaseAdminStub,
    hasFilter,
    getFilter,
    type SupabaseAdminStub,
} from '@/test/supabase-admin-stub'

// Holder mutável pro stub — factories de vi.mock são hoisted e não podem
// referenciar variáveis top-level; vi.hoisted resolve isso.
const h = vi.hoisted(() => ({
    stub: null as unknown as {
        from: (table: string) => unknown
        rpc: (fn: string, args?: unknown) => Promise<unknown>
    },
}))

vi.mock('@/lib/supabase-admin', () => ({
    supabaseAdmin: {
        from: (table: string) => h.stub.from(table),
        rpc: (fn: string, args?: unknown) => h.stub.rpc(fn, args),
    },
}))

vi.mock('@/lib/stripe', () => ({
    stripe: {
        webhooks: { constructEvent: vi.fn() },
        subscriptions: { retrieve: vi.fn() },
    },
}))

vi.mock('@/lib/contract-events', () => ({
    logContractEvent: vi.fn(),
}))

vi.mock('@/lib/trainer-notifications', () => ({
    insertTrainerNotification: vi.fn(),
}))

vi.mock('@/lib/push-notifications', () => ({
    sendTrainerPush: vi.fn(),
}))

import { stripe } from '@/lib/stripe'
import { logContractEvent } from '@/lib/contract-events'
import { insertTrainerNotification } from '@/lib/trainer-notifications'
import { sendTrainerPush } from '@/lib/push-notifications'
import { POST } from '../route'

const constructEventMock = vi.mocked(stripe.webhooks.constructEvent)
const retrieveMock = vi.mocked(stripe.subscriptions.retrieve)
const logEventMock = vi.mocked(logContractEvent)
const insertNotifMock = vi.mocked(insertTrainerNotification)
const sendPushMock = vi.mocked(sendTrainerPush)

const WEBHOOK_SECRET = 'whsec_connect_test'
const TRAINER_ID = 'trainer-1'
const STUDENT_ID = 'student-1'
const PLAN_ID = 'plan-1'
const CONTRACT_ID = 'contract-1'
const ACCOUNT_ID = 'acct_1'
const PERIOD_END_UNIX = 1_770_000_000
const PERIOD_END_ISO = new Date(PERIOD_END_UNIX * 1000).toISOString()

let stub: SupabaseAdminStub
let originalSecret: string | undefined

function makeRequest(body = 'raw-payload', signature: string | null = 't=1,v1=sig'): NextRequest {
    const headers: Record<string, string> = {}
    if (signature !== null) headers['stripe-signature'] = signature
    const init: RequestInit = { method: 'POST', headers, body }
    return new NextRequest('http://localhost/api/webhooks/stripe-connect', init as any)
}

function stubEvent(
    type: string,
    object: Record<string, unknown>,
    { id = 'evt_c1', account = ACCOUNT_ID }: { id?: string; account?: string | undefined } = {},
): Stripe.Event {
    return { id, type, account, data: { object } } as unknown as Stripe.Event
}

function stubSubscription(overrides: Record<string, unknown> = {}): Stripe.Response<Stripe.Subscription> {
    return {
        id: 'sub_1',
        status: 'active',
        cancel_at_period_end: false,
        items: { data: [{ current_period_end: PERIOD_END_UNIX }] },
        ...overrides,
    } as unknown as Stripe.Response<Stripe.Subscription>
}

function checkoutSession(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        mode: 'subscription',
        metadata: { trainer_id: TRAINER_ID, student_id: STUDENT_ID, plan_id: PLAN_ID },
        subscription: 'sub_1',
        customer: 'cus_1',
        amount_total: 19990,
        ...overrides,
    }
}

describe('POST /api/webhooks/stripe-connect', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        stub = createSupabaseAdminStub()
        h.stub = stub
        originalSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET
        process.env.STRIPE_CONNECT_WEBHOOK_SECRET = WEBHOOK_SECRET
        insertNotifMock.mockResolvedValue('notif-1')
        sendPushMock.mockResolvedValue(undefined)
    })

    afterEach(() => {
        if (originalSecret === undefined) delete process.env.STRIPE_CONNECT_WEBHOOK_SECRET
        else process.env.STRIPE_CONNECT_WEBHOOK_SECRET = originalSecret
    })

    describe('signature verification', () => {
        it('returns 400 when the stripe-signature header is missing', async () => {
            const res = await POST(makeRequest('body', null))
            expect(res.status).toBe(400)
            expect(constructEventMock).not.toHaveBeenCalled()
        })

        it('returns 500 when STRIPE_CONNECT_WEBHOOK_SECRET is not configured', async () => {
            delete process.env.STRIPE_CONNECT_WEBHOOK_SECRET
            const res = await POST(makeRequest())
            expect(res.status).toBe(500)
        })

        it('returns 400 when constructEvent rejects the signature', async () => {
            constructEventMock.mockImplementation(() => {
                throw new Error('No signatures found matching the expected signature')
            })
            const res = await POST(makeRequest('body', 'bad-sig'))
            expect(res.status).toBe(400)
            expect(stub.queries.length).toBe(0)
        })
    })

    describe('idempotency', () => {
        it('stores the event id with the connected account before processing', async () => {
            constructEventMock.mockReturnValue(stubEvent('some.event', {}, { id: 'evt_c9' }))
            const res = await POST(makeRequest())
            expect(res.status).toBe(200)
            const inserts = stub.calls('webhook_events', 'insert')
            expect(inserts.length).toBe(1)
            expect(inserts[0].payload).toEqual({
                event_id: 'evt_c9',
                event_type: 'some.event',
                metadata: { account: ACCOUNT_ID },
            })
        })

        it('returns 200 and skips the handler on duplicate delivery (unique violation)', async () => {
            constructEventMock.mockReturnValue(stubEvent('checkout.session.completed', checkoutSession()))
            stub.onQuery((q) => {
                if (q.table === 'webhook_events' && q.op === 'insert') {
                    return { error: { code: '23505', message: 'duplicate key' } }
                }
                return undefined
            })
            const res = await POST(makeRequest())
            expect(res.status).toBe(200)
            expect(retrieveMock).not.toHaveBeenCalled()
            expect(stub.queries.length).toBe(1)
        })

        it('returns 500 when the idempotency store is unavailable so Stripe retries', async () => {
            constructEventMock.mockReturnValue(stubEvent('some.event', {}))
            stub.onQuery((q) => {
                if (q.table === 'webhook_events' && q.op === 'insert') {
                    return { error: { code: '08006', message: 'connection failure' } }
                }
                return undefined
            })
            const res = await POST(makeRequest())
            expect(res.status).toBe(500)
        })

        it('deletes the idempotency row and returns 500 when a handler throws (clean retry)', async () => {
            constructEventMock.mockReturnValue(stubEvent('checkout.session.completed', checkoutSession(), { id: 'evt_fail' }))
            retrieveMock.mockResolvedValue(stubSubscription())
            stub.onQuery((q) => {
                if (q.table === 'trainer_plans') return { data: { price: 199.9, title: 'Plano Mensal' } }
                if (q.table === 'student_contracts' && q.op === 'select') return { data: { id: CONTRACT_ID } }
                // O update do contrato pending falha → handler lança
                if (q.table === 'student_contracts' && q.op === 'update' && hasFilter(q, 'eq', 'id', CONTRACT_ID)) {
                    return { error: { code: 'XX000', message: 'boom' } }
                }
                return undefined
            })

            const res = await POST(makeRequest())
            expect(res.status).toBe(500)
            expect(await res.json()).toEqual({ error: 'Handler failed' })

            // A linha de webhook_events foi removida pra o retry reprocessar limpo
            const deletes = stub.calls('webhook_events', 'delete')
            expect(deletes.length).toBe(1)
            expect(hasFilter(deletes[0], 'eq', 'event_id', 'evt_fail')).toBe(true)
        })
    })

    describe('account.updated', () => {
        it('syncs the connect account to payment_settings as active when charges are enabled', async () => {
            constructEventMock.mockReturnValue(stubEvent('account.updated', {
                id: ACCOUNT_ID,
                charges_enabled: true,
                details_submitted: true,
                payouts_enabled: true,
            }))
            const res = await POST(makeRequest())
            expect(res.status).toBe(200)

            const updates = stub.calls('payment_settings', 'update')
            expect(updates.length).toBe(1)
            expect(updates[0].payload).toEqual({
                charges_enabled: true,
                details_submitted: true,
                payouts_enabled: true,
                stripe_status: 'active',
            })
            expect(hasFilter(updates[0], 'eq', 'stripe_connect_id', ACCOUNT_ID)).toBe(true)
        })

        it('marks the account pending when charges are disabled', async () => {
            constructEventMock.mockReturnValue(stubEvent('account.updated', { id: ACCOUNT_ID }))
            await POST(makeRequest())
            expect(stub.calls('payment_settings', 'update')[0].payload).toEqual({
                charges_enabled: false,
                details_submitted: false,
                payouts_enabled: false,
                stripe_status: 'pending',
            })
        })
    })

    describe('checkout.session.completed', () => {
        it('activates the pending contract, cancels other contracts and logs contract_created', async () => {
            constructEventMock.mockReturnValue(stubEvent('checkout.session.completed', checkoutSession()))
            retrieveMock.mockResolvedValue(stubSubscription())
            stub.onQuery((q) => {
                if (q.table === 'trainer_plans') return { data: { price: 199.9, title: 'Plano Mensal' } }
                if (q.table === 'student_contracts' && q.op === 'select') return { data: { id: CONTRACT_ID } }
                return undefined
            })

            const res = await POST(makeRequest())
            expect(res.status).toBe(200)

            // Connected account propagado pro retrieve
            expect(retrieveMock).toHaveBeenCalledWith(
                'sub_1',
                { expand: ['items.data'] },
                { stripeAccount: ACCOUNT_ID },
            )

            // Cancela os OUTROS contratos (preserva o pending via neq)
            const cancelOthers = stub
                .calls('student_contracts', 'update')
                .find((q) => hasFilter(q, 'neq', 'id', CONTRACT_ID))
            expect(cancelOthers).toBeDefined()
            expect(cancelOthers!.payload).toEqual({ status: 'canceled' })
            expect(getFilter(cancelOthers!, 'in', 'status')?.[1]).toEqual(['active', 'past_due', 'pending'])

            // Ativa o pending com os vínculos Stripe
            const activate = stub
                .calls('student_contracts', 'update')
                .find((q) => hasFilter(q, 'eq', 'id', CONTRACT_ID))
            expect(activate).toBeDefined()
            expect(activate!.payload).toMatchObject({
                status: 'active',
                stripe_customer_id: 'cus_1',
                stripe_subscription_id: 'sub_1',
                current_period_end: PERIOD_END_ISO,
            })

            // Vínculo no aluno
            const studentUpdate = stub.calls('students', 'update')[0]
            expect(studentUpdate.payload).toEqual({ stripe_subscription_id: 'sub_1' })
            expect(hasFilter(studentUpdate, 'eq', 'id', STUDENT_ID)).toBe(true)

            expect(logEventMock).toHaveBeenCalledWith(expect.objectContaining({
                studentId: STUDENT_ID,
                trainerId: TRAINER_ID,
                contractId: CONTRACT_ID,
                eventType: 'contract_created',
                metadata: expect.objectContaining({
                    billing_type: 'stripe_auto',
                    amount: 199.9, // amount_total 19990 centavos / 100
                    plan_title: 'Plano Mensal',
                }),
            }))
        })

        it('creates a new contract when there is no pending one', async () => {
            constructEventMock.mockReturnValue(stubEvent('checkout.session.completed', checkoutSession()))
            retrieveMock.mockResolvedValue(stubSubscription())
            stub.onQuery((q) => {
                if (q.table === 'trainer_plans') return { data: { price: 199.9, title: 'Plano Mensal' } }
                if (q.table === 'student_contracts' && q.op === 'select') {
                    return { data: null, error: { code: 'PGRST116', message: 'no rows' } }
                }
                return undefined
            })

            const res = await POST(makeRequest())
            expect(res.status).toBe(200)

            const inserts = stub.calls('student_contracts', 'insert')
            expect(inserts.length).toBe(1)
            expect(inserts[0].payload).toMatchObject({
                student_id: STUDENT_ID,
                trainer_id: TRAINER_ID,
                plan_id: PLAN_ID,
                amount: 199.9,
                status: 'active',
                billing_type: 'stripe_auto',
                block_on_fail: true,
                stripe_subscription_id: 'sub_1',
                current_period_end: PERIOD_END_ISO,
            })

            // comportamento atual: o id do contrato recém-inserido não é
            // capturado (insert sem .select()), então o evento de timeline
            // sai com contract_id null.
            expect(logEventMock).toHaveBeenCalledWith(expect.objectContaining({
                eventType: 'contract_created',
                contractId: null,
            }))
        })

        it('skips the session when metadata is incomplete', async () => {
            constructEventMock.mockReturnValue(stubEvent('checkout.session.completed', checkoutSession({
                metadata: { trainer_id: TRAINER_ID, student_id: STUDENT_ID }, // sem plan_id
            })))
            const res = await POST(makeRequest())
            expect(res.status).toBe(200)
            expect(retrieveMock).not.toHaveBeenCalled()
            expect(stub.calls('student_contracts').length).toBe(0)
        })

        it('skips the session when mode is not subscription', async () => {
            constructEventMock.mockReturnValue(stubEvent('checkout.session.completed', checkoutSession({ mode: 'payment' })))
            const res = await POST(makeRequest())
            expect(res.status).toBe(200)
            expect(retrieveMock).not.toHaveBeenCalled()
        })

        it('skips the session when there is no subscription id', async () => {
            constructEventMock.mockReturnValue(stubEvent('checkout.session.completed', checkoutSession({ subscription: null })))
            const res = await POST(makeRequest())
            expect(res.status).toBe(200)
            expect(retrieveMock).not.toHaveBeenCalled()
        })
    })

    describe('invoice.payment_succeeded', () => {
        function succeededInvoice(overrides: Record<string, unknown> = {}): Record<string, unknown> {
            return {
                id: 'in_1',
                amount_paid: 19990,
                currency: 'brl',
                parent: { subscription_details: { subscription: 'sub_1' } },
                lines: { data: [{ description: 'Plano Mensal' }] },
                ...overrides,
            }
        }

        it('activates the contract, records the transaction, logs and notifies the trainer', async () => {
            constructEventMock.mockReturnValue(stubEvent('invoice.payment_succeeded', succeededInvoice()))
            retrieveMock.mockResolvedValue(stubSubscription())
            stub.onQuery((q) => {
                if (q.table === 'student_contracts' && q.op === 'select') {
                    return { data: { id: CONTRACT_ID, student_id: STUDENT_ID, trainer_id: TRAINER_ID, amount: 199.9 } }
                }
                if (q.table === 'students') return { data: { name: 'Maria' } }
                return undefined
            })

            const res = await POST(makeRequest())
            expect(res.status).toBe(200)
            expect(retrieveMock).toHaveBeenCalledWith(
                'sub_1',
                { expand: ['items.data'] },
                { stripeAccount: ACCOUNT_ID },
            )

            const contractUpdate = stub.calls('student_contracts', 'update')[0]
            expect(contractUpdate.payload).toEqual({ status: 'active', current_period_end: PERIOD_END_ISO })
            expect(hasFilter(contractUpdate, 'eq', 'id', CONTRACT_ID)).toBe(true)

            const txInserts = stub.calls('financial_transactions', 'insert')
            expect(txInserts.length).toBe(1)
            expect(txInserts[0].payload).toMatchObject({
                coach_id: TRAINER_ID,
                student_id: STUDENT_ID,
                amount_gross: 199.9,
                amount_net: 199.9,
                type: 'subscription',
                status: 'succeeded',
                stripe_payment_id: 'inv_in_1',
                stripe_invoice_id: 'in_1',
            })

            expect(logEventMock).toHaveBeenCalledWith(expect.objectContaining({
                contractId: CONTRACT_ID,
                eventType: 'payment_received',
                metadata: expect.objectContaining({ amount: 199.9, method: 'stripe' }),
            }))
            expect(insertNotifMock).toHaveBeenCalledWith(expect.objectContaining({
                trainerId: TRAINER_ID,
                type: 'payment_received',
            }))
            expect(sendPushMock).toHaveBeenCalledWith(expect.objectContaining({
                trainerId: TRAINER_ID,
                type: 'payment_received',
                notificationId: 'notif-1',
            }))
        })

        it('skips when no contract matches the subscription', async () => {
            constructEventMock.mockReturnValue(stubEvent('invoice.payment_succeeded', succeededInvoice()))
            const res = await POST(makeRequest())
            expect(res.status).toBe(200)
            expect(retrieveMock).not.toHaveBeenCalled()
            expect(stub.calls('financial_transactions').length).toBe(0)
            expect(insertNotifMock).not.toHaveBeenCalled()
        })

        it('resolves the subscription id from invoice metadata as last resort', async () => {
            constructEventMock.mockReturnValue(stubEvent('invoice.payment_succeeded', succeededInvoice({
                parent: null,
                lines: { data: [] },
                metadata: { subscription_id: 'sub_meta' },
            })))
            retrieveMock.mockResolvedValue(stubSubscription({ id: 'sub_meta' }))
            stub.onQuery((q) => {
                if (q.table === 'student_contracts' && q.op === 'select') {
                    return { data: { id: CONTRACT_ID, student_id: STUDENT_ID, trainer_id: TRAINER_ID, amount: 199.9 } }
                }
                if (q.table === 'students') return { data: { name: 'Maria' } }
                return undefined
            })

            const res = await POST(makeRequest())
            expect(res.status).toBe(200)
            const contractSelect = stub.calls('student_contracts', 'select')[0]
            expect(hasFilter(contractSelect, 'eq', 'stripe_subscription_id', 'sub_meta')).toBe(true)
        })
    })

    describe('invoice.payment_failed', () => {
        it('marks the contract past_due, records the failed transaction and notifies', async () => {
            constructEventMock.mockReturnValue(stubEvent('invoice.payment_failed', {
                id: 'in_2',
                parent: { subscription_details: { subscription: 'sub_1' } },
            }))
            stub.onQuery((q) => {
                if (q.table === 'student_contracts' && q.op === 'select') {
                    return { data: { id: CONTRACT_ID, student_id: STUDENT_ID, trainer_id: TRAINER_ID, amount: 199.9, block_on_fail: true } }
                }
                if (q.table === 'students') return { data: { name: 'Maria' } }
                return undefined
            })

            const res = await POST(makeRequest())
            expect(res.status).toBe(200)

            const contractUpdate = stub.calls('student_contracts', 'update')[0]
            expect(contractUpdate.payload).toEqual({ status: 'past_due' })

            const txInserts = stub.calls('financial_transactions', 'insert')
            expect(txInserts[0].payload).toMatchObject({
                amount_gross: 199.9,
                amount_net: 0,
                status: 'failed',
                stripe_payment_id: 'inv_failed_in_2',
            })

            expect(logEventMock).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'payment_failed' }))
            expect(insertNotifMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'payment_failed' }))
            expect(sendPushMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'payment_failed' }))
        })

        it('does nothing when no contract matches', async () => {
            constructEventMock.mockReturnValue(stubEvent('invoice.payment_failed', {
                id: 'in_3',
                parent: { subscription_details: { subscription: 'sub_unknown' } },
            }))
            const res = await POST(makeRequest())
            expect(res.status).toBe(200)
            expect(stub.calls('student_contracts', 'update').length).toBe(0)
            expect(insertNotifMock).not.toHaveBeenCalled()
        })
    })

    describe('customer.subscription.updated', () => {
        function subUpdatedEvent(sub: Record<string, unknown>): Stripe.Event {
            return stubEvent('customer.subscription.updated', {
                id: 'sub_1',
                status: 'active',
                cancel_at_period_end: false,
                items: { data: [{ current_period_end: PERIOD_END_UNIX }] },
                ...sub,
            })
        }

        it('syncs status, period end and cancel flag onto the contract', async () => {
            constructEventMock.mockReturnValue(subUpdatedEvent({}))
            stub.onQuery((q) => {
                if (q.table === 'student_contracts' && q.op === 'select') {
                    return { data: { id: CONTRACT_ID, student_id: STUDENT_ID, trainer_id: TRAINER_ID, cancel_at_period_end: false, canceled_by: null } }
                }
                return undefined
            })

            const res = await POST(makeRequest())
            expect(res.status).toBe(200)

            const update = stub.calls('student_contracts', 'update')[0]
            expect(update.payload).toEqual({
                status: 'active',
                current_period_end: PERIOD_END_ISO,
                cancel_at_period_end: false,
            })
            expect(hasFilter(update, 'eq', 'stripe_subscription_id', 'sub_1')).toBe(true)
            expect(insertNotifMock).not.toHaveBeenCalled()
        })

        it('detects cancel_at_period_end turning true: marks canceled_by system, logs and notifies', async () => {
            constructEventMock.mockReturnValue(subUpdatedEvent({ cancel_at_period_end: true }))
            stub.onQuery((q) => {
                if (q.table === 'student_contracts' && q.op === 'select') {
                    return { data: { id: CONTRACT_ID, student_id: STUDENT_ID, trainer_id: TRAINER_ID, cancel_at_period_end: false, canceled_by: null } }
                }
                if (q.table === 'students') return { data: { name: 'Maria' } }
                return undefined
            })

            const res = await POST(makeRequest())
            expect(res.status).toBe(200)

            const systemCancel = stub
                .calls('student_contracts', 'update')
                .find((q) => (q.payload as Record<string, unknown>)?.canceled_by === 'system')
            expect(systemCancel).toBeDefined()
            expect(hasFilter(systemCancel!, 'eq', 'id', CONTRACT_ID)).toBe(true)

            expect(logEventMock).toHaveBeenCalledWith(expect.objectContaining({
                eventType: 'contract_canceled',
                metadata: { canceled_by: 'system', source: 'stripe_dashboard' },
            }))
            expect(insertNotifMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'cancellation_alert' }))
            expect(sendPushMock).toHaveBeenCalledWith(expect.objectContaining({
                type: 'cancellation_alert',
                notificationId: 'notif-1',
            }))
        })

        it('does not notify when the cancellation was already requested in-app', async () => {
            constructEventMock.mockReturnValue(subUpdatedEvent({ cancel_at_period_end: true }))
            stub.onQuery((q) => {
                if (q.table === 'student_contracts' && q.op === 'select') {
                    return { data: { id: CONTRACT_ID, student_id: STUDENT_ID, trainer_id: TRAINER_ID, cancel_at_period_end: false, canceled_by: 'trainer' } }
                }
                return undefined
            })

            const res = await POST(makeRequest())
            expect(res.status).toBe(200)
            expect(logEventMock).not.toHaveBeenCalled()
            expect(insertNotifMock).not.toHaveBeenCalled()
        })
    })

    describe('customer.subscription.deleted', () => {
        it('cancels the contract, clears the student link and logs contract_canceled', async () => {
            constructEventMock.mockReturnValue(stubEvent('customer.subscription.deleted', { id: 'sub_1' }))
            stub.onQuery((q) => {
                if (q.table === 'student_contracts' && q.op === 'select') {
                    return { data: { id: CONTRACT_ID, student_id: STUDENT_ID, trainer_id: TRAINER_ID } }
                }
                return undefined
            })

            const res = await POST(makeRequest())
            expect(res.status).toBe(200)

            const update = stub.calls('student_contracts', 'update')[0]
            expect(update.payload).toMatchObject({ status: 'canceled', canceled_by: 'system' })
            expect(hasFilter(update, 'eq', 'stripe_subscription_id', 'sub_1')).toBe(true)

            const studentUpdate = stub.calls('students', 'update')[0]
            expect(studentUpdate.payload).toEqual({ stripe_subscription_id: null })
            expect(hasFilter(studentUpdate, 'eq', 'id', STUDENT_ID)).toBe(true)

            expect(logEventMock).toHaveBeenCalledWith(expect.objectContaining({
                eventType: 'contract_canceled',
                metadata: { canceled_by: 'system' },
            }))
        })

        it('still cancels by subscription id when no contract row is found', async () => {
            constructEventMock.mockReturnValue(stubEvent('customer.subscription.deleted', { id: 'sub_ghost' }))
            const res = await POST(makeRequest())
            expect(res.status).toBe(200)

            const update = stub.calls('student_contracts', 'update')[0]
            expect(update.payload).toMatchObject({ status: 'canceled' })
            expect(stub.calls('students').length).toBe(0)
            expect(logEventMock).not.toHaveBeenCalled()
        })
    })

    it('returns 200 for unhandled event types', async () => {
        constructEventMock.mockReturnValue(stubEvent('payout.paid', {}))
        const res = await POST(makeRequest())
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ received: true })
    })
})
