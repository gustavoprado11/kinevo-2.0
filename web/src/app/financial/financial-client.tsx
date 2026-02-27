'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Users, TrendingUp, Receipt, FileText, ArrowRight, Wallet } from 'lucide-react'
import { useOnboardingStore } from '@/stores/onboarding-store'
import Link from 'next/link'
import { AppLayout } from '@/components/layout'
import { ConnectStatusCard } from '@/components/financial/connect-status-card'
import { FinancialOnboarding } from '@/components/financial/financial-onboarding'
import { EmptyState } from '@/components/financial/empty-state'

interface Trainer {
    id: string
    name: string
    email: string
    avatar_url: string | null
    theme: string | null
}

interface Transaction {
    id: string
    amount_gross: number
    amount_net: number
    currency: string
    type: string
    status: string
    description: string | null
    created_at: string
    student_id: string | null
}

interface FinancialDashboardClientProps {
    trainer: Trainer
    connectStatus: {
        connected: boolean
        chargesEnabled: boolean
        detailsSubmitted: boolean
        payoutsEnabled: boolean
    }
    showOnboarding: boolean
    activeContractsCount: number
    mrr: number
    recentTransactions: Transaction[]
    plansCount: number
}

export function FinancialDashboardClient({
    trainer,
    connectStatus,
    showOnboarding: initialShowOnboarding,
    activeContractsCount,
    mrr,
    recentTransactions,
    plansCount,
}: FinancialDashboardClientProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [showOnboarding, setShowOnboarding] = useState(initialShowOnboarding)
    const [connectSyncing, setConnectSyncing] = useState(false)

    // Sync connect status on return from Stripe
    useEffect(() => {
        const connectParam = searchParams.get('connect')
        if (connectParam === 'success' || connectParam === 'refresh') {
            setConnectSyncing(true)
            fetch('/api/stripe/connect/status')
                .then(() => {
                    router.refresh()
                })
                .finally(() => {
                    setConnectSyncing(false)
                })
        }
    }, [searchParams, router])

    // Mark financial_setup milestone when Stripe is connected and charges enabled
    useEffect(() => {
        if (connectStatus.connected && connectStatus.chargesEnabled) {
            useOnboardingStore.getState().completeMilestone('financial_setup')
        }
    }, [connectStatus])

    if (showOnboarding) {
        return (
            <AppLayout
                trainerName={trainer.name}
                trainerEmail={trainer.email}
                trainerAvatarUrl={trainer.avatar_url}
                trainerTheme={trainer.theme as 'light' | 'dark' | 'system' | null}
            >
                <div className="min-h-[70vh] flex items-center justify-center">
                    <FinancialOnboarding onComplete={() => {
                        setShowOnboarding(false)
                        router.refresh()
                    }} />
                </div>
            </AppLayout>
        )
    }

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        }).format(value)
    }

    const statusBadge = (status: string) => {
        const map: Record<string, { label: string; classes: string }> = {
            succeeded: { label: 'Pago', classes: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
            failed: { label: 'Falhou', classes: 'bg-red-500/10 text-red-400 border-red-500/20' },
            pending: { label: 'Pendente', classes: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
            canceled: { label: 'Cancelado', classes: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
        }
        const badge = map[status] || map.pending
        return (
            <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border ${badge.classes}`}>
                {badge.label}
            </span>
        )
    }

    return (
        <AppLayout
            trainerName={trainer.name}
            trainerEmail={trainer.email}
            trainerAvatarUrl={trainer.avatar_url}
            trainerTheme={trainer.theme as 'light' | 'dark' | 'system' | null}
        >
        <div>
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-k-text-primary">Financeiro</h1>
                <p className="text-sm text-k-text-secondary mt-1">
                    Gerencie seus planos, cobranças e assinaturas.
                </p>
            </div>

            {/* Connect Status */}
            <div className="mb-8">
                <ConnectStatusCard
                    connected={connectStatus.connected}
                    chargesEnabled={connectStatus.chargesEnabled}
                    detailsSubmitted={connectStatus.detailsSubmitted}
                    payoutsEnabled={connectStatus.payoutsEnabled}
                />
                {connectSyncing && (
                    <p className="text-xs text-k-text-secondary mt-2">Sincronizando status...</p>
                )}
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <div className="rounded-2xl border border-k-border-primary bg-surface-card p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-violet-500/10">
                            <Users size={18} className="text-violet-400" />
                        </div>
                        <span className="text-xs font-medium text-k-text-secondary uppercase tracking-wider">
                            Assinaturas Ativas
                        </span>
                    </div>
                    <p className="text-2xl font-bold text-k-text-primary">{activeContractsCount}</p>
                </div>

                <div className="rounded-2xl border border-k-border-primary bg-surface-card p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-500/10">
                            <TrendingUp size={18} className="text-emerald-400" />
                        </div>
                        <span className="text-xs font-medium text-k-text-secondary uppercase tracking-wider">
                            Receita Mensal
                        </span>
                    </div>
                    <p className="text-2xl font-bold text-k-text-primary">{formatCurrency(mrr)}</p>
                </div>

                <div className="rounded-2xl border border-k-border-primary bg-surface-card p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-500/10">
                            <FileText size={18} className="text-blue-400" />
                        </div>
                        <span className="text-xs font-medium text-k-text-secondary uppercase tracking-wider">
                            Planos Criados
                        </span>
                    </div>
                    <p className="text-2xl font-bold text-k-text-primary">{plansCount}</p>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                <Link
                    href="/financial/plans"
                    className="rounded-2xl border border-k-border-primary bg-surface-card p-5 hover:border-violet-500/30 transition-colors group"
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-glass-bg">
                                <Wallet size={18} className="text-k-text-secondary" />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-k-text-primary">Meus Planos</h3>
                                <p className="text-xs text-k-text-secondary">Criar e gerenciar planos</p>
                            </div>
                        </div>
                        <ArrowRight size={16} className="text-k-text-secondary group-hover:text-violet-400 transition-colors" />
                    </div>
                </Link>

                <Link
                    href="/financial/subscriptions"
                    className="rounded-2xl border border-k-border-primary bg-surface-card p-5 hover:border-violet-500/30 transition-colors group"
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-glass-bg">
                                <Users size={18} className="text-k-text-secondary" />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-k-text-primary">Assinaturas</h3>
                                <p className="text-xs text-k-text-secondary">Gerenciar cobranças dos alunos</p>
                            </div>
                        </div>
                        <ArrowRight size={16} className="text-k-text-secondary group-hover:text-violet-400 transition-colors" />
                    </div>
                </Link>
            </div>

            {/* Recent Transactions */}
            <div className="rounded-2xl border border-k-border-primary bg-surface-card">
                <div className="px-6 py-4 border-b border-k-border-subtle">
                    <h2 className="text-sm font-semibold text-k-text-primary">Transações Recentes</h2>
                </div>
                {recentTransactions.length === 0 ? (
                    <EmptyState
                        icon={Receipt}
                        title="Nenhuma transação"
                        description="As transações dos seus alunos aparecerão aqui."
                    />
                ) : (
                    <div className="divide-y divide-k-border-subtle">
                        {recentTransactions.map((tx) => (
                            <div key={tx.id} className="px-6 py-3.5 flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-k-text-primary">
                                        {tx.description || tx.type}
                                    </p>
                                    <p className="text-xs text-k-text-secondary mt-0.5">
                                        {new Date(tx.created_at).toLocaleDateString('pt-BR')}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    {statusBadge(tx.status)}
                                    <span className="text-sm font-semibold text-k-text-primary">
                                        {formatCurrency(tx.amount_gross)}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
        </AppLayout>
    )
}
