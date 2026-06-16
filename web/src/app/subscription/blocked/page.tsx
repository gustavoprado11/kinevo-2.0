import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BlockedClient } from './blocked-client'

/**
 * Fase 1 · Trilha 3 — o hard-block deixou de existir.
 *
 * Esta rota não é mais um portão obrigatório: `get-trainer.ts` não redireciona
 * mais quem está sem assinatura ativa (esse treinador cai no Free e entra). A
 * página passa a ser uma tela de UPGRADE / "continuar no Gratuito":
 *   - CTA principal: assinar/reativar um plano (BlockedClient → checkout/portal).
 *   - Escape hatch: continuar no plano Gratuito (limitado), indo para o dashboard.
 *
 * Pagante ATIVO que chegar aqui por engano é mandado direto ao dashboard.
 */
export default async function SubscriptionBlockedPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) redirect('/login')

    const { data: trainer } = await supabase
        .from('trainers')
        .select('id, name')
        .eq('auth_user_id', user.id)
        .single()

    if (!trainer) redirect('/login')

    const { data: subscription } = await supabase
        .from('subscriptions')
        .select('status')
        .eq('trainer_id', trainer.id)
        .single()

    // Assinatura ativa → não há o que oferecer aqui; segue para o dashboard.
    if (subscription?.status === 'trialing' || subscription?.status === 'active') {
        redirect('/dashboard')
    }

    // Estado para a copy do card de upgrade.
    const state: 'no_subscription' | 'past_due' | 'canceled' = !subscription
        ? 'no_subscription'
        : subscription.status === 'past_due'
            ? 'past_due'
            : 'canceled'

    return (
        <>
            <BlockedClient trainerName={trainer.name} state={state} />
            {/* Escape hatch: o Free substitui o antigo bloqueio total. */}
            <Link
                href="/dashboard"
                className="fixed bottom-6 left-1/2 -translate-x-1/2 z-sticky text-k-text-quaternary hover:text-k-text-tertiary text-sm transition-colors"
            >
                Continuar no plano Gratuito (limitado)
            </Link>
        </>
    )
}
