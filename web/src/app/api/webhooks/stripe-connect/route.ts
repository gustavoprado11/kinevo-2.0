import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase-admin'
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

    // Idempotency check
    const { data: existing } = await supabaseAdmin
        .from('webhook_events')
        .select('id')
        .eq('event_id', event.id)
        .single()

    if (existing) {
        console.log(`[connect-webhook] Event ${event.id} already processed, skipping`)
        return NextResponse.json({ received: true })
    }

    // Record event for idempotency
    await supabaseAdmin.from('webhook_events').insert({
        event_id: event.id,
        event_type: event.type,
        metadata: { account: event.account },
    })

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

    console.log(`[connect-webhook:payment_failed] Contract ${contract.id} marked past_due`)
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    await supabaseAdmin
        .from('student_contracts')
        .update({
            status: subscription.status === 'active' ? 'active' : subscription.status as string,
            current_period_end: getPeriodEnd(subscription),
            cancel_at_period_end: subscription.cancel_at_period_end,
        })
        .eq('stripe_subscription_id', subscription.id)

    console.log(`[connect-webhook:subscription.updated] ${subscription.id} → ${subscription.status}`)
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    const { data: contract } = await supabaseAdmin
        .from('student_contracts')
        .select('id, student_id')
        .eq('stripe_subscription_id', subscription.id)
        .single()

    await supabaseAdmin
        .from('student_contracts')
        .update({ status: 'canceled' })
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
    }

    console.log(`[connect-webhook:subscription.deleted] ${subscription.id} canceled`)
}
