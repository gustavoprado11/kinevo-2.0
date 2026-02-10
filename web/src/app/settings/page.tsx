import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { stripe } from '@/lib/stripe'
import { AppLayout } from '@/components/layout'
import { BillingSection } from '@/components/settings/billing-section'

export default async function SettingsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) redirect('/login')

    const { data: trainer } = await supabase
        .from('trainers')
        .select('id, name, email')
        .eq('auth_user_id', user.id)
        .single()

    if (!trainer) {
        await supabase.auth.signOut()
        redirect('/login')
    }

    // Get subscription from DB
    let { data: subscription } = await supabaseAdmin
        .from('subscriptions')
        .select('status, current_period_end, cancel_at_period_end, stripe_customer_id, stripe_subscription_id')
        .eq('trainer_id', trainer.id)
        .single()

    // Sync from Stripe for fresh data (cancel_at_period_end, status changes)
    if (subscription?.stripe_subscription_id) {
        try {
            const stripeSub = await stripe.subscriptions.retrieve(
                subscription.stripe_subscription_id,
                { expand: ['items.data'] }
            )

            const item = stripeSub.items?.data?.[0]
            let periodEnd: string | null = null
            if (item?.current_period_end) {
                periodEnd = new Date(item.current_period_end * 1000).toISOString()
            } else if (stripeSub.trial_end) {
                periodEnd = new Date(stripeSub.trial_end * 1000).toISOString()
            }

            // Update DB with fresh data
            await supabaseAdmin.from('subscriptions')
                .update({
                    status: stripeSub.status as string,
                    current_period_end: periodEnd,
                    cancel_at_period_end: stripeSub.cancel_at_period_end,
                })
                .eq('trainer_id', trainer.id)

            // Use fresh data for rendering
            subscription = {
                ...subscription,
                status: stripeSub.status as string,
                current_period_end: periodEnd,
                cancel_at_period_end: stripeSub.cancel_at_period_end,
            }
        } catch (err) {
            console.error('[settings] Stripe sync error:', err)
            // Continue with DB data if Stripe is unreachable
        }
    }

    const isActive = subscription?.status === 'trialing' || subscription?.status === 'active'

    if (!isActive) {
        redirect('/subscription/blocked')
    }

    return (
        <AppLayout trainerName={trainer.name} trainerEmail={trainer.email}>
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-white">Configurações</h1>
                <p className="text-slate-400 mt-1">Gerencie suas preferências e assinatura</p>
            </div>

            <BillingSection subscription={subscription!} />
        </AppLayout>
    )
}
