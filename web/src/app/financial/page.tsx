import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { syncManualOverdue } from '@/actions/financial/sync-manual-overdue'
import { FinancialDashboardClient } from './financial-client'
import type { FinancialStudent } from '@/types/financial'

export default async function FinancialPage() {
    const { trainer } = await getTrainerWithSubscription()
    const supabase = await createClient()

    // Sync lazy: mark manual contracts overdue past grace period
    await syncManualOverdue()

    // Mark financial attention as seen (clears sidebar badge)
    await supabaseAdmin
        .from('trainers')
        .update({ financial_attention_seen_at: new Date().toISOString() })
        .eq('id', trainer.id)

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

    // Monthly revenue: sum of succeeded transactions this month
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const startOfNextMonth = new Date(startOfMonth)
    startOfNextMonth.setMonth(startOfNextMonth.getMonth() + 1)

    const { data: monthTransactions } = await supabaseAdmin
        .from('financial_transactions')
        .select('amount_gross')
        .eq('coach_id', trainer.id)
        .eq('status', 'succeeded')
        .gte('created_at', startOfMonth.toISOString())
        .lt('created_at', startOfNextMonth.toISOString())

    const monthlyRevenue = (monthTransactions ?? []).reduce(
        (sum, t) => sum + (t.amount_gross ?? 0), 0
    )

    // Use RPC for student-centered metrics
    const { data: allStudents } = await supabaseAdmin
        .rpc('get_financial_students', { p_trainer_id: trainer.id })

    const financialStudents = (allStudents ?? []) as FinancialStudent[]
    const payingCount = financialStudents.filter(s =>
        ['active', 'awaiting_payment'].includes(s.display_status)
    ).length
    const courtesyCount = financialStudents.filter(s =>
        s.display_status === 'courtesy'
    ).length
    const attentionStudents = financialStudents.filter(s =>
        ['overdue', 'grace_period', 'canceling', 'expired'].includes(s.display_status)
    )

    // Fetch recent transactions
    const { data: recentTransactions } = await supabaseAdmin
        .from('financial_transactions')
        .select('id, amount_gross, amount_net, currency, type, status, description, created_at, student_id')
        .eq('coach_id', trainer.id)
        .order('created_at', { ascending: false })
        .limit(10)

    // Enrich transactions with student names
    const studentIds = [...new Set((recentTransactions ?? []).map(t => t.student_id).filter(Boolean))]
    let studentNameMap: Record<string, string> = {}
    if (studentIds.length > 0) {
        const { data: txStudents } = await supabaseAdmin
            .from('students')
            .select('id, name')
            .in('id', studentIds)
        if (txStudents) {
            for (const s of txStudents) {
                studentNameMap[s.id] = s.name
            }
        }
    }

    const connectStatus = {
        connected: !!paymentSettings?.stripe_connect_id,
        chargesEnabled: paymentSettings?.charges_enabled ?? false,
        detailsSubmitted: paymentSettings?.details_submitted ?? false,
        payoutsEnabled: paymentSettings?.payouts_enabled ?? false,
    }

    const showOnboarding = !paymentSettings && (!plans || plans.length === 0)

    // Fetch students + active plans for "Nova Assinatura" modal
    const { data: students } = await supabaseAdmin
        .from('students')
        .select('id, name, email')
        .eq('coach_id', trainer.id)
        .in('status', ['active', 'pending'])
        .order('name')

    const { data: activePlans } = await supabaseAdmin
        .from('trainer_plans')
        .select('id, title, price, interval, stripe_price_id')
        .eq('trainer_id', trainer.id)
        .eq('is_active', true)
        .order('title')

    return (
        <FinancialDashboardClient
            trainer={trainer}
            connectStatus={connectStatus}
            showOnboarding={showOnboarding}
            monthlyRevenue={monthlyRevenue}
            payingCount={payingCount}
            courtesyCount={courtesyCount}
            attentionStudents={attentionStudents}
            recentTransactions={(recentTransactions ?? []).map(tx => ({
                ...tx,
                studentName: tx.student_id ? studentNameMap[tx.student_id] || null : null,
            }))}
            plansCount={plans?.length ?? 0}
            students={(students ?? []).map(s => ({ id: s.id, name: s.name, email: s.email }))}
            activePlans={(activePlans ?? []).map(p => ({ id: p.id, title: p.title, price: p.price, interval: p.interval, stripe_price_id: p.stripe_price_id }))}
            hasStripeConnect={connectStatus.connected && connectStatus.chargesEnabled}
        />
    )
}
