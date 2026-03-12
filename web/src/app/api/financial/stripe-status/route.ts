import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { stripe } from '@/lib/stripe'

export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Token ausente' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
        return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }

    // Get trainer
    const { data: trainer } = await supabaseAdmin
        .from('trainers')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()

    if (!trainer) {
        return NextResponse.json({ error: 'Treinador não encontrado' }, { status: 404 })
    }

    // Get payment settings
    const { data: settings } = await supabaseAdmin
        .from('payment_settings')
        .select('*')
        .eq('user_id', trainer.id)
        .single()

    if (!settings?.stripe_connect_id) {
        return NextResponse.json({
            connected: false,
            charges_enabled: false,
            details_submitted: false,
            payouts_enabled: false,
        })
    }

    try {
        // Sync from Stripe
        const account = await stripe.accounts.retrieve(settings.stripe_connect_id)

        const status = {
            connected: true,
            charges_enabled: account.charges_enabled ?? false,
            details_submitted: account.details_submitted ?? false,
            payouts_enabled: account.payouts_enabled ?? false,
        }

        // Update DB if changed
        if (
            status.charges_enabled !== settings.charges_enabled ||
            status.details_submitted !== settings.details_submitted ||
            status.payouts_enabled !== settings.payouts_enabled
        ) {
            await supabaseAdmin.from('payment_settings').update({
                charges_enabled: status.charges_enabled,
                details_submitted: status.details_submitted,
                payouts_enabled: status.payouts_enabled,
                stripe_status: status.charges_enabled ? 'active' : 'pending',
            }).eq('user_id', trainer.id)
        }

        return NextResponse.json(status)
    } catch (err) {
        console.error('[stripe-status] Error:', err)
        return NextResponse.json({ error: 'Erro ao consultar Stripe' }, { status: 500 })
    }
}
