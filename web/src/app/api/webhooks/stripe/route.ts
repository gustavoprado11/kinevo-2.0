import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getPeriodEnd, getPriceId, orgFieldsFromSubscription } from '@/lib/studio/org-billing-sync'
import Stripe from 'stripe'

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

    // Idempotency: single insert backed by the UNIQUE(event_id) constraint on
    // webhook_events. Previously we did check-then-insert, which has a TOCTOU
    // window — two concurrent deliveries of the same event_id (common under
    // Stripe's retry behavior on timeouts) could both read "not present" and
    // both advance into the handler, producing duplicate subscription upserts
    // and notifications. Insert-first collapses the race: only one INSERT
    // wins, the loser gets error code 23505 (unique_violation) and bails out.
    //
    // If the idempotency-store itself is unhealthy (non-unique error), we
    // return 500 so Stripe retries once the store is back, rather than
    // silently processing the event twice.
    {
        const { error: idempotencyError } = await supabaseAdmin
            .from('webhook_events')
            .insert({ event_id: event.id, event_type: event.type, metadata: {} })

        if (idempotencyError) {
            if (idempotencyError.code === '23505') {
                console.log(`[webhook] Event ${event.id} already processed, skipping`)
                return NextResponse.json({ received: true })
            }
            console.error('[webhook] Idempotency insert failed:', idempotencyError)
            return NextResponse.json({ error: 'Idempotency store unavailable' }, { status: 500 })
        }
    }

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
        // Handler falhou DEPOIS do registro de idempotência: se devolvêssemos
        // 200 aqui, o retry do Stripe encontraria o event_id já gravado e
        // pularia o evento PARA SEMPRE (assinatura de treinador ficaria
        // dessincronizada até alguém rodar sync manual — classe do incidente
        // de abril/2026). Desfazemos o registro e devolvemos 500 para o
        // Stripe re-entregar limpo — mesmo padrão do webhook do Connect.
        console.error(`[webhook] Error handling ${event.type}:`, handlerError)
        await supabaseAdmin
            .from('webhook_events')
            .delete()
            .eq('event_id', event.id)
        return NextResponse.json({ error: 'Handler failed, event released for retry' }, { status: 500 })
    }

    return NextResponse.json({ received: true })
}

// ── Estúdios (billing por org) ──────────────────────────────────────────────
/** Atualiza a org dona desta subscription. Retorna true se era uma org. */
async function updateOrgBySubscription(subscription: Stripe.Subscription): Promise<boolean> {
    const { data } = await supabaseAdmin
        .from('organizations')
        .update(orgFieldsFromSubscription(subscription))
        .eq('stripe_subscription_id', subscription.id)
        .select('id')
    return (data?.length ?? 0) > 0
}

/** É uma subscription de ESTÚDIO? (para ramificar os handlers por sub id) */
async function orgIdForSubscription(subscriptionId: string): Promise<string | null> {
    const { data } = await supabaseAdmin
        .from('organizations')
        .select('id')
        .eq('stripe_subscription_id', subscriptionId)
        .maybeSingle()
    return (data as { id: string } | null)?.id ?? null
}

async function handleOrgCheckout(session: Stripe.Checkout.Session, organizationId: string) {
    const subscription = await stripe.subscriptions.retrieve(session.subscription as string, { expand: ['items.data'] })
    const { error } = await supabaseAdmin
        .from('organizations')
        .update({
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: subscription.id,
            ...orgFieldsFromSubscription(subscription),
        })
        .eq('id', organizationId)
    if (error) {
        console.error('[webhook:checkout:org] update error:', error)
        throw error
    }
    console.log(`[webhook:checkout:org] org ${organizationId} → ${subscription.status}`)
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    // Estúdio: metadata.organization_id é a ponte (o checkout de org injeta ela).
    const organizationId = session.metadata?.organization_id
    if (organizationId && session.mode === 'subscription') {
        await handleOrgCheckout(session, organizationId)
        return
    }

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
        stripe_price_id: getPriceId(subscription),
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

    // Estúdio primeiro (resolve por stripe_subscription_id na org); senão solo.
    if (await updateOrgBySubscription(subscription)) return

    await supabaseAdmin.from('subscriptions')
        .update({
            status: subscription.status as string,
            current_period_end: getPeriodEnd(subscription),
            stripe_price_id: getPriceId(subscription),
        })
        .eq('stripe_subscription_id', subscription.id)
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
    const subscriptionId = getSubscriptionIdFromInvoice(invoice)
    if (!subscriptionId) return

    // Estúdio: past_due com grace_until derivado do period_end (precisa da sub).
    if (await orgIdForSubscription(subscriptionId)) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId, { expand: ['items.data'] })
        await updateOrgBySubscription(subscription)
        return
    }

    await supabaseAdmin.from('subscriptions')
        .update({ status: 'past_due' })
        .eq('stripe_subscription_id', subscriptionId)
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    if (await updateOrgBySubscription(subscription)) return

    await supabaseAdmin.from('subscriptions')
        .update({
            status: subscription.status as string,
            current_period_end: getPeriodEnd(subscription),
            cancel_at_period_end: subscription.cancel_at_period_end,
            stripe_price_id: getPriceId(subscription),
        })
        .eq('stripe_subscription_id', subscription.id)
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    // updateOrgBySubscription já mapeia canceled/unpaid → 'canceled' na org.
    if (await updateOrgBySubscription(subscription)) return

    await supabaseAdmin.from('subscriptions')
        .update({ status: 'canceled' })
        .eq('stripe_subscription_id', subscription.id)
}
