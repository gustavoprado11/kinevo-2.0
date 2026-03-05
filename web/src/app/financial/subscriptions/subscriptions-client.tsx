'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { AppLayout } from '@/components/layout'
import { EmptyState } from '@/components/financial/empty-state'
import { BillingTypeBadge } from '@/components/financial/billing-type-badge'
import { ConfigureBillingModal } from '@/components/financial/configure-billing-modal'
import { StudentFinancialModal } from '@/components/financial/student-financial-modal'
import { FinancialOnboardingModal } from '@/components/financial/financial-onboarding-modal'
import { markAsPaid } from '@/actions/financial/mark-as-paid'
import { toggleBlockOnFail } from '@/actions/financial/toggle-block-on-fail'
import { generateCheckoutLink } from '@/actions/financial/generate-checkout-link'
import type { FinancialStudent, DisplayStatus } from '@/types/financial'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import {
    Plus, Search, Users, Loader2, CheckCircle, ArrowLeft, Copy,
    RefreshCw, MessageCircle, Settings2, ChevronDown,
    Heart, DollarSign, CheckCircle2, FolderArchive
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
}

interface SubscriptionsClientProps {
    trainer: Trainer
    financialStudents: FinancialStudent[]
    students: Student[]
    plans: Plan[]
    hasStripeConnect: boolean
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
        filter: (s) => ['overdue', 'grace_period', 'canceling'].includes(s.display_status),
        badge: true,
    },
    {
        key: 'encerrados',
        label: 'Encerrados',
        filter: (s) => s.display_status === 'canceled',
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
}

const statusTooltips: Partial<Record<DisplayStatus, string>> = {
    courtesy: 'Acesso gratuito. O aluno treina normalmente sem cobrança configurada.',
    awaiting_payment: 'Link de pagamento Stripe enviado. Aguardando o aluno completar o pagamento.',
    grace_period: 'O pagamento manual venceu, mas está dentro do período de graça de 3 dias. Após esse período, o status muda para Inadimplente.',
    canceling: 'O aluno cancelou a assinatura pelo app. O acesso continua garantido até a data indicada. Após, volta para cortesia.',
    overdue: 'Pagamento atrasado há mais de 3 dias. Se o bloqueio de acesso estiver ativado, o aluno não consegue ver os treinos no app.',
}

const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

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
}: SubscriptionsClientProps) {
    const router = useRouter()
    const [financialStudents, setFinancialStudents] = useState(initialStudents)
    const [searchQuery, setSearchQuery] = useState('')
    const [activeTab, setActiveTab] = useState<TabKey>('todos')
    const [configModalState, setConfigModalState] = useState<{
        isOpen: boolean
        mode: 'new' | 'migrate'
        student: FinancialStudent | null
    }>({ isOpen: false, mode: 'new', student: null })
    const [detailModalOpen, setDetailModalOpen] = useState(false)
    const [selectedStudent, setSelectedStudent] = useState<FinancialStudent | null>(null)
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [syncing, setSyncing] = useState(false)
    const [blockConfirmId, setBlockConfirmId] = useState<string | null>(null)
    const [howToOpen, setHowToOpen] = useState(false)

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

    const handleSuccess = () => {
        router.refresh()
    }

    const handleSyncContracts = async () => {
        setSyncing(true)
        try {
            const res = await fetch('/api/stripe/connect/sync-contracts', { method: 'POST' })
            const data = await res.json()
            if (data.synced > 0) {
                router.refresh()
            }
        } catch {
            // silently fail
        } finally {
            setSyncing(false)
        }
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

        const plan = plans.find(p => p.title === student.plan_title)
        if (!plan) return

        setActionLoading(student.student_id)
        try {
            const result = await generateCheckoutLink({
                studentId: student.student_id,
                planId: plan.id,
            })
            if (result.url) {
                await navigator.clipboard.writeText(result.url)
                alert('Link de pagamento copiado!')
            } else if (result.error) {
                alert(result.error)
            }
        } catch {
            alert('Erro ao gerar link')
        } finally {
            setActionLoading(null)
        }
    }

    const handleOpenConfigModal = (mode: 'new' | 'migrate', targetStudent?: FinancialStudent | null) => {
        setConfigModalState({
            isOpen: true,
            mode,
            student: targetStudent ?? null,
        })
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
            return s.student_name.toLowerCase().includes(searchQuery.toLowerCase())
        }
        return true
    })

    const getStatusBadgeText = (s: FinancialStudent): string => {
        if (s.display_status === 'canceling' && s.current_period_end) {
            return `Cancela em ${formatDate(s.current_period_end)}`
        }
        if (s.display_status === 'active') {
            return `Ativo — ${billingTypeLabel(s.billing_type)}`
        }
        return statusConfig[s.display_status].label
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
    }))

    return (
        <AppLayout
            trainerName={trainer.name}
            trainerEmail={trainer.email}
            trainerAvatarUrl={trainer.avatar_url}
            trainerTheme={trainer.theme as 'light' | 'dark' | 'system' | null}
        >
            <div className="min-h-screen bg-surface-primary p-8 font-sans">
                <div className="max-w-7xl mx-auto space-y-8">

                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                            <Link
                                href="/financial"
                                className="inline-flex items-center gap-1.5 text-xs text-k-text-secondary hover:text-violet-600 dark:hover:text-violet-400 transition-colors mb-3"
                            >
                                <ArrowLeft size={14} />
                                Voltar para Financeiro
                            </Link>
                            <h1 className="text-3xl font-bold tracking-tighter bg-gradient-to-br from-[var(--gradient-text-from)] to-[var(--gradient-text-to)] bg-clip-text text-transparent">
                                Assinaturas
                            </h1>
                            <p className="mt-1 text-sm text-muted-foreground/60">
                                Gerencie as cobranças dos seus alunos
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            {hasStripeConnect && (
                                <span className="inline-flex items-center">
                                    <button
                                        onClick={handleSyncContracts}
                                        disabled={syncing}
                                        title="Sincronizar assinaturas com o Stripe"
                                        className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-full border border-k-border-primary bg-glass-bg hover:bg-violet-500/10 text-k-text-secondary hover:text-violet-600 dark:hover:text-violet-400 transition-all disabled:opacity-50"
                                    >
                                        <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
                                        {syncing ? 'Sincronizando...' : 'Sincronizar'}
                                    </button>
                                    <InfoTooltip content="Atualiza o status dos pagamentos Stripe. Use após enviar um link de pagamento para verificar se o aluno já pagou." />
                                </span>
                            )}
                            <button
                                onClick={() => handleOpenConfigModal('new')}
                                className="bg-violet-600 hover:bg-violet-500 text-white rounded-full px-6 py-2.5 text-sm font-semibold transition-all active:scale-95 flex items-center gap-2 w-fit"
                            >
                                <Plus size={18} strokeWidth={2} />
                                Nova Cobrança
                            </button>
                        </div>
                    </div>

                    {/* Tabs + Search */}
                    <div className="space-y-4" data-student-list>
                        <div className="flex items-center gap-1 bg-surface-card border border-k-border-subtle rounded-xl p-1">
                            {tabs.map(tab => {
                                const count = tabCounts[tab.key]
                                const isActive = activeTab === tab.key
                                return (
                                    <button
                                        key={tab.key}
                                        onClick={() => setActiveTab(tab.key)}
                                        className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                                            isActive
                                                ? 'bg-glass-bg-active text-k-text-primary shadow-sm'
                                                : 'text-k-text-tertiary hover:text-k-text-secondary'
                                        }`}
                                    >
                                        {tab.label}
                                        <span className={`text-[10px] ${
                                            isActive ? 'text-violet-600 dark:text-violet-400' : 'text-k-text-quaternary'
                                        }`}>
                                            {count}
                                        </span>
                                        {tab.badge && count > 0 && (
                                            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                        )}
                                    </button>
                                )
                            })}
                        </div>

                        {/* Collapsible "Como funciona" */}
                        <button
                            onClick={() => setHowToOpen(!howToOpen)}
                            className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-k-border-subtle bg-glass-bg text-k-text-tertiary hover:text-k-text-secondary transition-colors"
                        >
                            <span className="text-xs font-medium">Como funciona a cobrança</span>
                            <ChevronDown
                                size={14}
                                className={`transition-transform duration-200 ${howToOpen ? 'rotate-180' : ''}`}
                            />
                        </button>
                        {howToOpen && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-1">
                                <div className="rounded-xl border border-k-border-subtle bg-glass-bg p-4">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <Heart size={13} className="text-emerald-600 dark:text-emerald-400" />
                                        <span className="text-xs font-semibold text-k-text-primary">Cortesia por padrão</span>
                                    </div>
                                    <p className="text-[11px] text-k-text-secondary leading-relaxed">
                                        Todo aluno começa com acesso gratuito. Você decide individualmente quem cobrar.
                                    </p>
                                </div>
                                <div className="rounded-xl border border-k-border-subtle bg-glass-bg p-4">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <DollarSign size={13} className="text-violet-600 dark:text-violet-400" />
                                        <span className="text-xs font-semibold text-k-text-primary">Stripe (automático)</span>
                                    </div>
                                    <p className="text-[11px] text-k-text-secondary leading-relaxed">
                                        Gere um link, envie ao aluno, renovação automática. O aluno pode cancelar pelo app.
                                    </p>
                                </div>
                                <div className="rounded-xl border border-k-border-subtle bg-glass-bg p-4">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <Copy size={13} className="text-blue-600 dark:text-blue-400" />
                                        <span className="text-xs font-semibold text-k-text-primary">Manual</span>
                                    </div>
                                    <p className="text-[11px] text-k-text-secondary leading-relaxed">
                                        Registre pagamentos (Pix, dinheiro) no seu ritmo. O Kinevo avisa 3 dias após o vencimento.
                                    </p>
                                </div>
                                <div className="rounded-xl border border-k-border-subtle bg-glass-bg p-4">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <Settings2 size={13} className="text-amber-600 dark:text-amber-400" />
                                        <span className="text-xs font-semibold text-k-text-primary">Bloqueio de acesso</span>
                                    </div>
                                    <p className="text-[11px] text-k-text-secondary leading-relaxed">
                                        Opcional por aluno. Se ativado, o aluno perde acesso aos treinos após 3 dias de atraso.
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="relative group">
                            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                                <Search className="w-[18px] h-[18px] text-k-text-quaternary group-focus-within:text-violet-500 transition-colors" strokeWidth={1.5} />
                            </div>
                            <input
                                type="text"
                                placeholder="Buscar por nome do aluno..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-glass-bg border border-k-border-primary rounded-2xl py-3 pl-11 pr-4 text-k-text-primary placeholder:text-k-text-quaternary focus:outline-none focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500/50 backdrop-blur-md transition-all text-sm"
                            />
                        </div>
                    </div>

                    {/* Table */}
                    {filteredStudents.length === 0 ? (
                        <div className="bg-surface-card rounded-2xl border border-k-border-subtle border-dashed">
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
                        <div className="rounded-2xl border border-k-border-subtle bg-surface-card shadow-xl overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-k-border-subtle">
                                            <th className="px-6 py-4 text-left text-xs font-medium text-k-text-tertiary">Aluno</th>
                                            <th className="px-4 py-4 text-left text-xs font-medium text-k-text-tertiary">Tipo</th>
                                            <th className="px-4 py-4 text-left text-xs font-medium text-k-text-tertiary">Valor</th>
                                            <th className="px-4 py-4 text-left text-xs font-medium text-k-text-tertiary">
                                                Status
                                                <InfoTooltip content="Status financeiro do aluno. Atualizado automaticamente para Stripe. Para cobranças manuais, marque como pago quando receber." />
                                            </th>
                                            <th className="px-4 py-4 text-left text-xs font-medium text-k-text-tertiary">Vencimento</th>
                                            <th className="px-4 py-4 text-center text-xs font-medium text-k-text-tertiary">
                                                Acesso
                                                <InfoTooltip content="Controla se o aluno perde acesso aos treinos em caso de atraso. Desativado por padrão — o aluno mantém acesso mesmo com pagamento pendente." />
                                            </th>
                                            <th className="px-4 py-4 text-right text-xs font-medium text-k-text-tertiary">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-k-border-subtle">
                                        {filteredStudents.map((s) => (
                                            <tr
                                                key={s.student_id}
                                                className="group transition-colors hover:bg-glass-bg cursor-pointer"
                                                onClick={() => handleRowClick(s)}
                                            >
                                                {/* Aluno */}
                                                <td className="px-6 py-4 whitespace-nowrap">
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
                                                        <span className="text-sm font-medium text-k-text-primary">
                                                            {s.student_name}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Tipo */}
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    {s.billing_type ? (
                                                        <BillingTypeBadge billingType={s.billing_type} />
                                                    ) : (
                                                        <span className="text-xs text-k-text-quaternary">Cortesia</span>
                                                    )}
                                                </td>

                                                {/* Valor */}
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    {s.display_status === 'courtesy' ? (
                                                        <span className="text-xs text-k-text-quaternary">—</span>
                                                    ) : (
                                                        <span className="text-sm font-medium text-k-text-primary">
                                                            {s.amount ? formatCurrency(s.amount) : '—'}
                                                            {s.plan_interval && (
                                                                <span className="text-xs text-k-text-quaternary">
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
                                                    <span className="text-sm text-k-text-tertiary">
                                                        {s.display_status === 'courtesy' ? '—' : formatDate(s.current_period_end)}
                                                    </span>
                                                </td>

                                                {/* Acesso toggle */}
                                                <td className="px-4 py-4 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                                                    {s.display_status !== 'courtesy' && s.display_status !== 'canceled' && s.contract_id ? (
                                                        <div className="relative inline-block">
                                                            <button
                                                                type="button"
                                                                onClick={(e) => handleToggleBlock(s, !s.block_on_fail, e)}
                                                                disabled={actionLoading === s.contract_id}
                                                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${
                                                                    s.block_on_fail ? 'bg-violet-600' : 'bg-gray-600'
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
                                                                <div className="absolute z-20 top-full mt-1 right-0 w-56 p-3 rounded-xl border border-amber-500/20 bg-surface-card shadow-lg">
                                                                    <p className="text-[11px] text-amber-600 dark:text-amber-400 mb-2">
                                                                        Bloquear acesso de {s.student_name} se inadimplente?
                                                                    </p>
                                                                    <div className="flex gap-2">
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation()
                                                                                setBlockConfirmId(null)
                                                                                handleToggleBlock(s, true, e)
                                                                            }}
                                                                            className="px-2.5 py-1 text-[10px] font-semibold rounded-lg bg-violet-600 text-white hover:bg-violet-500 transition-colors"
                                                                        >
                                                                            Confirmar
                                                                        </button>
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation()
                                                                                setBlockConfirmId(null)
                                                                            }}
                                                                            className="px-2.5 py-1 text-[10px] font-medium text-k-text-secondary hover:text-k-text-primary transition-colors"
                                                                        >
                                                                            Cancelar
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-k-text-quaternary">—</span>
                                                    )}
                                                </td>

                                                {/* Ações */}
                                                <td className="px-4 py-4 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex items-center justify-end gap-2">
                                                        {actionLoading != null && (actionLoading === s.contract_id || actionLoading === s.student_id) ? (
                                                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground/50" />
                                                        ) : (
                                                            <>
                                                                {/* Courtesy + Canceled: Configure */}
                                                                {(s.display_status === 'courtesy' || s.display_status === 'canceled') && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation()
                                                                            handleOpenConfigModal('new', s)
                                                                        }}
                                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 transition-colors"
                                                                    >
                                                                        <Settings2 size={12} strokeWidth={2} />
                                                                        Configurar
                                                                    </button>
                                                                )}

                                                                {/* Awaiting payment: Copy link */}
                                                                {s.display_status === 'awaiting_payment' && (
                                                                    <button
                                                                        onClick={(e) => handleCopyLink(s, e)}
                                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 transition-colors"
                                                                    >
                                                                        <Copy size={12} strokeWidth={2} />
                                                                        Copiar Link
                                                                    </button>
                                                                )}

                                                                {/* Active manual / grace_period / overdue manual: Mark paid */}
                                                                {s.contract_id && s.billing_type !== 'stripe_auto' &&
                                                                    s.billing_type !== 'courtesy' &&
                                                                    ['active', 'grace_period', 'overdue'].includes(s.display_status) && (
                                                                    <button
                                                                        onClick={(e) => handleMarkAsPaid(s.contract_id!, e)}
                                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
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
                                                                        className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600/20 transition-colors"
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
            </div>

            {/* Configure Billing Modal */}
            <ConfigureBillingModal
                isOpen={configModalState.isOpen}
                onClose={() => setConfigModalState({ isOpen: false, mode: 'new', student: null })}
                onSuccess={handleSuccess}
                student={configModalState.student}
                allStudents={modalStudents}
                plans={modalPlans}
                hasStripeConnect={hasStripeConnect}
                mode={configModalState.mode}
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
                hasStripeConnect={hasStripeConnect}
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
            />
        </AppLayout>
    )
}
