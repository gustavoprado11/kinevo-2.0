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
        .select('id, email')
        .eq('auth_user_id', user.id)
        .single()

    if (!trainer) {
        return NextResponse.json({ error: 'Trainer not found' }, { status: 404 })
    }

    const body = await request.json()
    const { student_id, plan_id } = body

    if (!student_id || !plan_id) {
        return NextResponse.json({ error: 'Missing student_id or plan_id' }, { status: 400 })
    }

    // Check Stripe Connect account
    const { data: settings } = await supabaseAdmin
        .from('payment_settings')
        .select('stripe_connect_id, charges_enabled')
        .eq('user_id', trainer.id)
        .single()

    if (!settings?.stripe_connect_id || !settings.charges_enabled) {
        return NextResponse.json({ error: 'Stripe Connect not active' }, { status: 400 })
    }

    // Validate student belongs to trainer
    const { data: student } = await supabaseAdmin
        .from('students')
        .select('id, coach_id, name, email, stripe_customer_id')
        .eq('id', student_id)
        .single()

    if (!student || student.coach_id !== trainer.id) {
        return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    // Validate plan belongs to trainer
    const { data: plan } = await supabaseAdmin
        .from('trainer_plans')
        .select('id, title, trainer_id, stripe_price_id')
        .eq('id', plan_id)
        .single()

    if (!plan || plan.trainer_id !== trainer.id) {
        return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    if (!plan.stripe_price_id) {
        return NextResponse.json({ error: 'Plan has no Stripe price' }, { status: 400 })
    }

    try {
        // Find or create customer on connected account
        let stripeCustomerId = student.stripe_customer_id

        if (!stripeCustomerId) {
            const customer = await stripe.customers.create(
                {
                    email: student.email,
                    name: student.name,
                    metadata: {
                        student_id: student.id,
                        trainer_id: trainer.id,
                    },
                },
                { stripeAccount: settings.stripe_connect_id }
            )
            stripeCustomerId = customer.id

            await supabaseAdmin
                .from('students')
                .update({ stripe_customer_id: stripeCustomerId })
                .eq('id', student_id)
        }

        // Create Checkout Session
        const session = await stripe.checkout.sessions.create(
            {
                customer: stripeCustomerId,
                mode: 'subscription',
                payment_method_types: ['card'],
                line_items: [{
                    price: plan.stripe_price_id,
                    quantity: 1,
                }],
                subscription_data: {
                    metadata: {
                        trainer_id: trainer.id,
                        student_id,
                        plan_id,
                    },
                },
                metadata: {
                    trainer_id: trainer.id,
                    student_id,
                    plan_id,
                },
                success_url: `${request.nextUrl.origin}/financial/subscriptions?checkout=success`,
                cancel_url: `${request.nextUrl.origin}/financial/subscriptions?checkout=canceled`,
            },
            { stripeAccount: settings.stripe_connect_id }
        )

        return NextResponse.json({ url: session.url })
    } catch (err) {
        console.error('[connect-checkout] Error:', err)
        return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
    }
}
