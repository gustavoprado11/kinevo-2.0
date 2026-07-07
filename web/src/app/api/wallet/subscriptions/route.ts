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
    deactivatePaymentLink,
    getKinevoWalletId,
    getPaymentLink,
    type AsaasBillingType,
    type AsaasSplit,
    type AsaasSubscriptionCycle,
} from '@/lib/asaas'
import { getDecryptedApiKey, requireTrainer, WalletAuthError } from '@/lib/asaas/wallet-service'
import { logContractEvent } from '@/lib/contract-events'
import { sendStudentPush } from '@/lib/push-notifications'

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

// Recorrência é SÓ no cartão de crédito — único método com débito automático.
// PIX/boleto não auto-debitam (exigiriam o aluno pagar todo ciclo), então
// ficam restritos a cobrança avulsa. Decisão de produto (2026-05).
const RECURRING_BILLING_TYPE: AsaasBillingType = 'CREDIT_CARD'

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
        // Recorrência sempre no cartão (auto-débito). PIX/boleto não recorrem.
        const billingType = RECURRING_BILLING_TYPE

        // 3. apiKey da subconta
        const apiKey = await getDecryptedApiKey(trainer.id)

        // 4. Split (take rate Kinevo)
        const kinevoWalletId = getKinevoWalletId()
        const takeRatePct = Number(process.env.KINEVO_TAKE_RATE_PCT ?? '0')
        if (!(takeRatePct > 0) && process.env.NODE_ENV === 'production') {
            // Env ausente/inválida zeraria a taxa da plataforma em silêncio.
            console.error('[wallet/subscriptions] KINEVO_TAKE_RATE_PCT ausente ou inválida — assinatura criada SEM split Kinevo')
        }
        if (takeRatePct > 0 && !kinevoWalletId) {
            // Pct configurado mas ASAAS_KINEVO_WALLET_ID ausente: o split cai
            // SEM nenhum log — pior que taxa zero, porque parece ligada.
            console.error('[wallet/subscriptions] KINEVO_TAKE_RATE_PCT setado mas ASAAS_KINEVO_WALLET_ID ausente — split descartado')
        }
        const split: AsaasSplit[] | undefined =
            kinevoWalletId && takeRatePct > 0
                ? [{ walletId: kinevoWalletId, percentualValue: takeRatePct }]
                : undefined

        // 4b. Anti-duplicidade (P10): só faz sentido UMA assinatura pendente
        // por aluno. Mesmo plano → devolve o link existente (duplo-submit);
        // plano diferente → desativa o link antigo e aposenta o contrato
        // pendente antes de criar o novo (dois links RECURRENT pagáveis =
        // aluno pode assinar o plano errado/os dois).
        {
            const { data: dup } = await supabaseAdmin
                .from('student_contracts')
                .select('id, plan_id, asaas_payment_link_id')
                .eq('student_id', student.id)
                .eq('trainer_id', trainer.id)
                .eq('billing_type', 'asaas_auto_recurring')
                .eq('status', 'pending_payment')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()

            if (dup) {
                if (dup.plan_id === plan.id && dup.asaas_payment_link_id) {
                    try {
                        const existing = await getPaymentLink(apiKey, dup.asaas_payment_link_id)
                        if (existing.active !== false && !existing.deleted) {
                            return NextResponse.json({
                                contractId: dup.id,
                                paymentLinkId: existing.id,
                                url: existing.url,
                                invoiceUrl: existing.url,
                                cycle,
                                value: existing.value,
                                billingType: existing.billingType,
                                reused: true,
                            }, { status: 200 })
                        }
                    } catch (err) {
                        if (!(err instanceof AsaasApiError && err.status === 404)) throw err
                    }
                }
                // Plano diferente ou link morto: desativa o link antigo (best-
                // effort) e aposenta o contrato pendente.
                if (dup.asaas_payment_link_id) {
                    try {
                        await deactivatePaymentLink(apiKey, dup.asaas_payment_link_id)
                    } catch (err) {
                        if (!(err instanceof AsaasApiError && err.status === 404)) {
                            console.error('[wallet/subscriptions] deactivate old link failed:', err)
                        }
                    }
                }
                await supabaseAdmin
                    .from('student_contracts')
                    .update({ status: 'canceled', canceled_by: 'trainer', canceled_at: new Date().toISOString() })
                    .eq('id', dup.id)
                    .eq('status', 'pending_payment')
            }
        }

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
                    // Asaas cuida da régua da recorrência (recibos/falha de cartão).
                    notificationEnabled: true,
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

        // 9. Avisa o ALUNO in-app (P13) — best-effort; type roteia p/ /payment.
        await sendStudentPush({
            studentId: student.id,
            title: 'Nova assinatura para ativar',
            body: `${plan.title} — ${Number(plan.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}. Toque para pagar pelo app.`,
            data: { type: 'charge_created' },
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
