'use client'

import { useState } from 'react'

interface Subscription {
    status: string
    current_period_end: string | null
    cancel_at_period_end: boolean
    stripe_customer_id: string
}

interface BillingSectionProps {
    subscription: Subscription
}

function getStatusBadge(status: string) {
    switch (status) {
        case 'active':
            return { label: 'Ativo', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' }
        case 'trialing':
            return { label: 'Trial', color: 'bg-violet-500/10 text-violet-400 border-violet-500/20' }
        case 'past_due':
            return { label: 'Pagamento pendente', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' }
        case 'canceled':
            return { label: 'Cancelado', color: 'bg-red-500/10 text-red-400 border-red-500/20' }
        default:
            return { label: status, color: 'bg-gray-500/10 text-gray-400 border-gray-500/20' }
    }
}

function formatDate(dateStr: string | null) {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    })
}

function getTrialDaysRemaining(periodEnd: string | null): number | null {
    if (!periodEnd) return null
    const end = new Date(periodEnd)
    const now = new Date()
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return diff > 0 ? diff : 0
}

export function BillingSection({ subscription }: BillingSectionProps) {
    const [loading, setLoading] = useState(false)

    const badge = getStatusBadge(subscription.status)
    const trialDays = subscription.status === 'trialing' ? getTrialDaysRemaining(subscription.current_period_end) : null

    const handleManageBilling = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/stripe/portal', { method: 'POST' })
            const json = await res.json()
            if (json.url) {
                window.location.href = json.url
            }
        } catch {
            setLoading(false)
        }
    }

    return (
        <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-6">
            <h2 className="text-lg font-semibold text-white mb-6">Plano e Cobrança</h2>

            <div className="space-y-4">
                {/* Status */}
                <div className="flex items-center justify-between">
                    <span className="text-gray-400">Status</span>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium border ${badge.color}`}>
                        {badge.label}
                        {trialDays !== null && ` (${trialDays} dias restantes)`}
                    </span>
                </div>

                {/* Plan */}
                <div className="flex items-center justify-between">
                    <span className="text-gray-400">Plano</span>
                    <span className="text-white font-medium">Kinevo Pro — R$ 39,90/mês</span>
                </div>

                {/* Next billing */}
                <div className="flex items-center justify-between">
                    <span className="text-gray-400">
                        {subscription.status === 'trialing' ? 'Primeira cobrança' : 'Próxima cobrança'}
                    </span>
                    <span className="text-white">{formatDate(subscription.current_period_end)}</span>
                </div>

                {/* Cancel warning */}
                {subscription.cancel_at_period_end && (
                    <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 px-4 py-3 rounded-lg text-sm">
                        Sua assinatura será cancelada em {formatDate(subscription.current_period_end)}.
                        Você mantém acesso até essa data.
                    </div>
                )}
            </div>

            {/* Manage button */}
            <div className="mt-6 pt-6 border-t border-gray-700/50">
                <button
                    onClick={handleManageBilling}
                    disabled={loading}
                    className="px-6 py-2.5 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors text-sm"
                >
                    {loading ? 'Abrindo...' : 'Gerenciar assinatura'}
                </button>
                <p className="text-gray-500 text-xs mt-2">
                    Altere método de pagamento, veja faturas ou cancele sua assinatura.
                </p>
            </div>
        </div>
    )
}
