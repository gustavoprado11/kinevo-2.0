import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logContractEvent } from '@/lib/contract-events'
import { insertTrainerNotification } from '@/lib/trainer-notifications'
import { sendTrainerPush } from '@/lib/push-notifications'
import Stripe from 'stripe'

// In Stripe v20+, current_period_end moved from Subscription to SubscriptionItem
function getPeriodEnd(subscription: Stripe.Subscription): string | null {
    const item = subscription.items?.data?.[0]
    if (item?.current_period_end) {
        return new Date(item.current_period_end * 1000).toISOString()
    }
    if (subscription.trial_end) {
        return new Date(subscription.trial_end * 1000).toISOString()
    }
    return null
}

// In Stripe v20+, Invoice.subscription moved to Invoice.parent.subscription_details.subscription
function getSubscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
    // Try new v20+ path first
    const sub = invoice.parent?.subscription_details?.subscription
    if (sub) {
        return typeof sub === 'string' ? sub : sub.id
    }
    // Fallback: check subscription_details at top level or lines
    const lineItem = invoice.lines?.data?.[0]
    if (lineItem?.parent?.subscription_item_details?.subscription) {
        return lineItem.parent.subscription_item_details.subscription
    }
    // Last resort: check metadata
    if (invoice.metadata?.subscription_id) {
        return invoice.metadata.subscription_id
    }
    return null
}

export async function POST(request: NextRequest) {
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
        return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
    }

    const webhookSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET
    if (!webhookSecret) {
        console.error('[connect-webhook] STRIPE_CONNECT_WEBHOOK_SECRET not set')
        return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
    }

    let event: Stripe.Event

    try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err) {
        console.error('[connect-webhook] Signature verification failed:', err)
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    // Idempotency: race-safe insert-first pattern. See the comment in
    // api/webhooks/stripe/route.ts for the TOCTOU rationale. Additionally,
    // this handler previously inserted the idempotency row BEFORE running
    // the handler AND returned 500 on handler failure — which meant a
    // transient error left the event marked as "processed" so Stripe's
    // retry silently skipped it (audit MEDIUM finding). We now insert
    // first, and if the handler throws, we DELETE the idempotency row
    // before returning 500 so Stripe's next retry reprocesses cleanly.
    {
        const { error: idempotencyError } = await supabaseAdmin
            .from('webhook_events')
            .insert({
                event_id: event.id,
                event_type: event.type,
                metadata: { account: event.account },
            })

        if (idempotencyError) {
            if (idempotencyError.code === '23505') {
                console.log(`[connect-webhook] Event ${event.id} already processed, skipping`)
                return NextResponse.json({ received: true })
            }
            console.error('[connect-webhook] Idempotency insert failed:', idempotencyError)
            return NextResponse.json({ error: 'Idempotency store unavailable' }, { status: 500 })
        }
    }

    // The connected account ID — critical for all Stripe API calls
    const connectedAccountId = event.account || undefined

    console.log(`[connect-webhook] Received event: ${event.type} (${event.id}) for account ${connectedAccountId}`)

    try {
        switch (event.type) {
            case 'account.updated':
                await handleAccountUpdated(event.data.object as Stripe.Account)
                break
            case 'checkout.session.completed':
                await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, connectedAccountId)
                break
            case 'invoice.payment_succeeded':
                await handlePaymentSucceeded(event.data.object as Stripe.Invoice, connectedAccountId)
                break
            case 'invoice.payment_failed':
                await handlePaymentFailed(event.data.object as Stripe.Invoice, connectedAccountId)
                break
            case 'customer.subscription.updated':
                await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
                break
            case 'customer.subscription.deleted':
                await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
                break
            default:
                console.log(`[connect-webhook] Unhandled event type: ${event.type}`)
        }
    } catch (handlerError) {
        console.error(`[connect-webhook] Error handling ${event.type}:`, handlerError)
        // Undo the idempotency row so Stripe's next retry reprocesses.
        await supabaseAdmin.from('webhook_events').delete().eq('event_id', event.id)
        return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
    }

    return NextResponse.json({ received: true })
}

// ============================================================================
// Event Handlers
// ============================================================================

async function handleAccountUpdated(account: Stripe.Account) {
    // Sync connect account status to payment_settings
    const { error } = await supabaseAdmin
        .from('payment_settings')
        .update({
            charges_enabled: account.charges_enabled ?? false,
            details_submitted: account.details_submitted ?? false,
            payouts_enabled: account.payouts_enabled ?? false,
            stripe_status: account.charges_enabled ? 'active' : 'pending',
        })
        .eq('stripe_connect_id', account.id)

    if (error) {
        console.error('[connect-webhook:account.updated] DB error:', error)
    }

    console.log(`[connect-webhook:account.updated] Synced account ${account.id}`)
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session, connectedAccountId?: string) {
    const trainerId = session.metadata?.trainer_id
    const studentId = session.metadata?.student_id
    const planId = session.metadata?.plan_id

    console.log(`[connect-webhook:checkout] trainer=${trainerId}, student=${studentId}, plan=${planId}, account=${connectedAccountId}`)

    if (!trainerId || !studentId || !planId || session.mode !== 'subscription') {
        console.log('[connect-webhook:checkout] Skipped — missing metadata or not subscription')
        return
    }

    const subscriptionId = typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id

    if (!subscriptionId) {
        console.error('[connect-webhook:checkout] No subscription ID found in session')
        return
    }

    // Retrieve subscription details — MUST use stripeAccount for connected accounts
    const subscription = await stripe.subscriptions.retrieve(
        subscriptionId,
        { expand: ['items.data'] },
        connectedAccountId ? { stripeAccount: connectedAccountId } : undefined
    )

    // Fetch plan amount
    const { data: plan } = await supabaseAdmin
        .from('trainer_plans')
        .select('price, title')
        .eq('id', planId)
        .single()

    // Check if there is a pending contract to update
    const { data: pendingContract } = await supabaseAdmin
        .from('student_contracts')
        .select('id')
        .eq('student_id', studentId)
        .eq('plan_id', planId)
        .eq('status', 'pending')
        .single()

    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id || null

    if (pendingContract) {
        // Cancel any OTHER existing active contracts for this student
        await supabaseAdmin
            .from('student_contracts')
            .update({ status: 'canceled' })
            .eq('student_id', studentId)
            .eq('trainer_id', trainerId)
            .neq('id', pendingContract.id) // keep the pending one!
            .in('status', ['active', 'past_due', 'pending'])

        // Update the pending contract to active
        const { error: updateError } = await supabaseAdmin
            .from('student_contracts')
            .update({
                status: 'active',
                stripe_customer_id: customerId,
                stripe_subscription_id: subscriptionId,
                start_date: new Date().toISOString(),
                current_period_end: getPeriodEnd(subscription),
                updated_at: new Date().toISOString()
            })
            .eq('id', pendingContract.id)

        if (updateError) {
            console.error('[connect-webhook:checkout] Update error:', updateError)
            throw updateError
        }

        console.log(`[connect-webhook:checkout] Updated pending contract ${pendingContract.id} → active`)
    } else {
        // Fallback: Cancel any existing active contracts for this student
        await supabaseAdmin
            .from('student_contracts')
            .update({ status: 'canceled' })
            .eq('student_id', studentId)
            .eq('trainer_id', trainerId)
            .in('status', ['active', 'past_due', 'pending'])

        // Create student_contract
        const { error: insertError } = await supabaseAdmin
            .from('student_contracts')
            .insert({
                student_id: studentId,
                trainer_id: trainerId,
                plan_id: planId,
                amount: plan?.price || 0,
                status: 'active',
                billing_type: 'stripe_auto',
                block_on_fail: true,
                stripe_customer_id: customerId,
                stripe_subscription_id: subscriptionId,
                start_date: new Date().toISOString(),
                current_period_end: getPeriodEnd(subscription),
            })

        if (insertError) {
            console.error('[connect-webhook:checkout] Insert error:', insertError)
            throw insertError
        }

        console.log(`[connect-webhook:checkout] Created new contract for student ${studentId}`)
    }

    // Update student status
    await supabaseAdmin
        .from('students')
        .update({
            plan_status: 'active',
            pending_plan_id: null,
            current_plan_name: plan?.title || null,
            stripe_subscription_id: subscriptionId,
        })
        .eq('id', studentId)

    await logContractEvent({
        studentId,
        trainerId,
        contractId: pendingContract?.id ?? null,
        eventType: 'contract_created',
        metadata: {
            billing_type: 'stripe_auto',
            amount: session.amount_total ? session.amount_total / 100 : plan?.price ?? 0,
            plan_title: plan?.title ?? null,
        },
    })

    console.log(`[connect-webhook:checkout] Contract activated for student ${studentId}`)
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice, connectedAccountId?: string) {
    const subscriptionId = getSubscriptionIdFromInvoice(invoice)

    console.log(`[connect-webhook:payment_succeeded] invoice=${invoice.id}, subscriptionId=${subscriptionId}, account=${connectedAccountId}`)

    if (!subscriptionId) {
        console.log('[connect-webhook:payment_succeeded] No subscription ID found, skipping')
        return
    }

    // Find contract by stripe subscription
    const { data: contract } = await supabaseAdmin
        .from('student_contracts')
        .select('id, student_id, trainer_id, amount')
        .eq('stripe_subscription_id', subscriptionId)
        .single()

    if (!contract) {
        console.log(`[connect-webhook:payment_succeeded] No contract found for subscription ${subscriptionId}`)
        return
    }

    // Retrieve subscription for period end — MUST use stripeAccount for connected accounts
    const subscription = await stripe.subscriptions.retrieve(
        subscriptionId,
        { expand: ['items.data'] },
        connectedAccountId ? { stripeAccount: connectedAccountId } : undefined
    )

    // Update contract
    await supabaseAdmin
        .from('student_contracts')
        .update({
            status: 'active',
            current_period_end: getPeriodEnd(subscription),
        })
        .eq('id', contract.id)

    // Record transaction (no platform fee, gross = net)
    const amountPaid = invoice.amount_paid ? invoice.amount_paid / 100 : contract.amount

    await supabaseAdmin
        .from('financial_transactions')
        .insert({
            coach_id: contract.trainer_id,
            student_id: contract.student_id,
            amount_gross: amountPaid,
            amount_net: amountPaid,
            currency: invoice.currency || 'brl',
            type: 'subscription',
            status: 'succeeded',
            stripe_payment_id: `inv_${invoice.id}`,
            stripe_invoice_id: invoice.id,
            description: `Pagamento automático — ${invoice.lines?.data?.[0]?.description || 'Assinatura'}`,
        })

    // Update student status
    await supabaseAdmin
        .from('students')
        .update({ plan_status: 'active' })
        .eq('id', contract.student_id)

    await logContractEvent({
        studentId: contract.student_id,
        trainerId: contract.trainer_id,
        contractId: contract.id,
        eventType: 'payment_received',
        metadata: {
            amount: amountPaid,
            method: 'stripe',
            stripe_invoice_id: invoice.id,
        },
    })

    // Notify trainer of successful payment
    const { data: paidStudent } = await supabaseAdmin
        .from('students')
        .select('name')
        .eq('id', contract.student_id)
        .single()

    const amountFormatted = new Intl.NumberFormat('pt-BR', {
        style: 'currency', currency: 'BRL'
    }).format(amountPaid)

    const paymentNotifId = await insertTrainerNotification({
        trainerId: contract.trainer_id,
        type: 'payment_received',
        title: 'Pagamento confirmado',
        message: `${paidStudent?.name ?? 'Aluno'} pagou ${amountFormatted}.`,
        metadata: {
            student_id: contract.student_id,
            contract_id: contract.id,
            amount: amountPaid,
        },
    })

    sendTrainerPush({
        trainerId: contract.trainer_id,
        type: 'payment_received',
        title: 'Pagamento confirmado',
        body: `${paidStudent?.name ?? 'Aluno'} pagou ${amountFormatted}.`,
        notificationId: paymentNotifId ?? undefined,
        data: { type: 'payment_received', student_id: contract.student_id, contract_id: contract.id },
    })

    console.log(`[connect-webhook:payment_succeeded] Recorded for contract ${contract.id}, amount=${amountPaid}`)
}

async function handlePaymentFailed(invoice: Stripe.Invoice, connectedAccountId?: string) {
    const subscriptionId = getSubscriptionIdFromInvoice(invoice)

    console.log(`[connect-webhook:payment_failed] invoice=${invoice.id}, subscriptionId=${subscriptionId}, account=${connectedAccountId}`)

    if (!subscriptionId) {
        console.log('[connect-webhook:payment_failed] No subscription ID found, skipping')
        return
    }

    const { data: contract } = await supabaseAdmin
        .from('student_contracts')
        .select('id, student_id, trainer_id, amount, block_on_fail')
        .eq('stripe_subscription_id', subscriptionId)
        .single()

    if (!contract) return

    // Update contract status
    await supabaseAdmin
        .from('student_contracts')
        .update({ status: 'past_due' })
        .eq('id', contract.id)

    // Record failed transaction
    await supabaseAdmin
        .from('financial_transactions')
        .insert({
            coach_id: contract.trainer_id,
            student_id: contract.student_id,
            amount_gross: contract.amount,
            amount_net: 0,
            currency: 'brl',
            type: 'subscription',
            status: 'failed',
            stripe_payment_id: `inv_failed_${invoice.id}`,
            stripe_invoice_id: invoice.id,
            description: 'Pagamento falhou',
        })

    // Update student status
    await supabaseAdmin
        .from('students')
        .update({ plan_status: 'past_due' })
        .eq('id', contract.student_id)

    await logContractEvent({
        studentId: contract.student_id,
        trainerId: contract.trainer_id,
        contractId: contract.id,
        eventType: 'payment_failed',
        metadata: {
            amount: contract.amount,
            stripe_invoice_id: invoice.id,
        },
    })

    // Notify trainer of failed payment
    const { data: failedStudent } = await supabaseAdmin
        .from('students')
        .select('name')
        .eq('id', contract.student_id)
        .single()

    const failedNotifId = await insertTrainerNotification({
        trainerId: contract.trainer_id,
        type: 'payment_failed',
        title: 'Pagamento falhou',
        message: `Pagamento de ${failedStudent?.name ?? 'Aluno'} falhou.`,
        metadata: {
            student_id: contract.student_id,
            contract_id: contract.id,
        },
    })

    sendTrainerPush({
        trainerId: contract.trainer_id,
        type: 'payment_failed',
        title: 'Pagamento falhou',
        body: `Pagamento de ${failedStudent?.name ?? 'Aluno'} falhou.`,
        notificationId: failedNotifId ?? undefined,
        data: { type: 'payment_failed', student_id: contract.student_id, contract_id: contract.id },
    })

    console.log(`[connect-webhook:payment_failed] Contract ${contract.id} marked past_due`)
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    // Fetch current contract state before update (to detect cancel_at_period_end change)
    const { data: contract } = await supabaseAdmin
        .from('student_contracts')
        .select('id, student_id, trainer_id, cancel_at_period_end, canceled_by')
        .eq('stripe_subscription_id', subscription.id)
        .single()

    await supabaseAdmin
        .from('student_contracts')
        .update({
            status: subscription.status === 'active' ? 'active' : subscription.status as string,
            current_period_end: getPeriodEnd(subscription),
            cancel_at_period_end: subscription.cancel_at_period_end,
        })
        .eq('stripe_subscription_id', subscription.id)

    // Notify trainer if cancel_at_period_end changed to true and wasn't already set by app/trainer
    // This catches cancellations via Stripe Dashboard or other non-app channels
    if (
        subscription.cancel_at_period_end &&
        contract &&
        !contract.cancel_at_period_end &&
        contract.canceled_by !== 'student' &&
        contract.canceled_by !== 'trainer'
    ) {
        const { data: cancelStudent } = await supabaseAdmin
            .from('students')
            .select('name')
            .eq('id', contract.student_id)
            .single()

        const periodEnd = getPeriodEnd(subscription)
        const endDateStr = periodEnd
            ? new Date(periodEnd).toLocaleDateString('pt-BR')
            : 'fim do período'

        // Mark canceled_by as 'system' for non-app cancellations
        await supabaseAdmin
            .from('student_contracts')
            .update({
                canceled_by: 'system',
                canceled_at: new Date().toISOString(),
            })
            .eq('id', contract.id)

        await logContractEvent({
            studentId: contract.student_id,
            trainerId: contract.trainer_id,
            contractId: contract.id,
            eventType: 'contract_canceled',
            metadata: { canceled_by: 'system', source: 'stripe_dashboard' },
        })

        const cancelNotifId = await insertTrainerNotification({
            trainerId: contract.trainer_id,
            type: 'cancellation_alert',
            title: 'Assinatura cancelada',
            message: `A assinatura de ${cancelStudent?.name ?? 'Aluno'} foi cancelada. Acesso até ${endDateStr}.`,
            metadata: {
                student_id: contract.student_id,
                contract_id: contract.id,
                access_until: periodEnd,
            },
        })

        sendTrainerPush({
            trainerId: contract.trainer_id,
            type: 'cancellation_alert',
            title: 'Assinatura cancelada',
            body: `A assinatura de ${cancelStudent?.name ?? 'Aluno'} foi cancelada. Acesso até ${endDateStr}.`,
            notificationId: cancelNotifId ?? undefined,
            data: { type: 'cancellation_alert', student_id: contract.student_id, contract_id: contract.id },
        })
    }

    console.log(`[connect-webhook:subscription.updated] ${subscription.id} → ${subscription.status}`)
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    const { data: contract } = await supabaseAdmin
        .from('student_contracts')
        .select('id, student_id, trainer_id')
        .eq('stripe_subscription_id', subscription.id)
        .single()

    await supabaseAdmin
        .from('student_contracts')
        .update({
            status: 'canceled',
            canceled_by: 'system',
            canceled_at: new Date().toISOString(),
        })
        .eq('stripe_subscription_id', subscription.id)

    if (contract) {
        await supabaseAdmin
            .from('students')
            .update({
                plan_status: 'canceled',
                current_plan_name: null,
                stripe_subscription_id: null,
            })
            .eq('id', contract.student_id)

        await logContractEvent({
            studentId: contract.student_id,
            trainerId: contract.trainer_id,
            contractId: contract.id,
            eventType: 'contract_canceled',
            metadata: { canceled_by: 'system' },
        })
    }

    console.log(`[connect-webhook:subscription.deleted] ${subscription.id} canceled`)
}
