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

    const { planId } = await request.json()

    const { data: plan } = await supabaseAdmin
        .from('trainer_plans')
        .select('id, trainer_id, stripe_product_id')
        .eq('id', planId)
        .single()

    if (!plan || plan.trainer_id !== trainer.id) {
        return NextResponse.json({ error: 'Plano não encontrado' }, { status: 404 })
    }

    // Archive Stripe Product
    if (plan.stripe_product_id) {
        const { data: settings } = await supabaseAdmin
            .from('payment_settings')
            .select('stripe_connect_id')
            .eq('user_id', trainer.id)
            .single()

        if (settings?.stripe_connect_id) {
            try {
                await stripe.products.update(
                    plan.stripe_product_id,
                    { active: false },
                    { stripeAccount: settings.stripe_connect_id }
                )
            } catch (err) {
                console.error('[api/plans/delete] Stripe error:', err)
            }
        }
    }

    await supabaseAdmin
        .from('trainer_plans')
        .delete()
        .eq('id', planId)

    return NextResponse.json({ success: true })
}
