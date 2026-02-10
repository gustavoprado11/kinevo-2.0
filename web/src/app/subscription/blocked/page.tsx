import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BlockedClient } from './blocked-client'

export default async function SubscriptionBlockedPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) redirect('/login')

    const { data: trainer } = await supabase
        .from('trainers')
        .select('id, name')
        .eq('auth_user_id', user.id)
        .single()

    if (!trainer) redirect('/login')

    const { data: subscription } = await supabase
        .from('subscriptions')
        .select('status')
        .eq('trainer_id', trainer.id)
        .single()

    // If they have an active subscription, send them to dashboard
    if (subscription?.status === 'trialing' || subscription?.status === 'active') {
        redirect('/dashboard')
    }

    // Determine which state we're in
    const state: 'no_subscription' | 'past_due' | 'canceled' = !subscription
        ? 'no_subscription'
        : subscription.status === 'past_due'
            ? 'past_due'
            : 'canceled'

    return <BlockedClient trainerName={trainer.name} state={state} />
}
