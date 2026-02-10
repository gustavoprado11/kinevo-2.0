import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { stripe } from '@/lib/stripe'

export async function POST(request: NextRequest) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: trainer } = await supabase
        .from('trainers')
        .select('id, name, email')
        .eq('auth_user_id', user.id)
        .single()

    if (!trainer) {
        return NextResponse.json({ error: 'Trainer not found' }, { status: 404 })
    }

    // Check for existing Stripe customer
    const { data: existingSub } = await supabaseAdmin
        .from('subscriptions')
        .select('stripe_customer_id')
        .eq('trainer_id', trainer.id)
        .single()

    let stripeCustomerId = existingSub?.stripe_customer_id

    if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
            email: trainer.email,
            name: trainer.name,
            metadata: {
                trainer_id: trainer.id,
                supabase_auth_uid: user.id,
            },
        })
        stripeCustomerId = customer.id
    }

    const session = await stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{
            price: process.env.STRIPE_PRICE_ID!,
            quantity: 1,
        }],
        subscription_data: {
            trial_period_days: 7,
            metadata: {
                trainer_id: trainer.id,
            },
        },
        success_url: `${request.nextUrl.origin}/dashboard?checkout=success`,
        cancel_url: `${request.nextUrl.origin}/subscription/blocked?checkout=canceled`,
        metadata: {
            trainer_id: trainer.id,
        },
    })

    return NextResponse.json({ url: session.url })
}
