'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Lock, AlertCircle, RefreshCw } from 'lucide-react'

const stateConfig = {
    no_subscription: {
        icon: <Lock size={28} className="text-violet-400" />,
        title: 'Complete sua assinatura',
        description: 'Para acessar o Kinevo, você precisa ativar sua assinatura. Comece com 7 dias grátis!',
        buttonText: 'Assinar agora — 7 dias grátis',
        action: 'checkout' as const,
        showPrice: true,
    },
    past_due: {
        icon: <AlertCircle size={28} className="text-amber-400" />,
        title: 'Pagamento pendente',
        description: 'Seu último pagamento falhou. Atualize seu método de pagamento para restaurar o acesso ao Kinevo.',
        buttonText: 'Atualizar pagamento',
        action: 'portal' as const,
        showPrice: false,
    },
    canceled: {
        icon: <RefreshCw size={28} className="text-violet-400" />,
        title: 'Assinatura cancelada',
        description: 'Sua assinatura foi cancelada. Reative para continuar gerenciando seus alunos e treinos no Kinevo.',
        buttonText: 'Reativar assinatura',
        action: 'checkout' as const,
        showPrice: true,
    },
}

interface BlockedClientProps {
    trainerName: string
    state: 'no_subscription' | 'past_due' | 'canceled'
}

export function BlockedClient({ trainerName, state }: BlockedClientProps) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const config = stateConfig[state]

    const handleAction = async () => {
        setLoading(true)
        setError(null)

        const endpoint = config.action === 'checkout'
            ? '/api/stripe/checkout'
            : '/api/stripe/portal'

        try {
            const res = await fetch(endpoint, { method: 'POST' })
            const json = await res.json()

            if (!res.ok || !json.url) {
                setError('Erro ao processar. Tente novamente.')
                setLoading(false)
                return
            }

            window.location.href = json.url
        } catch {
            setError('Erro de conexão. Tente novamente.')
            setLoading(false)
        }
    }

    const handleLogout = async () => {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        await supabase.auth.signOut()
        window.location.href = '/login'
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-surface-bg px-6">
            {/* Background glows */}
            <div className="fixed top-0 -left-1/4 w-1/2 h-1/2 bg-violet-600/5 blur-[120px] rounded-full pointer-events-none" />
            <div className="fixed bottom-0 -right-1/4 w-1/2 h-1/2 bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none" />

            <div className="relative z-10 w-full max-w-md text-center">
                {/* Logo */}
                <div className="flex items-center justify-center gap-3 mb-10">
                    <Image
                        src="/logo-icon.png"
                        alt="Kinevo"
                        width={32}
                        height={32}
                        className="rounded-lg"
                    />
                    <span className="text-xl font-black text-white tracking-tight">Kinevo</span>
                </div>

                {/* Card */}
                <div className="bg-glass-bg backdrop-blur-md border border-k-border-primary rounded-2xl p-8">
                    {/* Icon */}
                    <div className="w-16 h-16 rounded-2xl bg-glass-bg border border-k-border-subtle flex items-center justify-center mx-auto mb-6">
                        {config.icon}
                    </div>

                    <h1 className="text-2xl font-black text-white tracking-tight mb-2">{config.title}</h1>
                    <p className="text-k-text-tertiary mb-1">Olá, {trainerName}.</p>
                    <p className="text-k-text-tertiary mb-8">{config.description}</p>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm mb-4">
                            {error}
                        </div>
                    )}

                    <button
                        onClick={handleAction}
                        disabled={loading}
                        className="w-full py-3 px-4 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-600/50 disabled:cursor-not-allowed text-white text-[11px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-violet-600/20 hover:shadow-violet-500/30"
                    >
                        {loading ? 'Processando...' : config.buttonText}
                    </button>

                    {config.showPrice && (
                        <p className="text-k-text-quaternary text-sm mt-4">
                            R$ 39,90/mês {state === 'no_subscription' ? 'após o período de teste' : ''}
                        </p>
                    )}
                </div>

                {/* Logout link */}
                <button
                    onClick={handleLogout}
                    className="text-k-text-quaternary hover:text-k-text-tertiary text-sm mt-6 transition-colors"
                >
                    Sair da conta
                </button>
            </div>
        </div>
    )
}
