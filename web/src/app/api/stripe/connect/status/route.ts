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

    // Sync from Stripe
    const account = await stripe.accounts.retrieve(settings.stripe_connect_id)

    const status = {
        connected: true,
        charges_enabled: account.charges_enabled ?? false,
        details_submitted: account.details_submitted ?? false,
        payouts_enabled: account.payouts_enabled ?? false,
        stripe_connect_id: account.id,
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
}
