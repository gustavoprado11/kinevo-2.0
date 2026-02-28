'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AppLayout } from '@/components/layout'
import { EmptyState } from '@/components/financial/empty-state'
import { PlanFormModal } from '@/components/financial/plan-form-modal'
import { togglePlan } from '@/actions/financial/toggle-plan'
import { deletePlan } from '@/actions/financial/delete-plan'
import { Plus, Search, Trash2, Loader2, Wallet, Pencil, ArrowLeft, Users } from 'lucide-react'

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
    created_at: string
}

interface PlansClientProps {
    trainer: Trainer
    plans: Plan[]
    hasStripeConnect: boolean
    usageByPlan: Record<string, number>
}

export function PlansClient({ trainer, plans: initialPlans, hasStripeConnect, usageByPlan }: PlansClientProps) {
    const router = useRouter()
    const [plans, setPlans] = useState(initialPlans)
    const [searchQuery, setSearchQuery] = useState('')
    const [deleting, setDeleting] = useState<string | null>(null)
    const [toggling, setToggling] = useState<string | null>(null)
    const [modalOpen, setModalOpen] = useState(false)
    const [editingPlan, setEditingPlan] = useState<Plan | null>(null)

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        }).format(value)
    }

    const intervalLabels: Record<string, { label: string; classes: string }> = {
        month: { label: 'Mensal', classes: 'bg-violet-500/10 text-violet-400 border-violet-500/20' },
        quarter: { label: 'Trimestral', classes: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
        year: { label: 'Anual', classes: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    }

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
        if (!confirm('Tem certeza que deseja excluir este plano?')) return

        setDeleting(planId)
        const result = await deletePlan({ planId })

        if (result.success) {
            setPlans(plans.filter(p => p.id !== planId))
        }

        setDeleting(null)
    }

    const handleModalSuccess = () => {
        router.refresh()
        // Also refresh local state
        setTimeout(() => {
            window.location.reload()
        }, 300)
    }

    const filteredPlans = plans.filter(
        (plan) =>
            plan.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            plan.description?.toLowerCase().includes(searchQuery.toLowerCase())
    )

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
                                Meus Planos
                            </h1>
                            <p className="mt-1 text-sm text-muted-foreground/60">
                                Gerencie seus planos de consultoria
                            </p>
                        </div>
                        <button
                            onClick={handleCreatePlan}
                            className="bg-violet-600 hover:bg-violet-500 text-white rounded-full px-6 py-2.5 text-sm font-semibold transition-all active:scale-95 flex items-center gap-2 w-fit"
                        >
                            <Plus size={18} strokeWidth={2} />
                            Criar Plano
                        </button>
                    </div>

                    {/* Search Bar */}
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                            <Search className="w-[18px] h-[18px] text-k-text-quaternary group-focus-within:text-violet-500 transition-colors" strokeWidth={1.5} />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar planos..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-glass-bg border border-k-border-primary rounded-2xl py-3.5 pl-11 pr-4 text-k-text-primary placeholder:text-k-text-quaternary focus:outline-none focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500/50 backdrop-blur-md transition-all"
                        />
                    </div>

                    {/* Content Grid */}
                    {filteredPlans.length === 0 ? (
                        <div className="bg-surface-card rounded-2xl border border-k-border-subtle border-dashed">
                            {searchQuery ? (
                                <div className="flex flex-col items-center justify-center py-24 px-4">
                                    <p className="text-muted-foreground/50 font-medium">
                                        Nenhum plano encontrado para &quot;{searchQuery}&quot;
                                    </p>
                                </div>
                            ) : (
                                <EmptyState
                                    icon={Wallet}
                                    title="Nenhum plano criado"
                                    description="Crie seu primeiro plano de consultoria para começar a cobrar seus alunos."
                                    action={{
                                        label: 'Criar Plano',
                                        onClick: handleCreatePlan,
                                    }}
                                />
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredPlans.map((plan) => {
                                const intervalInfo = intervalLabels[plan.interval] || intervalLabels.month
                                return (
                                    <div
                                        key={plan.id}
                                        onClick={() => handleEditPlan(plan)}
                                        className="group relative bg-surface-card border border-k-border-primary rounded-2xl p-5 shadow-xl hover:border-k-border-primary hover:bg-glass-bg hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden"
                                    >
                                        {/* Card Header */}
                                        <div className="flex justify-between items-start mb-3 gap-4">
                                            <h3 className="text-lg font-bold text-k-text-primary tracking-tight leading-snug group-hover:text-violet-200 transition-colors line-clamp-2">
                                                {plan.title}
                                            </h3>

                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-all">
                                                <button
                                                    onClick={(e) => handleEditPlan(plan)}
                                                    className="text-k-text-quaternary hover:text-violet-400 hover:bg-glass-bg p-2 rounded-lg transition-all"
                                                >
                                                    <Pencil className="w-4 h-4" strokeWidth={1.5} />
                                                </button>
                                                <button
                                                    onClick={(e) => handleDeletePlan(plan.id, e)}
                                                    disabled={deleting === plan.id}
                                                    className="text-k-text-quaternary hover:text-red-400 hover:bg-glass-bg p-2 rounded-lg transition-all"
                                                >
                                                    {deleting === plan.id ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Price + interval */}
                                        <div className="mb-4">
                                            <span className="text-2xl font-bold text-k-text-primary">
                                                {formatCurrency(plan.price)}
                                            </span>
                                            <span className="text-sm text-k-text-tertiary ml-1">
                                                /{intervalInfo.label.toLowerCase()}
                                            </span>
                                        </div>

                                        {/* Usage count */}
                                        <div className="flex items-center gap-1.5 text-xs text-k-text-secondary mb-3">
                                            <Users size={12} />
                                            <span>
                                                {(usageByPlan[plan.id] || 0) === 0
                                                    ? 'Nenhum aluno'
                                                    : `${usageByPlan[plan.id]} aluno${usageByPlan[plan.id] > 1 ? 's' : ''}`}
                                            </span>
                                        </div>

                                        {/* Description */}
                                        {plan.description && (
                                            <p className="text-xs text-k-text-tertiary mb-4 line-clamp-2">
                                                {plan.description}
                                            </p>
                                        )}

                                        {/* Badges Footer */}
                                        <div className="flex items-center gap-2 mt-auto flex-wrap">
                                            {/* Interval badge */}
                                            <span className={`px-2.5 py-1 text-[11px] font-semibold rounded-md border ${intervalInfo.classes}`}>
                                                {intervalInfo.label}
                                            </span>

                                            {/* Active/Inactive toggle */}
                                            <button
                                                onClick={(e) => handleTogglePlan(plan.id, e)}
                                                disabled={toggling === plan.id}
                                                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md border transition-colors ${plan.is_active
                                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                                                        : 'bg-gray-500/10 text-gray-400 border-gray-500/20 hover:bg-gray-500/20'
                                                    }`}
                                            >
                                                {toggling === plan.id ? (
                                                    <Loader2 className="w-3 h-3 animate-spin inline" />
                                                ) : (
                                                    plan.is_active ? 'Ativo' : 'Inativo'
                                                )}
                                            </button>

                                            {/* Visibility badge */}
                                            {plan.visibility === 'hidden' && (
                                                <span className="px-2.5 py-1 text-[11px] font-semibold rounded-md border bg-gray-500/10 text-gray-400 border-gray-500/20">
                                                    Oculto
                                                </span>
                                            )}
                                        </div>

                                        {/* Hover Glow Effect */}
                                        <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-k-border-subtle group-hover:ring-k-border-primary pointer-events-none" />
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Create/Edit Plan Modal */}
            <PlanFormModal
                isOpen={modalOpen}
                onClose={() => {
                    setModalOpen(false)
                    setEditingPlan(null)
                }}
                onSuccess={handleModalSuccess}
                plan={editingPlan}
                hasStripeConnect={hasStripeConnect}
            />
        </AppLayout>
    )
}
