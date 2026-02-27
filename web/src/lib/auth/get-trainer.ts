import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DEFAULT_ONBOARDING_STATE } from '@kinevo/shared/types/onboarding'
import type { OnboardingState } from '@kinevo/shared/types/onboarding'

interface TrainerRecord {
    id: string
    name: string
    email: string
    avatar_url: string | null
    theme: 'light' | 'dark' | 'system' | null
    ai_prescriptions_enabled?: boolean
    onboarding_state: OnboardingState | null
    [key: string]: any
}

export async function getTrainerWithSubscription() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) redirect('/login')

    // Try with onboarding_state first; fall back without it if column doesn't exist yet
    let trainer: TrainerRecord | null = null

    const { data: t1, error: e1 } = await supabase
        .from('trainers')
        .select('id, name, email, avatar_url, theme, ai_prescriptions_enabled, onboarding_state')
        .eq('auth_user_id', user.id)
        .single()

    if (t1) {
        trainer = t1 as unknown as TrainerRecord
    } else if (e1 && e1.message?.includes('onboarding_state')) {
        // Column doesn't exist yet — query without it
        const { data: t2 } = await supabase
            .from('trainers')
            .select('id, name, email, avatar_url, theme, ai_prescriptions_enabled')
            .eq('auth_user_id', user.id)
            .single()
        trainer = t2 ? { ...t2, onboarding_state: DEFAULT_ONBOARDING_STATE } as unknown as TrainerRecord : null
    }

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
