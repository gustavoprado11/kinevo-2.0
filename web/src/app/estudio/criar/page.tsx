import { redirect } from 'next/navigation'
import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { getOrganizationContext } from '@/lib/studio/get-organization'
import { AppLayout } from '@/components/layout'
import { CriarEstudioClient } from './criar-client'

/**
 * Criação self-serve de estúdio. Quem já pertence a um estúdio ativo vai para o
 * painel; quem tem uma org 'incomplete' (checkout abandonado) vai para /estudio
 * /blocked retomar o pagamento.
 */
export default async function CriarEstudioPage() {
    const { trainer } = await getTrainerWithSubscription()
    const ctx = await getOrganizationContext()
    if (ctx) {
        redirect(ctx.organization.subscription_status === 'incomplete' ? '/estudio/blocked' : '/estudio')
    }

    return (
        <AppLayout
            trainerName={trainer.name}
            trainerEmail={trainer.email}
            trainerAvatarUrl={trainer.avatar_url}
            trainerTheme={trainer.theme as 'light' | 'dark' | 'system' | null}
        >
            <CriarEstudioClient />
        </AppLayout>
    )
}
