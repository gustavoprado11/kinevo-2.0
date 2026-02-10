'use client'

import { useState } from 'react'

const stateConfig = {
    no_subscription: {
        title: 'Complete sua assinatura',
        description: 'Para acessar o Kinevo, você precisa ativar sua assinatura. Comece com 7 dias grátis!',
        buttonText: 'Assinar agora — 7 dias grátis',
        action: 'checkout' as const,
    },
    past_due: {
        title: 'Pagamento pendente',
        description: 'Seu último pagamento falhou. Atualize seu método de pagamento para restaurar o acesso.',
        buttonText: 'Atualizar pagamento',
        action: 'portal' as const,
    },
    canceled: {
        title: 'Assinatura cancelada',
        description: 'Sua assinatura foi cancelada. Reative para continuar usando o Kinevo.',
        buttonText: 'Reativar assinatura',
        action: 'checkout' as const,
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

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900">
            <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md text-center">
                <div className="w-16 h-16 rounded-full bg-violet-500/10 flex items-center justify-center mx-auto mb-6">
                    <svg className="w-8 h-8 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                </div>

                <h1 className="text-2xl font-bold text-white mb-2">{config.title}</h1>
                <p className="text-gray-400 mb-2">Olá, {trainerName}.</p>
                <p className="text-gray-400 mb-8">{config.description}</p>

                {error && (
                    <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg text-sm mb-4">
                        {error}
                    </div>
                )}

                <button
                    onClick={handleAction}
                    disabled={loading}
                    className="w-full py-3 px-4 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-800 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors"
                >
                    {loading ? 'Processando...' : config.buttonText}
                </button>

                {state === 'no_subscription' && (
                    <p className="text-gray-500 text-sm mt-4">
                        R$ 39,90/mês após o período de teste
                    </p>
                )}
            </div>
        </div>
    )
}
