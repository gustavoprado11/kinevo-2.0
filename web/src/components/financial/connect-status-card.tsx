'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2, AlertCircle, ExternalLink, Loader2, Wallet, Clock, ArrowUpRight } from 'lucide-react'

interface ConnectStatusCardProps {
    connected: boolean
    chargesEnabled: boolean
    detailsSubmitted: boolean
    payoutsEnabled: boolean
}

interface StripeBalance {
    available: number
    pending: number
    currency: string
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value)
}

const formatBalance = (value: number) => {
    if (value <= 0) return 'R$ 0,00'
    return formatCurrency(value)
}

export function ConnectStatusCard({
    connected,
    chargesEnabled,
    detailsSubmitted,
    payoutsEnabled,
}: ConnectStatusCardProps) {
    const [loading, setLoading] = useState(false)
    const [dashboardLoading, setDashboardLoading] = useState(false)
    const [balance, setBalance] = useState<StripeBalance | null>(null)
    const [balanceLoading, setBalanceLoading] = useState(false)

    const isFullyConnected = connected && detailsSubmitted && chargesEnabled

    // Fetch balance when fully connected
    useEffect(() => {
        if (!isFullyConnected) return

        setBalanceLoading(true)
        fetch('/api/stripe/connect/balance')
            .then(res => res.json())
            .then(data => {
                if (!data.error) {
                    setBalance(data)
                }
            })
            .catch(() => {})
            .finally(() => setBalanceLoading(false))
    }, [isFullyConnected])

    const handleConnect = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/stripe/connect/onboard', { method: 'POST' })
            const data = await res.json()
            if (data.url) {
                window.location.href = data.url
            }
        } catch {
            setLoading(false)
        }
    }

    const handleOpenDashboard = async () => {
        setDashboardLoading(true)
        try {
            const res = await fetch('/api/stripe/connect/dashboard', { method: 'POST' })
            const data = await res.json()
            if (data.url) {
                window.open(data.url, '_blank')
            }
        } catch {
            // silently fail
        } finally {
            setDashboardLoading(false)
        }
    }

    // Not connected at all
    if (!connected) {
        return (
            <div className="rounded-2xl border border-k-border-primary bg-surface-card p-6">
                <div className="flex items-start gap-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-violet-500/10">
                        <ExternalLink size={20} className="text-violet-400" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-base font-semibold text-k-text-primary">
                            Conectar com Stripe
                        </h3>
                        <p className="text-sm text-k-text-secondary mt-1">
                            Conecte sua conta Stripe para receber pagamentos automáticos dos seus alunos via cartão ou Pix.
                        </p>
                        <button
                            onClick={handleConnect}
                            disabled={loading}
                            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-xl bg-violet-600 hover:bg-violet-500 text-white transition-colors disabled:opacity-50"
                        >
                            {loading ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : (
                                <ExternalLink size={16} />
                            )}
                            Conectar com Stripe
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    // Connected but onboarding incomplete
    if (!detailsSubmitted || !chargesEnabled) {
        return (
            <div className="rounded-2xl border border-amber-500/20 bg-surface-card p-6">
                <div className="flex items-start gap-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-500/10">
                        <AlertCircle size={20} className="text-amber-400" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-base font-semibold text-k-text-primary">
                            Completar cadastro no Stripe
                        </h3>
                        <p className="text-sm text-k-text-secondary mt-1">
                            Sua conta Stripe está conectada, mas você precisa completar o cadastro para receber pagamentos.
                        </p>
                        <button
                            onClick={handleConnect}
                            disabled={loading}
                            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-xl bg-amber-600 hover:bg-amber-500 text-white transition-colors disabled:opacity-50"
                        >
                            {loading ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : (
                                <ExternalLink size={16} />
                            )}
                            Completar Cadastro
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    // Fully connected — compact inline layout with balance
    return (
        <div className="rounded-2xl border border-k-border-primary bg-surface-card px-5 py-4">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" />
                    <span className="text-sm font-medium text-k-text-primary">Stripe conectado</span>
                    {balanceLoading ? (
                        <Loader2 size={12} className="animate-spin text-k-text-quaternary" />
                    ) : balance ? (
                        <div className="flex items-center gap-3 ml-2 text-xs text-k-text-secondary">
                            <span className="flex items-center gap-1">
                                <Wallet size={12} className="text-emerald-400" />
                                {formatBalance(balance.available)}
                            </span>
                            {balance.pending > 0 && (
                                <span className="flex items-center gap-1">
                                    <Clock size={12} className="text-amber-400" />
                                    {formatCurrency(balance.pending)} pendente
                                </span>
                            )}
                        </div>
                    ) : null}
                </div>
                <button
                    onClick={handleOpenDashboard}
                    disabled={dashboardLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-glass-bg hover:bg-violet-500/10 text-k-text-secondary hover:text-violet-400 transition-colors disabled:opacity-50 flex-shrink-0"
                >
                    {dashboardLoading ? (
                        <Loader2 size={12} className="animate-spin" />
                    ) : (
                        <ArrowUpRight size={12} />
                    )}
                    Painel Stripe
                </button>
            </div>
        </div>
    )
}
