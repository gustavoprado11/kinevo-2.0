import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { syncManualOverdue } from '@/actions/financial/sync-manual-overdue'
import { AsaasApiError, getBalance, tryEnsureSubaccountWebhook } from '@/lib/asaas'
import { decryptApiKey } from '@/lib/asaas/encryption'
import { getWalletRow, summarizeWallet } from '@/lib/asaas/wallet-service'
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

    // Fetch pending Payment Links (cobrança gerada mas ainda não paga). A
    // gente mostra esses na mesma timeline pra trainer ver "tem 3 cobranças
    // esperando pagamento, mando o link de novo?"
    const { data: pendingLinks } = await supabaseAdmin
        .from('student_contracts')
        .select('id, amount, billing_type, asaas_payment_link_id, plan_id, student_id, created_at')
        .eq('trainer_id', trainer.id)
        .eq('status', 'pending_payment')
        .not('asaas_payment_link_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(20)

    // Lookups de nomes (alunos e planos) — pra mostrar "Maria — Consultoria"
    const studentIdSet = new Set<string>()
    for (const t of recentTransactions ?? []) if (t.student_id) studentIdSet.add(t.student_id)
    for (const c of pendingLinks ?? []) if (c.student_id) studentIdSet.add(c.student_id)

    const studentNameMap: Record<string, string> = {}
    if (studentIdSet.size > 0) {
        const { data: txStudents } = await supabaseAdmin
            .from('students')
            .select('id, name')
            .in('id', Array.from(studentIdSet))
        if (txStudents) {
            for (const s of txStudents) studentNameMap[s.id] = s.name
        }
    }

    const planIdSet = new Set<string>()
    for (const c of pendingLinks ?? []) if (c.plan_id) planIdSet.add(c.plan_id)
    const planTitleMap: Record<string, string> = {}
    if (planIdSet.size > 0) {
        const { data: ps } = await supabaseAdmin
            .from('trainer_plans')
            .select('id, title')
            .in('id', Array.from(planIdSet))
        if (ps) for (const p of ps) planTitleMap[p.id] = p.title
    }

    // Resolve a base URL do checkout Asaas (depende do env: sandbox vs prod)
    const asaasCheckoutBase = (process.env.ASAAS_ENV === 'production')
        ? 'https://www.asaas.com/c/'
        : 'https://sandbox.asaas.com/c/'

    // Pending charges viram entradas tipo "transaction com status=pending" pro
    // feed unificado. Inclui URL do link + contractId pra UI mostrar
    // botões Copiar/WhatsApp/Cancelar.
    const pendingActivityEntries = (pendingLinks ?? []).map(c => ({
        id: `pending-${c.id}`,
        amount_gross: Number(c.amount ?? 0),
        amount_net: Number(c.amount ?? 0),
        currency: 'brl',
        type: c.billing_type === 'asaas_auto_recurring' ? 'subscription' : 'charge',
        status: 'pending',
        description: c.plan_id ? planTitleMap[c.plan_id] ?? null : null,
        created_at: c.created_at ?? new Date().toISOString(),
        student_id: c.student_id,
        studentName: c.student_id ? studentNameMap[c.student_id] ?? null : null,
        paymentLinkUrl: c.asaas_payment_link_id
            ? `${asaasCheckoutBase}${c.asaas_payment_link_id}`
            : null,
        contractId: c.id,
    }))

    const connectStatus = {
        connected: !!paymentSettings?.stripe_connect_id,
        chargesEnabled: paymentSettings?.charges_enabled ?? false,
        detailsSubmitted: paymentSettings?.details_submitted ?? false,
        payoutsEnabled: paymentSettings?.payouts_enabled ?? false,
    }

    // Carteira Kinevo (Asaas) — status + saldo
    const walletRow = await getWalletRow(trainer.id)
    const walletSummary = summarizeWallet(walletRow)
    let walletBalance: number | null = null
    if (walletRow && walletSummary.status === 'approved' && walletRow.asaas_api_key_encrypted) {
        try {
            const blob = Buffer.isBuffer(walletRow.asaas_api_key_encrypted)
                ? (walletRow.asaas_api_key_encrypted as Buffer)
                : Buffer.from(String(walletRow.asaas_api_key_encrypted).replace(/^\\x/, ''), 'hex')
            const apiKey = decryptApiKey(blob)
            const b = await getBalance(apiKey)
            walletBalance = b.balance

            // Auto-cadastro silencioso de webhook (1x por trainer). Necessário
            // porque cada subconta Asaas tem webhook próprio — trainers que
            // entraram antes da automação rodam isso na primeira visita pós-deploy.
            // Marca webhook_configured_at depois pra não bater na Asaas em toda visita.
            if (!walletRow.webhook_configured_at) {
                await tryEnsureSubaccountWebhook(apiKey, { trainerId: trainer.id })
                await supabaseAdmin
                    .from('trainer_payment_accounts')
                    .update({ webhook_configured_at: new Date().toISOString() })
                    .eq('trainer_id', trainer.id)
            }
        } catch (err) {
            if (!(err instanceof AsaasApiError)) {
                console.error('[financial] balance/webhook setup failed', err)
            }
        }
    }

    // Tem contratos Stripe ativos? Define se mostramos o "Modo avançado: Stripe"
    const { data: legacyStripeContracts } = await supabaseAdmin
        .from('student_contracts')
        .select('id')
        .eq('trainer_id', trainer.id)
        .in('status', ['active', 'past_due'])
        .or('billing_type.eq.stripe_auto,stripe_subscription_id.not.is.null')
        .limit(1)
    const hasStripeLegacyContracts = (legacyStripeContracts?.length ?? 0) > 0

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
        .select('id, title, price, interval, stripe_price_id, allow_pix, allow_credit_card, allow_boleto')
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
            recentTransactions={[
                ...(recentTransactions ?? []).map(tx => ({
                    ...tx,
                    studentName: tx.student_id ? studentNameMap[tx.student_id] || null : null,
                    paymentLinkUrl: null as string | null,
                    contractId: null as string | null,
                })),
                ...pendingActivityEntries,
            ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 15)}
            plansCount={plans?.length ?? 0}
            students={(students ?? []).map(s => ({ id: s.id, name: s.name, email: s.email }))}
            activePlans={(activePlans ?? []).map(p => ({
                id: p.id,
                title: p.title,
                price: p.price,
                interval: p.interval,
                stripe_price_id: p.stripe_price_id,
                allow_pix: p.allow_pix ?? undefined,
                allow_credit_card: p.allow_credit_card ?? undefined,
                allow_boleto: p.allow_boleto ?? undefined,
            }))}
            hasStripeConnect={connectStatus.connected && connectStatus.chargesEnabled}
            walletStatus={walletSummary.status}
            walletMode={walletSummary.mode}
            walletBalance={walletBalance}
            walletRejectionReason={walletSummary.rejectionReason ?? null}
            hasStripeLegacyContracts={hasStripeLegacyContracts}
        />
    )
}
