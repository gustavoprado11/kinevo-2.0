// ============================================================================
// POST /api/wallet/subscriptions
// ============================================================================
// Cria uma assinatura recorrente via Asaas Payment Link (chargeType=RECURRENT).
// O aluno abre o link, preenche CPF + cartão (ou PIX por cobrança), e a
// Asaas gera a subscription internamente. Webhook PAYMENT_RECEIVED ativa o
// contrato.
//
// Body:
// {
//   "studentId":   "<uuid>",
//   "planId":      "<uuid>",
//   "billingType": "UNDEFINED" | "PIX" | "CREDIT_CARD" | "BOLETO"  // opcional
//   "nextDueDate": "2026-06-01"        // opcional — vira dueDateLimitDays
// }
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
    AsaasApiError,
    createPaymentLink,
    getKinevoWalletId,
    type AsaasBillingType,
    type AsaasSplit,
    type AsaasSubscriptionCycle,
} from '@/lib/asaas'
import { getDecryptedApiKey, requireTrainer, WalletAuthError } from '@/lib/asaas/wallet-service'
import { logContractEvent } from '@/lib/contract-events'

interface SubBody {
    studentId?: string
    planId?: string
    billingType?: AsaasBillingType
    nextDueDate?: string
}

function planIntervalToCycle(interval: string | null | undefined, count?: number | null): AsaasSubscriptionCycle {
    const i = (interval ?? 'month').toLowerCase()
    if (i.startsWith('quart')) return 'QUARTERLY'
    if (i.startsWith('year') || i === 'annual') return 'YEARLY'
    if (i.startsWith('semi') || (i === 'month' && count === 6)) return 'SEMIANNUALLY'
    if (i.startsWith('bi') || (i === 'month' && count === 2)) return 'BIWEEKLY'
    return 'MONTHLY'
}

interface PlanCols {
    allow_pix?: boolean | null
    allow_credit_card?: boolean | null
    allow_boleto?: boolean | null
}

function deriveBillingType(plan: PlanCols): AsaasBillingType {
    const allowed: AsaasBillingType[] = []
    if (plan.allow_pix ?? true) allowed.push('PIX')
    if (plan.allow_credit_card ?? true) allowed.push('CREDIT_CARD')
    if (plan.allow_boleto ?? false) allowed.push('BOLETO')
    return allowed.length === 1 ? allowed[0] : 'UNDEFINED'
}

function dueDateToLimitDays(dueDate: string): number {
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    const target = new Date(`${dueDate}T00:00:00Z`)
    const diff = Math.round((target.getTime() - today.getTime()) / 86_400_000)
    return Math.min(60, Math.max(1, diff))
}

export async function POST(request: NextRequest) {
    let body: SubBody
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
    }
    if (!body.studentId) return NextResponse.json({ error: 'studentId é obrigatório' }, { status: 400 })
    if (!body.planId) return NextResponse.json({ error: 'planId é obrigatório' }, { status: 400 })

    try {
        const trainer = await requireTrainer(request)

        // 1. Aluno pertence ao trainer?
        const { data: student } = await supabaseAdmin
            .from('students')
            .select('id, name, coach_id')
            .eq('id', body.studentId)
            .single()
        if (!student) return NextResponse.json({ error: 'Aluno não encontrado' }, { status: 404 })
        if (student.coach_id !== trainer.id) {
            return NextResponse.json({ error: 'Aluno não pertence a você' }, { status: 403 })
        }

        // 2. Plano existe e pertence ao trainer?
        const { data: plan } = await supabaseAdmin
            .from('trainer_plans')
            .select('id, title, description, price, interval, interval_count, allow_pix, allow_credit_card, allow_boleto')
            .eq('id', body.planId)
            .eq('trainer_id', trainer.id)
            .maybeSingle()
        if (!plan) return NextResponse.json({ error: 'Plano não encontrado' }, { status: 404 })

        const cycle = planIntervalToCycle(plan.interval, plan.interval_count)
        const nextDueDate = body.nextDueDate ?? new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10)
        const dueDateLimitDays = dueDateToLimitDays(nextDueDate)
        const billingType = body.billingType ?? deriveBillingType(plan)

        // 3. apiKey da subconta
        const apiKey = await getDecryptedApiKey(trainer.id)

        // 4. Split (take rate Kinevo)
        const kinevoWalletId = getKinevoWalletId()
        const takeRatePct = Number(process.env.KINEVO_TAKE_RATE_PCT ?? '0')
        const split: AsaasSplit[] | undefined =
            kinevoWalletId && takeRatePct > 0
                ? [{ walletId: kinevoWalletId, percentualValue: takeRatePct }]
                : undefined

        // 5. Cria contrato local (status=pending_payment)
        const { data: contract, error: contractErr } = await supabaseAdmin
            .from('student_contracts')
            .insert({
                student_id: student.id,
                trainer_id: trainer.id,
                plan_id: plan.id,
                amount: plan.price,
                provider: 'asaas',
                billing_type: 'asaas_auto_recurring',
                status: 'pending_payment',
                start_date: nextDueDate,
            })
            .select('id')
            .single()
        if (contractErr || !contract) {
            console.error('[wallet/subscriptions] contract insert failed', contractErr)
            return NextResponse.json({ error: 'Falha ao criar contrato local' }, { status: 500 })
        }

        // 6. Cria Payment Link recorrente
        let link
        try {
            link = await createPaymentLink(
                apiKey,
                {
                    name: `${plan.title} — ${student.name ?? 'Aluno'}`,
                    description: `${plan.title} (${cycle.toLowerCase()})`,
                    value: Number(plan.price),
                    billingType,
                    chargeType: 'RECURRENT',
                    subscriptionCycle: cycle,
                    dueDateLimitDays,
                    notificationEnabled: false,
                    split,
                },
                contract.id,
            )
        } catch (err) {
            // Rollback contrato local se Asaas falhar
            await supabaseAdmin.from('student_contracts').delete().eq('id', contract.id)
            throw err
        }

        // 7. Atualiza contrato com o link
        await supabaseAdmin
            .from('student_contracts')
            .update({ asaas_payment_link_id: link.id })
            .eq('id', contract.id)

        // 8. Histórico do contrato
        await logContractEvent({
            studentId: student.id,
            trainerId: trainer.id,
            contractId: contract.id,
            eventType: 'contract_created',
            metadata: { provider: 'asaas', amount: Number(plan.price), billingType, cycle, kind: 'recurring' },
        })

        return NextResponse.json({
            contractId: contract.id,
            paymentLinkId: link.id,
            url: link.url,
            invoiceUrl: link.url,        // alias pra UI antiga
            cycle,
            value: link.value,
            billingType: link.billingType,
        }, { status: 201 })
    } catch (err) {
        if (err instanceof WalletAuthError) {
            return NextResponse.json({ error: err.message }, { status: err.status })
        }
        if (err instanceof AsaasApiError) {
            console.error('[wallet/subscriptions] Asaas error', err.status, err.body)
            return NextResponse.json(
                { error: err.message, asaasStatus: err.status },
                { status: err.status === 400 ? 400 : 502 }
            )
        }
        console.error('[wallet/subscriptions] Error:', err)
        const message = err instanceof Error ? err.message : 'Erro ao criar assinatura'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
