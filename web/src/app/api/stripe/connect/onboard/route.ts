import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { stripe } from '@/lib/stripe'

export async function POST(request: NextRequest) {
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

    // Check if trainer already has a connected account
    const { data: settings } = await supabaseAdmin
        .from('payment_settings')
        .select('stripe_connect_id, charges_enabled, details_submitted')
        .eq('user_id', trainer.id)
        .single()

    let stripeAccountId = settings?.stripe_connect_id

    if (!stripeAccountId) {
        // Create a new Standard Connect account
        const account = await stripe.accounts.create({
            type: 'standard',
            email: trainer.email,
            metadata: {
                trainer_id: trainer.id,
                kinevo_user: 'true',
            },
        })

        stripeAccountId = account.id

        // Save to payment_settings
        await supabaseAdmin.from('payment_settings').upsert({
            user_id: trainer.id,
            stripe_connect_id: account.id,
            stripe_status: 'pending',
            charges_enabled: false,
            details_submitted: false,
            payouts_enabled: false,
        }, { onConflict: 'user_id' })
    }

    // Generate Account Link for onboarding
    const accountLink = await stripe.accountLinks.create({
        account: stripeAccountId,
        refresh_url: `${request.nextUrl.origin}/financial?connect=refresh`,
        return_url: `${request.nextUrl.origin}/financial?connect=success`,
        type: 'account_onboarding',
    })

    return NextResponse.json({ url: accountLink.url })
}
