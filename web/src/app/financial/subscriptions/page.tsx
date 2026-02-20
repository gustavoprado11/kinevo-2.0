import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { SubscriptionsClient } from './subscriptions-client'

export default async function SubscriptionsPage() {
    const { trainer } = await getTrainerWithSubscription()

    // Fetch contracts with student and plan data
    const { data: contracts, error: contractsError } = await supabaseAdmin
        .from('student_contracts')
        .select(`
            *,
            students:student_id(id, name, email, avatar_url),
            trainer_plans:plan_id(id, title, price, interval, stripe_price_id)
        `)
        .eq('trainer_id', trainer.id)
        .order('created_at', { ascending: false })

    if (contractsError) {
        console.error('[subscriptions] Failed to fetch contracts:', contractsError)
    }

    // Fetch payment settings for connect status
    const { data: paymentSettings } = await supabaseAdmin
        .from('payment_settings')
        .select('stripe_connect_id, charges_enabled')
        .eq('user_id', trainer.id)
        .single()

    const hasStripeConnect = !!(paymentSettings?.stripe_connect_id && paymentSettings.charges_enabled)

    // Fetch active plans for the new subscription modal
    const { data: plans } = await supabaseAdmin
        .from('trainer_plans')
        .select('id, title, price, interval, stripe_price_id')
        .eq('trainer_id', trainer.id)
        .eq('is_active', true)
        .order('title')

    // Fetch active students for the new subscription modal
    const { data: students } = await supabaseAdmin
        .from('students')
        .select('id, name, email')
        .eq('coach_id', trainer.id)
        .in('status', ['active', 'pending'])
        .order('name')

    return (
        <SubscriptionsClient
            trainer={trainer}
            contracts={contracts ?? []}
            students={students ?? []}
            plans={plans ?? []}
            hasStripeConnect={hasStripeConnect}
        />
    )
}
