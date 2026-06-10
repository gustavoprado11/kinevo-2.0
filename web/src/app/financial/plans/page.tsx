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
        .select('id, title, description, price, interval, interval_count, is_active, visibility, stripe_product_id, stripe_price_id, allow_pix, allow_credit_card, allow_boleto, max_installment_count, created_at')
        .eq('trainer_id', trainer.id)
        .order('created_at', { ascending: false })

    // Count active contracts per plan. (A tabela é student_contracts — o
    // from('contracts') antigo apontava para uma tabela inexistente, a query
    // falhava em runtime e o uso por plano aparecia sempre zerado.)
    const { data: contractCounts } = await supabase
        .from('student_contracts')
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
            plans={(plans ?? []).map(p => ({
                ...p,
                // defaults do schema (025): interval 'month', is_active true, created_at now()
                interval: p.interval ?? 'month',
                is_active: p.is_active ?? true,
                created_at: p.created_at ?? '',
            }))}
            hasStripeConnect={hasStripeConnect}
            usageByPlan={usageByPlan}
        />
    )
}
