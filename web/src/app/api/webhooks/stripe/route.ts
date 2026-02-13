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
    const sub = invoice.parent?.subscription_details?.subscription
    if (!sub) return null
    return typeof sub === 'string' ? sub : sub.id
}

export async function POST(request: NextRequest) {
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
        return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    if (!webhookSecret) {
        console.error('[webhook] STRIPE_WEBHOOK_SECRET not set')
        return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
    }

    let event: Stripe.Event

    try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err) {
        console.error('[webhook] Signature verification failed:', err)
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    // Idempotency check
    const { data: existing } = await supabaseAdmin
        .from('webhook_events')
        .select('id')
        .eq('event_id', event.id)
        .single()

    if (existing) {
        console.log(`[webhook] Event ${event.id} already processed, skipping`)
        return NextResponse.json({ received: true })
    }

    // Record event for idempotency
    await supabaseAdmin.from('webhook_events').insert({
        event_id: event.id,
        event_type: event.type,
        metadata: {},
    })

    console.log(`[webhook] Received event: ${event.type} (${event.id})`)

    try {
        switch (event.type) {
            case 'checkout.session.completed':
                await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
                break
            case 'invoice.payment_succeeded':
                await handlePaymentSucceeded(event.data.object as Stripe.Invoice)
                break
            case 'invoice.payment_failed':
                await handlePaymentFailed(event.data.object as Stripe.Invoice)
                break
            case 'customer.subscription.updated':
                await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
                break
            case 'customer.subscription.deleted':
                await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
                break
            default:
                console.log(`[webhook] Unhandled event type: ${event.type}`)
        }
    } catch (handlerError) {
        console.error(`[webhook] Error handling ${event.type}:`, handlerError)
        return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
    }

    return NextResponse.json({ received: true })
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const trainerId = session.metadata?.trainer_id
    console.log(`[webhook:checkout] trainer_id=${trainerId}, mode=${session.mode}, subscription=${session.subscription}`)

    if (!trainerId || session.mode !== 'subscription') {
        console.log('[webhook:checkout] Skipped — missing trainer_id or not subscription mode')
        return
    }

    const subscription = await stripe.subscriptions.retrieve(session.subscription as string, {
        expand: ['items.data'],
    })

    console.log(`[webhook:checkout] Stripe subscription status: ${subscription.status}, id: ${subscription.id}`)

    const { error: upsertError } = await supabaseAdmin.from('subscriptions').upsert({
        trainer_id: trainerId,
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: subscription.id,
        status: subscription.status as string,
        current_period_end: getPeriodEnd(subscription),
        cancel_at_period_end: subscription.cancel_at_period_end,
    }, { onConflict: 'trainer_id' })

    if (upsertError) {
        console.error('[webhook:checkout] Supabase upsert error:', upsertError)
        throw upsertError
    }

    console.log(`[webhook:checkout] Subscription upserted for trainer ${trainerId}`)
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
    const subscriptionId = getSubscriptionIdFromInvoice(invoice)
    if (!subscriptionId) return

    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['items.data'],
    })

    await supabaseAdmin.from('subscriptions')
        .update({
            status: subscription.status as string,
            current_period_end: getPeriodEnd(subscription),
        })
        .eq('stripe_subscription_id', subscription.id)
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
    const subscriptionId = getSubscriptionIdFromInvoice(invoice)
    if (!subscriptionId) return

    await supabaseAdmin.from('subscriptions')
        .update({ status: 'past_due' })
        .eq('stripe_subscription_id', subscriptionId)
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    await supabaseAdmin.from('subscriptions')
        .update({
            status: subscription.status as string,
            current_period_end: getPeriodEnd(subscription),
            cancel_at_period_end: subscription.cancel_at_period_end,
        })
        .eq('stripe_subscription_id', subscription.id)
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    await supabaseAdmin.from('subscriptions')
        .update({ status: 'canceled' })
        .eq('stripe_subscription_id', subscription.id)
}
