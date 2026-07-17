import { redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { AlertCircle } from 'lucide-react'
import { getOrganizationContext } from '@/lib/studio/get-organization'
import { isOrgBillingActive } from '@/lib/studio/org-access'
import { StudioTierPicker } from '../studio-tier-picker'

/**
 * Estúdio sem billing ativo (incomplete / blocked / canceled / past_due vencido).
 * Gestor: escolhe a faixa e assina (ou retoma o checkout abandonado). Coach:
 * mensagem para falar com o gestor. Org ativa ou sem org → dashboard.
 */
export default async function EstudioBlockedPage() {
    const ctx = await getOrganizationContext()
    if (!ctx) redirect('/dashboard')
    if (isOrgBillingActive(ctx.organization.subscription_status, ctx.organization.grace_until)) {
        redirect('/estudio')
    }

    const isNew = ctx.organization.subscription_status === 'incomplete'

    if (!ctx.isManager) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-surface-bg px-6">
                <div className="relative z-sticky w-full max-w-md text-center">
                    <div className="flex items-center justify-center gap-3 mb-10">
                        <Image src="/logo-icon.png" alt="Kinevo" width={32} height={32} className="rounded-lg" />
                        <span className="text-xl font-black text-white tracking-tight">Kinevo</span>
                    </div>
                    <div className="bg-glass-bg backdrop-blur-md border border-k-border-primary rounded-2xl p-8">
                        <div className="w-16 h-16 rounded-2xl bg-glass-bg border border-k-border-subtle flex items-center justify-center mx-auto mb-6">
                            <AlertCircle size={28} className="text-amber-400" />
                        </div>
                        <h1 className="text-2xl font-black text-white tracking-tight mb-2">Estúdio suspenso</h1>
                        <p className="text-k-text-tertiary mb-1">{ctx.organization.name}</p>
                        <p className="text-k-text-tertiary mb-8">O acesso do estúdio está suspenso. Fale com o gestor para regularizar.</p>
                        <Link href="/dashboard" className="inline-block w-full py-3 px-4 bg-primary hover:opacity-90 text-primary-foreground text-[11px] font-black rounded-control transition-all">
                            Voltar ao painel
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    // Gestor: seletor de faixa → checkout.
    return (
        <div className="min-h-screen bg-surface-bg px-6 py-16">
            <div className="mx-auto max-w-4xl">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                        <AlertCircle size={22} className="text-amber-500" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-k-text-primary">
                        {isNew ? `Ativar o ${ctx.organization.name}` : 'Reativar o estúdio'}
                    </h1>
                </div>
                <p className="text-sm text-k-text-tertiary mb-8">
                    {isNew
                        ? 'Escolha a faixa por número de alunos. Treinadores são ilimitados em todas.'
                        : 'A assinatura do estúdio está inativa. Escolha uma faixa para reativar o acesso da equipe.'}
                </p>
                <StudioTierPicker currentTier={ctx.organization.plan_tier as import('@/lib/studio/studio-tiers').StudioTier | null} ctaLabel="Assinar" />
                <div className="mt-8">
                    <Link href="/dashboard" className="text-sm text-k-text-tertiary hover:text-k-text-primary">← Voltar ao painel</Link>
                </div>
            </div>
        </div>
    )
}
