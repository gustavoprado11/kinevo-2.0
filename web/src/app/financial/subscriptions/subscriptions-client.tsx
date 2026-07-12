'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { AppLayout } from '@/components/layout'
import { EmptyState } from '@/components/financial/empty-state'
import { BillingTypeBadge } from '@/components/financial/billing-type-badge'
import { ConfigureBillingModal } from '@/components/financial/configure-billing-modal'
import { CobrarCarteiraModal } from '@/components/financial/cobrar-carteira-modal'
import type { KinevoWalletStatus } from '@/lib/asaas'
import { StudentFinancialModal } from '@/components/financial/student-financial-modal'
import { FinancialOnboardingModal } from '@/components/financial/financial-onboarding-modal'
import { markAsPaid } from '@/actions/financial/mark-as-paid'
import { toggleBlockOnFail } from '@/actions/financial/toggle-block-on-fail'
import { generateCheckoutLink } from '@/actions/financial/generate-checkout-link'
import type { FinancialStudent, DisplayStatus } from '@/types/financial'
import { formatCurrency } from '@/lib/utils/financial'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { useToast } from '@/components/ui/toast'
import { matchesSearch } from '@kinevo/shared/utils/search-text'
import {
    Plus, Search, Users, Loader2, CheckCircle, ArrowLeft, Copy,
    MessageCircle, Settings2,
    Heart, DollarSign, CheckCircle2, FolderArchive, CalendarOff
} from 'lucide-react'

interface Trainer {
    id: string
    name: string
    email: string
    avatar_url?: string | null
    theme?: string | null
}

interface Student {
    id: string
    name: string
    email: string
}

interface Plan {
    id: string
    title: string
    price: number
    interval: string
    stripe_price_id: string | null
    allow_pix?: boolean
    allow_credit_card?: boolean
    allow_boleto?: boolean
    max_installment_count?: number
}

interface SubscriptionsClientProps {
    trainer: Trainer
    financialStudents: FinancialStudent[]
    students: Student[]
    plans: Plan[]
    hasStripeConnect: boolean
    showStripeLegacy?: boolean
    walletStatus: KinevoWalletStatus
    sellToStudentId?: string
}

type TabKey = 'pagantes' | 'cortesia' | 'atencao' | 'encerrados' | 'todos'

const tabs: { key: TabKey; label: string; filter: (s: FinancialStudent) => boolean; badge?: boolean }[] = [
    {
        key: 'pagantes',
        label: 'Pagantes',
        filter: (s) => ['active', 'awaiting_payment'].includes(s.display_status),
    },
    {
        key: 'cortesia',
        label: 'Cortesia',
        filter: (s) => s.display_status === 'courtesy',
    },
    {
        key: 'atencao',
        label: 'Atenção',
        filter: (s) => ['overdue', 'grace_period', 'canceling', 'expired'].includes(s.display_status),
        badge: true,
    },
    {
        key: 'encerrados',
        label: 'Encerrados',
        filter: (s) => s.display_status === 'canceled' || s.display_status === 'expired',
    },
    {
        key: 'todos',
        label: 'Todos',
        filter: () => true,
    },
]

const statusConfig: Record<DisplayStatus, { label: string; className: string }> = {
    courtesy: { label: 'Cortesia', className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
    awaiting_payment: { label: 'Aguardando', className: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' },
    active: { label: 'Ativo', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
    grace_period: { label: 'Vence hoje', className: 'bg-orange-500/10 text-orange-600 dark:text-orange-400' },
    canceling: { label: 'Cancelando', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
    overdue: { label: 'Inadimplente', className: 'bg-red-500/10 text-red-600 dark:text-red-400' },
    canceled: { label: 'Encerrado', className: 'bg-gray-500/10 text-gray-600 dark:text-gray-400' },
    expired: { label: 'Expirado', className: 'bg-red-500/10 text-red-600 dark:text-red-400' },
}

const statusTooltips: Partial<Record<DisplayStatus, string>> = {
    courtesy: 'Acesso gratuito. O aluno treina normalmente sem cobrança configurada.',
    awaiting_payment: 'Link de pagamento enviado. Aguardando o aluno completar o pagamento.',
    grace_period: 'O pagamento manual venceu, mas está dentro do período de graça de 3 dias. Após esse período, o status muda para Inadimplente.',
    canceling: 'O aluno cancelou a assinatura pelo app. O acesso continua garantido até a data indicada. Após, volta para cortesia.',
    overdue: 'Pagamento atrasado há mais de 3 dias. Se o bloqueio de acesso estiver ativado, o aluno não consegue ver os treinos no app.',
    expired: 'O contrato expirou (período encerrado). Para continuar cobrando, configure uma nova cobrança.',
}

const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('pt-BR')
}

const intervalLabels: Record<string, string> = {
    month: '/mês',
    quarter: '/tri',
    year: '/ano',
}

function billingTypeLabel(bt: string | null): string {
    if (!bt) return 'Cortesia'
    if (bt === 'stripe_auto') return 'Stripe'
    if (bt === 'asaas_auto') return 'Cobrança Asaas'
    if (bt === 'asaas_auto_recurring') return 'Cartão automático'
    if (bt.startsWith('manual')) return 'Manual'
    if (bt === 'courtesy') return 'Cortesia'
    return bt
}

export function SubscriptionsClient({
    trainer,
    financialStudents: initialStudents,
    students,
    plans,
    hasStripeConnect,
    showStripeLegacy = false,
    walletStatus,
    sellToStudentId,
}: SubscriptionsClientProps) {
    const router = useRouter()
    const { toast } = useToast()
    const [financialStudents, setFinancialStudents] = useState(initialStudents)
    const [searchQuery, setSearchQuery] = useState('')
    const [activeTab, setActiveTab] = useState<TabKey>('todos')
    const [configModalState, setConfigModalState] = useState<{
        isOpen: boolean
        mode: 'new' | 'migrate'
        student: FinancialStudent | null
    }>({ isOpen: false, mode: 'new', student: null })
    const [cobrarCarteiraState, setCobrarCarteiraState] = useState<{
        isOpen: boolean
        student: FinancialStudent | null
    }>({ isOpen: false, student: null })
    const [detailModalOpen, setDetailModalOpen] = useState(false)
    const [selectedStudent, setSelectedStudent] = useState<FinancialStudent | null>(null)
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [blockConfirmId, setBlockConfirmId] = useState<string | null>(null)
    const [archiveTarget, setArchiveTarget] = useState<FinancialStudent | null>(null)
    const [appointmentPrompt, setAppointmentPrompt] = useState<{
        studentId: string
        studentName: string
        count: number
    } | null>(null)
    const [archiveLoading, setArchiveLoading] = useState(false)

    // Sync local state with server data
    useEffect(() => {
        setFinancialStudents(initialStudents)
    }, [initialStudents])

    // Auto-sync pending Stripe contracts
    useEffect(() => {
        const hasPendingStripe = initialStudents.some(
            s => s.billing_type === 'stripe_auto' && s.contract_status === 'pending'
        )
        if (!hasPendingStripe || !hasStripeConnect) return

        fetch('/api/stripe/connect/sync-contracts', { method: 'POST' })
            .then(res => res.json())
            .then(data => {
                if (data.synced > 0) {
                    router.refresh()
                }
            })
            .catch(() => {})
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    // Auto-open config modal when navigated with ?sell=<studentId>
    useEffect(() => {
        if (!sellToStudentId) return
        const target = initialStudents.find(s => s.student_id === sellToStudentId)
        handleOpenConfigModal('new', target)
    }, [sellToStudentId]) // eslint-disable-line react-hooks/exhaustive-deps

    const handleSuccess = () => {
        router.refresh()
    }

    const handleRowClick = (student: FinancialStudent) => {
        setSelectedStudent(student)
        setDetailModalOpen(true)
    }

    const handleMarkAsPaid = async (contractId: string, e: React.MouseEvent) => {
        e.stopPropagation()
        setActionLoading(contractId)
        const result = await markAsPaid({ contractId })
        if (result.success) {
            router.refresh()
        } else if (result.error) {
            toast({ message: result.error, type: 'error' })
        }
        setActionLoading(null)
    }

    const handleToggleBlock = async (student: FinancialStudent, value: boolean, e: React.MouseEvent) => {
        e.stopPropagation()
        if (!student.contract_id) return

        // Require confirm when enabling block
        if (value && blockConfirmId !== student.student_id) {
            setBlockConfirmId(student.student_id)
            return
        }

        setBlockConfirmId(null)
        setActionLoading(student.contract_id)
        await toggleBlockOnFail(student.contract_id, value)
        setActionLoading(null)
        router.refresh()
    }

    const handleCopyLink = async (student: FinancialStudent, e: React.MouseEvent) => {
        e.stopPropagation()

        setActionLoading(student.student_id)
        try {
            // Contrato Asaas pendente: a URL viva vem do Payment Link já criado
            // — o caminho Stripe abaixo falharia ("Conta Stripe não conectada").
            if (student.contract_id && student.billing_type?.startsWith('asaas')) {
                const res = await fetch(`/api/wallet/charges/${student.contract_id}`)
                const data = await res.json().catch(() => ({}))
                if (res.ok && data.url) {
                    await navigator.clipboard.writeText(data.url)
                    toast({ message: 'Link de pagamento copiado!', type: 'success' })
                } else {
                    toast({
                        message: data.error ?? 'Link não está mais ativo — gere uma nova cobrança.',
                        type: 'error',
                    })
                }
                return
            }

            const plan = plans.find(p => p.title === student.plan_title)
            if (!plan) return

            const result = await generateCheckoutLink({
                studentId: student.student_id,
                planId: plan.id,
            })
            if (result.url) {
                await navigator.clipboard.writeText(result.url)
                toast({ message: 'Link de pagamento copiado!', type: 'success' })
            } else if (result.error) {
                toast({ message: result.error, type: 'error' })
            }
        } catch {
            toast({ message: 'Erro ao gerar link', type: 'error' })
        } finally {
            setActionLoading(null)
        }
    }

    const handleOpenConfigModal = (mode: 'new' | 'migrate', targetStudent?: FinancialStudent | null) => {
        // Asaas-first: pra cobranças novas (não migração) e quando a Carteira está ativa,
        // abre o modal simplificado da Carteira. Migração continua no modal legado
        // porque envolve cancelar Stripe + recriar — fluxo mais delicado.
        const useWalletFlow = mode === 'new' && walletStatus === 'approved'
        if (useWalletFlow) {
            setCobrarCarteiraState({ isOpen: true, student: targetStudent ?? null })
            return
        }
        setConfigModalState({
            isOpen: true,
            mode,
            student: targetStudent ?? null,
        })
    }

    const handleArchive = async () => {
        if (!archiveTarget) return
        setArchiveLoading(true)
        try {
            const { archiveStudent } = await import('@/actions/financial/archive-student')
            const result = await archiveStudent({ studentId: archiveTarget.student_id })
            if (result.needsAppointmentDecision) {
                setAppointmentPrompt({
                    studentId: archiveTarget.student_id,
                    studentName: archiveTarget.student_name ?? 'este aluno',
                    count: result.activeRoutinesCount ?? 0,
                })
                setArchiveTarget(null)
                return
            }
            if (result.success) {
                setArchiveTarget(null)
                router.refresh()
            } else {
                toast({ message: result.error || 'Erro ao arquivar', type: 'error' })
            }
        } catch {
            toast({ message: 'Erro ao arquivar aluno', type: 'error' })
        } finally {
            setArchiveLoading(false)
        }
    }

    const continueArchiveWithDecision = async (decision: 'keep' | 'cancel') => {
        if (!appointmentPrompt) return
        setArchiveLoading(true)
        try {
            const { archiveStudent } = await import('@/actions/financial/archive-student')
            const result = await archiveStudent({
                studentId: appointmentPrompt.studentId,
                appointmentDecision: decision,
            })
            setAppointmentPrompt(null)
            if (result.success) {
                router.refresh()
            } else {
                toast({ message: result.error || 'Erro ao arquivar', type: 'error' })
            }
        } catch {
            toast({ message: 'Erro ao arquivar aluno', type: 'error' })
        } finally {
            setArchiveLoading(false)
        }
    }

    // Compute tab counts
    const tabCounts: Record<TabKey, number> = {
        pagantes: 0,
        cortesia: 0,
        atencao: 0,
        encerrados: 0,
        todos: financialStudents.length,
    }
    for (const s of financialStudents) {
        for (const tab of tabs) {
            if (tab.key !== 'todos' && tab.filter(s)) {
                tabCounts[tab.key]++
            }
        }
    }

    // Filter by tab + search
    const currentTab = tabs.find(t => t.key === activeTab) || tabs[0]
    const filteredStudents = financialStudents.filter(s => {
        if (!currentTab.filter(s)) return false
        if (searchQuery) {
            return matchesSearch(s.student_name, searchQuery)
        }
        return true
    })

    const getStatusBadgeText = (s: FinancialStudent): string => {
        if (s.display_status === 'canceling' && s.current_period_end) {
            return `Cancela em ${formatDate(s.current_period_end)}`
        }
        if (s.display_status === 'expired' && s.current_period_end) {
            return `Expirou em ${formatDate(s.current_period_end)}`
        }
        if (s.display_status === 'active') {
            return `Ativo — ${billingTypeLabel(s.billing_type)}`
        }
        return statusConfig[s.display_status].label
    }

    // Stats agregados pro topo da página
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)
    const stats = {
        active: financialStudents.filter(s => s.display_status === 'active').length,
        overdue: financialStudents.filter(s =>
            s.display_status === 'overdue' || s.display_status === 'grace_period'
        ).length,
        canceledMonth: financialStudents.filter(s =>
            s.display_status === 'canceled' &&
            s.canceled_at &&
            new Date(s.canceled_at) >= monthStart
        ).length,
        monthlyRevenue: financialStudents.reduce((sum, s) => {
            if (s.display_status !== 'active' || !s.amount) return sum
            const monthly = s.plan_interval === 'year' ? s.amount / 12
                : s.plan_interval === 'quarter' ? s.amount / 3
                : s.amount
            return sum + monthly
        }, 0),
    }

    const modalStudents = students.map(s => ({
        id: s.id,
        name: s.name,
        email: s.email,
    }))

    const modalPlans = plans.map(p => ({
        id: p.id,
        title: p.title,
        price: p.price,
        interval: p.interval,
        stripe_price_id: p.stripe_price_id,
        allow_pix: p.allow_pix ?? undefined,
        allow_credit_card: p.allow_credit_card ?? undefined,
        allow_boleto: p.allow_boleto ?? undefined,
        max_installment_count: p.max_installment_count ?? undefined,
    }))

    return (
        <AppLayout
            trainerName={trainer.name}
            trainerEmail={trainer.email}
            trainerAvatarUrl={trainer.avatar_url}
            trainerTheme={trainer.theme as 'light' | 'dark' | 'system' | null}
        >
            <div className="max-w-5xl mx-auto">
                {/* Voltar */}
                <Link
                    href="/financial"
                    className="inline-flex items-center gap-1 text-sm text-[#86868B] dark:text-k-text-tertiary hover:text-[#1D1D1F] dark:hover:text-k-text-primary transition-colors mb-4"
                >
                    <ArrowLeft size={16} />
                    Voltar pro Financeiro
                </Link>

                {/* Header */}
                <div className="flex items-start justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-[#1D1D1F] dark:text-k-text-primary">Assinaturas</h1>
                        <p className="text-sm text-[#86868B] dark:text-k-text-tertiary mt-1">
                            Quem está pagando recorrente — inclui Carteira Kinevo, manual e cortesia.
                        </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={() => handleOpenConfigModal('new')}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#7C3AED] dark:bg-violet-600 hover:bg-[#6D28D9] dark:hover:bg-violet-500 text-white text-sm font-medium transition-colors active:scale-[0.98]"
                        >
                            <Plus size={15} />
                            Nova assinatura
                        </button>
                    </div>
                </div>

                {/* Stats no topo */}
                {financialStudents.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                        <SubStat
                            label="Ativas"
                            value={stats.active.toString()}
                            tone="emerald"
                        />
                        <SubStat
                            label="Em atraso"
                            value={stats.overdue.toString()}
                            tone={stats.overdue > 0 ? 'red' : 'neutral'}
                            detail={stats.overdue > 0 ? 'Precisam de ação' : 'Nenhuma'}
                        />
                        <SubStat
                            label="Canceladas no mês"
                            value={stats.canceledMonth.toString()}
                            tone="neutral"
                        />
                        <SubStat
                            label="Receita mensal"
                            value={formatCurrency(stats.monthlyRevenue)}
                            tone="violet"
                            detail="Soma do que está cobrando hoje"
                        />
                    </div>
                )}

                <div className="space-y-4" data-student-list>
                    {/* Filtros chip-style */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {tabs.map(tab => {
                            const count = tabCounts[tab.key]
                            const isActive = activeTab === tab.key
                            return (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key)}
                                    className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                                        isActive
                                            ? 'bg-[#1D1D1F] dark:bg-k-text-primary text-white dark:text-surface-card'
                                            : 'bg-white dark:bg-surface-card text-[#6E6E73] dark:text-k-text-secondary border border-[#E8E8ED] dark:border-k-border-primary hover:bg-[#F5F5F7] dark:hover:bg-glass-bg'
                                    }`}
                                >
                                    {tab.label}
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                                        isActive
                                            ? 'bg-white/20 dark:bg-surface-card/30'
                                            : 'bg-[#F5F5F7] dark:bg-glass-bg'
                                    }`}>
                                        {count}
                                    </span>
                                    {tab.badge && count > 0 && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-[#FF3B30] dark:bg-red-500" />
                                    )}
                                </button>
                            )
                        })}
                    </div>

                    {/* Busca */}
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
                            <Search className="w-4 h-4 text-[#AEAEB2] dark:text-k-text-quaternary group-focus-within:text-[#7C3AED] dark:group-focus-within:text-violet-500 transition-colors" strokeWidth={1.5} />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar por nome do aluno…"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white dark:bg-surface-card border border-[#E8E8ED] dark:border-k-border-primary rounded-xl py-2.5 pl-10 pr-4 text-sm text-[#1D1D1F] dark:text-k-text-primary placeholder:text-[#AEAEB2] dark:placeholder:text-k-text-quaternary focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/15 dark:focus:ring-violet-500/15 focus:border-[#7C3AED]/50 dark:focus:border-violet-500/50"
                        />
                    </div>
                </div>

                    {/* Table */}
                    {filteredStudents.length === 0 ? (
                        <div className="bg-white dark:bg-surface-card rounded-2xl border border-[#D2D2D7] dark:border-k-border-subtle border-dashed">
                            {searchQuery ? (
                                <div className="flex flex-col items-center justify-center py-24 px-4">
                                    <p className="text-muted-foreground/50 font-medium">
                                        Nenhum aluno encontrado para &quot;{searchQuery}&quot;
                                    </p>
                                </div>
                            ) : activeTab === 'pagantes' ? (
                                <EmptyState
                                    icon={DollarSign}
                                    title="Nenhum aluno pagante"
                                    description={'Para configurar cobrança, vá à aba Cortesia e clique em "Configurar" no aluno desejado. Você pode cobrar via Stripe (automático) ou controle manual.'}
                                />
                            ) : activeTab === 'cortesia' ? (
                                <EmptyState
                                    icon={Heart}
                                    title="Todos os alunos têm cobrança configurada"
                                    description="Quando você cancelar a cobrança de um aluno ou cadastrar um novo, ele aparece aqui automaticamente como cortesia."
                                />
                            ) : activeTab === 'atencao' ? (
                                <EmptyState
                                    icon={CheckCircle2}
                                    title="Tudo em dia"
                                    description="Nenhum aluno com pagamento pendente, vencido ou cancelamento em andamento."
                                />
                            ) : activeTab === 'encerrados' ? (
                                <EmptyState
                                    icon={FolderArchive}
                                    title="Nenhum contrato encerrado"
                                    description={'Quando você cancelar a cobrança de um aluno, o contrato aparece aqui. Você pode reconfigurar a cobrança a qualquer momento clicando em "Configurar".'}
                                />
                            ) : (
                                <EmptyState
                                    icon={Users}
                                    title="Nenhum aluno cadastrado"
                                    description="Cadastre alunos no módulo Alunos. Eles aparecem aqui automaticamente como cortesia."
                                />
                            )}
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-[#E8E8ED] dark:border-k-border-subtle bg-white dark:bg-surface-card shadow-[0_1px_3px_rgba(0,0,0,0.08)] dark:shadow-xl overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-[#E8E8ED] dark:border-k-border-subtle">
                                            <th className="px-6 py-4 text-left text-xs font-medium text-[#86868B] dark:text-k-text-tertiary">Aluno</th>
                                            <th className="px-4 py-4 text-left text-xs font-medium text-[#86868B] dark:text-k-text-tertiary">Tipo</th>
                                            <th className="px-4 py-4 text-left text-xs font-medium text-[#86868B] dark:text-k-text-tertiary">Valor</th>
                                            <th className="px-4 py-4 text-left text-xs font-medium text-[#86868B] dark:text-k-text-tertiary">
                                                Status
                                                <InfoTooltip content="Status financeiro do aluno. Atualizado automaticamente para Stripe. Para cobranças manuais, marque como pago quando receber." />
                                            </th>
                                            <th className="px-4 py-4 text-left text-xs font-medium text-[#86868B] dark:text-k-text-tertiary">Vencimento</th>
                                            <th className="px-4 py-4 text-center text-xs font-medium text-[#86868B] dark:text-k-text-tertiary">
                                                Acesso
                                                <InfoTooltip content="Controla se o aluno perde acesso aos treinos em caso de atraso. Desativado por padrão — o aluno mantém acesso mesmo com pagamento pendente." />
                                            </th>
                                            <th className="px-4 py-4 text-right text-xs font-medium text-[#86868B] dark:text-k-text-tertiary">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#E8E8ED] dark:divide-k-border-subtle">
                                        {filteredStudents.map((s) => (
                                            <tr
                                                key={s.student_id}
                                                className="group transition-colors hover:bg-[#F5F5F7] dark:hover:bg-glass-bg cursor-pointer"
                                                onClick={() => handleRowClick(s)}
                                            >
                                                {/* Aluno */}
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#E8E8ED] dark:border-k-border-primary bg-[#F5F5F7] dark:bg-glass-bg overflow-hidden flex-shrink-0">
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
                                                                <span className="text-xs font-semibold text-[#1D1D1F] dark:text-k-text-primary">
                                                                    {s.student_name?.charAt(0).toUpperCase() || '?'}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className="text-sm font-medium text-[#1D1D1F] dark:text-k-text-primary">
                                                            {s.student_name}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Tipo */}
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    {s.billing_type ? (
                                                        <BillingTypeBadge billingType={s.billing_type} />
                                                    ) : (
                                                        <span className="text-xs text-[#AEAEB2] dark:text-k-text-quaternary">Cortesia</span>
                                                    )}
                                                </td>

                                                {/* Valor */}
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    {s.display_status === 'courtesy' ? (
                                                        <span className="text-xs text-[#AEAEB2] dark:text-k-text-quaternary">—</span>
                                                    ) : (
                                                        <span className="text-sm font-medium text-[#1D1D1F] dark:text-k-text-primary">
                                                            {s.amount ? formatCurrency(s.amount) : '—'}
                                                            {s.plan_interval && (
                                                                <span className="text-xs text-[#AEAEB2] dark:text-k-text-quaternary">
                                                                    {intervalLabels[s.plan_interval] || ''}
                                                                </span>
                                                            )}
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Status */}
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <span className={`px-2.5 py-1 text-[11px] font-semibold rounded-full ${statusConfig[s.display_status].className}`}>
                                                        {getStatusBadgeText(s)}
                                                    </span>
                                                    {statusTooltips[s.display_status] && (
                                                        <InfoTooltip content={statusTooltips[s.display_status]!} side="bottom" />
                                                    )}
                                                </td>

                                                {/* Vencimento */}
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <span className="text-sm text-[#86868B] dark:text-k-text-tertiary">
                                                        {s.display_status === 'courtesy' ? '—' : formatDate(s.current_period_end)}
                                                    </span>
                                                </td>

                                                {/* Acesso toggle */}
                                                <td className="px-4 py-4 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                                                    {s.display_status !== 'courtesy' && s.display_status !== 'canceled' && s.display_status !== 'expired' && s.contract_id ? (
                                                        <div className="relative inline-block">
                                                            <button
                                                                type="button"
                                                                onClick={(e) => handleToggleBlock(s, !s.block_on_fail, e)}
                                                                disabled={actionLoading === s.contract_id}
                                                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${
                                                                    s.block_on_fail ? 'bg-[#7C3AED] dark:bg-violet-600' : 'bg-[#8E8E93] dark:bg-gray-600'
                                                                }`}
                                                                title={s.block_on_fail ? 'Bloqueio ativo' : 'Acesso livre'}
                                                            >
                                                                <span
                                                                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                                                        s.block_on_fail ? 'translate-x-[18px]' : 'translate-x-[3px]'
                                                                    }`}
                                                                />
                                                            </button>
                                                            {blockConfirmId === s.student_id && (
                                                                <div className="absolute z-header top-full mt-1 right-0 w-56 p-3 rounded-xl border border-[#FF9500]/20 dark:border-amber-500/20 bg-white dark:bg-surface-card shadow-lg">
                                                                    <p className="text-[11px] text-[#FF9500] dark:text-amber-400 mb-2">
                                                                        Bloquear acesso de {s.student_name} se inadimplente?
                                                                    </p>
                                                                    <div className="flex gap-2">
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation()
                                                                                setBlockConfirmId(null)
                                                                                handleToggleBlock(s, true, e)
                                                                            }}
                                                                            className="px-2.5 py-1 text-[10px] font-semibold rounded-lg bg-[#7C3AED] dark:bg-violet-600 text-white hover:bg-[#6D28D9] dark:hover:bg-violet-500 transition-colors"
                                                                        >
                                                                            Confirmar
                                                                        </button>
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation()
                                                                                setBlockConfirmId(null)
                                                                            }}
                                                                            className="px-2.5 py-1 text-[10px] font-medium text-[#6E6E73] dark:text-k-text-secondary hover:text-[#1D1D1F] dark:hover:text-k-text-primary transition-colors"
                                                                        >
                                                                            Cancelar
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-[#AEAEB2] dark:text-k-text-quaternary">—</span>
                                                    )}
                                                </td>

                                                {/* Ações */}
                                                <td className="px-4 py-4 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex items-center justify-end gap-2">
                                                        {actionLoading != null && (actionLoading === s.contract_id || actionLoading === s.student_id) ? (
                                                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground/50" />
                                                        ) : (
                                                            <>
                                                                {/* Courtesy + Canceled + Expired: Configure */}
                                                                {(s.display_status === 'courtesy' || s.display_status === 'canceled' || s.display_status === 'expired') && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation()
                                                                            handleOpenConfigModal('new', s)
                                                                        }}
                                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-[#7C3AED]/10 dark:bg-violet-500/10 text-[#7C3AED] dark:text-violet-400 border border-[#7C3AED]/20 dark:border-violet-500/20 hover:bg-[#7C3AED]/20 dark:hover:bg-violet-500/20 transition-colors"
                                                                    >
                                                                        <Settings2 size={12} strokeWidth={2} />
                                                                        Configurar
                                                                    </button>
                                                                )}

                                                                {/* Canceled + Expired: Archive */}
                                                                {(s.display_status === 'canceled' || s.display_status === 'expired') && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation()
                                                                            setArchiveTarget(s)
                                                                        }}
                                                                        title="Arquivar aluno"
                                                                        className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gray-500/10 text-gray-500 dark:text-gray-400 hover:bg-red-500/10 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                                                                    >
                                                                        <FolderArchive size={13} strokeWidth={2} />
                                                                    </button>
                                                                )}

                                                                {/* Awaiting payment: Copy link */}
                                                                {s.display_status === 'awaiting_payment' && (
                                                                    <button
                                                                        onClick={(e) => handleCopyLink(s, e)}
                                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-[#7C3AED]/10 dark:bg-violet-500/10 text-[#7C3AED] dark:text-violet-400 border border-[#7C3AED]/20 dark:border-violet-500/20 hover:bg-[#7C3AED]/20 dark:hover:bg-violet-500/20 transition-colors"
                                                                    >
                                                                        <Copy size={12} strokeWidth={2} />
                                                                        Copiar Link
                                                                    </button>
                                                                )}

                                                                {/* Active manual / grace_period / overdue manual: Mark paid.
                                                                    asaas_auto_recurring fica de fora: marcar pago não pausa o
                                                                    débito automático do cartão → dupla cobrança. */}
                                                                {s.contract_id && s.billing_type !== 'stripe_auto' &&
                                                                    s.billing_type !== 'courtesy' &&
                                                                    s.billing_type !== 'asaas_auto_recurring' &&
                                                                    ['active', 'grace_period', 'overdue'].includes(s.display_status) && (
                                                                    <button
                                                                        onClick={(e) => handleMarkAsPaid(s.contract_id!, e)}
                                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-[#34C759]/10 dark:bg-emerald-500/10 text-[#34C759] dark:text-emerald-400 border border-[#34C759]/20 dark:border-emerald-500/20 hover:bg-[#34C759]/20 dark:hover:bg-emerald-500/20 transition-colors"
                                                                    >
                                                                        <CheckCircle size={12} strokeWidth={2} />
                                                                        Marcar pago
                                                                    </button>
                                                                )}

                                                                {/* WhatsApp for grace_period / overdue */}
                                                                {['grace_period', 'overdue'].includes(s.display_status) && s.phone && (
                                                                    <a
                                                                        href={`https://wa.me/55${s.phone.replace(/\D/g, '')}`}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        title="Contatar via WhatsApp"
                                                                        className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[#34C759]/10 dark:bg-emerald-600/10 text-[#34C759] dark:text-emerald-400 hover:bg-[#34C759]/20 dark:hover:bg-emerald-600/20 transition-colors"
                                                                    >
                                                                        <MessageCircle size={13} strokeWidth={2} />
                                                                    </a>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
            </div>

            {/* Configure Billing Modal (legacy — Stripe + manual + cortesia) */}
            <ConfigureBillingModal
                isOpen={configModalState.isOpen}
                onClose={() => setConfigModalState({ isOpen: false, mode: 'new', student: null })}
                onSuccess={handleSuccess}
                student={configModalState.student}
                hasStripeConnect={hasStripeConnect}
                showStripeLegacy={showStripeLegacy}
                allStudents={modalStudents}
                plans={modalPlans}
                mode={configModalState.mode}
            />

            {/* Cobrar via Carteira (Asaas — fluxo principal) */}
            <CobrarCarteiraModal
                isOpen={cobrarCarteiraState.isOpen}
                onClose={() => setCobrarCarteiraState({ isOpen: false, student: null })}
                onSuccess={handleSuccess}
                initialStudent={
                    cobrarCarteiraState.student
                        ? {
                            id: cobrarCarteiraState.student.student_id,
                            name: cobrarCarteiraState.student.student_name ?? 'Aluno',
                        }
                        : null
                }
                students={modalStudents}
                plans={modalPlans}
                walletStatus={walletStatus}
                initialMode="recurring"
            />

            {/* Financial Onboarding Modal (first visit) */}
            <FinancialOnboardingModal />

            {/* Student Financial Modal */}
            <StudentFinancialModal
                isOpen={detailModalOpen}
                onClose={() => {
                    setDetailModalOpen(false)
                    setSelectedStudent(null)
                }}
                onSuccess={handleSuccess}
                student={selectedStudent}
                plans={modalPlans}
                onOpenNewSubscription={(studentId) => {
                    setDetailModalOpen(false)
                    setSelectedStudent(null)
                    const target = financialStudents.find(s => s.student_id === studentId)
                    handleOpenConfigModal('new', target)
                }}
                onMigrate={(student) => {
                    setDetailModalOpen(false)
                    setSelectedStudent(null)
                    handleOpenConfigModal('migrate', student)
                }}
                onArchive={(studentId) => {
                    setDetailModalOpen(false)
                    setSelectedStudent(null)
                    const target = financialStudents.find(s => s.student_id === studentId)
                    if (target) setArchiveTarget(target)
                }}
            />

            {/* Archive Confirmation Modal */}
            {archiveTarget && (
                <div className="fixed inset-0 z-float flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => !archiveLoading && setArchiveTarget(null)} />
                    <div className="relative bg-background border border-border rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                        <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mb-4 mx-auto">
                            <FolderArchive className="w-6 h-6 text-red-500" />
                        </div>
                        <h3 className="text-lg font-bold text-foreground text-center mb-2">Arquivar Aluno?</h3>
                        <p className="text-muted-foreground text-sm text-center mb-6">
                            Tem certeza que deseja arquivar <span className="text-foreground font-medium">{archiveTarget.student_name}</span>?
                            O aluno será desvinculado da sua conta e contratos ativos serão cancelados. O aluno manterá acesso ao app e ao histórico de treinos.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setArchiveTarget(null)}
                                disabled={archiveLoading}
                                className="flex-1 px-4 py-2 bg-muted hover:bg-muted/80 text-foreground text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleArchive}
                                disabled={archiveLoading}
                                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {archiveLoading ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /> Arquivando...</>
                                ) : (
                                    'Sim, Arquivar'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Appointment Decision Modal (segunda etapa quando há rotinas ativas) */}
            {appointmentPrompt && (
                <div className="fixed inset-0 z-float flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                        onClick={() => !archiveLoading && setAppointmentPrompt(null)}
                    />
                    <div className="relative bg-background border border-border rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                        <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mb-4 mx-auto">
                            <CalendarOff className="w-6 h-6 text-red-500" />
                        </div>
                        <h3 className="text-lg font-bold text-foreground text-center mb-2">
                            E os agendamentos?
                        </h3>
                        <p className="text-muted-foreground text-sm text-center mb-6">
                            <span className="text-foreground font-medium">{appointmentPrompt.studentName}</span>{' '}
                            tem{' '}
                            <span className="text-foreground font-medium">
                                {appointmentPrompt.count}{' '}
                                {appointmentPrompt.count === 1 ? 'rotina ativa' : 'rotinas ativas'}
                            </span>
                            . Deseja encerrá-las também?
                        </p>
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={() => void continueArchiveWithDecision('cancel')}
                                disabled={archiveLoading}
                                className="w-full px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {archiveLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Processando...
                                    </>
                                ) : (
                                    'Arquivar e encerrar agendamentos'
                                )}
                            </button>
                            <button
                                onClick={() => void continueArchiveWithDecision('keep')}
                                disabled={archiveLoading}
                                className="w-full px-4 py-2.5 bg-muted hover:bg-muted/80 text-foreground text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
                            >
                                Só arquivar aluno
                            </button>
                            <button
                                onClick={() => setAppointmentPrompt(null)}
                                disabled={archiveLoading}
                                className="w-full px-4 py-2 text-muted-foreground hover:text-foreground text-xs font-medium transition-colors disabled:opacity-50"
                            >
                                Voltar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    )
}

// ─── Helper: card de stat usado no topo ──────────────────────────────────

function SubStat({
    label, value, tone, detail,
}: {
    label: string
    value: string
    tone: 'emerald' | 'red' | 'violet' | 'neutral'
    detail?: string
}) {
    const toneClasses = {
        emerald: 'text-emerald-700 dark:text-emerald-400',
        red: 'text-red-700 dark:text-red-400',
        violet: 'text-violet-700 dark:text-violet-400',
        neutral: 'text-[#1D1D1F] dark:text-k-text-primary',
    }
    return (
        <div className="rounded-2xl border border-[#E8E8ED] dark:border-k-border-primary bg-white dark:bg-surface-card p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-none">
            <p className="text-[11px] uppercase tracking-wider font-medium text-[#6E6E73] dark:text-k-text-secondary mb-1">
                {label}
            </p>
            <p className={`text-xl font-bold tabular-nums ${toneClasses[tone]}`}>{value}</p>
            {detail && (
                <p className="text-[11px] text-[#86868B] dark:text-k-text-tertiary mt-0.5">{detail}</p>
            )}
        </div>
    )
}
