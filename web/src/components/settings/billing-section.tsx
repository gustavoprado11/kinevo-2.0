'use client'

import { useState } from 'react'
import { AlertTriangle, CreditCard, ExternalLink } from 'lucide-react'

interface Subscription {
    status: string
    current_period_end: string | null
    cancel_at_period_end: boolean
    stripe_customer_id: string
}

interface BillingSectionProps {
    subscription: Subscription
}

function getStatusBadge(status: string, cancelAtPeriodEnd: boolean) {
    if (cancelAtPeriodEnd) {
        return { label: 'Cancelamento agendado', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' }
    }

    switch (status) {
        case 'active':
            return { label: 'Ativo', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' }
        case 'trialing':
            return { label: 'Período de teste', color: 'bg-violet-500/10 text-violet-400 border-violet-500/20' }
        case 'past_due':
            return { label: 'Pagamento pendente', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' }
        case 'canceled':
            return { label: 'Cancelado', color: 'bg-red-500/10 text-red-400 border-red-500/20' }
        default:
            return { label: status, color: 'bg-slate-500/10 text-slate-400 border-slate-500/20' }
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

    const badge = getStatusBadge(subscription.status, subscription.cancel_at_period_end)
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
        <div className="space-y-4">
            {/* Cancellation Banner */}
            {subscription.cancel_at_period_end && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5 flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                        <AlertTriangle size={20} className="text-amber-400" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-amber-400 font-semibold text-sm">Cancelamento agendado</h3>
                        <p className="text-slate-400 text-sm mt-1">
                            Sua assinatura será encerrada em <strong className="text-white">{formatDate(subscription.current_period_end)}</strong>.
                            Você mantém acesso total até essa data. Para reativar, clique em &quot;Gerenciar assinatura&quot; abaixo.
                        </p>
                    </div>
                </div>
            )}

            {/* Main Billing Card */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6">
                    <CreditCard size={20} className="text-slate-400" />
                    <h2 className="text-lg font-semibold text-white">Plano e Cobrança</h2>
                </div>

                <div className="space-y-4">
                    {/* Status */}
                    <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-sm">Status</span>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${badge.color}`}>
                            {badge.label}
                        </span>
                    </div>

                    {/* Trial info */}
                    {trialDays !== null && !subscription.cancel_at_period_end && (
                        <div className="flex items-center justify-between">
                            <span className="text-slate-400 text-sm">Dias restantes do trial</span>
                            <span className="text-violet-400 font-bold">{trialDays} dias</span>
                        </div>
                    )}

                    {/* Plan */}
                    <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-sm">Plano</span>
                        <span className="text-white font-medium text-sm">Kinevo Pro — R$ 39,90/mês</span>
                    </div>

                    {/* Next billing / End date */}
                    <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-sm">
                            {subscription.cancel_at_period_end
                                ? 'Acesso até'
                                : subscription.status === 'trialing'
                                    ? 'Primeira cobrança'
                                    : 'Próxima cobrança'}
                        </span>
                        <span className="text-white text-sm">{formatDate(subscription.current_period_end)}</span>
                    </div>
                </div>

                {/* Manage button */}
                <div className="mt-6 pt-6 border-t border-slate-800">
                    <button
                        onClick={handleManageBilling}
                        disabled={loading}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-800 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors text-sm"
                    >
                        {loading ? 'Abrindo...' : 'Gerenciar assinatura'}
                        <ExternalLink size={14} />
                    </button>
                    <p className="text-slate-500 text-xs mt-2">
                        {subscription.cancel_at_period_end
                            ? 'Reative sua assinatura, altere método de pagamento ou veja faturas.'
                            : 'Altere método de pagamento, veja faturas ou cancele sua assinatura.'}
                    </p>
                </div>
            </div>
        </div>
    )
}
