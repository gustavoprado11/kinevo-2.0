import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { stripe } from '@/lib/stripe'
import Stripe from 'stripe'

/**
 * Syncs pending Stripe contracts by checking actual subscription status on Stripe.
 * This resolves cases where webhook events were missed or failed.
 */
export async function POST() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: trainer } = await supabase
        .from('trainers')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()

    if (!trainer) {
        return NextResponse.json({ error: 'Trainer not found' }, { status: 404 })
    }

    const { data: settings } = await supabaseAdmin
        .from('payment_settings')
        .select('stripe_connect_id')
        .eq('user_id', trainer.id)
        .single()

    if (!settings?.stripe_connect_id) {
        return NextResponse.json({ error: 'Stripe not connected' }, { status: 400 })
    }

    // Find all pending or active stripe_auto contracts for this trainer
    const { data: contracts } = await supabaseAdmin
        .from('student_contracts')
        .select('id, student_id, plan_id, stripe_subscription_id, stripe_customer_id, status, amount')
        .eq('trainer_id', trainer.id)
        .eq('billing_type', 'stripe_auto')
        .in('status', ['pending', 'active', 'past_due'])

    if (!contracts || contracts.length === 0) {
        return NextResponse.json({ synced: 0, message: 'No Stripe contracts to sync' })
    }

    let synced = 0
    let errors = 0

    for (const contract of contracts) {
        try {
            // Case 1: Contract has a subscription ID — check its status on Stripe
            if (contract.stripe_subscription_id) {
                const subscription = await stripe.subscriptions.retrieve(
                    contract.stripe_subscription_id,
                    { expand: ['items.data'] },
                    { stripeAccount: settings.stripe_connect_id }
                )

                const periodEnd = getPeriodEnd(subscription)

                if (subscription.status === 'active' || subscription.status === 'trialing') {
                    await supabaseAdmin
                        .from('student_contracts')
                        .update({
                            status: 'active',
                            current_period_end: periodEnd,
                            cancel_at_period_end: subscription.cancel_at_period_end,
                            updated_at: new Date().toISOString(),
                        })
                        .eq('id', contract.id)

                    // Update student status
                    await supabaseAdmin
                        .from('students')
                        .update({ plan_status: 'active' })
                        .eq('id', contract.student_id)

                    synced++
                } else if (subscription.status === 'canceled') {
                    await supabaseAdmin
                        .from('student_contracts')
                        .update({
                            status: 'canceled',
                            updated_at: new Date().toISOString(),
                        })
                        .eq('id', contract.id)

                    synced++
                } else if (subscription.status === 'past_due') {
                    await supabaseAdmin
                        .from('student_contracts')
                        .update({
                            status: 'past_due',
                            current_period_end: periodEnd,
                            updated_at: new Date().toISOString(),
                        })
                        .eq('id', contract.id)

                    synced++
                }

                continue
            }

            // Case 2: Pending contract without subscription ID — search for active subscription on Stripe
            if (contract.status === 'pending' && contract.stripe_customer_id) {
                const subscriptions = await stripe.subscriptions.list(
                    {
                        customer: contract.stripe_customer_id,
                        status: 'active',
                        limit: 5,
                    },
                    { stripeAccount: settings.stripe_connect_id }
                )

                if (subscriptions.data.length > 0) {
                    const sub = subscriptions.data[0]
                    const periodEnd = getPeriodEnd(sub)

                    await supabaseAdmin
                        .from('student_contracts')
                        .update({
                            status: 'active',
                            stripe_subscription_id: sub.id,
                            current_period_end: periodEnd,
                            start_date: new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                        })
                        .eq('id', contract.id)

                    // Update student status
                    const { data: plan } = await supabaseAdmin
                        .from('trainer_plans')
                        .select('title')
                        .eq('id', contract.plan_id)
                        .single()

                    await supabaseAdmin
                        .from('students')
                        .update({
                            plan_status: 'active',
                            current_plan_name: plan?.title || null,
                            stripe_subscription_id: sub.id,
                            pending_plan_id: null,
                        })
                        .eq('id', contract.student_id)

                    // Also record the transaction if invoice exists
                    try {
                        const invoices = await stripe.invoices.list(
                            {
                                subscription: sub.id,
                                status: 'paid',
                                limit: 1,
                            },
                            { stripeAccount: settings.stripe_connect_id }
                        )

                        if (invoices.data.length > 0) {
                            const inv = invoices.data[0]
                            const amountPaid = inv.amount_paid ? inv.amount_paid / 100 : contract.amount

                            // Check if transaction already exists
                            const { data: existingTx } = await supabaseAdmin
                                .from('financial_transactions')
                                .select('id')
                                .eq('stripe_invoice_id', inv.id)
                                .single()

                            if (!existingTx) {
                                await supabaseAdmin
                                    .from('financial_transactions')
                                    .insert({
                                        coach_id: trainer.id,
                                        student_id: contract.student_id,
                                        amount_gross: amountPaid,
                                        amount_net: amountPaid,
                                        currency: inv.currency || 'brl',
                                        type: 'subscription',
                                        status: 'succeeded',
                                        stripe_payment_id: `inv_${inv.id}`,
                                        stripe_invoice_id: inv.id,
                                        description: `Pagamento automático — ${inv.lines?.data?.[0]?.description || 'Assinatura'}`,
                                    })
                            }
                        }
                    } catch (invErr) {
                        console.error(`[sync-contracts] Error fetching invoices for sub ${sub.id}:`, invErr)
                    }

                    synced++
                }
            }
        } catch (err) {
            console.error(`[sync-contracts] Error syncing contract ${contract.id}:`, err)
            errors++
        }
    }

    console.log(`[sync-contracts] Done: ${synced} synced, ${errors} errors out of ${contracts.length} contracts`)

    return NextResponse.json({ synced, errors, total: contracts.length })
}

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
