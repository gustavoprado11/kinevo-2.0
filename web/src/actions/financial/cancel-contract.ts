'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { stripe } from '@/lib/stripe'
import { revalidatePath } from 'next/cache'

export async function cancelContract({ contractId }: { contractId: string }) {
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

    // Fetch contract and validate ownership
    const { data: contract } = await supabaseAdmin
        .from('student_contracts')
        .select('*')
        .eq('id', contractId)
        .single()

    if (!contract) {
        return { error: 'Contrato não encontrado' }
    }

    if (contract.trainer_id !== trainer.id) {
        return { error: 'Sem permissão' }
    }

    try {
        // If stripe_auto with an active subscription, cancel on Stripe
        if (contract.billing_type === 'stripe_auto' && contract.stripe_subscription_id) {
            const { data: settings } = await supabaseAdmin
                .from('payment_settings')
                .select('stripe_connect_id')
                .eq('user_id', trainer.id)
                .single()

            if (settings?.stripe_connect_id) {
                await stripe.subscriptions.cancel(
                    contract.stripe_subscription_id,
                    { stripeAccount: settings.stripe_connect_id }
                )
            }
        }

        // Update contract status in DB
        const { error: updateError } = await supabaseAdmin
            .from('student_contracts')
            .update({ status: 'canceled' })
            .eq('id', contractId)

        if (updateError) {
            console.error('[cancel-contract] DB error:', updateError)
            return { error: 'Erro ao cancelar contrato' }
        }

        // Update student plan status
        await supabaseAdmin
            .from('students')
            .update({
                plan_status: 'canceled',
                current_plan_name: null,
            })
            .eq('id', contract.student_id)

        revalidatePath('/financial')
        revalidatePath('/financial/subscriptions')

        return { success: true }
    } catch (err) {
        console.error('[cancel-contract] Error:', err)
        return { error: 'Erro ao cancelar contrato' }
    }
}
