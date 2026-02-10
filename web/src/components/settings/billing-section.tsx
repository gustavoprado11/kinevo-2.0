'use client'

import { useState } from 'react'
import { AlertTriangle, CreditCard, ExternalLink, CalendarDays, Activity, Wallet } from 'lucide-react'

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
            return { label: status, color: 'bg-muted text-muted-foreground border-border' }
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
                        <p className="mt-1 text-sm text-muted-foreground">
                            Sua assinatura será encerrada em <strong className="text-foreground">{formatDate(subscription.current_period_end)}</strong>.
                            Você mantém acesso total até essa data. Para reativar, clique em &quot;Gerenciar assinatura&quot; abaixo.
                        </p>
                    </div>
                </div>
            )}

            {/* Main Billing Card */}
            <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-card to-card/80 p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                            <CreditCard size={18} className="text-violet-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-card-foreground">Plano e Cobrança</h2>
                            <p className="mt-0.5 text-sm text-muted-foreground">Visão financeira da sua assinatura.</p>
                        </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${badge.color}`}>
                        {badge.label}
                    </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-xl border border-border bg-background p-4">
                        <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                            <Wallet size={14} />
                            Plano
                        </div>
                        <p className="font-semibold text-foreground">Kinevo Pro</p>
                        <p className="text-violet-300 text-sm mt-0.5">R$ 39,90/mês</p>
                    </div>

                    <div className="rounded-xl border border-border bg-background p-4">
                        <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                            <CalendarDays size={14} />
                            {subscription.cancel_at_period_end
                                ? 'Acesso até'
                                : subscription.status === 'trialing'
                                    ? 'Primeira cobrança'
                                    : 'Próxima cobrança'}
                        </div>
                        <p className="font-semibold text-foreground">{formatDate(subscription.current_period_end)}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">Data de referência da assinatura</p>
                    </div>
                </div>

                <div className="my-5 h-px bg-border" />

                <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                        <span className="inline-flex items-center gap-2 text-muted-foreground">
                            <Activity size={15} />
                            Status de cobrança
                        </span>
                        <span className="font-medium text-foreground">{badge.label}</span>
                    </div>

                    {trialDays !== null && !subscription.cancel_at_period_end && (
                        <div className="flex items-center justify-between text-sm">
                            <span className="inline-flex items-center gap-2 text-muted-foreground">
                                <CalendarDays size={15} />
                                Dias restantes do teste
                            </span>
                            <span className="text-violet-300 font-semibold">{trialDays} dias</span>
                        </div>
                    )}
                </div>

                {/* Manage button */}
                <div className="mt-6 border-t border-border pt-6">
                    <button
                        onClick={handleManageBilling}
                        disabled={loading}
                        className="inline-flex items-center gap-2 rounded-xl border border-input bg-background px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:bg-background"
                    >
                        {loading ? 'Abrindo...' : 'Gerenciar assinatura'}
                        <ExternalLink size={14} />
                    </button>
                    <p className="mt-2 text-xs text-muted-foreground">
                        {subscription.cancel_at_period_end
                            ? 'Reative sua assinatura, altere método de pagamento ou veja faturas.'
                            : 'Altere método de pagamento, veja faturas ou cancele sua assinatura.'}
                    </p>
                </div>
            </div>
        </div>
    )
}
