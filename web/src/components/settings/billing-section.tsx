'use client'

import { useState } from 'react'
import { AlertTriangle, CreditCard, ExternalLink, CalendarDays, Activity, Wallet, Tag } from 'lucide-react'

interface Subscription {
    status: string
    current_period_end: string | null
    cancel_at_period_end: boolean
    stripe_customer_id: string
}

interface BillingSectionProps {
    subscription: Subscription
    planName: string
    planAmount: number | null // in cents
    planCurrency: string
    planInterval: string
    discountName: string | null
    discountPercent: number | null
    discountAmountOff: number | null // in cents
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

function formatCurrency(amountInCents: number, currency: string): string {
    const amount = amountInCents / 100
    if (currency === 'brl') {
        return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    }
    return amount.toLocaleString('en-US', { style: 'currency', currency: currency.toUpperCase() })
}

function getIntervalLabel(interval: string): string {
    switch (interval) {
        case 'month': return 'mês'
        case 'year': return 'ano'
        case 'week': return 'semana'
        case 'day': return 'dia'
        default: return interval
    }
}

function getEffectivePrice(
    baseAmount: number | null,
    discountPercent: number | null,
    discountAmountOff: number | null,
): number | null {
    if (baseAmount === null) return null
    if (discountPercent) {
        return Math.round(baseAmount * (1 - discountPercent / 100))
    }
    if (discountAmountOff) {
        return Math.max(0, baseAmount - discountAmountOff)
    }
    return baseAmount
}

export function BillingSection({
    subscription,
    planName,
    planAmount,
    planCurrency,
    planInterval,
    discountName,
    discountPercent,
    discountAmountOff,
}: BillingSectionProps) {
    const [loading, setLoading] = useState(false)

    const badge = getStatusBadge(subscription.status, subscription.cancel_at_period_end)
    const trialDays = subscription.status === 'trialing' ? getTrialDaysRemaining(subscription.current_period_end) : null

    const hasDiscount = !!(discountPercent || discountAmountOff)
    const effectiveAmount = getEffectivePrice(planAmount, discountPercent, discountAmountOff)

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
        <div className="space-y-6 h-full flex flex-col">
            {/* Cancellation Banner */}
            {subscription.cancel_at_period_end && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5 flex items-start gap-4 shadow-sm">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                        <AlertTriangle size={20} className="text-amber-400" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-amber-400 font-bold text-[11px] uppercase tracking-widest">Cancelamento agendado</h3>
                        <p className="mt-1 text-sm text-k-text-tertiary">
                            Sua assinatura será encerrada em <strong className="text-k-text-primary">{formatDate(subscription.current_period_end)}</strong>.
                            Você mantém acesso total até essa data. Para reativar, clique em &quot;Gerenciar assinatura&quot; abaixo.
                        </p>
                    </div>
                </div>
            )}

            {/* Main Billing Card */}
            <div className="rounded-2xl border border-k-border-primary bg-surface-card p-6 shadow-sm flex-1 flex flex-col justify-between">
                <div>
                    <div className="flex items-start justify-between gap-4 mb-8">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
                                <CreditCard size={18} strokeWidth={1.5} />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-k-text-primary">Plano e Cobrança</h2>
                                <p className="mt-0.5 text-sm text-k-text-tertiary">Visão financeira da sua assinatura.</p>
                            </div>
                        </div>
                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${badge.color}`}>
                            {badge.label}
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Plan card */}
                        <div className="rounded-xl border border-k-border-subtle bg-glass-bg p-4">
                            <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-k-text-tertiary">
                                <Wallet size={12} strokeWidth={2} />
                                Plano
                            </div>
                            <p className="font-bold text-k-text-primary">{planName}</p>
                            {effectiveAmount !== null ? (
                                <div className="mt-0.5">
                                    {hasDiscount && planAmount !== null ? (
                                        <div className="flex items-center gap-2">
                                            <span className="text-k-text-quaternary text-sm line-through">
                                                {formatCurrency(planAmount, planCurrency)}
                                            </span>
                                            <span className="text-violet-400 text-sm font-medium">
                                                {formatCurrency(effectiveAmount, planCurrency)}/{getIntervalLabel(planInterval)}
                                            </span>
                                        </div>
                                    ) : (
                                        <p className="text-violet-400 text-sm font-medium">
                                            {formatCurrency(effectiveAmount, planCurrency)}/{getIntervalLabel(planInterval)}
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <p className="text-violet-400 text-sm mt-0.5 font-medium">—</p>
                            )}
                        </div>

                        {/* Date card */}
                        <div className="rounded-xl border border-k-border-subtle bg-glass-bg p-4">
                            <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-k-text-tertiary">
                                <CalendarDays size={12} strokeWidth={2} />
                                {subscription.cancel_at_period_end
                                    ? 'Acesso até'
                                    : subscription.status === 'trialing'
                                        ? 'Primeira cobrança'
                                        : 'Próxima cobrança'}
                            </div>
                            <p className="font-bold text-k-text-primary">{formatDate(subscription.current_period_end)}</p>
                            <p className="mt-0.5 text-[10px] font-bold text-k-text-quaternary uppercase tracking-widest">Data de referência</p>
                        </div>
                    </div>

                    {/* Coupon badge */}
                    {hasDiscount && discountName && (
                        <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-500/5 border border-emerald-500/20 px-4 py-2.5">
                            <Tag size={14} className="text-emerald-400 shrink-0" />
                            <div className="flex-1 min-w-0">
                                <span className="text-sm font-medium text-emerald-400">{discountName}</span>
                                {discountPercent && (
                                    <span className="ml-2 text-xs text-emerald-400/70">(-{discountPercent}%)</span>
                                )}
                                {discountAmountOff && (
                                    <span className="ml-2 text-xs text-emerald-400/70">(-{formatCurrency(discountAmountOff, planCurrency)})</span>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="my-6 h-px bg-k-border-subtle" />

                    <div className="space-y-4">
                        <div className="flex items-center justify-between text-sm">
                            <span className="inline-flex items-center gap-2 text-k-text-tertiary font-medium">
                                <Activity size={14} strokeWidth={1.5} />
                                Status de cobrança
                            </span>
                            <span className="font-bold text-k-text-primary">{badge.label}</span>
                        </div>

                        {trialDays !== null && !subscription.cancel_at_period_end && (
                            <div className="flex items-center justify-between text-sm">
                                <span className="inline-flex items-center gap-2 text-k-text-tertiary font-medium">
                                    <CalendarDays size={14} strokeWidth={1.5} />
                                    Dias restantes do teste
                                </span>
                                <span className="text-violet-400 font-bold">{trialDays} dias</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Manage button */}
                <div className="mt-8 border-t border-k-border-subtle pt-6">
                    <button
                        onClick={handleManageBilling}
                        disabled={loading}
                        className="inline-flex items-center gap-2 rounded-xl border border-k-border-primary bg-glass-bg px-5 py-2.5 text-sm font-bold text-k-text-primary transition-all hover:bg-glass-bg-active disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {loading ? 'Abrindo...' : 'Gerenciar assinatura'}
                        <ExternalLink size={14} strokeWidth={2} />
                    </button>
                    <p className="mt-3 text-xs text-k-text-quaternary italic">
                        {subscription.cancel_at_period_end
                            ? 'Reative sua assinatura, altere método de pagamento ou veja faturas.'
                            : 'Altere método de pagamento, veja faturas ou cancele sua assinatura.'}
                    </p>
                </div>
            </div>
        </div>
    )
}
