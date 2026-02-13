'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { stripe } from '@/lib/stripe'
import { revalidatePath } from 'next/cache'

interface CreatePlanInput {
    title: string
    price: number
    interval: string
    description: string
    visibility: string
    hasStripeConnect: boolean
}

export async function createPlan(input: CreatePlanInput) {
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

    let stripeProductId: string | null = null
    let stripePriceId: string | null = null

    // If trainer has Stripe Connect, create Product + Price on their account
    if (input.hasStripeConnect) {
        const { data: settings } = await supabaseAdmin
            .from('payment_settings')
            .select('stripe_connect_id, charges_enabled')
            .eq('user_id', trainer.id)
            .single()

        if (settings?.stripe_connect_id && settings.charges_enabled) {
            try {
                const product = await stripe.products.create({
                    name: input.title,
                    description: input.description || undefined,
                    metadata: { trainer_id: trainer.id },
                }, {
                    stripeAccount: settings.stripe_connect_id,
                })

                const intervalMap: Record<string, 'month' | 'year'> = {
                    month: 'month',
                    quarter: 'month',
                    year: 'year',
                }
                const intervalCountMap: Record<string, number> = {
                    month: 1,
                    quarter: 3,
                    year: 1,
                }

                const price = await stripe.prices.create({
                    product: product.id,
                    unit_amount: Math.round(input.price * 100),
                    currency: 'brl',
                    recurring: {
                        interval: intervalMap[input.interval] || 'month',
                        interval_count: intervalCountMap[input.interval] || 1,
                    },
                    metadata: { trainer_id: trainer.id },
                }, {
                    stripeAccount: settings.stripe_connect_id,
                })

                stripeProductId = product.id
                stripePriceId = price.id
            } catch (err) {
                console.error('[create-plan] Stripe error:', err)
                // Continue without Stripe IDs — plan is still usable for manual billing
            }
        }
    }

    const intervalCountMap: Record<string, number> = {
        month: 1,
        quarter: 3,
        year: 1,
    }

    const { error: insertError } = await supabaseAdmin.from('trainer_plans').insert({
        trainer_id: trainer.id,
        title: input.title,
        description: input.description || null,
        price: input.price,
        interval: input.interval,
        interval_count: intervalCountMap[input.interval] || 1,
        is_active: true,
        visibility: input.visibility || 'public',
        stripe_product_id: stripeProductId,
        stripe_price_id: stripePriceId,
    })

    if (insertError) {
        console.error('[create-plan] DB error:', insertError)
        return { error: 'Erro ao salvar plano' }
    }

    revalidatePath('/financial')
    revalidatePath('/financial/plans')

    return { success: true }
}
