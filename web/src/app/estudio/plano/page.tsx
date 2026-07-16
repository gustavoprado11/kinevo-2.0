import { createClient } from '@/lib/supabase/server'
import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { AppLayout } from '@/components/layout'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { studioLimitForOrg, type StudioTier } from '@/lib/studio/studio-tiers'
import { requireManagerContext } from '../guard'
import { EstudioNav } from '../estudio-nav'
import { PlanoClient } from './plano-client'

export default async function EstudioPlanoPage() {
    const ctx = await requireManagerContext()
    const { trainer } = await getTrainerWithSubscription()
    await createClient()

    const { count } = await supabaseAdmin
        .from('students')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', ctx.organization.id)
        .eq('is_trainer_profile', false)

    const limit = studioLimitForOrg(ctx.organization.plan_tier)

    return (
        <AppLayout
            trainerName={trainer.name}
            trainerEmail={trainer.email}
            trainerAvatarUrl={trainer.avatar_url}
            trainerTheme={trainer.theme as 'light' | 'dark' | 'system' | null}
        >
            <div className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight text-k-text-primary">{ctx.organization.name}</h1>
                <p className="text-sm text-k-text-tertiary mt-0.5">Painel do estúdio — visão do gestor</p>
            </div>

            <EstudioNav active="plano" />

            <PlanoClient
                tier={(ctx.organization.plan_tier as StudioTier | null) ?? null}
                studentCount={count ?? 0}
                studentLimit={Number.isFinite(limit) ? limit : null}
                currentPeriodEnd={ctx.organization.current_period_end}
                cancelAtPeriodEnd={ctx.organization.cancel_at_period_end}
                status={ctx.organization.subscription_status}
            />
        </AppLayout>
    )
}
