import { createClient } from '@/lib/supabase/server'
import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { AppLayout } from '@/components/layout'
import { EquipeSection } from '@/components/settings/equipe-section'
import { getOrgMembersDirectory } from '@/lib/studio/org-directory'
import { requireManagerContext } from '../guard'
import { EstudioNav } from '../estudio-nav'

export default async function EstudioTreinadoresPage() {
    const ctx = await requireManagerContext()
    const { trainer } = await getTrainerWithSubscription()
    const supabase = await createClient()

    const directory = await getOrgMembersDirectory(supabase, ctx.organization.id)
    const coaches = directory.map(m => ({
        trainerId: m.trainer_id,
        role: m.role,
        status: m.status,
        name: m.name || '—',
        email: m.email || '',
    }))

    return (
        <AppLayout
            trainerName={trainer.name}
            trainerEmail={trainer.email}
            trainerAvatarUrl={trainer.avatar_url}
            trainerTheme={trainer.theme as 'light' | 'dark' | 'system' | null}
        >
            <div className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight text-k-text-primary">{ctx.organization.name}</h1>
                <p className="text-sm text-k-text-tertiary mt-0.5">Administração do estúdio</p>
            </div>

            <EstudioNav active="treinadores" />

            <div className="mt-6">
                <EquipeSection
                    organization={{
                        id: ctx.organization.id,
                        name: ctx.organization.name,
                        visibility: ctx.organization.visibility,
                    }}
                    isManager={ctx.isManager}
                    currentTrainerId={ctx.trainerId}
                    coaches={coaches}
                />
            </div>
        </AppLayout>
    )
}
