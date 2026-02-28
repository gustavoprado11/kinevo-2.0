import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { createClient } from '@/lib/supabase/server'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { DashboardClient } from './dashboard-client'
import { CheckoutPolling } from './checkout-polling'

export default async function DashboardPage({
    searchParams,
}: {
    searchParams: Promise<{ checkout?: string }>
}) {
    const { checkout } = await searchParams

    // Race condition: returning from Stripe checkout but webhook hasn't fired yet
    // We need to check this before getTrainerWithSubscription (which redirects if no subscription)
    if (checkout === 'success') {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            const { data: sub } = await supabase
                .from('subscriptions')
                .select('status')
                .eq('trainer_id', user.id)
                .single()
            const isActive = sub?.status === 'trialing' || sub?.status === 'active'
            if (!isActive) {
                // Fetch trainer name for polling screen
                const { data: t } = await supabase
                    .from('trainers')
                    .select('name')
                    .eq('auth_user_id', user.id)
                    .single()
                return <CheckoutPolling trainerName={t?.name || ''} />
            }
        }
    }

    const { trainer } = await getTrainerWithSubscription()

    // Fetch students for StudentModal callback + self profile detection
    const supabase = await createClient()
    const { data: students } = await supabase
        .from('students')
        .select('id, name, email, phone, status, created_at, is_trainer_profile')
        .order('created_at', { ascending: false })

    const selfStudent = students?.find(s => (s as any).is_trainer_profile) ?? null

    // All dashboard data (cached 60s)
    const data = await getDashboardData(trainer.id)

    return (
        <DashboardClient
            trainer={trainer}
            data={data}
            initialStudents={students || []}
            selfStudentId={selfStudent?.id ?? null}
        />
    )
}
