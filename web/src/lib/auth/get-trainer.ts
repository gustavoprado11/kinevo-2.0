import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function getTrainerWithSubscription() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) redirect('/login')

    const { data: trainer } = await supabase
        .from('trainers')
        .select('id, name, email, avatar_url, theme, ai_prescriptions_enabled')
        .eq('auth_user_id', user.id)
        .single()

    if (!trainer) {
        // Trainer record doesn't exist — force logout
        await supabase.auth.signOut()
        redirect('/login')
    }

    const { data: subscription } = await supabase
        .from('subscriptions')
        .select('status, current_period_end, cancel_at_period_end, stripe_customer_id')
        .eq('trainer_id', trainer.id)
        .single()

    const isActive = subscription?.status === 'trialing' || subscription?.status === 'active'

    if (!isActive) {
        redirect('/subscription/blocked')
    }

    return { user, trainer, subscription: subscription! }
}
