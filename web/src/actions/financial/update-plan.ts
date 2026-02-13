'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { stripe } from '@/lib/stripe'
import { revalidatePath } from 'next/cache'

interface UpdatePlanInput {
    planId: string
    title: string
    price: number
    interval: string
    description: string
    visibility: string
}

export async function updatePlan(input: UpdatePlanInput) {
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

    // Fetch existing plan and validate ownership
    const { data: plan } = await supabaseAdmin
        .from('trainer_plans')
        .select('*')
        .eq('id', input.planId)
        .single()

    if (!plan) {
        return { error: 'Plano não encontrado' }
    }

    if (plan.trainer_id !== trainer.id) {
        return { error: 'Sem permissão para editar este plano' }
    }

    // Check if trainer has Stripe Connect
    const { data: settings } = await supabaseAdmin
        .from('payment_settings')
        .select('stripe_connect_id, charges_enabled')
        .eq('user_id', trainer.id)
        .single()

    const hasStripe = settings?.stripe_connect_id && settings.charges_enabled

    const intervalCountMap: Record<string, number> = {
        month: 1,
        quarter: 3,
        year: 1,
    }

    try {
        // Update Stripe Product if title/description changed
        if (hasStripe && plan.stripe_product_id) {
            const titleChanged = input.title !== plan.title
            const descChanged = input.description !== (plan.description || '')

            if (titleChanged || descChanged) {
                await stripe.products.update(
                    plan.stripe_product_id,
                    {
                        name: input.title,
                        description: input.description || undefined,
                    },
                    { stripeAccount: settings!.stripe_connect_id! }
                )
            }

            // If price or interval changed, archive old Price and create new
            const priceChanged = input.price !== Number(plan.price)
            const intervalChanged = input.interval !== plan.interval

            if ((priceChanged || intervalChanged) && plan.stripe_price_id) {
                // Archive old price
                await stripe.prices.update(
                    plan.stripe_price_id,
                    { active: false },
                    { stripeAccount: settings!.stripe_connect_id! }
                )

                const intervalMap: Record<string, 'month' | 'year'> = {
                    month: 'month',
                    quarter: 'month',
                    year: 'year',
                }

                // Create new price
                const newPrice = await stripe.prices.create(
                    {
                        product: plan.stripe_product_id,
                        unit_amount: Math.round(input.price * 100),
                        currency: 'brl',
                        recurring: {
                            interval: intervalMap[input.interval] || 'month',
                            interval_count: intervalCountMap[input.interval] || 1,
                        },
                        metadata: { trainer_id: trainer.id },
                    },
                    { stripeAccount: settings!.stripe_connect_id! }
                )

                // Update DB with new price ID
                await supabaseAdmin
                    .from('trainer_plans')
                    .update({
                        title: input.title,
                        description: input.description || null,
                        price: input.price,
                        interval: input.interval,
                        interval_count: intervalCountMap[input.interval] || 1,
                        visibility: input.visibility || 'public',
                        stripe_price_id: newPrice.id,
                    })
                    .eq('id', input.planId)

                revalidatePath('/financial')
                revalidatePath('/financial/plans')
                return { success: true }
            }
        }

        // Update DB (no Stripe price change needed)
        const { error: updateError } = await supabaseAdmin
            .from('trainer_plans')
            .update({
                title: input.title,
                description: input.description || null,
                price: input.price,
                interval: input.interval,
                interval_count: intervalCountMap[input.interval] || 1,
                visibility: input.visibility || 'public',
            })
            .eq('id', input.planId)

        if (updateError) {
            console.error('[update-plan] DB error:', updateError)
            return { error: 'Erro ao atualizar plano' }
        }

        revalidatePath('/financial')
        revalidatePath('/financial/plans')
        return { success: true }
    } catch (err) {
        console.error('[update-plan] Error:', err)
        return { error: 'Erro ao atualizar plano' }
    }
}
