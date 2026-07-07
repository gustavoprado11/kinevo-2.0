/**
 * Financeiro / contratos — núcleo compartilhado (server-only, SEM 'use server').
 *
 * Cada função recebe um client Supabase admin + o trainerId JÁ RESOLVIDO e
 * executa toda a lógica (incluindo Stripe/Asaas e contract_events), escopando
 * ownership por trainerId explícito. As actions ('use server') viram wrappers
 * de auth + revalidatePath; as tools MCP chamam o core direto com o admin
 * client + trainerId do token. Paridade total, sem duplicar lógica.
 *
 * ⚠️ Operações sensíveis (dinheiro/cobrança). As tools MCP aplicam um gate
 * confirm=true (preview antes de executar). Os cores NÃO confirmam — quem chama
 * é responsável por confirmar.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@kinevo/shared/types/database'
import { stripe } from '@/lib/stripe'
import { logContractEvent } from '@/lib/contract-events'
import { cancelAsaasRecurring } from '@/lib/asaas/cancel-recurring'
// Imports diretos (não o barrel @/lib/asaas): o barrel puxa webhook-setup →
// supabase-admin, que explode fora do runtime server (ex.: vitest sem env).
import { AsaasApiError } from '@/lib/asaas/client'
import { deactivatePaymentLink } from '@/lib/asaas/payment-links'
import { getDecryptedApiKey } from '@/lib/asaas/wallet-service'

type DBClient = SupabaseClient<Database>

function addInterval(date: Date, interval: string): Date {
    const result = new Date(date)
    switch (interval) {
        case 'month':
            result.setMonth(result.getMonth() + 1)
            break
        case 'quarter':
            result.setMonth(result.getMonth() + 3)
            break
        case 'year':
            result.setFullYear(result.getFullYear() + 1)
            break
        default:
            result.setMonth(result.getMonth() + 1)
    }
    return result
}

// ----------------------------------------------------------------------------
// create contract (manual: courtesy / one_off / recurring)
// ----------------------------------------------------------------------------
export interface CreateContractInput {
    studentId: string
    planId: string | null
    billingType: 'manual_recurring' | 'manual_one_off' | 'courtesy'
    blockOnFail: boolean
}

export async function createContractCore(
    supabaseAdmin: DBClient,
    trainerId: string,
    input: CreateContractInput,
): Promise<{ success?: boolean; error?: string; contractId?: string }> {
    const { data: student } = await supabaseAdmin
        .from('students')
        .select('id, coach_id, name')
        .eq('id', input.studentId)
        .single()

    if (!student) return { error: 'Aluno não encontrado' }
    if (student.coach_id !== trainerId) return { error: 'Este aluno não pertence a você' }

    let plan: { id: string; title: string; price: number; interval: string | null; trainer_id: string } | null = null

    if (input.planId) {
        const { data: planData } = await supabaseAdmin
            .from('trainer_plans')
            .select('id, title, price, interval, trainer_id')
            .eq('id', input.planId)
            .single()

        if (!planData) return { error: 'Plano não encontrado' }
        if (planData.trainer_id !== trainerId) return { error: 'Este plano não pertence a você' }
        plan = planData
    } else if (input.billingType !== 'courtesy') {
        return { error: 'Selecione um plano.' }
    }

    // Cancela qualquer contrato ativo/pendente existente do aluno.
    await supabaseAdmin
        .from('student_contracts')
        .update({ status: 'canceled' })
        .eq('student_id', input.studentId)
        .eq('trainer_id', trainerId)
        .in('status', ['active', 'past_due', 'pending'])

    const now = new Date()
    let contractData: Database['public']['Tables']['student_contracts']['Insert']

    if (input.billingType === 'courtesy') {
        contractData = {
            student_id: input.studentId,
            trainer_id: trainerId,
            plan_id: input.planId,
            amount: 0,
            status: 'active',
            billing_type: 'courtesy',
            block_on_fail: false,
            start_date: now.toISOString(),
            current_period_end: null,
        }
    } else if (input.billingType === 'manual_one_off') {
        const endDate = addInterval(now, plan!.interval || 'month')
        contractData = {
            student_id: input.studentId,
            trainer_id: trainerId,
            plan_id: input.planId,
            amount: plan!.price,
            status: 'active',
            billing_type: 'manual_one_off',
            block_on_fail: input.blockOnFail,
            start_date: now.toISOString(),
            end_date: endDate.toISOString(),
            current_period_end: endDate.toISOString(),
        }
    } else {
        const periodEnd = addInterval(now, plan!.interval || 'month')
        contractData = {
            student_id: input.studentId,
            trainer_id: trainerId,
            plan_id: input.planId,
            amount: plan!.price,
            status: 'active',
            billing_type: 'manual_recurring',
            block_on_fail: input.blockOnFail,
            start_date: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
        }
    }

    const { data: newContract, error: insertError } = await supabaseAdmin
        .from('student_contracts')
        .insert(contractData)
        .select('id')
        .single()

    if (insertError || !newContract) {
        console.error('[createContractCore] DB error:', insertError)
        return { error: 'Erro ao criar contrato' }
    }

    await logContractEvent({
        studentId: input.studentId,
        trainerId,
        contractId: newContract.id,
        eventType: 'contract_created',
        metadata: {
            billing_type: input.billingType,
            amount: plan?.price ?? 0,
            plan_title: plan?.title ?? 'Acesso Gratuito',
        },
    })

    return { success: true, contractId: newContract.id }
}

// ----------------------------------------------------------------------------
// mark as paid (manual payment)
// ----------------------------------------------------------------------------
export async function markAsPaidCore(
    supabaseAdmin: DBClient,
    trainerId: string,
    { contractId }: { contractId: string },
): Promise<{ success?: boolean; error?: string }> {
    const { data: contract } = await supabaseAdmin
        .from('student_contracts')
        .select('*, trainer_plans:plan_id(interval)')
        .eq('id', contractId)
        .single()

    if (!contract) return { error: 'Contrato não encontrado' }
    if (contract.trainer_id !== trainerId) return { error: 'Sem permissão' }

    // Débito automático Asaas: marcar pago aqui só registra receita local —
    // NÃO pausa a cobrança do cartão na Asaas → o aluno seria cobrado em dobro.
    if (contract.billing_type === 'asaas_auto_recurring') {
        return {
            error:
                'Este contrato tem débito automático na Asaas — registrar pagamento manual não pausa a cobrança do cartão e o aluno seria cobrado em dobro. ' +
                'Cancele a assinatura Asaas (ou migre para cobrança manual) antes de registrar pagamentos por fora.',
        }
    }

    // one_off NÃO renova período; qualquer outro tipo manual (recurring) renova.
    const isRecurring = contract.billing_type !== 'manual_one_off'

    // Período sendo liquidado, capturado ANTES de qualquer avanço — é o que
    // amarra a idempotência aos DOIS efeitos (linha duplicada + avanço duplo).
    const currentEnd = contract.current_period_end
        ? new Date(contract.current_period_end)
        : new Date()

    // Chave de idempotência DETERMINÍSTICA (substitui o `manual_<uuid>` aleatório,
    // que nunca colidia → não dedupava nada):
    //   • avulso (one_off): liquidado uma vez → chave estável.
    //   • recorrente: por período liquidado (currentEnd, antes do avanço).
    const idemKey = isRecurring
        ? `manual_${contractId}_${currentEnd.toISOString()}`
        : `manual_${contractId}_oneoff`

    // INSERT-FIRST como lock de idempotência. A unique parcial em
    // stripe_payment_id (migration 220) garante que só UMA chamada grava a
    // transação dessa chave; o avanço de período abaixo só roda pra quem GANHOU
    // o insert — então a dupla-chamada não duplica a linha NEM adianta o período.
    const { error: insertError } = await supabaseAdmin
        .from('financial_transactions')
        .insert({
            coach_id: trainerId,
            student_id: contract.student_id,
            amount_gross: contract.amount,
            amount_net: contract.amount,
            currency: 'brl',
            type: 'subscription',
            status: 'succeeded',
            stripe_payment_id: idemKey,
            description: isRecurring ? 'Pagamento manual registrado' : 'Pagamento avulso registrado',
        })
    if (insertError) {
        // 23505 = unique_violation → esse período já foi liquidado (dupla-chamada)
        // → no-op idempotente: não grava de novo e NÃO avança o período.
        if (insertError.code === '23505') return { success: true }
        console.error('[markAsPaidCore] DB error (insert):', insertError)
        return { error: 'Erro ao registrar pagamento' }
    }

    // Só a 1ª chamada (quem ganhou o insert) chega aqui. Ativa e — no recorrente
    // — avança o período a partir do vencimento ANTERIOR (não de hoje).
    const planInterval = (contract.trainer_plans as { interval: string } | null)?.interval || 'month'
    const { error: updateError } = await supabaseAdmin
        .from('student_contracts')
        .update(
            isRecurring
                ? { status: 'active', current_period_end: addInterval(currentEnd, planInterval).toISOString() }
                : { status: 'active' },
        )
        .eq('id', contractId)

    if (updateError) {
        console.error('[markAsPaidCore] DB error (update):', updateError)
        return { error: 'Erro ao atualizar contrato' }
    }

    await logContractEvent({
        studentId: contract.student_id,
        trainerId,
        contractId,
        eventType: 'payment_received',
        metadata: { amount: contract.amount, method: 'manual', billing_type: contract.billing_type },
    })

    return { success: true }
}

// ----------------------------------------------------------------------------
// cancel contract (cancela Stripe/Asaas + estado local)
// ----------------------------------------------------------------------------
export async function cancelContractCore(
    supabaseAdmin: DBClient,
    trainerId: string,
    { contractId, cancelAtPeriodEnd }: { contractId: string; cancelAtPeriodEnd?: boolean },
): Promise<{ success?: boolean; error?: string; scheduledCancellation?: boolean }> {
    const { data: contract } = await supabaseAdmin
        .from('student_contracts')
        .select('*')
        .eq('id', contractId)
        .single()

    if (!contract) return { error: 'Contrato não encontrado' }
    if (contract.trainer_id !== trainerId) return { error: 'Sem permissão' }

    // "Ao fim do período" só existe no Stripe. Para Asaas o cancelamento é
    // IMEDIATO — aceitar o flag e ignorar (comportamento antigo) fazia o
    // chamador prometer "mantém acesso até lá" e o aluno perder acesso agora.
    if (cancelAtPeriodEnd && contract.billing_type?.startsWith('asaas')) {
        return {
            error:
                'Cancelamento ao fim do período não está disponível para cobranças Asaas — o cancelamento é imediato. ' +
                'Chame novamente sem agendar (ou aguarde o fim do ciclo para cancelar).',
        }
    }

    try {
        if (contract.billing_type === 'stripe_auto' && contract.stripe_subscription_id) {
            const { data: settings } = await supabaseAdmin
                .from('payment_settings')
                .select('stripe_connect_id')
                .eq('user_id', trainerId)
                .single()

            if (settings?.stripe_connect_id) {
                if (cancelAtPeriodEnd) {
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
                        trainerId,
                        contractId,
                        eventType: 'contract_canceled',
                        metadata: { canceled_by: 'trainer', scheduled: true },
                    })

                    return { success: true, scheduledCancellation: true }
                } else {
                    await stripe.subscriptions.cancel(
                        contract.stripe_subscription_id,
                        { stripeAccount: settings.stripe_connect_id }
                    )
                }
            }
        }

        if (contract.billing_type === 'asaas_auto_recurring') {
            try {
                await cancelAsaasRecurring({
                    trainerId,
                    billingType: contract.billing_type,
                    subscriptionId: contract.asaas_subscription_id,
                })
            } catch (err) {
                console.error('[cancelContractCore] Asaas cancel failed:', err)
                return { error: 'Não foi possível cancelar a assinatura na Asaas. Tente novamente.' }
            }
        }

        // Payment Link vivo de contrato Asaas: desativa na Asaas. Sem isto, um
        // link RECURRENT ainda não pago sobrevive ao cancelamento — se o aluno
        // pagar depois, a Asaas cria uma assinatura órfã que cobra todo mês
        // contra um contrato cancelado (e nenhuma superfície a cancela).
        if (contract.billing_type?.startsWith('asaas') && contract.asaas_payment_link_id) {
            try {
                const apiKey = await getDecryptedApiKey(trainerId)
                await deactivatePaymentLink(apiKey, contract.asaas_payment_link_id)
            } catch (err) {
                if (err instanceof AsaasApiError && err.status === 404) {
                    // link já removido/desativado — nada a fazer
                } else if (
                    contract.billing_type === 'asaas_auto_recurring' &&
                    !contract.asaas_subscription_id
                ) {
                    // Caso perigoso: recorrente AINDA sem assinatura (link é o único
                    // ponto de cobrança futuro). Não cancela local sem matar o link.
                    console.error('[cancelContractCore] deactivate link failed:', err)
                    return { error: 'Não foi possível desativar o link de pagamento na Asaas. Tente novamente.' }
                } else {
                    // One-off / recorrente já assinado: best-effort, não trava o cancel.
                    console.error('[cancelContractCore] deactivate link failed (best-effort):', err)
                }
            }
        }

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
            console.error('[cancelContractCore] DB error:', updateError)
            return { error: 'Erro ao cancelar contrato' }
        }

        await logContractEvent({
            studentId: contract.student_id,
            trainerId,
            contractId,
            eventType: 'contract_canceled',
            metadata: { canceled_by: 'trainer' },
        })

        return { success: true }
    } catch (err) {
        console.error('[cancelContractCore] Error:', err)
        return { error: 'Erro ao cancelar contrato' }
    }
}
