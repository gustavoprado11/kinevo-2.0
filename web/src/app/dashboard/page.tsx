import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { createClient } from '@/lib/supabase/server'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { isOrgBillingActive } from '@/lib/studio/org-access'
import { redirect } from 'next/navigation'
import { DashboardClient } from './dashboard-client'
import { StudioDashboardView } from './studio-view'
import { CheckoutPolling } from './checkout-polling'

export default async function DashboardPage({
    searchParams,
}: {
    searchParams: Promise<{ checkout?: string; h?: string; v?: string }>
}) {
    const { checkout, h, v } = await searchParams

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

    const { trainer, tier } = await getTrainerWithSubscription(user.id)

    // Preferência de Início (migration 210): home do Assistente → redireciona,
    // exceto ao voltar do checkout (mostra o dashboard) ou com ?h=classic
    // (toggle Assistente→Clássico, nav otimista — a preferência grava em
    // background e ainda pode estar 'assistant' nesta carga; não fazer bounce).
    // home_style já vem embutido no fetch do trainer acima — elimina o roundtrip
    // serial extra que rodava em toda carga do dashboard.
    if (checkout !== 'success' && h !== 'classic' && trainer.home_style === 'assistant') {
        redirect('/assistente')
    }

    // Estúdios (decisão 16/jul): o GESTOR usa o Dashboard normal — a visão do
    // estúdio (KPIs, por treinador, tendências) renderiza AQUI por padrão, com
    // toggle pro painel pessoal (?v=me). Coach comum segue no pessoal.
    if (checkout !== 'success' && v !== 'me') {
        const { data: mgr } = await supabase
            .from('organization_members')
            .select('organizations(id, name, subscription_status, grace_until)')
            .eq('trainer_id', trainer.id)
            .eq('status', 'active')
            .in('role', ['owner', 'admin'])
            .maybeSingle()
        const mgrOrg = (mgr as { organizations: { id: string; name: string; subscription_status: string; grace_until: string | null } | { id: string; name: string; subscription_status: string; grace_until: string | null }[] | null } | null)?.organizations
        const org = Array.isArray(mgrOrg) ? mgrOrg[0] : mgrOrg
        if (org && isOrgBillingActive(org.subscription_status, org.grace_until)) {
            return <StudioDashboardView trainer={trainer} organization={{ id: org.id, name: org.name }} />
        }
    }

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

    const selfStudent = students?.find(s => s.is_trainer_profile) ?? null

    // Estúdios: o modal de novo aluno do dashboard também precisa do toggle
    // "Aluno particular" (sem isto, todo aluno criado por aqui nascia no
    // estúdio). Coach de estúdio = membro ativo de qualquer papel.
    const { data: anyMembership } = await supabase
        .from('organization_members')
        .select('id')
        .eq('trainer_id', trainer.id)
        .eq('status', 'active')
        .maybeSingle()
    const isStudioCoach = !!anyMembership
    const hasPaidSolo = tier !== 'free'

    return (
        <DashboardClient
            trainer={trainer}
            data={data}
            initialStudents={(students || []).map(s => ({
                ...s,
                // CHECK constraint do schema garante a union
                status: s.status as 'active' | 'inactive' | 'pending',
            }))}
            selfStudentId={selfStudent?.id ?? null}
            formTemplates={formTemplates}
            isStudioCoach={isStudioCoach}
            hasPaidSolo={hasPaidSolo}
        />
    )
}
