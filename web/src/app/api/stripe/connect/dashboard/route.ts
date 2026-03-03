import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { stripe } from '@/lib/stripe'

export async function POST() {
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
        .select('stripe_connect_id')
        .eq('user_id', trainer.id)
        .single()

    if (!settings?.stripe_connect_id) {
        return NextResponse.json({ error: 'Stripe not connected' }, { status: 400 })
    }

    try {
        const account = await stripe.accounts.retrieve(settings.stripe_connect_id)

        if (account.type === 'express' || account.type === 'custom') {
            // Express/Custom accounts: generate a login link to the hosted dashboard
            const loginLink = await stripe.accounts.createLoginLink(
                settings.stripe_connect_id
            )
            return NextResponse.json({ url: loginLink.url })
        }

        // Standard accounts manage their own Stripe Dashboard directly
        return NextResponse.json({ url: 'https://dashboard.stripe.com' })
    } catch (err) {
        console.error('[stripe/connect/dashboard] Error:', err)
        return NextResponse.json({ error: 'Failed to create dashboard link' }, { status: 500 })
    }
}
