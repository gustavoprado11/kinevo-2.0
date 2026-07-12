/**
 * Financeiro / planos — núcleo compartilhado (server-only, SEM 'use server').
 *
 * createPlanCore / updatePlanCore recebem um client admin + trainerId resolvido
 * e gerenciam o plano (incluindo Product/Price no Stripe Connect). As actions
 * viram wrappers de auth + revalidatePath; as tools MCP chamam o core direto.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@kinevo/shared/types/database'
import { stripe } from '@/lib/stripe'

type DBClient = SupabaseClient<Database>

const intervalCountMap: Record<string, number> = { month: 1, quarter: 3, year: 1 }
const intervalMap: Record<string, 'month' | 'year'> = { month: 'month', quarter: 'month', year: 'year' }

export interface CreatePlanInput {
    title: string
    price: number
    interval: string
    description: string
    visibility: string
    /** Quando true e o Connect estiver ativo, cria Product/Price no Stripe. */
    hasStripeConnect: boolean
    allowPix?: boolean
    allowCreditCard?: boolean
    allowBoleto?: boolean
    maxInstallmentCount?: number
}

export async function createPlanCore(
    supabaseAdmin: DBClient,
    trainerId: string,
    input: CreatePlanInput,
): Promise<{ success?: boolean; error?: string; planId?: string }> {
    let stripeProductId: string | null = null
    let stripePriceId: string | null = null

    // Asaas-first (decisão 11/jul): NÃO cria mais Product/Price novos no
    // Stripe Connect a menos que o treinador tenha ligado explicitamente o modo
    // legado (show_stripe_legacy). Planos-Stripe EXISTENTES continuam sendo
    // espelhados no updatePlanCore (leitura/manutenção de legado intactas).
    if (input.hasStripeConnect) {
        const { getFinancialSettings } = await import('@/lib/financial/settings')
        const financialSettings = await getFinancialSettings(trainerId)
        if (!financialSettings.showStripeLegacy) {
            input = { ...input, hasStripeConnect: false }
        }
    }

    if (input.hasStripeConnect) {
        const { data: settings } = await supabaseAdmin
            .from('payment_settings')
            .select('stripe_connect_id, charges_enabled')
            .eq('user_id', trainerId)
            .single()

        if (settings?.stripe_connect_id && settings.charges_enabled) {
            try {
                const product = await stripe.products.create(
                    {
                        name: input.title,
                        description: input.description || undefined,
                        metadata: { trainer_id: trainerId },
                    },
                    { stripeAccount: settings.stripe_connect_id }
                )

                const price = await stripe.prices.create(
                    {
                        product: product.id,
                        unit_amount: Math.round(input.price * 100),
                        currency: 'brl',
                        recurring: {
                            interval: intervalMap[input.interval] || 'month',
                            interval_count: intervalCountMap[input.interval] || 1,
                        },
                        metadata: { trainer_id: trainerId },
                    },
                    { stripeAccount: settings.stripe_connect_id }
                )

                stripeProductId = product.id
                stripePriceId = price.id
            } catch (err) {
                console.error('[createPlanCore] Stripe error:', err)
                // Continua sem IDs do Stripe — plano ainda serve para cobrança manual.
            }
        }
    }

    const { data: newPlan, error: insertError } = await supabaseAdmin
        .from('trainer_plans')
        .insert({
            trainer_id: trainerId,
            title: input.title,
            description: input.description || null,
            price: input.price,
            interval: input.interval,
            interval_count: intervalCountMap[input.interval] || 1,
            is_active: true,
            visibility: input.visibility || 'public',
            stripe_product_id: stripeProductId,
            stripe_price_id: stripePriceId,
            allow_pix: input.allowPix ?? true,
            allow_credit_card: input.allowCreditCard ?? true,
            allow_boleto: input.allowBoleto ?? false,
            max_installment_count: input.allowCreditCard === false
                ? 1
                : Math.max(1, Math.floor(input.maxInstallmentCount ?? 1)),
        })
        .select('id')
        .single()

    if (insertError || !newPlan) {
        console.error('[createPlanCore] DB error:', insertError)
        return { error: 'Erro ao salvar plano' }
    }

    return { success: true, planId: newPlan.id }
}

export interface UpdatePlanInput {
    planId: string
    title: string
    price: number
    interval: string
    description: string
    visibility: string
    allowPix?: boolean
    allowCreditCard?: boolean
    allowBoleto?: boolean
    maxInstallmentCount?: number
}

export async function updatePlanCore(
    supabaseAdmin: DBClient,
    trainerId: string,
    input: UpdatePlanInput,
): Promise<{ success?: boolean; error?: string }> {
    const { data: plan } = await supabaseAdmin
        .from('trainer_plans')
        .select('*')
        .eq('id', input.planId)
        .single()

    if (!plan) return { error: 'Plano não encontrado' }
    if (plan.trainer_id !== trainerId) return { error: 'Sem permissão para editar este plano' }

    const { data: settings } = await supabaseAdmin
        .from('payment_settings')
        .select('stripe_connect_id, charges_enabled')
        .eq('user_id', trainerId)
        .single()

    const hasStripe = settings?.stripe_connect_id && settings.charges_enabled

    const maxInstallmentCount = input.allowCreditCard === false
        ? 1
        : Math.max(1, Math.floor(input.maxInstallmentCount ?? 1))

    try {
        if (hasStripe && plan.stripe_product_id) {
            const titleChanged = input.title !== plan.title
            const descChanged = input.description !== (plan.description || '')

            if (titleChanged || descChanged) {
                await stripe.products.update(
                    plan.stripe_product_id,
                    { name: input.title, description: input.description || undefined },
                    { stripeAccount: settings!.stripe_connect_id! }
                )
            }

            const priceChanged = input.price !== Number(plan.price)
            const intervalChanged = input.interval !== plan.interval

            if ((priceChanged || intervalChanged) && plan.stripe_price_id) {
                await stripe.prices.update(
                    plan.stripe_price_id,
                    { active: false },
                    { stripeAccount: settings!.stripe_connect_id! }
                )

                const newPrice = await stripe.prices.create(
                    {
                        product: plan.stripe_product_id,
                        unit_amount: Math.round(input.price * 100),
                        currency: 'brl',
                        recurring: {
                            interval: intervalMap[input.interval] || 'month',
                            interval_count: intervalCountMap[input.interval] || 1,
                        },
                        metadata: { trainer_id: trainerId },
                    },
                    { stripeAccount: settings!.stripe_connect_id! }
                )

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
                        allow_pix: input.allowPix ?? true,
                        allow_credit_card: input.allowCreditCard ?? true,
                        allow_boleto: input.allowBoleto ?? false,
                        max_installment_count: maxInstallmentCount,
                    })
                    .eq('id', input.planId)

                return { success: true }
            }
        }

        const { error: updateError } = await supabaseAdmin
            .from('trainer_plans')
            .update({
                title: input.title,
                description: input.description || null,
                price: input.price,
                interval: input.interval,
                interval_count: intervalCountMap[input.interval] || 1,
                visibility: input.visibility || 'public',
                allow_pix: input.allowPix ?? true,
                allow_credit_card: input.allowCreditCard ?? true,
                allow_boleto: input.allowBoleto ?? false,
                max_installment_count: maxInstallmentCount,
            })
            .eq('id', input.planId)

        if (updateError) {
            console.error('[updatePlanCore] DB error:', updateError)
            return { error: 'Erro ao atualizar plano' }
        }

        return { success: true }
    } catch (err) {
        console.error('[updatePlanCore] Error:', err)
        return { error: 'Erro ao atualizar plano' }
    }
}
