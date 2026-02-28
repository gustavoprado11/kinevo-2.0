import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { PlansClient } from './plans-client'

export default async function PlansPage() {
    const { trainer } = await getTrainerWithSubscription()
    const supabase = await createClient()

    // Fetch trainer plans
    const { data: plans } = await supabase
        .from('trainer_plans')
        .select('id, title, description, price, interval, interval_count, is_active, visibility, stripe_product_id, stripe_price_id, created_at')
        .eq('trainer_id', trainer.id)
        .order('created_at', { ascending: false })

    // Count active contracts per plan
    const { data: contractCounts } = await supabase
        .from('contracts')
        .select('plan_id')
        .eq('trainer_id', trainer.id)
        .in('status', ['active', 'past_due'])

    const usageByPlan: Record<string, number> = {}
    if (contractCounts) {
        for (const c of contractCounts) {
            if (c.plan_id) {
                usageByPlan[c.plan_id] = (usageByPlan[c.plan_id] || 0) + 1
            }
        }
    }

    // Fetch payment settings for connect status
    const { data: paymentSettings } = await supabaseAdmin
        .from('payment_settings')
        .select('stripe_connect_id, charges_enabled')
        .eq('user_id', trainer.id)
        .single()

    const hasStripeConnect = !!(paymentSettings?.stripe_connect_id && paymentSettings.charges_enabled)

    return (
        <PlansClient
            trainer={trainer}
            plans={plans ?? []}
            hasStripeConnect={hasStripeConnect}
            usageByPlan={usageByPlan}
        />
    )
}
