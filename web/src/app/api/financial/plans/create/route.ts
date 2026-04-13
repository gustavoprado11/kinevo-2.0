import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { stripe } from '@/lib/stripe'

export async function POST(request: NextRequest) {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Token ausente' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
        return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }

    const { data: trainer } = await supabaseAdmin
        .from('trainers')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()

    if (!trainer) {
        return NextResponse.json({ error: 'Treinador não encontrado' }, { status: 404 })
    }

    const body = await request.json()
    const { title, price, interval, description } = body

    if (!title || !price || !interval) {
        return NextResponse.json({ error: 'Campos obrigatórios: title, price, interval' }, { status: 400 })
    }

    let stripeProductId: string | null = null
    let stripePriceId: string | null = null

    // Check if trainer has Stripe Connect
    const { data: settings } = await supabaseAdmin
        .from('payment_settings')
        .select('stripe_connect_id, charges_enabled')
        .eq('user_id', trainer.id)
        .single()

    if (settings?.stripe_connect_id && settings.charges_enabled) {
        try {
            const product = await stripe.products.create({
                name: title,
                description: description || undefined,
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

            const stripePrice = await stripe.prices.create({
                product: product.id,
                unit_amount: Math.round(price * 100),
                currency: 'brl',
                recurring: {
                    interval: intervalMap[interval] || 'month',
                    interval_count: intervalCountMap[interval] || 1,
                },
                metadata: { trainer_id: trainer.id },
            }, {
                stripeAccount: settings.stripe_connect_id,
            })

            stripeProductId = product.id
            stripePriceId = stripePrice.id
        } catch (err) {
            console.error('[api/plans/create] Stripe error:', err)
            // Continue without Stripe IDs
        }
    }

    const intervalCountMap: Record<string, number> = {
        month: 1,
        quarter: 3,
        year: 1,
    }

    const { error: insertError } = await supabaseAdmin.from('trainer_plans').insert({
        trainer_id: trainer.id,
        title,
        description: description || null,
        price,
        interval,
        interval_count: intervalCountMap[interval] || 1,
        is_active: true,
        visibility: 'public',
        stripe_product_id: stripeProductId,
        stripe_price_id: stripePriceId,
    })

    if (insertError) {
        console.error('[api/plans/create] DB error:', insertError)
        return NextResponse.json({ error: 'Erro ao salvar plano' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
}
