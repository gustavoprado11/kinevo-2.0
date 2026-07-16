import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { stripe } from '@/lib/stripe'
import { getOrganizationContext } from '@/lib/studio/get-organization'
import { isStudioTier, studioPriceIdForTier } from '@/lib/studio/studio-tiers'

/**
 * Checkout de assinatura do ESTÚDIO (billing por org). Espelha o checkout solo
 * (/api/stripe/checkout), mas o pagador é a ORG e só o gestor (owner/admin) paga.
 *
 * A metadata organization_id é a ÚNICA ponte no checkout.session.completed — o
 * webhook usa ela para saber qual org ativar (ver /api/webhooks/stripe).
 */
export async function POST(request: NextRequest) {
    const ctx = await getOrganizationContext()
    if (!ctx) return NextResponse.json({ error: 'Você não pertence a um estúdio' }, { status: 404 })
    if (!ctx.isManager) return NextResponse.json({ error: 'Apenas o gestor pode assinar' }, { status: 403 })

    const body = await request.json().catch(() => null)
    const requestedTier: unknown = body?.tier
    if (!isStudioTier(requestedTier) || requestedTier === 'studio_custom') {
        return NextResponse.json({ error: 'Faixa inválida' }, { status: 400 })
    }
    const priceId = studioPriceIdForTier(requestedTier)
    if (!priceId) {
        return NextResponse.json({ error: `Price não configurado para ${requestedTier}` }, { status: 500 })
    }

    // Nome/email do gestor para o customer da org (informativo no Stripe).
    const { data: trainer } = await supabaseAdmin
        .from('trainers')
        .select('name, email')
        .eq('id', ctx.trainerId)
        .single()

    // Customer da ORG: lê organizations.stripe_customer_id; senão reusa por
    // metadata.organization_id (anti-órfão) ou cria novo.
    const { data: org } = await supabaseAdmin
        .from('organizations')
        .select('stripe_customer_id, name')
        .eq('id', ctx.organization.id)
        .single()

    let stripeCustomerId = (org as { stripe_customer_id: string | null } | null)?.stripe_customer_id ?? null
    if (!stripeCustomerId) {
        const email = trainer?.email ?? undefined
        const existing = email ? await stripe.customers.list({ email, limit: 10 }) : { data: [] }
        const match = existing.data.find((c) => c.metadata?.organization_id === ctx.organization.id)
        if (match) {
            stripeCustomerId = match.id
        } else {
            const customer = await stripe.customers.create({
                email,
                name: ctx.organization.name,
                metadata: { organization_id: ctx.organization.id },
            })
            stripeCustomerId = customer.id
        }
        await supabaseAdmin.from('organizations').update({ stripe_customer_id: stripeCustomerId }).eq('id', ctx.organization.id)
    }

    const session = await stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        mode: 'subscription',
        payment_method_types: ['card'],
        allow_promotion_codes: true,
        line_items: [{ price: priceId, quantity: 1 }],
        subscription_data: {
            metadata: { organization_id: ctx.organization.id, studio_tier: requestedTier },
        },
        success_url: `${request.nextUrl.origin}/estudio?checkout=success`,
        cancel_url: `${request.nextUrl.origin}/estudio/blocked?checkout=canceled`,
        metadata: { organization_id: ctx.organization.id, studio_tier: requestedTier },
    })

    return NextResponse.json({ url: session.url })
}
