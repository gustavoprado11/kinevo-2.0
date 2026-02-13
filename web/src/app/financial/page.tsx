import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { FinancialDashboardClient } from './financial-client'

export default async function FinancialPage() {
    const { trainer } = await getTrainerWithSubscription()
    const supabase = await createClient()

    // Fetch payment settings (Connect status)
    const { data: paymentSettings } = await supabaseAdmin
        .from('payment_settings')
        .select('*')
        .eq('user_id', trainer.id)
        .single()

    // Fetch trainer plans
    const { data: plans } = await supabase
        .from('trainer_plans')
        .select('id, title, price, interval, is_active')
        .eq('trainer_id', trainer.id)
        .order('created_at', { ascending: false })

    // Fetch active contracts count
    const { count: activeContractsCount } = await supabaseAdmin
        .from('student_contracts')
        .select('id', { count: 'exact', head: true })
        .eq('trainer_id', trainer.id)
        .eq('status', 'active')

    // Fetch recent transactions
    const { data: recentTransactions } = await supabaseAdmin
        .from('financial_transactions')
        .select('id, amount_gross, amount_net, currency, type, status, description, created_at, student_id')
        .eq('coach_id', trainer.id)
        .order('created_at', { ascending: false })
        .limit(10)

    // Calculate MRR from active contracts
    const { data: activeContracts } = await supabaseAdmin
        .from('student_contracts')
        .select('amount')
        .eq('trainer_id', trainer.id)
        .eq('status', 'active')

    let mrr = 0
    if (activeContracts) {
        for (const contract of activeContracts) {
            mrr += contract.amount || 0
        }
    }

    const connectStatus = {
        connected: !!paymentSettings?.stripe_connect_id,
        chargesEnabled: paymentSettings?.charges_enabled ?? false,
        detailsSubmitted: paymentSettings?.details_submitted ?? false,
        payoutsEnabled: paymentSettings?.payouts_enabled ?? false,
    }

    const showOnboarding = !paymentSettings && (!plans || plans.length === 0)

    return (
        <FinancialDashboardClient
            trainer={trainer}
            connectStatus={connectStatus}
            showOnboarding={showOnboarding}
            activeContractsCount={activeContractsCount ?? 0}
            mrr={mrr}
            recentTransactions={recentTransactions ?? []}
            plansCount={plans?.length ?? 0}
        />
    )
}
