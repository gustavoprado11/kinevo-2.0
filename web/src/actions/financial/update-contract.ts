'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { stripe } from '@/lib/stripe'
import { revalidatePath } from 'next/cache'

interface UpdateContractInput {
    contractId: string
    planId?: string | null
    amount?: number
    blockOnFail?: boolean
    currentPeriodEnd?: string | null
    cancelAtPeriodEnd?: boolean
}

export async function updateContract(input: UpdateContractInput) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Não autorizado' }
    }

    const { data: trainer } = await supabase
        .from('trainers')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()

    if (!trainer) {
        return { error: 'Treinador não encontrado' }
    }

    // Fetch current contract
    const { data: contract } = await supabaseAdmin
        .from('student_contracts')
        .select('*')
        .eq('id', input.contractId)
        .single()

    if (!contract) {
        return { error: 'Contrato não encontrado' }
    }

    if (contract.trainer_id !== trainer.id) {
        return { error: 'Sem permissão' }
    }

    const isStripe = contract.billing_type === 'stripe_auto'
    const isCourtesy = contract.billing_type === 'courtesy'
    const payload: Record<string, unknown> = {}
    let newPlanTitle: string | null = null

    try {
        // Handle plan change
        if (input.planId !== undefined && input.planId !== contract.plan_id) {
            if (isStripe) {
                return { error: 'Para alterar o plano de uma assinatura Stripe, cancele e crie uma nova.' }
            }

            if (input.planId) {
                const { data: plan } = await supabaseAdmin
                    .from('trainer_plans')
                    .select('id, title, price, trainer_id')
                    .eq('id', input.planId)
                    .single()

                if (!plan || plan.trainer_id !== trainer.id) {
                    return { error: 'Plano não encontrado' }
                }

                payload.plan_id = plan.id
                newPlanTitle = plan.title

                // Auto-update amount for manual contracts
                if (!isCourtesy && input.amount === undefined) {
                    payload.amount = plan.price
                }
            } else {
                // Remove plan (only for courtesy)
                if (!isCourtesy) {
                    return { error: 'Plano é obrigatório para este tipo de cobrança' }
                }
                payload.plan_id = null
                newPlanTitle = 'Acesso Gratuito'
            }
        }

        // Handle amount change
        if (input.amount !== undefined && input.amount !== contract.amount) {
            if (isStripe) {
                return { error: 'O valor de assinaturas Stripe é gerido pelo Stripe.' }
            }
            if (isCourtesy) {
                payload.amount = 0
            } else {
                payload.amount = input.amount
            }
        }

        // Handle blockOnFail change
        if (input.blockOnFail !== undefined && input.blockOnFail !== contract.block_on_fail) {
            payload.block_on_fail = input.blockOnFail
        }

        // Handle currentPeriodEnd change
        if (input.currentPeriodEnd !== undefined && input.currentPeriodEnd !== contract.current_period_end) {
            if (isStripe) {
                return { error: 'O vencimento de assinaturas Stripe é gerido pelo Stripe.' }
            }
            if (isCourtesy) {
                return { error: 'Contratos de cortesia não têm vencimento.' }
            }
            payload.current_period_end = input.currentPeriodEnd
        }

        // Handle cancelAtPeriodEnd (Stripe only)
        if (input.cancelAtPeriodEnd !== undefined && input.cancelAtPeriodEnd !== contract.cancel_at_period_end) {
            if (!isStripe || !contract.stripe_subscription_id) {
                return { error: 'Essa opção é apenas para assinaturas Stripe.' }
            }

            const { data: settings } = await supabaseAdmin
                .from('payment_settings')
                .select('stripe_connect_id')
                .eq('user_id', trainer.id)
                .single()

            if (!settings?.stripe_connect_id) {
                return { error: 'Conta Stripe Connect não encontrada.' }
            }

            await stripe.subscriptions.update(
                contract.stripe_subscription_id,
                { cancel_at_period_end: input.cancelAtPeriodEnd },
                { stripeAccount: settings.stripe_connect_id }
            )

            payload.cancel_at_period_end = input.cancelAtPeriodEnd
        }

        // Nothing to update
        if (Object.keys(payload).length === 0) {
            return { success: true }
        }

        // Execute DB update
        const { error: updateError } = await supabaseAdmin
            .from('student_contracts')
            .update(payload)
            .eq('id', input.contractId)

        if (updateError) {
            console.error('[update-contract] DB error:', updateError)
            return { error: 'Erro ao atualizar contrato' }
        }

        // Update student plan name if plan changed
        if (newPlanTitle !== null) {
            await supabaseAdmin
                .from('students')
                .update({ current_plan_name: newPlanTitle })
                .eq('id', contract.student_id)
        }

        revalidatePath('/financial')
        revalidatePath('/financial/subscriptions')

        return { success: true }
    } catch (err) {
        console.error('[update-contract] Error:', err)
        return { error: 'Erro ao atualizar contrato' }
    }
}
