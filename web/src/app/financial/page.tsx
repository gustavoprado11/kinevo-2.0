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

    // Fetch overdue manual contracts (pending actions)
    const { data: overdueContracts } = await supabaseAdmin
        .from('student_contracts')
        .select('id, student_id, amount, current_period_end, billing_type, students!inner(name)')
        .eq('trainer_id', trainer.id)
        .in('status', ['past_due', 'pending'])
        .in('billing_type', ['manual_recurring', 'manual_one_off'])
        .order('current_period_end', { ascending: true })
        .limit(5)

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

    // Count students without active contracts
    const { count: totalStudentsCount } = await supabaseAdmin
        .from('students')
        .select('id', { count: 'exact', head: true })
        .eq('coach_id', trainer.id)
        .in('status', ['active', 'pending'])

    const { data: coveredStudentRows } = await supabaseAdmin
        .from('student_contracts')
        .select('student_id')
        .eq('trainer_id', trainer.id)
        .eq('status', 'active')

    const coveredStudentIds = new Set((coveredStudentRows ?? []).map(r => r.student_id))
    const totalStudents = totalStudentsCount ?? 0
    const studentsWithoutContract = totalStudents - coveredStudentIds.size

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

    return (
        <FinancialDashboardClient
            trainer={trainer}
            connectStatus={connectStatus}
            showOnboarding={showOnboarding}
            activeContractsCount={activeContractsCount ?? 0}
            mrr={mrr}
            recentTransactions={(recentTransactions ?? []).map(tx => ({
                ...tx,
                studentName: tx.student_id ? studentNameMap[tx.student_id] || null : null,
            }))}
            plansCount={plans?.length ?? 0}
            overdueContracts={(overdueContracts ?? []).map(c => ({
                id: c.id,
                studentName: (c.students as unknown as { name: string })?.name || 'Aluno',
                amount: c.amount,
                currentPeriodEnd: c.current_period_end,
            }))}
            students={(students ?? []).map(s => ({ id: s.id, name: s.name, email: s.email }))}
            activePlans={(activePlans ?? []).map(p => ({ id: p.id, title: p.title, price: p.price, interval: p.interval, stripe_price_id: p.stripe_price_id }))}
            hasStripeConnect={connectStatus.connected && connectStatus.chargesEnabled}
            totalStudents={totalStudents}
            studentsWithoutContract={studentsWithoutContract}
        />
    )
}
