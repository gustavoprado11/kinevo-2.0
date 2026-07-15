import { createClient } from '@/lib/supabase/server'
import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { AppLayout } from '@/components/layout'
import { getOrgMembersDirectory } from '@/lib/studio/org-directory'
import { requireManagerContext } from '../guard'
import { EstudioNav } from '../estudio-nav'
import { EstudioAlunosClient, type StudentOverviewRow } from './estudio-alunos-client'

export default async function EstudioAlunosPage() {
    const ctx = await requireManagerContext()
    const { trainer } = await getTrainerWithSubscription()
    const supabase = await createClient()

    const [overviewRes, directory] = await Promise.all([
        supabase.rpc('get_org_students_overview', { p_org: ctx.organization.id }),
        getOrgMembersDirectory(supabase, ctx.organization.id),
    ])
    const students = (overviewRes.data ?? []) as StudentOverviewRow[]
    const coaches = directory
        .filter(m => m.is_coach && m.status === 'active')
        .map(m => ({ id: m.trainer_id, name: m.name }))

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

            <EstudioNav active="alunos" />

            <EstudioAlunosClient students={students} coaches={coaches} />
        </AppLayout>
    )
}
