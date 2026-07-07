import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { stripe } from '@/lib/stripe'
import { logContractEvent } from '@/lib/contract-events'
import { consumeRateLimit } from '@/lib/rate-limit'
import { cancelAsaasRecurring } from '@/lib/asaas/cancel-recurring'
import { AsaasApiError, deactivatePaymentLink } from '@/lib/asaas'
import { getDecryptedApiKey } from '@/lib/asaas/wallet-service'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest) {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Token ausente' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
        return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }

    let body: { contractId?: string; cancelAtPeriodEnd?: boolean }
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
    }

    const { contractId, cancelAtPeriodEnd } = body
    if (!contractId) {
        return NextResponse.json({ error: 'contractId é obrigatório' }, { status: 400 })
    }
    if (!UUID_RE.test(contractId)) {
        return NextResponse.json({ error: 'Formato de ID inválido' }, { status: 400 })
    }

    // Get trainer
    const { data: trainer } = await supabaseAdmin
        .from('trainers')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()

    if (!trainer) {
        return NextResponse.json({ error: 'Treinador não encontrado' }, { status: 404 })
    }

    // Rate limit: 5/min, 20/day per trainer
    const rl = await consumeRateLimit(`financial:cancel:${trainer.id}`, { perMinute: 5, perDay: 20 })
    if (!rl.allowed) {
        return NextResponse.json({ error: rl.error }, { status: 429 })
    }

    // Fetch contract
    const { data: contract } = await supabaseAdmin
        .from('student_contracts')
        .select('*')
        .eq('id', contractId)
        .single()

    if (!contract) {
        return NextResponse.json({ error: 'Contrato não encontrado' }, { status: 404 })
    }

    if (contract.trainer_id !== trainer.id) {
        return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    // "Ao fim do período" só existe no Stripe — para Asaas o cancelamento é
    // imediato; aceitar o flag e ignorar enganaria o treinador/aluno.
    if (cancelAtPeriodEnd && contract.billing_type?.startsWith('asaas')) {
        return NextResponse.json(
            { error: 'Cancelamento ao fim do período não está disponível para cobranças Asaas — cancele sem agendar (imediato).' },
            { status: 400 },
        )
    }

    try {
        // Stripe subscription: cancel via Stripe API
        if (contract.billing_type === 'stripe_auto' && contract.stripe_subscription_id) {
            const { data: settings } = await supabaseAdmin
                .from('payment_settings')
                .select('stripe_connect_id')
                .eq('user_id', trainer.id)
                .single()

            if (settings?.stripe_connect_id) {
                if (cancelAtPeriodEnd) {
                    // Schedule cancellation at period end
                    await stripe.subscriptions.update(
                        contract.stripe_subscription_id,
                        { cancel_at_period_end: true },
                        { stripeAccount: settings.stripe_connect_id }
                    )

                    await supabaseAdmin
                        .from('student_contracts')
                        .update({
                            cancel_at_period_end: true,
                            canceled_by: 'trainer',
                            canceled_at: new Date().toISOString(),
                        })
                        .eq('id', contractId)

                    await logContractEvent({
                        studentId: contract.student_id,
                        trainerId: trainer.id,
                        contractId,
                        eventType: 'contract_canceled',
                        metadata: { canceled_by: 'trainer', scheduled: true },
                    })

                    return NextResponse.json({ success: true, scheduledCancellation: true })
                } else {
                    // Immediate cancellation via Stripe
                    await stripe.subscriptions.cancel(
                        contract.stripe_subscription_id,
                        { stripeAccount: settings.stripe_connect_id }
                    )
                }
            }
        }

        // Asaas recorrente: cancela a assinatura na Asaas ANTES de marcar local,
        // pra não deixar "cancelado aqui mas cobrando lá".
        if (contract.billing_type === 'asaas_auto_recurring') {
            try {
                await cancelAsaasRecurring({
                    trainerId: trainer.id,
                    billingType: contract.billing_type,
                    subscriptionId: contract.asaas_subscription_id,
                })
            } catch (err) {
                console.error('[cancel-contract] Asaas cancel failed:', err)
                return NextResponse.json(
                    { error: 'Não foi possível cancelar a assinatura na Asaas. Tente novamente em instantes.' },
                    { status: 502 },
                )
            }
        }

        // Payment Link vivo de contrato Asaas: desativa na Asaas (espelho do
        // cancelContractCore). Um link RECURRENT não pago que sobrevive ao
        // cancelamento vira assinatura órfã se o aluno pagar depois.
        if (contract.billing_type?.startsWith('asaas') && contract.asaas_payment_link_id) {
            try {
                const apiKey = await getDecryptedApiKey(trainer.id)
                await deactivatePaymentLink(apiKey, contract.asaas_payment_link_id)
            } catch (err) {
                if (err instanceof AsaasApiError && err.status === 404) {
                    // link já removido/desativado — ok
                } else if (
                    contract.billing_type === 'asaas_auto_recurring' &&
                    !contract.asaas_subscription_id
                ) {
                    console.error('[cancel-contract] deactivate link failed:', err)
                    return NextResponse.json(
                        { error: 'Não foi possível desativar o link de pagamento na Asaas. Tente novamente.' },
                        { status: 502 },
                    )
                } else {
                    console.error('[cancel-contract] deactivate link failed (best-effort):', err)
                }
            }
        }

        // Immediate cancel: update DB
        const { error: updateError } = await supabaseAdmin
            .from('student_contracts')
            .update({
                status: 'canceled',
                cancel_at_period_end: false,
                canceled_by: 'trainer',
                canceled_at: new Date().toISOString(),
            })
            .eq('id', contractId)

        if (updateError) {
            return NextResponse.json({ error: 'Erro ao cancelar contrato' }, { status: 500 })
        }

        await logContractEvent({
            studentId: contract.student_id,
            trainerId: trainer.id,
            contractId,
            eventType: 'contract_canceled',
            metadata: { canceled_by: 'trainer' },
        })

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('[cancel-contract] Error:', err)
        return NextResponse.json({ error: 'Erro ao cancelar contrato' }, { status: 500 })
    }
}
