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

    // manual_one_off: marca pago, NÃO renova período
    if (contract.billing_type === 'manual_one_off') {
        const { error: updateError } = await supabaseAdmin
            .from('student_contracts')
            .update({ status: 'active' })
            .eq('id', contractId)

        if (updateError) {
            console.error('[markAsPaidCore] DB error:', updateError)
            return { error: 'Erro ao atualizar contrato' }
        }

        await supabaseAdmin.from('financial_transactions').insert({
            coach_id: trainerId,
            student_id: contract.student_id,
            amount_gross: contract.amount,
            amount_net: contract.amount,
            currency: 'brl',
            type: 'subscription',
            status: 'succeeded',
            stripe_payment_id: `manual_${crypto.randomUUID()}`,
            description: 'Pagamento avulso registrado',
        })

        await logContractEvent({
            studentId: contract.student_id,
            trainerId,
            contractId,
            eventType: 'payment_received',
            metadata: { amount: contract.amount, method: 'manual', billing_type: 'manual_one_off' },
        })

        return { success: true }
    }

    // manual_recurring: renova a partir do vencimento anterior (não de hoje)
    const currentEnd = contract.current_period_end
        ? new Date(contract.current_period_end)
        : new Date()

    const planInterval = (contract.trainer_plans as { interval: string } | null)?.interval || 'month'
    const newPeriodEnd = addInterval(currentEnd, planInterval)

    const { error: updateError } = await supabaseAdmin
        .from('student_contracts')
        .update({
            status: 'active',
            current_period_end: newPeriodEnd.toISOString(),
        })
        .eq('id', contractId)

    if (updateError) {
        console.error('[markAsPaidCore] DB error:', updateError)
        return { error: 'Erro ao atualizar contrato' }
    }

    await supabaseAdmin.from('financial_transactions').insert({
        coach_id: trainerId,
        student_id: contract.student_id,
        amount_gross: contract.amount,
        amount_net: contract.amount,
        currency: 'brl',
        type: 'subscription',
        status: 'succeeded',
        stripe_payment_id: `manual_${crypto.randomUUID()}`,
        description: 'Pagamento manual registrado',
    })

    await logContractEvent({
        studentId: contract.student_id,
        trainerId,
        contractId,
        eventType: 'payment_received',
        metadata: { amount: contract.amount, method: 'manual', billing_type: 'manual_recurring' },
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
