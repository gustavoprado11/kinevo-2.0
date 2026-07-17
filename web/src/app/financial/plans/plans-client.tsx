'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AppLayout } from '@/components/layout'
import { EmptyState } from '@/components/financial/empty-state'
import { PlanFormModal } from '@/components/financial/plan-form-modal'
import { togglePlan } from '@/actions/financial/toggle-plan'
import { deletePlan } from '@/actions/financial/delete-plan'
import {
    Plus, Trash2, Loader2, Wallet, Pencil, ChevronLeft, Users,
    TrendingUp, Layers, Repeat,
} from 'lucide-react'
import { formatBRL } from '@kinevo/shared/utils/currency'

interface Trainer {
    id: string
    name: string
    email: string
    avatar_url?: string | null
    theme?: string | null
}

interface Plan {
    id: string
    title: string
    description: string | null
    price: number
    interval: string
    interval_count: number | null
    is_active: boolean
    visibility: string | null
    stripe_product_id: string | null
    stripe_price_id: string | null
    allow_pix?: boolean | null
    allow_credit_card?: boolean | null
    allow_boleto?: boolean | null
    max_installment_count?: number | null
    created_at: string
}

interface PlansClientProps {
    trainer: Trainer
    plans: Plan[]
    hasStripeConnect: boolean
    usageByPlan: Record<string, number>
}

const intervalLabel = (i: string): string => {
    switch (i) {
        case 'month': return 'mensal'
        case 'quarter': return 'trimestral'
        case 'year': return 'anual'
        default: return i
    }
}

export function PlansClient({ trainer, plans: initialPlans, hasStripeConnect, usageByPlan }: PlansClientProps) {
    const router = useRouter()
    const [plans, setPlans] = useState(initialPlans)
    const [deleting, setDeleting] = useState<string | null>(null)
    const [toggling, setToggling] = useState<string | null>(null)
    const [modalOpen, setModalOpen] = useState(false)
    const [editingPlan, setEditingPlan] = useState<Plan | null>(null)
    const [showArchived, setShowArchived] = useState(false)

    // ─── Stats ──────────────────────────────────────────────────────
    const stats = useMemo(() => {
        const activePlans = plans.filter(p => p.is_active)
        const linkedStudents = Object.values(usageByPlan).reduce((a, b) => a + b, 0)
        // Receita mensal estimada: pra cada plano ativo, multiplica preço × alunos
        // do plano. Anual conta /12, trimestral /3.
        const monthlyRevenue = activePlans.reduce((sum, p) => {
            const count = usageByPlan[p.id] ?? 0
            const monthly = p.interval === 'year' ? p.price / 12
                : p.interval === 'quarter' ? p.price / 3
                : p.price
            return sum + (monthly * count)
        }, 0)
        return {
            activeCount: activePlans.length,
            totalCount: plans.length,
            linkedStudents,
            monthlyRevenue,
        }
    }, [plans, usageByPlan])

    const visiblePlans = useMemo(() => {
        if (showArchived) return plans
        return plans.filter(p => p.is_active)
    }, [plans, showArchived])

    const archivedCount = plans.filter(p => !p.is_active).length

    // ─── Handlers ───────────────────────────────────────────────────
    const handleEditPlan = (plan: Plan) => {
        setEditingPlan(plan)
        setModalOpen(true)
    }
    const handleCreatePlan = () => {
        setEditingPlan(null)
        setModalOpen(true)
    }
    const handleTogglePlan = async (planId: string, e: React.MouseEvent) => {
        e.stopPropagation()
        setToggling(planId)
        const result = await togglePlan({ planId })
        if (result.success) {
            setPlans(plans.map(p =>
                p.id === planId ? { ...p, is_active: result.is_active ?? !p.is_active } : p
            ))
        }
        setToggling(null)
    }
    const handleDeletePlan = async (planId: string, e: React.MouseEvent) => {
        e.stopPropagation()
        if (!confirm('Tem certeza que deseja excluir este plano?\nAssinaturas ativas continuam funcionando mas o plano some das listagens.')) return
        setDeleting(planId)
        const result = await deletePlan({ planId })
        if (result.success) setPlans(plans.filter(p => p.id !== planId))
        setDeleting(null)
    }
    const handleModalSuccess = () => {
        router.refresh()
        setTimeout(() => window.location.reload(), 300)
    }

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
                    <ChevronLeft size={16} />
                    Voltar pro Financeiro
                </Link>

                {/* Header */}
                <div className="flex items-start justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-[#1D1D1F] dark:text-k-text-primary">Planos</h1>
                        <p className="text-sm text-[#86868B] dark:text-k-text-tertiary mt-1">
                            Pacotes que você vende. Defina preço, recorrência e métodos aceitos.
                        </p>
                    </div>
                    <button
                        onClick={handleCreatePlan}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-control bg-primary hover:opacity-90 text-primary-foreground text-sm font-medium transition-colors active:scale-[0.98] shrink-0"
                    >
                        <Plus size={15} />
                        Novo plano
                    </button>
                </div>

                {/* Stats */}
                {plans.length > 0 && (
                    <div className="grid grid-cols-3 gap-3 mb-6">
                        <StatCard
                            icon={<Layers size={16} className="text-[#7C3AED] dark:text-violet-400" />}
                            iconBg="bg-[#7C3AED]/10 dark:bg-violet-500/10"
                            label="Planos ativos"
                            value={stats.activeCount.toString()}
                            detail={`de ${stats.totalCount} ${stats.totalCount === 1 ? 'cadastrado' : 'cadastrados'}`}
                        />
                        <StatCard
                            icon={<TrendingUp size={16} className="text-[#34C759] dark:text-emerald-400" />}
                            iconBg="bg-[#34C759]/10 dark:bg-emerald-500/10"
                            label="Receita mensal estimada"
                            value={formatBRL(stats.monthlyRevenue)}
                            detail="Soma do que está cobrando hoje"
                        />
                        <StatCard
                            icon={<Users size={16} className="text-[#5856D6] dark:text-blue-400" />}
                            iconBg="bg-[#5856D6]/10 dark:bg-blue-500/10"
                            label="Alunos vinculados"
                            value={stats.linkedStudents.toString()}
                            detail={
                                stats.activeCount > 0
                                    ? `média ${Math.round(stats.linkedStudents / stats.activeCount)} por plano`
                                    : '—'
                            }
                        />
                    </div>
                )}

                {/* Filtro arquivados (se houver) */}
                {archivedCount > 0 && (
                    <div className="flex items-center gap-2 mb-3">
                        <button
                            onClick={() => setShowArchived(false)}
                            className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                                !showArchived
                                    ? 'bg-[#1D1D1F] dark:bg-k-text-primary text-white dark:text-surface-card'
                                    : 'bg-white dark:bg-surface-card text-[#6E6E73] dark:text-k-text-secondary border border-[#E8E8ED] dark:border-k-border-primary hover:bg-[#F5F5F7]'
                            }`}
                        >
                            Ativos <span className="opacity-60 ml-1">({stats.activeCount})</span>
                        </button>
                        <button
                            onClick={() => setShowArchived(true)}
                            className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                                showArchived
                                    ? 'bg-[#1D1D1F] dark:bg-k-text-primary text-white dark:text-surface-card'
                                    : 'bg-white dark:bg-surface-card text-[#6E6E73] dark:text-k-text-secondary border border-[#E8E8ED] dark:border-k-border-primary hover:bg-[#F5F5F7]'
                            }`}
                        >
                            Todos <span className="opacity-60 ml-1">({plans.length})</span>
                        </button>
                    </div>
                )}

                {/* Lista de planos */}
                {visiblePlans.length === 0 ? (
                    <div className="bg-white dark:bg-surface-card rounded-2xl border border-[#E8E8ED] dark:border-k-border-primary border-dashed">
                        <EmptyState
                            icon={Wallet}
                            title={plans.length === 0 ? 'Nenhum plano criado' : 'Nenhum plano ativo'}
                            description={
                                plans.length === 0
                                    ? 'Crie seu primeiro plano para começar a cobrar seus alunos via PIX ou Cartão.'
                                    : 'Você tem planos arquivados. Clique em "Todos" pra vê-los.'
                            }
                            action={
                                plans.length === 0
                                    ? { label: 'Criar Plano', onClick: handleCreatePlan }
                                    : undefined
                            }
                        />
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        {visiblePlans.map(plan => (
                            <PlanRow
                                key={plan.id}
                                plan={plan}
                                usage={usageByPlan[plan.id] ?? 0}
                                deleting={deleting === plan.id}
                                toggling={toggling === plan.id}
                                onEdit={() => handleEditPlan(plan)}
                                onToggle={(e) => handleTogglePlan(plan.id, e)}
                                onDelete={(e) => handleDeletePlan(plan.id, e)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Modal */}
            <PlanFormModal
                isOpen={modalOpen}
                onClose={() => {
                    setModalOpen(false)
                    setEditingPlan(null)
                }}
                onSuccess={handleModalSuccess}
                plan={editingPlan ? {
                    ...editingPlan,
                    allow_pix: editingPlan.allow_pix ?? undefined,
                    allow_credit_card: editingPlan.allow_credit_card ?? undefined,
                    allow_boleto: editingPlan.allow_boleto ?? undefined,
                    max_installment_count: editingPlan.max_installment_count ?? undefined,
                } : null}
                hasStripeConnect={hasStripeConnect}
            />
        </AppLayout>
    )
}

// ─── Sub-componentes ─────────────────────────────────────────────────────

function StatCard({
    icon, iconBg, label, value, detail,
}: {
    icon: React.ReactNode
    iconBg: string
    label: string
    value: string
    detail: string
}) {
    return (
        <div className="rounded-2xl border border-[#E8E8ED] dark:border-k-border-primary bg-white dark:bg-surface-card p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-none">
            <div className="flex items-center gap-2 mb-2">
                <div className={`flex items-center justify-center w-7 h-7 rounded-lg ${iconBg}`}>
                    {icon}
                </div>
                <span className="text-[11px] uppercase tracking-wider font-medium text-[#6E6E73] dark:text-k-text-secondary">
                    {label}
                </span>
            </div>
            <p className="text-xl font-bold text-[#1D1D1F] dark:text-k-text-primary tabular-nums">{value}</p>
            <p className="text-[11px] text-[#86868B] dark:text-k-text-tertiary mt-0.5">{detail}</p>
        </div>
    )
}

function PlanRow({
    plan, usage, deleting, toggling, onEdit, onToggle, onDelete,
}: {
    plan: Plan
    usage: number
    deleting: boolean
    toggling: boolean
    onEdit: () => void
    onToggle: (e: React.MouseEvent) => void
    onDelete: (e: React.MouseEvent) => void
}) {
    const archived = !plan.is_active
    return (
        <div
            onClick={onEdit}
            className={`bg-white dark:bg-surface-card border border-[#E8E8ED] dark:border-k-border-primary rounded-2xl p-4 md:p-5 grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-4 md:gap-5 items-center transition-all hover:border-[#86868B] dark:hover:border-k-text-tertiary cursor-pointer shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-none ${
                archived ? 'opacity-60' : ''
            }`}
        >
            <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="text-base font-semibold text-[#1D1D1F] dark:text-k-text-primary truncate">
                        {plan.title}
                    </h3>
                    {archived ? (
                        <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#F5F5F7] dark:bg-glass-bg text-[#6E6E73] dark:text-k-text-secondary">
                            Arquivado
                        </span>
                    ) : (
                        <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                            Ativo
                        </span>
                    )}
                    {plan.visibility === 'hidden' && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-600 dark:text-slate-400">
                            Oculto
                        </span>
                    )}
                </div>
                {plan.description && (
                    <p className="text-xs text-[#6E6E73] dark:text-k-text-secondary mb-2 line-clamp-2">
                        {plan.description}
                    </p>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                    {plan.allow_pix !== false && (
                        <span className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-700 dark:text-violet-400">
                            PIX
                        </span>
                    )}
                    {plan.allow_credit_card !== false && (
                        <span className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-400">
                            Cartão
                        </span>
                    )}
                    {plan.allow_boleto === true && (
                        <span className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400">
                            Boleto
                        </span>
                    )}
                    <span className="inline-flex items-center gap-1 text-[11px] text-[#6E6E73] dark:text-k-text-secondary">
                        <Users size={11} />
                        {usage === 0 ? 'Nenhum aluno' : `${usage} ${usage === 1 ? 'aluno' : 'alunos'}`}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-[#6E6E73] dark:text-k-text-secondary">
                        <Repeat size={11} />
                        {intervalLabel(plan.interval)}
                    </span>
                </div>
            </div>

            <div className="text-left md:text-right">
                <p className="text-xl font-bold text-[#1D1D1F] dark:text-k-text-primary tabular-nums">
                    {formatBRL(plan.price)}
                </p>
                <p className="text-[11px] text-[#86868B] dark:text-k-text-tertiary">
                    por {intervalLabel(plan.interval)}
                </p>
            </div>

            <div className="flex items-center gap-1 shrink-0">
                <button
                    onClick={(e) => { e.stopPropagation(); onEdit() }}
                    title="Editar plano"
                    className="p-2 rounded-lg text-[#86868B] dark:text-k-text-tertiary hover:bg-[#F5F5F7] dark:hover:bg-glass-bg hover:text-[#1D1D1F] dark:hover:text-k-text-primary"
                >
                    <Pencil size={14} />
                </button>
                <button
                    onClick={onToggle}
                    disabled={toggling}
                    title={archived ? 'Reativar plano' : 'Arquivar plano'}
                    className="px-2.5 py-1.5 text-[11px] font-medium rounded-lg text-[#86868B] dark:text-k-text-tertiary hover:bg-[#F5F5F7] dark:hover:bg-glass-bg hover:text-[#1D1D1F] dark:hover:text-k-text-primary disabled:opacity-50"
                >
                    {toggling ? (
                        <Loader2 size={12} className="animate-spin" />
                    ) : (
                        archived ? 'Reativar' : 'Arquivar'
                    )}
                </button>
                <button
                    onClick={onDelete}
                    disabled={deleting}
                    title="Excluir plano"
                    className="p-2 rounded-lg text-[#86868B] dark:text-k-text-tertiary hover:bg-red-50 dark:hover:bg-red-500/[0.08] hover:text-[#FF3B30] dark:hover:text-red-400 disabled:opacity-50"
                >
                    {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
            </div>
        </div>
    )
}
