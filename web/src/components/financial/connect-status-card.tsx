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

    // Fully connected — show balance + dashboard link
    return (
        <div className="rounded-2xl border border-emerald-500/20 bg-surface-card p-6">
            <div className="flex items-start gap-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/10">
                    <CheckCircle2 size={20} className="text-emerald-400" />
                </div>
                <div className="flex-1">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <h3 className="text-base font-semibold text-k-text-primary">
                                Stripe Conectado
                            </h3>
                            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                                Ativo
                            </span>
                        </div>
                        <button
                            onClick={handleOpenDashboard}
                            disabled={dashboardLoading}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-glass-bg hover:bg-violet-500/10 text-k-text-secondary hover:text-violet-400 transition-colors disabled:opacity-50"
                        >
                            {dashboardLoading ? (
                                <Loader2 size={12} className="animate-spin" />
                            ) : (
                                <ArrowUpRight size={12} />
                            )}
                            Painel Stripe
                        </button>
                    </div>

                    <div className="mt-3 flex gap-4 text-xs text-k-text-secondary">
                        <span className="flex items-center gap-1">
                            <CheckCircle2 size={12} className="text-emerald-400" />
                            Pagamentos habilitados
                        </span>
                        {payoutsEnabled && (
                            <span className="flex items-center gap-1">
                                <CheckCircle2 size={12} className="text-emerald-400" />
                                Transferências habilitadas
                            </span>
                        )}
                    </div>

                    {/* Balance section */}
                    {balanceLoading ? (
                        <div className="mt-4 flex items-center gap-2 text-xs text-k-text-secondary">
                            <Loader2 size={12} className="animate-spin" />
                            Carregando saldo...
                        </div>
                    ) : balance ? (
                        <div className="mt-4 grid grid-cols-2 gap-3">
                            <div className="rounded-xl bg-glass-bg p-3">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <Wallet size={12} className="text-emerald-400" />
                                    <span className="text-[10px] font-medium text-k-text-secondary uppercase tracking-wider">
                                        Disponível
                                    </span>
                                </div>
                                <p className="text-lg font-bold text-emerald-400">
                                    {formatCurrency(balance.available)}
                                </p>
                            </div>
                            <div className="rounded-xl bg-glass-bg p-3">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <Clock size={12} className="text-amber-400" />
                                    <span className="text-[10px] font-medium text-k-text-secondary uppercase tracking-wider">
                                        Pendente
                                    </span>
                                </div>
                                <p className="text-lg font-bold text-k-text-primary">
                                    {formatCurrency(balance.pending)}
                                </p>
                            </div>
                        </div>
                    ) : null}

                    {payoutsEnabled && (
                        <p className="mt-3 text-[11px] text-k-text-secondary">
                            O Stripe deposita automaticamente o saldo disponível na sua conta bancária.
                        </p>
                    )}
                </div>
            </div>
        </div>
    )
}
