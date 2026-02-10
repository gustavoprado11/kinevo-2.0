import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { stripe } from '@/lib/stripe'

/**
 * POST /api/stripe/sync
 *
 * Fallback: checks Stripe directly for the trainer's subscription
 * and syncs it to the database. Used when the webhook hasn't fired
 * or failed silently after checkout completion.
 */
export async function POST() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: trainer } = await supabase
        .from('trainers')
        .select('id, email')
        .eq('auth_user_id', user.id)
        .single()

    if (!trainer) {
        return NextResponse.json({ error: 'Trainer not found' }, { status: 404 })
    }

    // Check if we already have an active subscription in DB
    const { data: existingSub } = await supabaseAdmin
        .from('subscriptions')
        .select('status, stripe_customer_id')
        .eq('trainer_id', trainer.id)
        .single()

    if (existingSub?.status === 'trialing' || existingSub?.status === 'active') {
        return NextResponse.json({ status: existingSub.status, synced: false })
    }

    // Search for the customer in Stripe by email
    let stripeCustomerId = existingSub?.stripe_customer_id

    if (!stripeCustomerId) {
        const customers = await stripe.customers.list({
            email: trainer.email,
            limit: 1,
        })
        stripeCustomerId = customers.data[0]?.id
    }

    if (!stripeCustomerId) {
        return NextResponse.json({ status: 'no_customer', synced: false })
    }

    // List active subscriptions for this customer
    const subscriptions = await stripe.subscriptions.list({
        customer: stripeCustomerId,
        status: 'all',
        limit: 5,
        expand: ['data.items.data'],
    })

    // Find an active or trialing subscription
    const activeSub = subscriptions.data.find(
        s => s.status === 'trialing' || s.status === 'active'
    )

    if (!activeSub) {
        return NextResponse.json({ status: 'no_active_subscription', synced: false })
    }

    // Get period end from subscription item (Stripe v20+)
    const item = activeSub.items?.data?.[0]
    let periodEnd: string | null = null
    if (item?.current_period_end) {
        periodEnd = new Date(item.current_period_end * 1000).toISOString()
    } else if (activeSub.trial_end) {
        periodEnd = new Date(activeSub.trial_end * 1000).toISOString()
    }

    // Upsert the subscription to our DB
    const { error: upsertError } = await supabaseAdmin.from('subscriptions').upsert({
        trainer_id: trainer.id,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: activeSub.id,
        status: activeSub.status,
        current_period_end: periodEnd,
        cancel_at_period_end: activeSub.cancel_at_period_end,
    }, { onConflict: 'trainer_id' })

    if (upsertError) {
        console.error('[stripe/sync] Upsert error:', upsertError)
        return NextResponse.json({ error: 'Failed to sync subscription' }, { status: 500 })
    }

    console.log(`[stripe/sync] Synced subscription for trainer ${trainer.id}: ${activeSub.status}`)

    return NextResponse.json({ status: activeSub.status, synced: true })
}
