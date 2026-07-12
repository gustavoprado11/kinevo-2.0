import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { stripe } from '@/lib/stripe'
import { priceToTier, priceIdForTier, type AiTier } from '@/lib/auth/get-ai-tier'
import { assertCanDowngradeToFree, StudentDowngradeError } from '@/lib/limits/student-cap'

const PAID_TIERS: ReadonlySet<string> = new Set<AiTier>(['essencial', 'pro_ia', 'premium_ia'])

export async function POST(request: NextRequest) {
    const isMobile = request.nextUrl.searchParams.get('source') === 'mobile'
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: trainer } = await supabase
        .from('trainers')
        .select('id, name, email')
        .eq('auth_user_id', user.id)
        .single()

    if (!trainer) {
        return NextResponse.json({ error: 'Trainer not found' }, { status: 404 })
    }

    // Resolve o price alvo. NUNCA aceitar price arbitrário do cliente: só os do
    // mapa de env. Backward-compat: sem body → STRIPE_PRICE_ID (Essencial atual).
    const body = await request.json().catch(() => null)
    const requestedTier: unknown = body?.tier
    const requestedPriceId: unknown = body?.priceId

    let priceId: string | null = null
    if (typeof requestedPriceId === 'string' && requestedPriceId.length > 0) {
        const mapped = priceToTier(requestedPriceId)
        if (!mapped || !PAID_TIERS.has(mapped)) {
            return NextResponse.json({ error: 'Price inválido' }, { status: 400 })
        }
        priceId = requestedPriceId
    } else if (typeof requestedTier === 'string') {
        if (requestedTier === 'free') {
            // Downgrade pro Gratuito não passa por checkout; bloqueia se houver alunos.
            try {
                await assertCanDowngradeToFree(supabaseAdmin, trainer.id)
            } catch (e) {
                if (e instanceof StudentDowngradeError) {
                    return NextResponse.json({ error: e.message }, { status: 409 })
                }
                throw e
            }
            return NextResponse.json(
                { error: 'O plano Gratuito não usa checkout.' },
                { status: 400 },
            )
        }
        if (!PAID_TIERS.has(requestedTier)) {
            return NextResponse.json({ error: 'Tier inválido' }, { status: 400 })
        }
        priceId = priceIdForTier(requestedTier as AiTier)
        if (!priceId) {
            return NextResponse.json(
                { error: `Price não configurado para o tier ${requestedTier}` },
                { status: 500 },
            )
        }
    } else {
        priceId = process.env.STRIPE_PRICE_ID ?? null
    }

    if (!priceId) {
        return NextResponse.json({ error: 'Price não configurado' }, { status: 500 })
    }

    // Check for existing Stripe customer
    const { data: existingSub } = await supabaseAdmin
        .from('subscriptions')
        .select('stripe_customer_id')
        .eq('trainer_id', trainer.id)
        .single()

    let stripeCustomerId = existingSub?.stripe_customer_id

    if (!stripeCustomerId) {
        // AC9: sem linha em subscriptions, cada tentativa de checkout criava um
        // customer NOVO no Stripe (abrir 3× sem concluir = 3 órfãos). Reusa o
        // customer já criado pra este trainer numa tentativa anterior.
        const existing = await stripe.customers.list({ email: trainer.email, limit: 10 })
        const match = existing.data.find(
            (c) => c.metadata?.trainer_id === trainer.id,
        ) ?? existing.data[0]
        if (match) {
            stripeCustomerId = match.id
        } else {
            const customer = await stripe.customers.create({
                email: trainer.email,
                name: trainer.name,
                metadata: {
                    trainer_id: trainer.id,
                    supabase_auth_uid: user.id,
                },
            })
            stripeCustomerId = customer.id
        }
    }

    const session = await stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        mode: 'subscription',
        payment_method_types: ['card'],
        allow_promotion_codes: true,
        line_items: [{
            price: priceId,
            quantity: 1,
        }],
        subscription_data: {
            // Sem trial: o plano Gratuito já serve de teste para o treinador, então
            // os planos pagos cobram na hora (antes havia trial_period_days: 7).
            metadata: {
                trainer_id: trainer.id,
            },
        },
        success_url: isMobile
            ? `${request.nextUrl.origin}/checkout-bridge?result=success`
            : `${request.nextUrl.origin}/dashboard?checkout=success`,
        cancel_url: isMobile
            ? `${request.nextUrl.origin}/checkout-bridge?result=canceled`
            : `${request.nextUrl.origin}/subscription/blocked?checkout=canceled`,
        metadata: {
            trainer_id: trainer.id,
        },
    })

    return NextResponse.json({ url: session.url })
}
