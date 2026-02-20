'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AppLayout } from '@/components/layout'
import { EmptyState } from '@/components/financial/empty-state'
import { BillingTypeBadge } from '@/components/financial/billing-type-badge'
import { NewSubscriptionModal } from '@/components/financial/new-subscription-modal'
import { markAsPaid } from '@/actions/financial/mark-as-paid'
import { cancelContract } from '@/actions/financial/cancel-contract'
import Image from 'next/image'
import { Plus, Search, Users, Loader2, CheckCircle, XCircle, ArrowLeft } from 'lucide-react'

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
    avatar_url?: string | null
}

interface Plan {
    id: string
    title: string
    price: number
    interval: string
    stripe_price_id: string | null
}

interface Contract {
    id: string
    student_id: string
    trainer_id: string
    plan_id: string | null
    amount: number
    status: string
    billing_type: string
    block_on_fail: boolean
    stripe_subscription_id: string | null
    current_period_end: string | null
    cancel_at_period_end: boolean | null
    created_at: string
    students: Student | null
    trainer_plans: Plan | null
}

interface SubscriptionsClientProps {
    trainer: Trainer
    contracts: Contract[]
    students: Student[]
    plans: Plan[]
    hasStripeConnect: boolean
}

export function SubscriptionsClient({
    trainer,
    contracts: initialContracts,
    students,
    plans,
    hasStripeConnect,
}: SubscriptionsClientProps) {
    const router = useRouter()
    const [contracts, setContracts] = useState(initialContracts)
    const [searchQuery, setSearchQuery] = useState('')
    const [modalOpen, setModalOpen] = useState(false)
    const [actionLoading, setActionLoading] = useState<string | null>(null)

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

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
            past_due: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
            pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
            canceled: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
        }
        const labels: Record<string, string> = {
            active: 'Ativo',
            past_due: 'Pendente',
            pending: 'Pendente',
            canceled: 'Cancelado',
        }

        const style = styles[status] || styles.canceled
        const label = labels[status] || status

        return (
            <span className={`px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider rounded-full border ${style}`}>
                {label}
            </span>
        )
    }

    const handleMarkAsPaid = async (contractId: string, e: React.MouseEvent) => {
        e.stopPropagation()
        setActionLoading(contractId)

        const result = await markAsPaid({ contractId })
        if (result.success) {
            router.refresh()
            setContracts(contracts.map(c =>
                c.id === contractId ? { ...c, status: 'active' } : c
            ))
        }

        setActionLoading(null)
    }

    const handleCancel = async (contractId: string, e: React.MouseEvent) => {
        e.stopPropagation()
        if (!confirm('Tem certeza que deseja cancelar esta assinatura? Esta ação não pode ser desfeita.')) return

        setActionLoading(contractId)

        const result = await cancelContract({ contractId })
        if (result.success) {
            router.refresh()
            setContracts(contracts.map(c =>
                c.id === contractId ? { ...c, status: 'canceled' } : c
            ))
        }

        setActionLoading(null)
    }

    const handleSuccess = () => {
        router.refresh()
        setTimeout(() => {
            window.location.reload()
        }, 300)
    }

    const filteredContracts = contracts.filter((contract) => {
        const studentName = contract.students?.name?.toLowerCase() || ''
        const studentEmail = contract.students?.email?.toLowerCase() || ''
        const planTitle = contract.trainer_plans?.title?.toLowerCase() || ''
        const query = searchQuery.toLowerCase()
        return studentName.includes(query) || studentEmail.includes(query) || planTitle.includes(query)
    })

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
                                className="inline-flex items-center gap-1.5 text-xs text-k-text-secondary hover:text-violet-400 transition-colors mb-3"
                            >
                                <ArrowLeft size={14} />
                                Voltar para Financeiro
                            </Link>
                            <h1 className="text-3xl font-bold tracking-tighter bg-gradient-to-br from-[var(--gradient-text-from)] to-[var(--gradient-text-to)] bg-clip-text text-transparent">
                                Assinaturas
                            </h1>
                            <p className="mt-1 text-sm text-muted-foreground/60">
                                Gerencie as assinaturas dos seus alunos
                            </p>
                        </div>
                        <button
                            onClick={() => setModalOpen(true)}
                            className="bg-violet-600 hover:bg-violet-500 text-white rounded-full px-6 py-2.5 text-sm font-semibold shadow-lg shadow-violet-500/20 transition-all active:scale-95 flex items-center gap-2 w-fit"
                        >
                            <Plus size={18} strokeWidth={2} />
                            Nova Assinatura
                        </button>
                    </div>

                    {/* Search Bar */}
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                            <Search className="w-[18px] h-[18px] text-k-text-quaternary group-focus-within:text-violet-500 transition-colors" strokeWidth={1.5} />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar por aluno ou plano..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-glass-bg border border-k-border-primary rounded-2xl py-3.5 pl-11 pr-4 text-k-text-primary placeholder:text-k-text-quaternary focus:outline-none focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500/50 backdrop-blur-md transition-all"
                        />
                    </div>

                    {/* Table */}
                    {filteredContracts.length === 0 ? (
                        <div className="bg-surface-card rounded-2xl border border-k-border-subtle border-dashed">
                            {searchQuery ? (
                                <div className="flex flex-col items-center justify-center py-24 px-4">
                                    <p className="text-muted-foreground/50 font-medium">
                                        Nenhuma assinatura encontrada para &quot;{searchQuery}&quot;
                                    </p>
                                </div>
                            ) : (
                                <EmptyState
                                    icon={Users}
                                    title="Nenhuma assinatura"
                                    description="Crie sua primeira assinatura para começar a gerenciar os pagamentos dos seus alunos."
                                    action={{
                                        label: 'Nova Assinatura',
                                        onClick: () => setModalOpen(true),
                                    }}
                                />
                            )}
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-k-border-subtle bg-surface-card shadow-xl overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-k-border-subtle">
                                            <th className="px-6 py-5 text-left text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                                                Aluno
                                            </th>
                                            <th className="px-6 py-5 text-left text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                                                Plano
                                            </th>
                                            <th className="px-6 py-5 text-left text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                                                Valor
                                            </th>
                                            <th className="px-6 py-5 text-left text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                                                Tipo
                                            </th>
                                            <th className="px-6 py-5 text-left text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                                                Status
                                            </th>
                                            <th className="px-6 py-5 text-left text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                                                Vencimento
                                            </th>
                                            <th className="px-6 py-5 text-right text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                                                Ações
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-k-border-subtle">
                                        {filteredContracts.map((contract) => (
                                            <tr
                                                key={contract.id}
                                                className="group transition-colors hover:bg-glass-bg"
                                            >
                                                {/* Student */}
                                                <td className="px-6 py-5 whitespace-nowrap">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-k-border-primary bg-glass-bg overflow-hidden flex-shrink-0">
                                                            {contract.students?.avatar_url ? (
                                                                <Image
                                                                    src={contract.students.avatar_url}
                                                                    alt={contract.students.name}
                                                                    width={36}
                                                                    height={36}
                                                                    className="h-9 w-9 rounded-full object-cover"
                                                                    unoptimized
                                                                />
                                                            ) : (
                                                                <span className="text-xs font-semibold text-k-text-primary">
                                                                    {contract.students?.name?.charAt(0).toUpperCase() || '?'}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-medium text-k-text-primary">
                                                                {contract.students?.name || 'Aluno removido'}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground/60">
                                                                {contract.students?.email || ''}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Plan */}
                                                <td className="px-6 py-5 whitespace-nowrap">
                                                    <span className="text-sm text-k-text-primary">
                                                        {contract.trainer_plans?.title || '—'}
                                                    </span>
                                                </td>

                                                {/* Amount */}
                                                <td className="px-6 py-5 whitespace-nowrap">
                                                    <span className="text-sm font-medium text-k-text-primary">
                                                        {contract.billing_type === 'courtesy'
                                                            ? 'Grátis'
                                                            : formatCurrency(contract.amount)}
                                                    </span>
                                                </td>

                                                {/* Billing Type */}
                                                <td className="px-6 py-5 whitespace-nowrap">
                                                    <BillingTypeBadge billingType={contract.billing_type} />
                                                </td>

                                                {/* Status */}
                                                <td className="px-6 py-5 whitespace-nowrap">
                                                    {getStatusBadge(contract.status)}
                                                </td>

                                                {/* Period End */}
                                                <td className="px-6 py-5 whitespace-nowrap">
                                                    <span className="text-sm text-muted-foreground/60">
                                                        {formatDate(contract.current_period_end)}
                                                    </span>
                                                </td>

                                                {/* Actions */}
                                                <td className="px-6 py-5 whitespace-nowrap text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {actionLoading === contract.id ? (
                                                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground/50" />
                                                        ) : (
                                                            <>
                                                                {/* Mark as Paid — only for manual/past_due */}
                                                                {contract.status === 'past_due' &&
                                                                    contract.billing_type !== 'stripe_auto' &&
                                                                    contract.billing_type !== 'courtesy' && (
                                                                        <button
                                                                            onClick={(e) => handleMarkAsPaid(contract.id, e)}
                                                                            title="Marcar como pago"
                                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                                                                        >
                                                                            <CheckCircle size={13} strokeWidth={2} />
                                                                            Baixar
                                                                        </button>
                                                                    )}

                                                                {/* Cancel — for active/past_due (not already canceled) */}
                                                                {(contract.status === 'active' || contract.status === 'past_due') && (
                                                                    <button
                                                                        onClick={(e) => handleCancel(contract.id, e)}
                                                                        title="Cancelar assinatura"
                                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-gray-500/10 text-gray-400 border border-gray-500/20 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-colors"
                                                                    >
                                                                        <XCircle size={13} strokeWidth={2} />
                                                                        Cancelar
                                                                    </button>
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

            {/* New Subscription Modal */}
            <NewSubscriptionModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                onSuccess={handleSuccess}
                students={modalStudents}
                plans={modalPlans}
                hasStripeConnect={hasStripeConnect}
            />
        </AppLayout>
    )
}
