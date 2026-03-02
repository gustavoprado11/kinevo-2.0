'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import {
    Users, TrendingUp, Receipt, ArrowRight, Wallet, AlertTriangle,
    Heart, Plus, Check, DollarSign
} from 'lucide-react'
import { useOnboardingStore } from '@/stores/onboarding-store'
import Link from 'next/link'
import { AppLayout } from '@/components/layout'
import { ConnectStatusCard } from '@/components/financial/connect-status-card'
import { FinancialOnboarding } from '@/components/financial/financial-onboarding'
import { FinancialOnboardingModal } from '@/components/financial/financial-onboarding-modal'
import { EmptyState } from '@/components/financial/empty-state'
import { NewSubscriptionModal } from '@/components/financial/new-subscription-modal'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import type { FinancialStudent, DisplayStatus } from '@/types/financial'

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
    monthlyRevenue: number
    payingCount: number
    courtesyCount: number
    attentionStudents: FinancialStudent[]
    recentTransactions: Transaction[]
    plansCount: number
    students: ModalStudent[]
    activePlans: ModalPlan[]
    hasStripeConnect: boolean
}

const statusLabels: Record<DisplayStatus, string> = {
    courtesy: 'Cortesia',
    awaiting_payment: 'Aguardando',
    active: 'Ativo',
    grace_period: 'Vence hoje',
    canceling: 'Cancelando',
    overdue: 'Inadimplente',
    canceled: 'Encerrado',
}

const statusColors: Record<DisplayStatus, string> = {
    courtesy: 'text-blue-400',
    awaiting_payment: 'text-sky-400',
    active: 'text-emerald-400',
    grace_period: 'text-orange-400',
    canceling: 'text-amber-400',
    overdue: 'text-red-400',
    canceled: 'text-gray-400',
}

export function FinancialDashboardClient({
    trainer,
    connectStatus,
    showOnboarding: initialShowOnboarding,
    monthlyRevenue,
    payingCount,
    courtesyCount,
    attentionStudents,
    recentTransactions,
    plansCount,
    students,
    activePlans,
    hasStripeConnect,
}: FinancialDashboardClientProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [showOnboarding, setShowOnboarding] = useState(initialShowOnboarding)
    const [connectSyncing, setConnectSyncing] = useState(false)
    const [modalOpen, setModalOpen] = useState(false)

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

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '—'
        return new Date(dateStr).toLocaleDateString('pt-BR')
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

    const cleanDescription = (tx: Transaction): string => {
        if (tx.studentName) {
            const match = tx.description?.match(/× (.+?) \(/)
            const planName = match ? match[1] : null
            return planName ? `${tx.studentName} — ${planName}` : tx.studentName
        }
        if (tx.description) {
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

    function daysOverdue(dateStr: string | null): number {
        if (!dateStr) return 0
        const diff = Date.now() - new Date(dateStr).getTime()
        return Math.max(0, Math.floor(diff / 86400000))
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
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-2xl font-bold text-k-text-primary">Financeiro</h1>
                <button
                    onClick={() => setModalOpen(true)}
                    className="bg-violet-600 hover:bg-violet-500 text-white rounded-xl px-4 py-2 text-sm font-medium transition-all active:scale-95 flex items-center gap-1.5"
                >
                    <Plus size={16} />
                    Nova Cobrança
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

            {/* Attention section */}
            {attentionStudents.length > 0 ? (
                <div className="mb-8">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
                        <span className="text-sm font-semibold text-k-text-primary">Atenção necessária</span>
                        <InfoTooltip content="Alunos que precisam da sua ação. Resolva marcando como pago, contatando o aluno ou verificando os detalhes." />
                        <span className="text-[10px] text-k-text-quaternary bg-glass-bg px-1.5 py-0.5 rounded">
                            {attentionStudents.length}
                        </span>
                    </div>
                    <div className="space-y-2">
                        {attentionStudents.map(s => (
                            <Link
                                key={s.student_id}
                                href="/financial/subscriptions"
                                className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
                                    s.display_status === 'overdue'
                                        ? 'bg-red-500/5 border-red-500/15 hover:border-red-500/30'
                                        : s.display_status === 'grace_period'
                                        ? 'bg-orange-500/5 border-orange-500/15 hover:border-orange-500/30'
                                        : 'bg-amber-500/5 border-amber-500/15 hover:border-amber-500/30'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full border border-k-border-primary bg-glass-bg overflow-hidden flex-shrink-0">
                                        {s.avatar_url ? (
                                            <Image
                                                src={s.avatar_url}
                                                alt={s.student_name}
                                                width={32}
                                                height={32}
                                                className="h-8 w-8 rounded-full object-cover"
                                                unoptimized
                                            />
                                        ) : (
                                            <span className="text-xs font-semibold text-k-text-primary">
                                                {s.student_name?.charAt(0).toUpperCase() || '?'}
                                            </span>
                                        )}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-k-text-primary">{s.student_name}</span>
                                            <span className={`text-[10px] font-semibold ${statusColors[s.display_status]}`}>
                                                {s.display_status === 'canceling' && s.current_period_end
                                                    ? `Cancela em ${formatDate(s.current_period_end)}`
                                                    : statusLabels[s.display_status]}
                                            </span>
                                        </div>
                                        <span className="text-xs text-k-text-quaternary">
                                            {s.amount ? formatCurrency(s.amount) : ''}
                                            {s.display_status === 'overdue' && s.current_period_end
                                                ? ` · Vencido há ${daysOverdue(s.current_period_end)} dia${daysOverdue(s.current_period_end) !== 1 ? 's' : ''}`
                                                : s.billing_type === 'stripe_auto' ? ' · Stripe' : ''}
                                        </span>
                                    </div>
                                </div>
                                <span className="text-xs text-k-text-tertiary flex items-center gap-1">
                                    Ver detalhes
                                    <ArrowRight size={12} />
                                </span>
                            </Link>
                        ))}
                    </div>
                </div>
            ) : payingCount > 0 || courtesyCount > 0 ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/5 border border-emerald-500/10 rounded-xl mb-8 w-fit">
                    <Check size={14} className="text-emerald-400" />
                    <span className="text-xs text-emerald-400">Tudo em dia</span>
                </div>
            ) : null}

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="rounded-2xl border border-k-border-primary bg-surface-card p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-500/10">
                            <DollarSign size={18} className="text-emerald-400" />
                        </div>
                        <span className="text-xs font-medium text-k-text-secondary">
                            Receita do mês
                            <InfoTooltip content="Soma dos pagamentos recebidos neste mês (Stripe + manuais marcados como pago)." />
                        </span>
                    </div>
                    <p className="text-2xl font-bold text-k-text-primary">{formatCurrency(monthlyRevenue)}</p>
                </div>

                <div className="rounded-2xl border border-k-border-primary bg-surface-card p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-violet-500/10">
                            <Users size={18} className="text-violet-400" />
                        </div>
                        <span className="text-xs font-medium text-k-text-secondary">
                            Alunos pagantes
                            <InfoTooltip content="Alunos com cobrança ativa via Stripe ou controle manual. Não inclui cortesia." />
                        </span>
                    </div>
                    <p className="text-2xl font-bold text-k-text-primary">{payingCount}</p>
                </div>

                <div className="rounded-2xl border border-k-border-primary bg-surface-card p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-500/10">
                            <Heart size={18} className="text-blue-400" />
                        </div>
                        <span className="text-xs font-medium text-k-text-secondary">
                            Em cortesia
                            <InfoTooltip content="Alunos com acesso gratuito — sem cobrança configurada. Você pode configurar cobrança a qualquer momento." />
                        </span>
                    </div>
                    <p className="text-2xl font-bold text-k-text-primary">{courtesyCount}</p>
                </div>

                <Link
                    href="/financial/subscriptions"
                    className={`rounded-2xl border p-5 transition-colors group ${
                        attentionStudents.length > 0
                            ? 'border-red-500/20 bg-surface-card hover:border-red-500/30'
                            : 'border-k-border-primary bg-surface-card hover:border-emerald-500/30'
                    }`}
                >
                    <div className="flex items-center gap-3 mb-3">
                        <div className={`flex items-center justify-center w-9 h-9 rounded-xl ${
                            attentionStudents.length > 0 ? 'bg-red-500/10' : 'bg-emerald-500/10'
                        }`}>
                            <AlertTriangle size={18} className={
                                attentionStudents.length > 0 ? 'text-red-400' : 'text-emerald-400'
                            } />
                        </div>
                        <span className="text-xs font-medium text-k-text-secondary">
                            Atenção
                            <InfoTooltip content="Alunos com pagamento atrasado, vencido ou cancelamento em andamento. Clique em 'Ver detalhes' para resolver." />
                        </span>
                    </div>
                    <p className="text-2xl font-bold text-k-text-primary">{attentionStudents.length}</p>
                </Link>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                <div className="rounded-2xl border border-k-border-primary bg-surface-card p-5">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Wallet size={16} className="text-k-text-tertiary" />
                            <h3 className="text-sm font-semibold text-k-text-primary">Planos</h3>
                            <InfoTooltip content="Planos de cobrança que você criou. Cada plano define valor e recorrência. Você vincula planos aos alunos na página de Assinaturas." />
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
                            <InfoTooltip content="Resumo dos alunos com cobrança configurada. Clique em 'Gerenciar assinaturas' para ver a lista completa." />
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
                        {payingCount === 0 ? 'Nenhum aluno pagante' : `${payingCount} aluno${payingCount > 1 ? 's' : ''} pagante${payingCount > 1 ? 's' : ''}`}
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

            {/* Recent Transactions */}
            <div className="rounded-2xl border border-k-border-primary bg-surface-card">
                <div className="px-6 py-4 border-b border-k-border-subtle">
                    <h2 className="text-sm font-semibold text-k-text-primary">
                        Últimas transações
                        <InfoTooltip content="Pagamentos recentes dos seus alunos (Stripe automático e manuais marcados como pago)." />
                    </h2>
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

        {/* Financial Onboarding Modal (first visit) */}
        <FinancialOnboardingModal />

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
