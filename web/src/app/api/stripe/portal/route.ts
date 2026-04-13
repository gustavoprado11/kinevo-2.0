import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { stripe } from '@/lib/stripe'

export async function POST(request: NextRequest) {
    let user: { id: string } | null = null

    // Support Bearer token auth (mobile) and cookie auth (web)
    const authHeader = request.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.replace('Bearer ', '')
        const { data: { user: tokenUser }, error } = await supabaseAdmin.auth.getUser(token)
        if (error || !tokenUser) {
            return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
        }
        user = tokenUser
    } else {
        const supabase = await createClient()
        const { data: { user: cookieUser } } = await supabase.auth.getUser()
        user = cookieUser
    }

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: trainer } = await supabaseAdmin
        .from('trainers')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()

    if (!trainer) {
        return NextResponse.json({ error: 'Trainer not found' }, { status: 404 })
    }

    const { data: subscription } = await supabaseAdmin
        .from('subscriptions')
        .select('stripe_customer_id')
        .eq('trainer_id', trainer.id)
        .single()

    if (!subscription?.stripe_customer_id) {
        return NextResponse.json({ error: 'No subscription found' }, { status: 404 })
    }

    const portalSession = await stripe.billingPortal.sessions.create({
        customer: subscription.stripe_customer_id,
        return_url: `${request.nextUrl.origin}/settings`,
    })

    return NextResponse.json({ url: portalSession.url })
}
