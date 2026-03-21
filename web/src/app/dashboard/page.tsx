import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { createClient } from '@/lib/supabase/server'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { redirect } from 'next/navigation'
import { DashboardClient } from './dashboard-client'
import { CheckoutPolling } from './checkout-polling'

export default async function DashboardPage({
    searchParams,
}: {
    searchParams: Promise<{ checkout?: string }>
}) {
    const { checkout } = await searchParams

    // Single getUser() call for the entire page — validates the JWT once via
    // Supabase Auth API, then passes userId down to avoid redundant roundtrips.
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) redirect('/login')

    // Race condition: returning from Stripe checkout but webhook hasn't fired yet
    // We need to check this before getTrainerWithSubscription (which redirects if no subscription)
    if (checkout === 'success') {
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

    const { trainer } = await getTrainerWithSubscription(user.id)

    // Fetch dashboard data, students, and templates in parallel
    const [data, studentsResult, templatesResult] = await Promise.all([
        getDashboardData(trainer.id),
        supabase
            .from('students')
            .select('id, name, email, phone, status, created_at, is_trainer_profile')
            .order('created_at', { ascending: false }),
        supabase
            .from('form_templates')
            .select('id, title, trainer_id')
            .or(`trainer_id.eq.${trainer.id},trainer_id.is.null`)
            .or('system_key.is.null,system_key.neq.prescription_questionnaire')
            .eq('is_active', true)
            .order('created_at', { ascending: false }),
    ])

    const students = studentsResult.data
    const formTemplates = (templatesResult.data || []).map(t => ({
        id: t.id,
        title: t.title,
        trainer_id: t.trainer_id,
    }))

    const selfStudent = students?.find(s => (s as any).is_trainer_profile) ?? null

    return (
        <DashboardClient
            trainer={trainer}
            data={data}
            initialStudents={students || []}
            selfStudentId={selfStudent?.id ?? null}
            formTemplates={formTemplates}
        />
    )
}
