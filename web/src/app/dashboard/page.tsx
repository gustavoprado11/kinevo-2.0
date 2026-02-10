import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardClient } from './dashboard-client'
import { CheckoutPolling } from './checkout-polling'

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

    // Get trainer data
    const { data: trainer } = await supabase
        .from('trainers')
        .select('id, name, email')
        .eq('auth_user_id', user.id)
        .single()

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
        .select('id, name, email, phone, status, created_at')
        .order('created_at', { ascending: false })

    // Get daily activity
    const { getDailyActivity } = await import('@/actions/dashboard/get-daily-activity')
    const { data: dailyActivity } = await getDailyActivity()

    return <DashboardClient trainer={trainer} initialStudents={students || []} dailyActivity={dailyActivity || []} />
}
