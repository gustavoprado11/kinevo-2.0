// ============================================================================
// POST /api/webhooks/asaas
// ============================================================================
// Asaas calls this URL for every event on payments, transfers, and accounts.
// Auth: header `asaas-access-token` == process.env.ASAAS_WEBHOOK_TOKEN.
// Idempotency: insert into webhook_events with the event id (UNIQUE).
//
// We ALWAYS return 200 (even on internal errors) so Asaas doesn't retry-loop
// our system into ground. Errors are logged.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
    parseWebhookEvent,
    verifyWebhookSecret,
    ASAAS_WEBHOOK_TOKEN_HEADER,
    type AsaasWebhookEvent,
} from '@/lib/asaas'

export async function POST(request: NextRequest) {
    // 1. Verify shared-secret header
    const headerValue = request.headers.get(ASAAS_WEBHOOK_TOKEN_HEADER)
    if (!verifyWebhookSecret(headerValue)) {
        console.warn('[asaas-webhook] Rejected: bad asaas-access-token')
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    // 2. Parse body
    let event: AsaasWebhookEvent
    try {
        const body = await request.json()
        event = parseWebhookEvent(body)
    } catch (err) {
        console.error('[asaas-webhook] Bad payload:', err)
        return NextResponse.json({ error: 'bad payload' }, { status: 400 })
    }

    // 3. Idempotency: insert into webhook_events. If unique violation, skip.
    {
        const { error: idemErr } = await supabaseAdmin
            .from('webhook_events')
            .insert({
                event_id: `asaas-${event.id}`,
                event_type: event.event,
                metadata: { source: 'asaas', payload: event } as Record<string, unknown>,
            })
        if (idemErr) {
            if (idemErr.code === '23505') {
                console.log(`[asaas-webhook] Event ${event.id} already processed, skipping`)
                return NextResponse.json({ received: true })
            }
            console.error('[asaas-webhook] Idempotency insert failed:', idemErr)
            // Don't 500 — Asaas would retry indefinitely. Just log.
            return NextResponse.json({ received: true })
        }
    }

    console.log(`[asaas-webhook] Received event: ${event.event} (${event.id})`)

    // 4. Dispatch
    try {
        switch (event.event) {
            case 'PAYMENT_RECEIVED':
            case 'PAYMENT_CONFIRMED':
            case 'PAYMENT_RECEIVED_IN_CASH'.toUpperCase() as never:
                await handlePaymentReceived(event)
                break

            case 'PAYMENT_OVERDUE':
                await handlePaymentOverdue(event)
                break

            case 'PAYMENT_REFUNDED':
            case 'PAYMENT_DELETED':
                await handlePaymentRefunded(event)
                break

            case 'TRANSFER_DONE':
                await handleTransferDone(event)
                break

            case 'TRANSFER_FAILED':
            case 'TRANSFER_CANCELLED':
                await handleTransferFailed(event)
                break

            case 'TRANSFER_PENDING':
            case 'TRANSFER_IN_BANK_PROCESSING':
                await handleTransferProcessing(event)
                break

            case 'ACCOUNT_STATUS_UPDATED':
            case 'ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED':
            case 'ACCOUNT_STATUS_GENERAL_APPROVAL_REJECTED':
                await handleAccountStatusUpdated(event)
                break

            default:
                console.log(`[asaas-webhook] Unhandled event type: ${event.event}`)
        }
        return NextResponse.json({ received: true })
    } catch (err) {
        console.error(`[asaas-webhook] Handler error for ${event.event}:`, err)
        // Still return 200 — we logged it, retry won't help.
        return NextResponse.json({ received: true })
    }
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function handlePaymentReceived(event: AsaasWebhookEvent) {
    const payment = event.payment
    if (!payment) return

    // Update existing financial_transactions row (created when charge was made)
    const { error: updErr } = await supabaseAdmin
        .from('financial_transactions')
        .update({
            status: 'completed',
            amount_net: payment.netValue,
            processed_at: new Date().toISOString(),
        })
        .eq('asaas_payment_id', payment.id)
    if (updErr) {
        console.error('[asaas-webhook] update transaction failed:', updErr)
    }

    // Marca contrato como active (pode ser one-off ligado por asaas_payment_id
    // ou recorrente ligado por asaas_subscription_id via externalReference do
    // payment, que carrega o contract_id quando criado via subscription).
    // Estratégia: tenta primeiro por asaas_payment_id; se não bater, por externalReference.
    const { error: updByPay } = await supabaseAdmin
        .from('student_contracts')
        .update({ status: 'active' })
        .eq('asaas_payment_id', payment.id)
        .in('status', ['pending_payment', 'past_due'])
    if (updByPay) {
        console.error('[asaas-webhook] update contract by paymentId failed:', updByPay)
    }
    // No fluxo de subscription, o externalReference do payment é o contract.id
    if (payment.externalReference) {
        await supabaseAdmin
            .from('student_contracts')
            .update({ status: 'active' })
            .eq('id', payment.externalReference)
            .in('status', ['pending_payment', 'past_due'])
    }
}

async function handlePaymentOverdue(event: AsaasWebhookEvent) {
    const payment = event.payment
    if (!payment) return
    await supabaseAdmin
        .from('financial_transactions')
        .update({ status: 'overdue' })
        .eq('asaas_payment_id', payment.id)
    await supabaseAdmin
        .from('student_contracts')
        .update({ status: 'past_due' })
        .eq('asaas_payment_id', payment.id)
}

async function handlePaymentRefunded(event: AsaasWebhookEvent) {
    const payment = event.payment
    if (!payment) return
    await supabaseAdmin
        .from('financial_transactions')
        .update({ status: 'refunded' })
        .eq('asaas_payment_id', payment.id)
}

async function handleTransferDone(event: AsaasWebhookEvent) {
    const transfer = event.transfer
    if (!transfer) return
    await supabaseAdmin
        .from('payouts')
        .update({
            status: 'completed',
            end_to_end_id: transfer.endToEndIdentifier ?? null,
            completed_at: new Date().toISOString(),
        })
        .eq('asaas_transfer_id', transfer.id)
}

async function handleTransferFailed(event: AsaasWebhookEvent) {
    const transfer = event.transfer
    if (!transfer) return
    await supabaseAdmin
        .from('payouts')
        .update({
            status: transfer.status === 'CANCELLED' ? 'cancelled' : 'failed',
            failure_reason: transfer.failReason ?? 'Transfer failed at Asaas',
        })
        .eq('asaas_transfer_id', transfer.id)
}

async function handleTransferProcessing(event: AsaasWebhookEvent) {
    const transfer = event.transfer
    if (!transfer) return
    await supabaseAdmin
        .from('payouts')
        .update({ status: 'processing' })
        .eq('asaas_transfer_id', transfer.id)
}

async function handleAccountStatusUpdated(event: AsaasWebhookEvent) {
    const account = event.account
    if (!account?.id) return

    const localStatus = mapAsaasStatusToLocal(account.accountStatus ?? 'PENDING')
    const updates: Record<string, unknown> = {
        status: localStatus,
        rejection_reason: account.rejectReason ?? null,
    }
    if (localStatus === 'approved') {
        updates.activated_at = new Date().toISOString()
    }
    await supabaseAdmin
        .from('trainer_payment_accounts')
        .update(updates)
        .eq('asaas_account_id', account.id)
}

function mapAsaasStatusToLocal(asaasStatus: string): 'pending' | 'awaiting' | 'approved' | 'rejected' | 'blocked' {
    switch (asaasStatus.toUpperCase()) {
        case 'AWAITING': return 'awaiting'
        case 'APPROVED': return 'approved'
        case 'REJECTED': return 'rejected'
        case 'BLOCKED': return 'blocked'
        default: return 'pending'
    }
}

