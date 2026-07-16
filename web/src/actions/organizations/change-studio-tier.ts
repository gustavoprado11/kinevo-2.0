'use server'

import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { stripe } from '@/lib/stripe'
import { getOrganizationContext } from '@/lib/studio/get-organization'
import { isOrgBillingActive } from '@/lib/studio/org-access'
import { isStudioTier, studioPriceIdForTier, type StudioTier } from '@/lib/studio/studio-tiers'

/**
 * Troca a faixa do estúdio in-app (não pelo portal, cujo subscription_update
 * mudou de schema na API nova). Faz stripe.subscriptions.update trocando o
 * price do item com proração — sem 2ª assinatura. O webhook
 * (customer.subscription.updated) grava o novo plan_tier; atualizamos aqui
 * também para a UI refletir na hora. Só o gestor de estúdio com billing ativo.
 */
export async function changeStudioTier(data: { tier: StudioTier }) {
    try {
        const ctx = await getOrganizationContext()
        if (!ctx) return { success: false, error: 'Você não pertence a um estúdio' }
        if (!ctx.isManager) return { success: false, error: 'Apenas o gestor pode mudar a faixa' }
        if (!isStudioTier(data.tier) || data.tier === 'studio_custom') {
            return { success: false, error: 'Faixa inválida' }
        }
        if (!isOrgBillingActive(ctx.organization.subscription_status, ctx.organization.grace_until)) {
            return { success: false, error: 'O estúdio não tem uma assinatura ativa. Assine primeiro.' }
        }
        if (ctx.organization.plan_tier === data.tier) {
            return { success: false, error: 'O estúdio já está nesta faixa' }
        }

        const newPriceId = studioPriceIdForTier(data.tier)
        if (!newPriceId) return { success: false, error: `Price não configurado para ${data.tier}` }

        const { data: org } = await supabaseAdmin
            .from('organizations')
            .select('stripe_subscription_id')
            .eq('id', ctx.organization.id)
            .single()
        const subId = (org as { stripe_subscription_id: string | null } | null)?.stripe_subscription_id
        if (!subId) return { success: false, error: 'Assinatura do estúdio não encontrada' }

        const subscription = await stripe.subscriptions.retrieve(subId)
        const itemId = subscription.items?.data?.[0]?.id
        if (!itemId) return { success: false, error: 'Item da assinatura não encontrado' }

        await stripe.subscriptions.update(subId, {
            items: [{ id: itemId, price: newPriceId }],
            proration_behavior: 'create_prorations',
        })

        // Atualiza a UI na hora (o webhook confirma em seguida).
        await supabaseAdmin
            .from('organizations')
            .update({ plan_tier: data.tier })
            .eq('id', ctx.organization.id)

        revalidatePath('/estudio/plano')
        return { success: true }
    } catch (error) {
        console.error('[changeStudioTier] erro:', error)
        return { success: false, error: 'Não foi possível trocar a faixa' }
    }
}
