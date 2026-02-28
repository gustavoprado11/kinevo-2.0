'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Users, TrendingUp, Receipt, ArrowRight, Wallet, AlertTriangle, UserX, Plus, CheckCircle, Check } from 'lucide-react'
import { useOnboardingStore } from '@/stores/onboarding-store'
import Link from 'next/link'
import { AppLayout } from '@/components/layout'
import { ConnectStatusCard } from '@/components/financial/connect-status-card'
import { FinancialOnboarding } from '@/components/financial/financial-onboarding'
import { EmptyState } from '@/components/financial/empty-state'
import { NewSubscriptionModal } from '@/components/financial/new-subscription-modal'
import { markAsPaid } from '@/actions/financial/mark-as-paid'

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
    studentName: string | null
}

interface OverdueContract {
    id: string
    studentName: string
    amount: number
    currentPeriodEnd: string | null
}

interface ModalStudent {
    id: string
    name: string
    email: string
}

interface ModalPlan {
    id: string
    title: string
    price: number
    interval: string
    stripe_price_id: string | null
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
    overdueContracts: OverdueContract[]
    students: ModalStudent[]
    activePlans: ModalPlan[]
    hasStripeConnect: boolean
    totalStudents: number
    studentsWithoutContract: number
}

export function FinancialDashboardClient({
    trainer,
    connectStatus,
    showOnboarding: initialShowOnboarding,
    activeContractsCount,
    mrr,
    recentTransactions,
    plansCount,
    overdueContracts: initialOverdueContracts,
    students,
    activePlans,
    hasStripeConnect,
    totalStudents,
    studentsWithoutContract,
}: FinancialDashboardClientProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [showOnboarding, setShowOnboarding] = useState(initialShowOnboarding)
    const [connectSyncing, setConnectSyncing] = useState(false)
    const [modalOpen, setModalOpen] = useState(false)
    const [overdueContracts, setOverdueContracts] = useState(initialOverdueContracts)
    const [markingPaid, setMarkingPaid] = useState<string | null>(null)

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

    const timeAgo = (dateStr: string) => {
        const now = new Date()
        const date = new Date(dateStr)
        const diffMs = now.getTime() - date.getTime()
        const diffMin = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMs / 3600000)
        const diffDays = Math.floor(diffMs / 86400000)

        if (diffMin < 1) return 'Agora'
        if (diffMin < 60) return `há ${diffMin}min`
        if (diffHours < 24) return `há ${diffHours}h`
        if (diffDays === 1) return 'Ontem'
        if (diffDays < 7) return `há ${diffDays} dias`
        return new Date(dateStr).toLocaleDateString('pt-BR')
    }

    // Fix 4: Clean Stripe description to something human-readable
    const cleanDescription = (tx: Transaction): string => {
        if (tx.studentName) {
            // Extract plan name from Stripe description: "Pagamento automático — 1 × PlanName (at R$ X.XX / month)"
            const match = tx.description?.match(/× (.+?) \(/)
            const planName = match ? match[1] : null
            return planName ? `${tx.studentName} — ${planName}` : tx.studentName
        }
        if (tx.description) {
            // Fallback: clean raw Stripe text
            const match = tx.description.match(/× (.+?) \(/)
            if (match) return `Plano ${match[1]}`
            return tx.description.replace(/\s*\(at R\$.*?\)/, '').replace(/1 × /, '')
        }
        const typeMap: Record<string, string> = {
            charge: 'Pagamento recebido',
            payment: 'Pagamento recebido',
            payout: 'Transferência para conta',
            refund: 'Reembolso',
            adjustment: 'Ajuste',
        }
        return typeMap[tx.type] || tx.type
    }

    const handleMarkAsPaid = async (contractId: string) => {
        setMarkingPaid(contractId)
        const result = await markAsPaid({ contractId })
        if (result.success) {
            setOverdueContracts(prev => prev.filter(c => c.id !== contractId))
            router.refresh()
        }
        setMarkingPaid(null)
    }

    return (
        <AppLayout
            trainerName={trainer.name}
            trainerEmail={trainer.email}
            trainerAvatarUrl={trainer.avatar_url}
            trainerTheme={trainer.theme as 'light' | 'dark' | 'system' | null}
        >
        <div>
            {/* Fix 1 + Fix 2: Header without subtitle, with "+ Nova Assinatura" button */}
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-2xl font-bold text-k-text-primary">Financeiro</h1>
                <button
                    onClick={() => setModalOpen(true)}
                    className="bg-violet-600 hover:bg-violet-500 text-white rounded-xl px-4 py-2 text-sm font-medium transition-all active:scale-95 flex items-center gap-1.5"
                >
                    <Plus size={16} />
                    Nova Assinatura
                </button>
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

            {/* Fix 6: Enhanced Pending Actions */}
            {overdueContracts.length > 0 ? (
                <div className="mb-8">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                        <span className="text-sm font-semibold text-k-text-primary">Ações pendentes</span>
                        <span className="text-[10px] text-k-text-quaternary bg-glass-bg px-1.5 py-0.5 rounded">
                            {overdueContracts.length}
                        </span>
                    </div>
                    <div className="space-y-2">
                        {overdueContracts.map(c => {
                            const isPastDue = c.currentPeriodEnd && new Date(c.currentPeriodEnd) < new Date()
                            return (
                                <div
                                    key={c.id}
                                    className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
                                        isPastDue
                                            ? 'bg-red-500/5 border-red-500/15'
                                            : 'bg-amber-500/5 border-amber-500/15'
                                    }`}
                                >
                                    <div>
                                        <span className="text-sm text-k-text-primary">{c.studentName}</span>
                                        <span className="text-xs text-k-text-quaternary block mt-0.5">
                                            {formatCurrency(c.amount)}
                                            {c.currentPeriodEnd && ` · ${isPastDue ? 'venceu' : 'vence'} ${new Date(c.currentPeriodEnd).toLocaleDateString('pt-BR')}`}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => handleMarkAsPaid(c.id)}
                                        disabled={markingPaid === c.id}
                                        className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-1.5 ${
                                            isPastDue
                                                ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                                                : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                                        }`}
                                    >
                                        <CheckCircle size={13} />
                                        {markingPaid === c.id ? 'Registrando...' : 'Registrar pagamento'}
                                    </button>
                                </div>
                            )
                        })}
                    </div>
                </div>
            ) : activeContractsCount > 0 ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/5 border border-emerald-500/10 rounded-xl mb-8 w-fit">
                    <Check size={14} className="text-emerald-400" />
                    <span className="text-xs text-emerald-400">Todas as cobranças em dia</span>
                </div>
            ) : null}

            {/* Stats Cards — Fix 5: Replace "Planos Criados" with "Sem assinatura" */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <div className="rounded-2xl border border-k-border-primary bg-surface-card p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-violet-500/10">
                            <Users size={18} className="text-violet-400" />
                        </div>
                        <span className="text-xs font-medium text-k-text-secondary">
                            Assinaturas ativas
                        </span>
                    </div>
                    <p className="text-2xl font-bold text-k-text-primary">{activeContractsCount}</p>
                </div>

                <div className="rounded-2xl border border-k-border-primary bg-surface-card p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-500/10">
                            <TrendingUp size={18} className="text-emerald-400" />
                        </div>
                        <span className="text-xs font-medium text-k-text-secondary">
                            Receita mensal
                        </span>
                    </div>
                    <p className="text-2xl font-bold text-k-text-primary">{formatCurrency(mrr)}</p>
                </div>

                <Link
                    href="/financial/subscriptions"
                    className="rounded-2xl border border-k-border-primary bg-surface-card p-5 hover:border-amber-500/30 transition-colors group"
                >
                    <div className="flex items-center gap-3 mb-3">
                        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-amber-500/10">
                            <UserX size={18} className="text-amber-400" />
                        </div>
                        <span className="text-xs font-medium text-k-text-secondary">
                            Sem assinatura
                        </span>
                    </div>
                    <p className="text-2xl font-bold text-k-text-primary">{studentsWithoutContract}</p>
                    {totalStudents > 0 && (
                        <p className="text-[10px] text-k-text-quaternary mt-1">
                            de {totalStudents} aluno{totalStudents > 1 ? 's' : ''}
                        </p>
                    )}
                </Link>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                <div className="rounded-2xl border border-k-border-primary bg-surface-card p-5">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Wallet size={16} className="text-k-text-tertiary" />
                            <h3 className="text-sm font-semibold text-k-text-primary">Planos</h3>
                        </div>
                        <Link
                            href="/financial/plans"
                            className="text-xs text-k-text-tertiary hover:text-violet-400 transition-colors flex items-center gap-1"
                        >
                            Ver todos
                            <ArrowRight size={12} />
                        </Link>
                    </div>
                    <p className="text-xs text-k-text-secondary mb-3">
                        {plansCount === 0 ? 'Nenhum plano criado' : `${plansCount} plano${plansCount > 1 ? 's' : ''} criado${plansCount > 1 ? 's' : ''}`}
                    </p>
                    <Link
                        href="/financial/plans"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-400 hover:text-violet-300 transition-colors"
                    >
                        Gerenciar planos
                        <ArrowRight size={12} />
                    </Link>
                </div>

                <div className="rounded-2xl border border-k-border-primary bg-surface-card p-5">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Users size={16} className="text-k-text-tertiary" />
                            <h3 className="text-sm font-semibold text-k-text-primary">Assinaturas</h3>
                        </div>
                        <Link
                            href="/financial/subscriptions"
                            className="text-xs text-k-text-tertiary hover:text-violet-400 transition-colors flex items-center gap-1"
                        >
                            Ver todas
                            <ArrowRight size={12} />
                        </Link>
                    </div>
                    <p className="text-xs text-k-text-secondary mb-3">
                        {activeContractsCount === 0 ? 'Nenhuma assinatura ativa' : `${activeContractsCount} assinatura${activeContractsCount > 1 ? 's' : ''} ativa${activeContractsCount > 1 ? 's' : ''}`}
                    </p>
                    <Link
                        href="/financial/subscriptions"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-400 hover:text-violet-300 transition-colors"
                    >
                        Gerenciar assinaturas
                        <ArrowRight size={12} />
                    </Link>
                </div>
            </div>

            {/* Recent Transactions — Fix 4: Humanized descriptions */}
            <div className="rounded-2xl border border-k-border-primary bg-surface-card">
                <div className="px-6 py-4 border-b border-k-border-subtle">
                    <h2 className="text-sm font-semibold text-k-text-primary">Últimas transações</h2>
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
                            <div key={tx.id} className="px-6 py-3 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                        tx.status === 'succeeded' ? 'bg-emerald-400' :
                                        tx.status === 'pending' ? 'bg-amber-400' :
                                        tx.status === 'failed' ? 'bg-red-400' : 'bg-gray-400'
                                    }`} />
                                    <div>
                                        <p className="text-sm text-k-text-primary">
                                            {cleanDescription(tx)}
                                        </p>
                                        <p className="text-xs text-k-text-quaternary mt-0.5">
                                            {timeAgo(tx.created_at)}
                                        </p>
                                    </div>
                                </div>
                                <span className={`text-sm font-semibold ${
                                    tx.status === 'succeeded' ? 'text-emerald-400' : 'text-k-text-primary'
                                }`}>
                                    {tx.type === 'payout' ? '−' : '+'}{formatCurrency(tx.amount_gross)}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>

        {/* New Subscription Modal */}
        <NewSubscriptionModal
            isOpen={modalOpen}
            onClose={() => setModalOpen(false)}
            onSuccess={() => { router.refresh(); setModalOpen(false) }}
            students={students}
            plans={activePlans}
            hasStripeConnect={hasStripeConnect}
        />
        </AppLayout>
    )
}
