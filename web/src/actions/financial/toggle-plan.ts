'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { stripe } from '@/lib/stripe'
import { revalidatePath } from 'next/cache'

export async function togglePlan({ planId }: { planId: string }) {
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

    // Fetch plan and validate ownership
    const { data: plan } = await supabaseAdmin
        .from('trainer_plans')
        .select('id, trainer_id, is_active, stripe_product_id')
        .eq('id', planId)
        .single()

    if (!plan) {
        return { error: 'Plano não encontrado' }
    }

    if (plan.trainer_id !== trainer.id) {
        return { error: 'Sem permissão para editar este plano' }
    }

    const newActive = !plan.is_active

    try {
        // Update Stripe Product if exists
        if (plan.stripe_product_id) {
            const { data: settings } = await supabaseAdmin
                .from('payment_settings')
                .select('stripe_connect_id')
                .eq('user_id', trainer.id)
                .single()

            if (settings?.stripe_connect_id) {
                await stripe.products.update(
                    plan.stripe_product_id,
                    { active: newActive },
                    { stripeAccount: settings.stripe_connect_id }
                )
            }
        }

        // Update DB
        const { error: updateError } = await supabaseAdmin
            .from('trainer_plans')
            .update({ is_active: newActive })
            .eq('id', planId)

        if (updateError) {
            console.error('[toggle-plan] DB error:', updateError)
            return { error: 'Erro ao atualizar plano' }
        }

        revalidatePath('/financial')
        revalidatePath('/financial/plans')
        return { success: true, is_active: newActive }
    } catch (err) {
        console.error('[toggle-plan] Error:', err)
        return { error: 'Erro ao atualizar plano' }
    }
}
