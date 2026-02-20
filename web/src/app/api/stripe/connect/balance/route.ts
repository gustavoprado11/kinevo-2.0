import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { stripe } from '@/lib/stripe'

export async function GET() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: trainer } = await supabase
        .from('trainers')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()

    if (!trainer) {
        return NextResponse.json({ error: 'Trainer not found' }, { status: 404 })
    }

    const { data: settings } = await supabaseAdmin
        .from('payment_settings')
        .select('stripe_connect_id, payouts_enabled')
        .eq('user_id', trainer.id)
        .single()

    if (!settings?.stripe_connect_id) {
        return NextResponse.json({ error: 'Stripe not connected' }, { status: 400 })
    }

    try {
        const balance = await stripe.balance.retrieve({
            stripeAccount: settings.stripe_connect_id,
        })

        // Get available and pending balances in BRL (or first available currency)
        const available = balance.available.find(b => b.currency === 'brl') || balance.available[0]
        const pending = balance.pending.find(b => b.currency === 'brl') || balance.pending[0]

        return NextResponse.json({
            available: available ? available.amount / 100 : 0,
            pending: pending ? pending.amount / 100 : 0,
            currency: available?.currency || pending?.currency || 'brl',
        })
    } catch (err) {
        console.error('[stripe/connect/balance] Error:', err)
        return NextResponse.json({ error: 'Failed to fetch balance' }, { status: 500 })
    }
}
