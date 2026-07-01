import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { AlertCircle } from 'lucide-react'
import { getOrganizationContext } from '@/lib/studio/get-organization'

/**
 * Estúdios P1.0 — tela de estúdio bloqueado por billing.
 *
 * Alvo do redirect em `settings/page.tsx` quando a org está com
 * `subscription_status = 'blocked'`. Por ora é só a tela (o fluxo real de
 * checkout/reativação do estúdio é ligado na P1.5). Quem não pertence a uma org
 * bloqueada é mandado ao dashboard.
 */
export default async function EstudioBlockedPage() {
    const ctx = await getOrganizationContext()

    // Sem org, ou org com billing OK → não há bloqueio a exibir.
    if (!ctx || ctx.organization.subscription_status !== 'blocked') {
        redirect('/dashboard')
    }

    const description = ctx.isManager
        ? 'A assinatura do estúdio está suspensa. Regularize o pagamento para reativar o acesso da sua equipe.'
        : 'O acesso do estúdio está temporariamente suspenso. Fale com o responsável pelo estúdio para regularizar.'

    return (
        <div className="min-h-screen flex items-center justify-center bg-surface-bg px-6">
            {/* Background glows */}
            <div className="fixed top-0 -left-1/4 w-1/2 h-1/2 bg-violet-600/5 blur-[120px] rounded-full pointer-events-none" />
            <div className="fixed bottom-0 -right-1/4 w-1/2 h-1/2 bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none" />

            <div className="relative z-sticky w-full max-w-md text-center">
                {/* Logo */}
                <div className="flex items-center justify-center gap-3 mb-10">
                    <Image src="/logo-icon.png" alt="Kinevo" width={32} height={32} className="rounded-lg" />
                    <span className="text-xl font-black text-white tracking-tight">Kinevo</span>
                </div>

                {/* Card */}
                <div className="bg-glass-bg backdrop-blur-md border border-k-border-primary rounded-2xl p-8">
                    <div className="w-16 h-16 rounded-2xl bg-glass-bg border border-k-border-subtle flex items-center justify-center mx-auto mb-6">
                        <AlertCircle size={28} className="text-amber-400" />
                    </div>

                    <h1 className="text-2xl font-black text-white tracking-tight mb-2">Estúdio suspenso</h1>
                    <p className="text-k-text-tertiary mb-1">{ctx.organization.name}</p>
                    <p className="text-k-text-tertiary mb-8">{description}</p>

                    <Link
                        href="/dashboard"
                        className="inline-block w-full py-3 px-4 bg-violet-600 hover:bg-violet-500 text-white text-[11px] font-black rounded-xl transition-all shadow-lg shadow-violet-600/20 hover:shadow-violet-500/30"
                    >
                        Voltar ao painel
                    </Link>
                </div>
            </div>
        </div>
    )
}
