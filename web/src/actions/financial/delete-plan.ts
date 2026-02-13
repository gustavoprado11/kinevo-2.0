'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { stripe } from '@/lib/stripe'
import { revalidatePath } from 'next/cache'

export async function deletePlan({ planId }: { planId: string }) {
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
        .select('id, trainer_id, stripe_product_id')
        .eq('id', planId)
        .single()

    if (!plan) {
        return { error: 'Plano não encontrado' }
    }

    if (plan.trainer_id !== trainer.id) {
        return { error: 'Sem permissão para excluir este plano' }
    }

    try {
        // Archive Stripe Product (don't delete — Stripe doesn't support deletion)
        if (plan.stripe_product_id) {
            const { data: settings } = await supabaseAdmin
                .from('payment_settings')
                .select('stripe_connect_id')
                .eq('user_id', trainer.id)
                .single()

            if (settings?.stripe_connect_id) {
                await stripe.products.update(
                    plan.stripe_product_id,
                    { active: false },
                    { stripeAccount: settings.stripe_connect_id }
                )
            }
        }

        // Delete from DB
        const { error: deleteError } = await supabaseAdmin
            .from('trainer_plans')
            .delete()
            .eq('id', planId)

        if (deleteError) {
            console.error('[delete-plan] DB error:', deleteError)
            return { error: 'Erro ao excluir plano' }
        }

        revalidatePath('/financial')
        revalidatePath('/financial/plans')
        return { success: true }
    } catch (err) {
        console.error('[delete-plan] Error:', err)
        return { error: 'Erro ao excluir plano' }
    }
}
