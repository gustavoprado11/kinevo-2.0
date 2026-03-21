import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { syncManualOverdue } from '@/actions/financial/sync-manual-overdue'
import { SubscriptionsClient } from './subscriptions-client'
import type { FinancialStudent } from '@/types/financial'

export default async function SubscriptionsPage({
    searchParams,
}: {
    searchParams: Promise<{ sell?: string }>
}) {
    const { sell: sellToStudentId } = await searchParams
    const { trainer } = await getTrainerWithSubscription()

    // Sync lazy: mark manual contracts overdue past grace period
    await syncManualOverdue()

    // Mark financial attention as seen (clears sidebar badge)
    await supabaseAdmin
        .from('trainers')
        .update({ financial_attention_seen_at: new Date().toISOString() })
        .eq('id', trainer.id)

    // Load students via RPC (student-centered model)
    const { data: financialStudents, error: rpcError } = await supabaseAdmin
        .rpc('get_financial_students', { p_trainer_id: trainer.id })

    if (rpcError) {
        console.error('[subscriptions] RPC error:', rpcError)
    }

    // Fetch active plans for modals
    const { data: plans } = await supabaseAdmin
        .from('trainer_plans')
        .select('id, title, price, interval, stripe_price_id')
        .eq('trainer_id', trainer.id)
        .eq('is_active', true)
        .order('title')

    // Fetch students for NewSubscriptionModal
    const { data: students } = await supabaseAdmin
        .from('students')
        .select('id, name, email')
        .eq('coach_id', trainer.id)
        .in('status', ['active', 'pending'])
        .order('name')

    // Check Stripe Connect status
    const { data: paymentSettings } = await supabaseAdmin
        .from('payment_settings')
        .select('stripe_connect_id, charges_enabled')
        .eq('user_id', trainer.id)
        .single()

    const hasStripeConnect = !!(paymentSettings?.stripe_connect_id && paymentSettings.charges_enabled)

    return (
        <SubscriptionsClient
            trainer={trainer}
            financialStudents={(financialStudents ?? []) as FinancialStudent[]}
            students={students ?? []}
            plans={plans ?? []}
            hasStripeConnect={hasStripeConnect}
            sellToStudentId={sellToStudentId}
        />
    )
}
