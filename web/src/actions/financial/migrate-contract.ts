'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { stripe } from '@/lib/stripe'
import { logContractEvent } from '@/lib/contract-events'
import { generateCheckoutCore } from '@/lib/stripe/generate-checkout'
import { revalidatePath } from 'next/cache'

interface MigrateContractInput {
    studentId: string
    fromContractId: string
    toBillingType: 'stripe_auto' | 'manual_recurring' | 'manual_one_off' | 'courtesy'
    planId?: string
    amount?: number
    blockOnFail?: boolean
    firstDueDate?: string // ISO string
}

interface MigrateContractResult {
    success: boolean
    error?: string
    newContractId?: string
    checkoutUrl?: string
}

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

export async function migrateContract(input: MigrateContractInput): Promise<MigrateContractResult> {
    // 1. Auth
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { success: false, error: 'Não autorizado' }
    }

    const { data: trainer } = await supabase
        .from('trainers')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()

    if (!trainer) {
        return { success: false, error: 'Treinador não encontrado' }
    }

    // 2. Fetch current contract + validate ownership
    const { data: currentContract } = await supabaseAdmin
        .from('student_contracts')
        .select('*')
        .eq('id', input.fromContractId)
        .eq('trainer_id', trainer.id)
        .single()

    if (!currentContract) {
        return { success: false, error: 'Contrato não encontrado' }
    }

    if (!['active', 'past_due'].includes(currentContract.status)) {
        return { success: false, error: 'Só é possível migrar contratos ativos' }
    }

    // 3. If current contract is Stripe → cancel subscription first
    if (currentContract.billing_type === 'stripe_auto' && currentContract.stripe_subscription_id) {
        try {
            const { data: paymentSettings } = await supabaseAdmin
                .from('payment_settings')
                .select('stripe_connect_id')
                .eq('user_id', trainer.id)
                .single()

            if (!paymentSettings?.stripe_connect_id) {
                return { success: false, error: 'Conta Stripe não encontrada' }
            }

            // Cancel immediately on Stripe (not cancel_at_period_end)
            await stripe.subscriptions.cancel(
                currentContract.stripe_subscription_id,
                { stripeAccount: paymentSettings.stripe_connect_id }
            )
        } catch (stripeError) {
            console.error('[migrate-contract] Stripe cancellation failed:', stripeError)
            return { success: false, error: 'Falha ao cancelar assinatura no Stripe. Tente novamente.' }
        }
    }

    // 4. Cancel old contract in DB
    const { error: cancelError } = await supabaseAdmin
        .from('student_contracts')
        .update({
            status: 'canceled',
            canceled_by: 'trainer',
            canceled_at: new Date().toISOString(),
        })
        .eq('id', input.fromContractId)

    if (cancelError) {
        console.error('[migrate-contract] Failed to cancel old contract:', cancelError)
        await logContractEvent({
            studentId: input.studentId,
            trainerId: trainer.id,
            contractId: input.fromContractId,
            eventType: 'contract_canceled',
            metadata: { canceled_by: 'system', reason: 'migration_partial_failure', error: cancelError.message },
        })
        return { success: false, error: 'Falha ao atualizar banco. A assinatura Stripe foi cancelada. Crie um novo contrato manualmente.' }
    }

    // 5. Create new contract based on target type
    let newContractId: string | undefined
    let checkoutUrl: string | undefined

    if (input.toBillingType === 'courtesy') {
        // Courtesy = no new contract, just update student status
        await supabaseAdmin
            .from('students')
            .update({
                plan_status: 'active',
                pending_plan_id: null,
                current_plan_name: 'Acesso Gratuito',
            })
            .eq('id', input.studentId)
    } else if (input.toBillingType === 'stripe_auto') {
        // Stripe: generate checkout link using extracted core
        if (!input.planId) {
            return { success: false, error: 'Selecione um plano para cobrança via Stripe.' }
        }

        const { data: paymentSettings } = await supabaseAdmin
            .from('payment_settings')
            .select('stripe_connect_id, charges_enabled')
            .eq('user_id', trainer.id)
            .single()

        if (!paymentSettings?.stripe_connect_id || !paymentSettings.charges_enabled) {
            return { success: false, error: 'Conta Stripe não conectada ou não ativa' }
        }

        try {
            const result = await generateCheckoutCore({
                studentId: input.studentId,
                planId: input.planId,
                trainerId: trainer.id,
                stripeConnectId: paymentSettings.stripe_connect_id,
            })
            newContractId = result.contractId
            checkoutUrl = result.url
        } catch (err) {
            console.error('[migrate-contract] Failed to generate checkout:', err)
            await logContractEvent({
                studentId: input.studentId,
                trainerId: trainer.id,
                eventType: 'contract_canceled',
                metadata: { canceled_by: 'system', reason: 'migration_checkout_failed' },
            })
            return { success: false, error: 'Contrato anterior cancelado, mas falha ao gerar link Stripe. Crie a cobrança manualmente.' }
        }
    } else {
        // Manual: create contract directly
        if (!input.planId && !input.amount) {
            return { success: false, error: 'Selecione um plano ou informe um valor.' }
        }

        // Fetch plan for interval if planId provided
        let planTitle: string | null = null
        let planInterval = 'month'
        let amount = input.amount ?? 0

        if (input.planId) {
            const { data: plan } = await supabaseAdmin
                .from('trainer_plans')
                .select('id, title, price, interval')
                .eq('id', input.planId)
                .single()

            if (plan) {
                planTitle = plan.title
                planInterval = plan.interval || 'month'
                amount = plan.price
            }
        }

        const now = new Date()
        const periodEnd = input.firstDueDate
            ? new Date(input.firstDueDate)
            : addInterval(now, planInterval)

        const contractData: Record<string, unknown> = {
            student_id: input.studentId,
            trainer_id: trainer.id,
            plan_id: input.planId || null,
            billing_type: input.toBillingType,
            status: 'active',
            amount,
            block_on_fail: input.blockOnFail ?? false,
            start_date: now.toISOString(),
            current_period_end: input.toBillingType === 'manual_one_off'
                ? periodEnd.toISOString()
                : periodEnd.toISOString(),
        }

        if (input.toBillingType === 'manual_one_off') {
            contractData.end_date = periodEnd.toISOString()
        }

        const { data: newContract, error: createError } = await supabaseAdmin
            .from('student_contracts')
            .insert(contractData)
            .select('id')
            .single()

        if (createError || !newContract) {
            console.error('[migrate-contract] Failed to create new contract:', createError)
            await logContractEvent({
                studentId: input.studentId,
                trainerId: trainer.id,
                eventType: 'contract_canceled',
                metadata: { canceled_by: 'system', reason: 'migration_create_failed' },
            })
            return { success: false, error: 'Contrato anterior cancelado, mas falha ao criar novo. Crie manualmente.' }
        }

        newContractId = newContract.id

        // Update student status
        await supabaseAdmin
            .from('students')
            .update({
                plan_status: 'active',
                pending_plan_id: null,
                current_plan_name: planTitle ?? 'Manual',
            })
            .eq('id', input.studentId)
    }

    // 6. Log migration event
    await logContractEvent({
        studentId: input.studentId,
        trainerId: trainer.id,
        contractId: newContractId ?? null,
        eventType: 'contract_migrated',
        metadata: {
            from: currentContract.billing_type,
            to: input.toBillingType,
            from_contract_id: input.fromContractId,
        },
    })

    // 7. Revalidate
    revalidatePath('/financial/subscriptions')
    revalidatePath('/financial')

    return { success: true, newContractId, checkoutUrl }
}
