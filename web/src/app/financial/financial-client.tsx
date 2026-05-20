'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
    Users, TrendingUp, Receipt, ArrowRight, Wallet, AlertTriangle,
    Heart, Plus, Check, DollarSign, ArrowDownToLine, ChevronDown,
    Send, Repeat, Sparkles, KeyRound, Settings as SettingsIcon, Link2,
    Lock, Unlock, Loader2, Copy, MessageCircle, Clock, X,
} from 'lucide-react'
import { useOnboardingStore } from '@/stores/onboarding-store'
import { AppLayout } from '@/components/layout'
import { ConnectStatusCard } from '@/components/financial/connect-status-card'
import { WalletStatusCard } from '@/components/financial/wallet-status-card'
import { FinancialOnboarding } from '@/components/financial/financial-onboarding'
import { FinancialOnboardingModal } from '@/components/financial/financial-onboarding-modal'
import { EmptyState } from '@/components/financial/empty-state'
import { CobrarCarteiraModal } from '@/components/financial/cobrar-carteira-modal'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import type { FinancialStudent, DisplayStatus } from '@/types/financial'
import type { KinevoWalletStatus, KinevoWalletMode } from '@/lib/asaas'

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
    /** Quando setado, é uma cobrança Payment Link ainda não paga: trainer
     *  pode copiar a URL ou compartilhar via WhatsApp. */
    paymentLinkUrl?: string | null
    /** contract_id local pra ações tipo cancelar a cobrança pending. */
    contractId?: string | null
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
    allow_pix?: boolean
    allow_credit_card?: boolean
    allow_boleto?: boolean
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
    walletStatus: KinevoWalletStatus
    walletMode: KinevoWalletMode
    walletBalance: number | null
    walletRejectionReason: string | null
    hasStripeLegacyContracts: boolean
}

const statusLabels: Record<DisplayStatus, string> = {
    courtesy: 'Cortesia',
    awaiting_payment: 'Aguardando',
    active: 'Ativo',
    grace_period: 'Vence hoje',
    canceling: 'Cancelando',
    overdue: 'Inadimplente',
    canceled: 'Encerrado',
    expired: 'Expirado',
}

const statusColors: Record<DisplayStatus, string> = {
    courtesy: 'text-blue-600 dark:text-blue-400',
    awaiting_payment: 'text-sky-600 dark:text-sky-400',
    active: 'text-emerald-600 dark:text-emerald-400',
    grace_period: 'text-orange-600 dark:text-orange-400',
    canceling: 'text-amber-600 dark:text-amber-400',
    overdue: 'text-red-600 dark:text-red-400',
    canceled: 'text-gray-600 dark:text-gray-400',
    expired: 'text-red-600 dark:text-red-400',
}

const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

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

function daysOverdue(dateStr: string | null): number {
    if (!dateStr) return 0
    const diff = Date.now() - new Date(dateStr).getTime()
    return Math.max(0, Math.floor(diff / 86400000))
}

function cleanDescription(tx: Transaction): string {
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
        payout: 'Saque para sua conta',
        refund: 'Reembolso',
        adjustment: 'Ajuste',
    }
    return typeMap[tx.type] || tx.type
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
    walletStatus,
    walletMode,
    walletBalance,
    walletRejectionReason,
    hasStripeLegacyContracts,
}: FinancialDashboardClientProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [showOnboarding, setShowOnboarding] = useState(initialShowOnboarding)
    const [connectSyncing, setConnectSyncing] = useState(false)
    const [chargeOpen, setChargeOpen] = useState(false)
    const [chargeMode, setChargeMode] = useState<'one_off' | 'recurring'>('one_off')
    const [chargeDropdownOpen, setChargeDropdownOpen] = useState(false)
    // Feedback efêmero pro botão "Copiar link" no feed de atividade
    const [copiedActivityId, setCopiedActivityId] = useState<string | null>(null)
    // Cancelamento de cobrança pending — id do contrato em loading + erro
    const [cancelingContractId, setCancelingContractId] = useState<string | null>(null)
    const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null)
    const [cancelError, setCancelError] = useState<string | null>(null)

    async function cancelPendingCharge(contractId: string) {
        setCancelingContractId(contractId)
        setCancelError(null)
        try {
            const res = await fetch(`/api/wallet/charges/${contractId}`, { method: 'DELETE' })
            if (!res.ok) {
                const body = await res.json().catch(() => ({}))
                throw new Error(body.error || `Falha (${res.status})`)
            }
            router.refresh()
            setCancelConfirmId(null)
        } catch (err) {
            setCancelError(err instanceof Error ? err.message : 'Erro ao cancelar')
        } finally {
            setCancelingContractId(null)
        }
    }
    const chargeBtnRef = useRef<HTMLDivElement>(null)

    // Estado pra desbloquear acesso manualmente
    const [unblockingId, setUnblockingId] = useState<string | null>(null)
    const [unblockError, setUnblockError] = useState<string | null>(null)

    async function unblockStudent(studentId: string) {
        setUnblockingId(studentId)
        setUnblockError(null)
        try {
            const res = await fetch(`/api/students/${studentId}/access`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ blocked: false }),
            })
            if (!res.ok) {
                const body = await res.json().catch(() => ({}))
                throw new Error(body.error || `Falha (${res.status})`)
            }
            router.refresh()
        } catch (err) {
            setUnblockError(err instanceof Error ? err.message : 'Erro ao desbloquear')
        } finally {
            setUnblockingId(null)
        }
    }

    // Sync connect status on return from Stripe (legacy)
    useEffect(() => {
        const connectParam = searchParams.get('connect')
        if (connectParam === 'success' || connectParam === 'refresh') {
            setConnectSyncing(true)
            fetch('/api/stripe/connect/status')
                .then(() => router.refresh())
                .finally(() => setConnectSyncing(false))
        }
    }, [searchParams, router])

    // Mark milestone when Stripe configured (legacy)
    useEffect(() => {
        if (connectStatus.connected && connectStatus.chargesEnabled) {
            useOnboardingStore.getState().completeMilestone('financial_setup')
        }
    }, [connectStatus])

    // Close dropdown on outside click
    useEffect(() => {
        function onClick(e: MouseEvent) {
            if (chargeBtnRef.current && !chargeBtnRef.current.contains(e.target as Node)) {
                setChargeDropdownOpen(false)
            }
        }
        if (chargeDropdownOpen) document.addEventListener('mousedown', onClick)
        return () => document.removeEventListener('mousedown', onClick)
    }, [chargeDropdownOpen])

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

    const walletApproved = walletStatus === 'approved'

    function openChargeNew(mode: 'one_off' | 'recurring' = 'one_off') {
        setChargeDropdownOpen(false)
        setChargeMode(mode)
        setChargeOpen(true)
    }

    return (
        <AppLayout
            trainerName={trainer.name}
            trainerEmail={trainer.email}
            trainerAvatarUrl={trainer.avatar_url}
            trainerTheme={trainer.theme as 'light' | 'dark' | 'system' | null}
        >
            <div>
                {/* Page header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-[#1D1D1F] dark:text-k-text-primary">Financeiro</h1>
                    <p className="text-sm text-[#86868B] dark:text-k-text-tertiary mt-1">
                        Receba, cobre e controle tudo num lugar só.
                    </p>
                </div>

                {/* ─── HERO: Carteira ───────────────────────────────────────── */}
                {walletApproved ? (
                    <section className="relative rounded-2xl border border-violet-500/15 bg-gradient-to-br from-violet-50 to-blue-50 dark:from-violet-500/[0.05] dark:to-blue-500/[0.04] dark:border-violet-500/15 p-6 sm:p-7 mb-6">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-medium text-[#6E6E73] dark:text-k-text-secondary">
                                        Saldo disponível
                                    </span>
                                    {walletMode === 'linked' && (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-500/15 text-slate-700 dark:text-slate-300">
                                            <Link2 size={9} />
                                            Conta vinculada
                                        </span>
                                    )}
                                    {walletMode === 'subaccount' && (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                                            <Check size={9} strokeWidth={3} />
                                            Carteira ativa
                                        </span>
                                    )}
                                </div>
                                <p className="text-3xl sm:text-4xl font-semibold text-[#1D1D1F] dark:text-k-text-primary tabular-nums tracking-tight">
                                    {walletBalance !== null ? formatCurrency(walletBalance) : '—'}
                                </p>
                                <Link
                                    href="/financial/wallet"
                                    className="mt-2 inline-flex items-center gap-1 text-xs text-[#86868B] dark:text-k-text-tertiary hover:text-[#1D1D1F] dark:hover:text-k-text-primary"
                                >
                                    Ver detalhes da Carteira
                                    <ArrowRight size={11} />
                                </Link>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                                {/* Cobrar aluno — dropdown */}
                                <div ref={chargeBtnRef} className="relative">
                                    <button
                                        onClick={() => setChargeDropdownOpen(o => !o)}
                                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#007AFF] hover:bg-[#0056B3] dark:bg-violet-600 dark:hover:bg-violet-500 text-white text-sm font-medium transition-colors active:scale-[0.98] shadow-[0_4px_10px_-2px_rgba(0,122,255,0.35)] dark:shadow-[0_4px_10px_-2px_rgba(124,58,237,0.35)]"
                                    >
                                        <Send size={15} />
                                        Cobrar aluno
                                        <ChevronDown size={14} className={`transition-transform ${chargeDropdownOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    {chargeDropdownOpen && (
                                        <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-[#E8E8ED] dark:border-k-border-primary bg-white dark:bg-surface-card shadow-lg z-50 overflow-hidden">
                                            <button
                                                onClick={() => openChargeNew('one_off')}
                                                className="w-full flex items-start gap-3 px-4 py-3 hover:bg-[#F5F5F7] dark:hover:bg-glass-bg transition-colors text-left"
                                            >
                                                <div className="rounded-lg bg-[#007AFF]/10 dark:bg-violet-500/10 p-2 shrink-0">
                                                    <Receipt size={15} className="text-[#007AFF] dark:text-violet-400" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-[#1D1D1F] dark:text-k-text-primary">Cobrança avulsa</p>
                                                    <p className="text-[11px] text-[#86868B] dark:text-k-text-tertiary mt-0.5">Pagamento único via PIX ou cartão</p>
                                                </div>
                                            </button>
                                            <button
                                                onClick={() => openChargeNew('recurring')}
                                                className="w-full flex items-start gap-3 px-4 py-3 hover:bg-[#F5F5F7] dark:hover:bg-glass-bg transition-colors text-left border-t border-[#E8E8ED] dark:border-k-border-subtle"
                                            >
                                                <div className="rounded-lg bg-[#5856D6]/10 dark:bg-blue-500/10 p-2 shrink-0">
                                                    <Repeat size={15} className="text-[#5856D6] dark:text-blue-400" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-[#1D1D1F] dark:text-k-text-primary">Nova assinatura</p>
                                                    <p className="text-[11px] text-[#86868B] dark:text-k-text-tertiary mt-0.5">Cobrança recorrente (mensal/anual)</p>
                                                </div>
                                            </button>
                                            <Link
                                                href="/financial/plans"
                                                onClick={() => setChargeDropdownOpen(false)}
                                                className="w-full flex items-start gap-3 px-4 py-3 hover:bg-[#F5F5F7] dark:hover:bg-glass-bg transition-colors text-left border-t border-[#E8E8ED] dark:border-k-border-subtle"
                                            >
                                                <div className="rounded-lg bg-[#34C759]/10 dark:bg-emerald-500/10 p-2 shrink-0">
                                                    <Sparkles size={15} className="text-[#34C759] dark:text-emerald-400" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-[#1D1D1F] dark:text-k-text-primary">Criar novo plano</p>
                                                    <p className="text-[11px] text-[#86868B] dark:text-k-text-tertiary mt-0.5">Antes de cobrar, defina o pacote</p>
                                                </div>
                                            </Link>
                                        </div>
                                    )}
                                </div>

                                <Link
                                    href="/financial/wallet"
                                    className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors active:scale-[0.98] ${
                                        (walletBalance ?? 0) > 0
                                            ? 'bg-white dark:bg-surface-card border border-[#E8E8ED] dark:border-k-border-primary text-[#1D1D1F] dark:text-k-text-primary hover:bg-[#F5F5F7] dark:hover:bg-glass-bg'
                                            : 'bg-white/50 dark:bg-surface-card/50 border border-[#E8E8ED] dark:border-k-border-primary text-[#8E8E93] dark:text-k-text-quaternary cursor-not-allowed pointer-events-none'
                                    }`}
                                >
                                    <ArrowDownToLine size={15} />
                                    Sacar via PIX
                                </Link>
                            </div>
                        </div>
                    </section>
                ) : (
                    <div className="mb-6">
                        <WalletStatusCard
                            status={walletStatus}
                            mode={walletMode}
                            balance={walletBalance}
                            rejectionReason={walletRejectionReason}
                        />
                    </div>
                )}

                {/* Stripe legado (escondido por padrão) */}
                {hasStripeLegacyContracts && (
                    <details className="mb-6 group">
                        <summary className="cursor-pointer text-xs text-k-text-quaternary hover:text-k-text-tertiary transition-colors inline-flex items-center gap-1 select-none">
                            <span>Modo avançado: Stripe Connect (legado)</span>
                            <span className="text-[10px] opacity-60 group-open:hidden">▼</span>
                            <span className="text-[10px] opacity-60 hidden group-open:inline">▲</span>
                        </summary>
                        <div className="mt-3">
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
                    </details>
                )}

                {/* ─── Stats Grid ──────────────────────────────────────────── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
                    <StatCard
                        icon={<DollarSign size={18} className="text-[#34C759] dark:text-emerald-400" />}
                        iconBg="bg-[#34C759]/10 dark:bg-emerald-500/10"
                        label="Receita do mês"
                        tooltip="Soma dos pagamentos recebidos neste mês."
                        value={formatCurrency(monthlyRevenue)}
                    />
                    <StatCard
                        icon={<Users size={18} className="text-[#007AFF] dark:text-violet-400" />}
                        iconBg="bg-[#007AFF]/10 dark:bg-violet-500/10"
                        label="Alunos pagantes"
                        tooltip="Alunos com cobrança ativa. Não inclui cortesia."
                        value={payingCount.toString()}
                    />
                    <StatCard
                        icon={<Heart size={18} className="text-[#5AC8FA] dark:text-blue-400" />}
                        iconBg="bg-[#5AC8FA]/10 dark:bg-blue-500/10"
                        label="Cortesias"
                        tooltip="Alunos com acesso gratuito — sem cobrança configurada."
                        value={courtesyCount.toString()}
                    />
                    <Link
                        href={attentionStudents.length > 0 ? '/financial/subscriptions' : '#'}
                        className={`rounded-2xl border p-4 sm:p-5 transition-colors shadow-[0_1px_3px_rgba(0,0,0,0.06)] dark:shadow-none ${
                            attentionStudents.length > 0
                                ? 'border-[#FF3B30]/20 dark:border-red-500/20 bg-white dark:bg-surface-card hover:border-[#FF3B30]/40 dark:hover:border-red-500/40'
                                : 'border-[#E8E8ED] dark:border-k-border-primary bg-white dark:bg-surface-card pointer-events-none'
                        }`}
                    >
                        <div className="flex items-center gap-2.5 mb-2.5">
                            <div className={`flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl ${
                                attentionStudents.length > 0 ? 'bg-[#FF3B30]/10 dark:bg-red-500/10' : 'bg-[#34C759]/10 dark:bg-emerald-500/10'
                            }`}>
                                <AlertTriangle size={17} className={
                                    attentionStudents.length > 0 ? 'text-[#FF3B30] dark:text-red-400' : 'text-[#34C759] dark:text-emerald-400'
                                } />
                            </div>
                            <span className="text-[11px] sm:text-xs font-medium text-[#6E6E73] dark:text-k-text-secondary">
                                Precisam de atenção
                            </span>
                        </div>
                        <p className="text-xl sm:text-2xl font-bold text-[#1D1D1F] dark:text-k-text-primary tabular-nums">
                            {attentionStudents.length}
                        </p>
                    </Link>
                </div>

                {/* ─── Body em duas colunas ─────────────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">

                    {/* Esquerda: Atividade recente */}
                    <div className="lg:col-span-2">
                        <div className="rounded-2xl border border-[#E8E8ED] dark:border-k-border-primary bg-white dark:bg-surface-card shadow-[0_1px_3px_rgba(0,0,0,0.06)] dark:shadow-none">
                            <div className="px-5 sm:px-6 py-4 border-b border-[#E8E8ED] dark:border-k-border-subtle flex items-center justify-between">
                                <h2 className="text-sm font-semibold text-[#1D1D1F] dark:text-k-text-primary">
                                    Atividade recente
                                </h2>
                                <span className="text-[11px] text-[#86868B] dark:text-k-text-tertiary">
                                    últimos pagamentos e saques
                                </span>
                            </div>
                            {recentTransactions.length === 0 ? (
                                <EmptyState
                                    icon={Receipt}
                                    title="Nenhuma transação ainda"
                                    description="Conforme seus alunos pagarem, os recebimentos aparecem aqui."
                                />
                            ) : (
                                <div className="divide-y divide-[#E8E8ED] dark:divide-k-border-subtle">
                                    {recentTransactions.map((tx) => {
                                        const isPendingLink = tx.status === 'pending' && !!tx.paymentLinkUrl
                                        const studentLabel = tx.studentName ?? 'seu aluno'
                                        const message = `Olá ${studentLabel}! Aqui está o link para você pagar: ${tx.paymentLinkUrl}`
                                        const wpUrl = tx.paymentLinkUrl ? `https://wa.me/?text=${encodeURIComponent(message)}` : null
                                        return (
                                        <div key={tx.id} className="px-5 sm:px-6 py-3">
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                                        tx.status === 'succeeded' || tx.status === 'completed' ? 'bg-[#34C759] dark:bg-emerald-400' :
                                                        tx.status === 'pending' ? 'bg-[#FF9500] dark:bg-amber-400' :
                                                        tx.status === 'failed' || tx.status === 'overdue' ? 'bg-[#FF3B30] dark:bg-red-400' :
                                                        'bg-[#8E8E93] dark:bg-gray-400'
                                                    }`} />
                                                    <div className="min-w-0">
                                                        <p className="text-sm text-[#1D1D1F] dark:text-k-text-primary truncate">
                                                            {cleanDescription(tx)}
                                                        </p>
                                                        <p className="text-xs text-[#8E8E93] dark:text-k-text-quaternary mt-0.5 flex items-center gap-1.5">
                                                            {isPendingLink && <Clock size={10} className="text-[#FF9500] dark:text-amber-400" />}
                                                            {isPendingLink ? (
                                                                <>
                                                                    <span className="text-[#FF9500] dark:text-amber-400 font-medium">
                                                                        Aguardando pagamento
                                                                    </span>
                                                                    <span>· {timeAgo(tx.created_at)}</span>
                                                                </>
                                                            ) : (
                                                                timeAgo(tx.created_at)
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>
                                                <span className={`text-sm font-semibold tabular-nums whitespace-nowrap ml-3 ${
                                                    tx.type === 'payout' ? 'text-[#FF3B30] dark:text-red-400' :
                                                    (tx.status === 'succeeded' || tx.status === 'completed') ? 'text-[#34C759] dark:text-emerald-400' :
                                                    isPendingLink ? 'text-[#FF9500] dark:text-amber-400' :
                                                    'text-[#1D1D1F] dark:text-k-text-primary'
                                                }`}>
                                                    {tx.type === 'payout' ? '−' : '+'}{formatCurrency(tx.amount_gross)}
                                                </span>
                                            </div>
                                            {isPendingLink && tx.paymentLinkUrl && (
                                                <div className="mt-2 ml-5 flex items-center gap-2 flex-wrap">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(tx.paymentLinkUrl!)
                                                            setCopiedActivityId(tx.id)
                                                            setTimeout(() => setCopiedActivityId(prev => prev === tx.id ? null : prev), 1500)
                                                        }}
                                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md border border-[#E8E8ED] dark:border-k-border-subtle text-[#1D1D1F] dark:text-k-text-secondary hover:bg-[#F5F5F7] dark:hover:bg-glass-bg transition-colors"
                                                    >
                                                        {copiedActivityId === tx.id ? (
                                                            <><Check size={11} className="text-[#34C759] dark:text-emerald-400" /> Copiado</>
                                                        ) : (
                                                            <><Copy size={11} /> Copiar link</>
                                                        )}
                                                    </button>
                                                    {wpUrl && (
                                                        <a
                                                            href={wpUrl}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md bg-[#34C759] dark:bg-emerald-500 text-white hover:bg-[#2EB050] dark:hover:bg-emerald-600 transition-colors"
                                                        >
                                                            <MessageCircle size={11} /> WhatsApp
                                                        </a>
                                                    )}
                                                    {tx.contractId && (
                                                        cancelConfirmId === tx.contractId ? (
                                                            <div className="inline-flex items-center gap-1.5 text-[11px]">
                                                                <span className="text-[#86868B] dark:text-k-text-tertiary">Cancelar?</span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => cancelPendingCharge(tx.contractId!)}
                                                                    disabled={cancelingContractId === tx.contractId}
                                                                    className="inline-flex items-center gap-1 px-2 py-1 font-medium rounded-md bg-[#FF3B30] dark:bg-red-500 text-white hover:bg-[#E0352B] dark:hover:bg-red-600 transition-colors disabled:opacity-50"
                                                                >
                                                                    {cancelingContractId === tx.contractId
                                                                        ? <Loader2 size={11} className="animate-spin" />
                                                                        : <Check size={11} strokeWidth={3} />}
                                                                    Sim
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => { setCancelConfirmId(null); setCancelError(null) }}
                                                                    disabled={cancelingContractId === tx.contractId}
                                                                    className="inline-flex items-center px-2 py-1 font-medium rounded-md border border-[#E8E8ED] dark:border-k-border-subtle text-[#1D1D1F] dark:text-k-text-secondary hover:bg-[#F5F5F7] dark:hover:bg-glass-bg transition-colors disabled:opacity-50"
                                                                >
                                                                    Não
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => { setCancelConfirmId(tx.contractId!); setCancelError(null) }}
                                                                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md text-[#86868B] dark:text-k-text-tertiary hover:bg-[#FF3B30]/5 dark:hover:bg-red-500/10 hover:text-[#FF3B30] dark:hover:text-red-400 transition-colors"
                                                            >
                                                                <X size={11} /> Cancelar
                                                            </button>
                                                        )
                                                    )}
                                                    {cancelError && cancelConfirmId === tx.contractId && (
                                                        <span className="text-[11px] text-[#FF3B30] dark:text-red-400 ml-1">
                                                            {cancelError}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Direita: Atenção + Atalhos */}
                    <div className="space-y-4 sm:space-y-6">

                        {/* Atenção */}
                        {attentionStudents.length > 0 && (
                            <div className="rounded-2xl border border-[#E8E8ED] dark:border-k-border-primary bg-white dark:bg-surface-card shadow-[0_1px_3px_rgba(0,0,0,0.06)] dark:shadow-none overflow-hidden">
                                <div className="px-5 py-4 border-b border-[#E8E8ED] dark:border-k-border-subtle flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-[#FF3B30] dark:bg-red-400 rounded-full animate-pulse" />
                                        <h2 className="text-sm font-semibold text-[#1D1D1F] dark:text-k-text-primary">
                                            Precisam de atenção
                                        </h2>
                                    </div>
                                    <span className="text-[11px] font-medium text-[#FF3B30] dark:text-red-400">
                                        {attentionStudents.length} {attentionStudents.length === 1 ? 'item' : 'itens'}
                                    </span>
                                </div>
                                <div className="divide-y divide-[#E8E8ED] dark:divide-k-border-subtle">
                                    {attentionStudents.slice(0, 4).map(s => (
                                        <div
                                            key={s.student_id}
                                            className="px-5 py-3 flex items-center gap-3 hover:bg-[#F5F5F7] dark:hover:bg-glass-bg transition-colors"
                                        >
                                            <Link
                                                href="/financial/subscriptions"
                                                className="flex items-center gap-3 flex-1 min-w-0"
                                            >
                                            <div className={`relative flex h-8 w-8 items-center justify-center rounded-full overflow-hidden flex-shrink-0 border border-[#E8E8ED] dark:border-k-border-primary ${
                                                s.access_blocked_at
                                                    ? 'bg-red-100 dark:bg-red-500/15'
                                                    : s.display_status === 'overdue' || s.display_status === 'expired'
                                                        ? 'bg-[#FF3B30]/10 dark:bg-red-500/10'
                                                        : 'bg-[#FF9500]/10 dark:bg-amber-500/10'
                                            }`}>
                                                {s.avatar_url ? (
                                                    <Image src={s.avatar_url} alt={s.student_name} width={32} height={32} className="h-8 w-8 rounded-full object-cover" unoptimized />
                                                ) : (
                                                    <span className={`text-xs font-semibold ${
                                                        s.access_blocked_at
                                                            ? 'text-red-700 dark:text-red-300'
                                                            : s.display_status === 'overdue' || s.display_status === 'expired'
                                                                ? 'text-[#FF3B30] dark:text-red-400'
                                                                : 'text-[#FF9500] dark:text-amber-400'
                                                    }`}>
                                                        {s.student_name?.charAt(0).toUpperCase() || '?'}
                                                    </span>
                                                )}
                                                {s.access_blocked_at && (
                                                    <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-red-600 dark:bg-red-500 border-2 border-white dark:border-surface-card flex items-center justify-center">
                                                        <Lock size={7} className="text-white" strokeWidth={3} />
                                                    </span>
                                                )}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium text-[#1D1D1F] dark:text-k-text-primary truncate flex items-center gap-1.5">
                                                    {s.student_name}
                                                    {s.access_blocked_at && (
                                                        <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-400">
                                                            <Lock size={8} strokeWidth={3} />
                                                            App bloqueado
                                                        </span>
                                                    )}
                                                </p>
                                                <p className={`text-[11px] ${statusColors[s.display_status]}`}>
                                                    {s.display_status === 'overdue' && s.current_period_end
                                                        ? `Atrasado há ${daysOverdue(s.current_period_end)}d`
                                                        : s.display_status === 'canceling' && s.current_period_end
                                                        ? `Cancela em ${formatDate(s.current_period_end)}`
                                                        : statusLabels[s.display_status]}
                                                    {s.amount && ` · ${formatCurrency(s.amount)}`}
                                                </p>
                                            </div>
                                            <ArrowRight size={13} className="text-[#86868B] dark:text-k-text-tertiary flex-shrink-0" />
                                            </Link>
                                            {s.access_blocked_at && (
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault()
                                                        e.stopPropagation()
                                                        void unblockStudent(s.student_id)
                                                    }}
                                                    disabled={unblockingId === s.student_id}
                                                    title={s.access_blocked_reason ?? 'Liberar acesso ao app'}
                                                    className="ml-1 inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-500/25 disabled:opacity-50 flex-shrink-0"
                                                >
                                                    {unblockingId === s.student_id ? (
                                                        <Loader2 size={10} className="animate-spin" />
                                                    ) : (
                                                        <Unlock size={10} strokeWidth={2.5} />
                                                    )}
                                                    Liberar
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                {unblockError && (
                                    <div className="px-5 py-2 text-xs text-red-700 dark:text-red-400 border-t border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/[0.05]">
                                        {unblockError}
                                    </div>
                                )}
                                {attentionStudents.length > 4 && (
                                    <Link
                                        href="/financial/subscriptions"
                                        className="block px-5 py-3 text-xs text-center text-[#007AFF] dark:text-violet-400 hover:bg-[#F5F5F7] dark:hover:bg-glass-bg border-t border-[#E8E8ED] dark:border-k-border-subtle"
                                    >
                                        Ver todos ({attentionStudents.length})
                                    </Link>
                                )}
                            </div>
                        )}

                        {/* Atalhos */}
                        <div className="grid grid-cols-2 gap-3">
                            <QuickLink
                                href="/financial/plans"
                                icon={<Wallet size={16} />}
                                title="Planos"
                                detail={plansCount === 0 ? 'Nenhum criado' : `${plansCount} ${plansCount === 1 ? 'plano' : 'planos'}`}
                            />
                            <QuickLink
                                href="/financial/subscriptions"
                                icon={<Repeat size={16} />}
                                title="Assinaturas"
                                detail={payingCount === 0 ? 'Nenhuma ativa' : `${payingCount} ${payingCount === 1 ? 'ativa' : 'ativas'}`}
                            />
                            <QuickLink
                                href="/financial/pix-keys"
                                icon={<KeyRound size={16} />}
                                title="Chaves PIX"
                                detail="Pra sacar"
                            />
                            <QuickLink
                                href="/financial/settings"
                                icon={<SettingsIcon size={16} />}
                                title="Configurações"
                                detail="Carteira, taxas…"
                            />
                        </div>
                    </div>
                </div>

                {/* "Tudo em dia" indicador (quando não há atenção e tem ativos) */}
                {attentionStudents.length === 0 && (payingCount > 0 || courtesyCount > 0) && (
                    <div className="mt-6 flex items-center gap-2 px-3 py-2 bg-[#34C759]/5 dark:bg-emerald-500/5 border border-[#34C759]/15 dark:border-emerald-500/15 rounded-xl w-fit">
                        <Check size={14} className="text-[#34C759] dark:text-emerald-400" />
                        <span className="text-xs text-[#34C759] dark:text-emerald-400 font-medium">Tudo em dia</span>
                    </div>
                )}
            </div>

            {/* Modais */}
            <FinancialOnboardingModal />
            <CobrarCarteiraModal
                isOpen={chargeOpen}
                onClose={() => setChargeOpen(false)}
                onSuccess={() => { router.refresh(); setChargeOpen(false) }}
                students={students}
                plans={activePlans}
                walletStatus={walletStatus}
                initialMode={chargeMode}
            />
        </AppLayout>
    )
}

// ─── Componentes auxiliares ────────────────────────────────────────────────

function StatCard({
    icon, iconBg, label, tooltip, value,
}: {
    icon: React.ReactNode
    iconBg: string
    label: string
    tooltip: string
    value: string
}) {
    return (
        <div className="rounded-2xl border border-[#E8E8ED] dark:border-k-border-primary bg-white dark:bg-surface-card p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] dark:shadow-none">
            <div className="flex items-center gap-2.5 mb-2.5">
                <div className={`flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl ${iconBg}`}>
                    {icon}
                </div>
                <span className="text-[11px] sm:text-xs font-medium text-[#6E6E73] dark:text-k-text-secondary flex items-center gap-1">
                    {label}
                    <InfoTooltip content={tooltip} />
                </span>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-[#1D1D1F] dark:text-k-text-primary tabular-nums">
                {value}
            </p>
        </div>
    )
}

function QuickLink({
    href, icon, title, detail,
}: {
    href: string
    icon: React.ReactNode
    title: string
    detail: string
}) {
    return (
        <Link
            href={href}
            className="rounded-2xl border border-[#E8E8ED] dark:border-k-border-primary bg-white dark:bg-surface-card p-4 transition-all hover:border-[#86868B] dark:hover:border-k-text-tertiary hover:-translate-y-0.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-none"
        >
            <div className="rounded-lg bg-[#F5F5F7] dark:bg-glass-bg p-2 w-fit text-[#1D1D1F] dark:text-k-text-primary mb-2.5">
                {icon}
            </div>
            <p className="text-sm font-semibold text-[#1D1D1F] dark:text-k-text-primary">{title}</p>
            <p className="text-[11px] text-[#86868B] dark:text-k-text-tertiary mt-0.5">{detail}</p>
        </Link>
    )
}
