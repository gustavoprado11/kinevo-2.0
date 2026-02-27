import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardClient } from './dashboard-client'
import { CheckoutPolling } from './checkout-polling'
import { DEFAULT_ONBOARDING_STATE } from '@kinevo/shared/types/onboarding'

export default async function DashboardPage({
    searchParams,
}: {
    searchParams: Promise<{ checkout?: string }>
}) {
    const supabase = await createClient()
    const { checkout } = await searchParams

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    // Get trainer data (resilient: works with or without onboarding_state column)
    let trainer: { id: string; name: string; email: string; avatar_url?: string | null; theme?: 'light' | 'dark' | 'system' | null; onboarding_state?: any; [key: string]: any } | null = null

    const { data: t1, error: e1 } = await supabase
        .from('trainers')
        .select('id, name, email, avatar_url, theme, onboarding_state')
        .eq('auth_user_id', user.id)
        .single()

    if (t1) {
        trainer = t1 as any
    } else if (e1 && e1.message?.includes('onboarding_state')) {
        const { data: t2 } = await supabase
            .from('trainers')
            .select('id, name, email, avatar_url, theme')
            .eq('auth_user_id', user.id)
            .single()
        trainer = t2 ? { ...t2, onboarding_state: DEFAULT_ONBOARDING_STATE } as any : null
    }

    if (!trainer) {
        // No trainer record — force logout
        await supabase.auth.signOut()
        redirect('/login')
    }

    // Check subscription
    const { data: subscription } = await supabase
        .from('subscriptions')
        .select('status, current_period_end, cancel_at_period_end')
        .eq('trainer_id', trainer.id)
        .single()

    const isActive = subscription?.status === 'trialing' || subscription?.status === 'active'

    // Race condition: returning from Stripe checkout but webhook hasn't fired yet
    if (!isActive && checkout === 'success') {
        return <CheckoutPolling trainerName={trainer.name} />
    }

    // No active subscription — redirect to blocked page
    if (!isActive) {
        redirect('/subscription/blocked')
    }

    // Get students for this trainer (RLS will filter automatically)
    const { data: students } = await supabase
        .from('students')
        .select('id, name, email, phone, status, created_at, is_trainer_profile')
        .order('created_at', { ascending: false })

    // Find the trainer's self-student profile
    const selfStudent = students?.find(s => (s as any).is_trainer_profile) ?? null

    // Get daily activity
    const { getDailyActivity } = await import('@/actions/dashboard/get-daily-activity')
    const { data: dailyActivity } = await getDailyActivity()

    return <DashboardClient trainer={trainer} initialStudents={students || []} dailyActivity={dailyActivity || []} selfStudentId={selfStudent?.id ?? null} />
}
