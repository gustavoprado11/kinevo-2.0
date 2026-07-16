import { redirect } from 'next/navigation'
import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { getOrganizationContext } from '@/lib/studio/get-organization'
import { tierDisplay } from '@/lib/billing/tiers'
import { AppLayout } from '@/components/layout'
import { CriarEstudioClient } from './criar-client'

/**
 * Criação self-serve de estúdio. Quem já pertence a um estúdio ativo vai para o
 * painel; quem tem uma org 'incomplete' (checkout abandonado) vai para /estudio
 * /blocked retomar o pagamento.
 */
export default async function CriarEstudioPage() {
    const { trainer, tier } = await getTrainerWithSubscription()
    const ctx = await getOrganizationContext()
    if (ctx) {
        redirect(ctx.organization.subscription_status === 'incomplete' ? '/estudio/blocked' : '/estudio')
    }

    // Dupla cobrança: quem já paga um plano solo precisa saber que ele continua
    // (e passa a valer só para alunos particulares) — decide depois no painel.
    const soloDisplay = tier !== 'free' ? tierDisplay(tier) : undefined
    const soloPlanNote = soloDisplay ? `${soloDisplay.name} · ${soloDisplay.price}/mês` : null

    return (
        <AppLayout
            trainerName={trainer.name}
            trainerEmail={trainer.email}
            trainerAvatarUrl={trainer.avatar_url}
            trainerTheme={trainer.theme as 'light' | 'dark' | 'system' | null}
        >
            <CriarEstudioClient soloPlanNote={soloPlanNote} />
        </AppLayout>
    )
}
