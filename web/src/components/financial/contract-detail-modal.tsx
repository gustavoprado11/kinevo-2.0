'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, AlertCircle, AlertTriangle, Calendar, Shield, ShieldOff } from 'lucide-react'
import { BillingTypeBadge } from './billing-type-badge'
import { updateContract } from '@/actions/financial/update-contract'
import { cancelContract } from '@/actions/financial/cancel-contract'
import Image from 'next/image'

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

interface ContractDetailModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    contract: Contract | null
    plans: Plan[]
}

export function ContractDetailModal({
    isOpen,
    onClose,
    onSuccess,
    contract,
    plans,
}: ContractDetailModalProps) {
    const [editPlanId, setEditPlanId] = useState<string>('')
    const [editAmount, setEditAmount] = useState<string>('')
    const [editBlockOnFail, setEditBlockOnFail] = useState(false)
    const [editPeriodEnd, setEditPeriodEnd] = useState('')
    const [loading, setLoading] = useState(false)
    const [cancelLoading, setCancelLoading] = useState(false)
    const [error, setError] = useState('')

    // Initialize edit fields from contract
    useEffect(() => {
        if (isOpen && contract) {
            setEditPlanId(contract.plan_id || '')
            setEditAmount(String(contract.amount || 0))
            setEditBlockOnFail(contract.block_on_fail ?? false)
            setEditPeriodEnd(contract.current_period_end
                ? contract.current_period_end.split('T')[0]
                : '')
            setError('')
        }
    }, [isOpen, contract])

    if (!isOpen || !contract) return null

    const isStripe = contract.billing_type === 'stripe_auto'
    const isCourtesy = contract.billing_type === 'courtesy'
    const isManual = contract.billing_type === 'manual_recurring' || contract.billing_type === 'manual_one_off'
    const isActive = contract.status === 'active' || contract.status === 'past_due'

    // Detect changes
    const hasChanges = (() => {
        if (editPlanId !== (contract.plan_id || '')) return true
        if (!isStripe && !isCourtesy && editAmount !== String(contract.amount || 0)) return true
        if (editBlockOnFail !== (contract.block_on_fail ?? false)) return true
        if (isManual && editPeriodEnd !== (contract.current_period_end?.split('T')[0] || '')) return true
        return false
    })()

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

    const intervalLabels: Record<string, string> = {
        month: '/mês',
        quarter: '/trimestre',
        year: '/ano',
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

    const handleSave = async () => {
        setError('')
        setLoading(true)

        const payload: {
            contractId: string
            planId?: string | null
            amount?: number
            blockOnFail?: boolean
            currentPeriodEnd?: string | null
        } = { contractId: contract.id }

        if (editPlanId !== (contract.plan_id || '')) {
            payload.planId = editPlanId || null
        }
        if (!isStripe && !isCourtesy && editAmount !== String(contract.amount || 0)) {
            payload.amount = parseFloat(editAmount) || 0
        }
        if (editBlockOnFail !== (contract.block_on_fail ?? false)) {
            payload.blockOnFail = editBlockOnFail
        }
        if (isManual && editPeriodEnd !== (contract.current_period_end?.split('T')[0] || '')) {
            payload.currentPeriodEnd = editPeriodEnd ? new Date(editPeriodEnd + 'T23:59:59Z').toISOString() : null
        }

        const result = await updateContract(payload)

        if (result.error) {
            setError(result.error)
            setLoading(false)
            return
        }

        setLoading(false)
        onSuccess()
        onClose()
    }

    const handleScheduleCancel = async () => {
        if (!confirm(isStripe
            ? 'Agendar cancelamento? A assinatura continuará ativa até o final do período atual.'
            : 'Tem certeza que deseja cancelar esta assinatura? Esta ação não pode ser desfeita.'
        )) return

        setCancelLoading(true)

        const result = isStripe
            ? await cancelContract({ contractId: contract.id, cancelAtPeriodEnd: true })
            : await cancelContract({ contractId: contract.id })

        if (result.error) {
            setError(result.error)
            setCancelLoading(false)
            return
        }

        setCancelLoading(false)
        onSuccess()
        if (!isStripe) onClose()
    }

    const handleKeepSubscription = async () => {
        setCancelLoading(true)
        const result = await updateContract({
            contractId: contract.id,
            cancelAtPeriodEnd: false,
        })

        if (result.error) {
            setError(result.error)
            setCancelLoading(false)
            return
        }

        setCancelLoading(false)
        onSuccess()
    }

    // When plan changes for manual, auto-update amount
    const handlePlanChange = (newPlanId: string) => {
        setEditPlanId(newPlanId)
        if (isManual && newPlanId) {
            const plan = plans.find(p => p.id === newPlanId)
            if (plan) {
                setEditAmount(String(plan.price))
            }
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-transparent bg-surface-card backdrop-blur-xl shadow-2xl ring-1 ring-k-border-primary animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-k-border-subtle bg-surface-inset px-8 py-6 flex-shrink-0">
                    <div className="min-w-0">
                        <h2 className="text-xl font-bold text-white tracking-tight">
                            Detalhes da Assinatura
                        </h2>
                        <p className="text-xs text-muted-foreground/60 uppercase tracking-widest font-semibold mt-1 truncate">
                            {contract.students?.name || 'Aluno'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="h-8 w-8 flex items-center justify-center text-muted-foreground/50 hover:text-k-text-primary hover:bg-glass-bg rounded-full transition-colors flex-shrink-0"
                    >
                        <X className="w-5 h-5" strokeWidth={1.5} />
                    </button>
                </div>

                {/* Content */}
                <div className="overflow-y-auto flex-1 p-8 space-y-6">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                            {error}
                        </div>
                    )}

                    {/* Info Section */}
                    <div className="space-y-4">
                        {/* Student */}
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-k-border-primary bg-glass-bg overflow-hidden flex-shrink-0">
                                {contract.students?.avatar_url ? (
                                    <Image
                                        src={contract.students.avatar_url}
                                        alt={contract.students.name}
                                        width={40}
                                        height={40}
                                        className="h-10 w-10 rounded-full object-cover"
                                        unoptimized
                                    />
                                ) : (
                                    <span className="text-sm font-semibold text-k-text-primary">
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

                        {/* Badges row */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <BillingTypeBadge billingType={contract.billing_type} />
                            {getStatusBadge(contract.status)}
                        </div>

                        {/* Created date */}
                        <div className="flex items-center justify-between text-xs text-muted-foreground/50">
                            <span>Criado em {formatDate(contract.created_at)}</span>
                            {isStripe && contract.stripe_subscription_id && (
                                <span className="font-mono text-[10px] text-muted-foreground/30">
                                    {contract.stripe_subscription_id.slice(0, 20)}...
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="border-t border-k-border-subtle" />

                    {/* Editable Fields */}
                    <div className="space-y-5">
                        {/* Plan */}
                        {isStripe ? (
                            <div>
                                <label className="mb-1.5 block text-[11px] font-bold text-k-text-tertiary uppercase tracking-wider">
                                    Plano
                                </label>
                                <div className="rounded-xl border border-k-border-subtle bg-glass-bg/50 px-4 py-3 text-sm text-muted-foreground/60">
                                    {contract.trainer_plans
                                        ? `${contract.trainer_plans.title} — ${formatCurrency(contract.trainer_plans.price)}${intervalLabels[contract.trainer_plans.interval] || '/mês'}`
                                        : '—'}
                                </div>
                            </div>
                        ) : (
                            <div>
                                <label className="mb-1.5 block text-[11px] font-bold text-k-text-tertiary uppercase tracking-wider">
                                    Plano {!isCourtesy && <span className="text-violet-500">*</span>}
                                </label>
                                <select
                                    value={editPlanId}
                                    onChange={(e) => handlePlanChange(e.target.value)}
                                    className="w-full rounded-xl border border-k-border-subtle bg-glass-bg px-4 py-3 text-k-text-primary focus:outline-none focus:border-violet-500/50 focus:ring-4 focus:ring-violet-500/20 transition-all text-sm"
                                >
                                    {isCourtesy && <option value="">Nenhum</option>}
                                    {!isCourtesy && <option value="">Selecione um plano...</option>}
                                    {plans.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.title} — {formatCurrency(p.price)}{intervalLabels[p.interval] || '/mês'}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Amount */}
                        {isStripe ? (
                            <div>
                                <label className="mb-1.5 block text-[11px] font-bold text-k-text-tertiary uppercase tracking-wider">
                                    Valor
                                </label>
                                <div className="rounded-xl border border-k-border-subtle bg-glass-bg/50 px-4 py-3 text-sm text-muted-foreground/60">
                                    {formatCurrency(contract.amount)}
                                </div>
                            </div>
                        ) : isCourtesy ? (
                            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
                                <p className="text-sm text-emerald-400 font-medium">Acesso gratuito — sem cobrança</p>
                            </div>
                        ) : (
                            <div>
                                <label className="mb-1.5 block text-[11px] font-bold text-k-text-tertiary uppercase tracking-wider">
                                    Valor (R$)
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={editAmount}
                                    onChange={(e) => setEditAmount(e.target.value)}
                                    className="w-full rounded-xl border border-k-border-subtle bg-glass-bg px-4 py-3 text-k-text-primary focus:outline-none focus:border-violet-500/50 focus:ring-4 focus:ring-violet-500/20 transition-all text-sm"
                                />
                            </div>
                        )}

                        {/* Period End */}
                        {isStripe ? (
                            <div>
                                <label className="mb-1.5 block text-[11px] font-bold text-k-text-tertiary uppercase tracking-wider">
                                    Vencimento
                                </label>
                                <div className="rounded-xl border border-k-border-subtle bg-glass-bg/50 px-4 py-3 text-sm text-muted-foreground/60 flex items-center gap-2">
                                    <Calendar size={14} />
                                    {formatDate(contract.current_period_end)}
                                </div>
                            </div>
                        ) : isManual ? (
                            <div>
                                <label className="mb-1.5 block text-[11px] font-bold text-k-text-tertiary uppercase tracking-wider">
                                    Vencimento
                                </label>
                                <input
                                    type="date"
                                    value={editPeriodEnd}
                                    onChange={(e) => setEditPeriodEnd(e.target.value)}
                                    className="w-full rounded-xl border border-k-border-subtle bg-glass-bg px-4 py-3 text-k-text-primary focus:outline-none focus:border-violet-500/50 focus:ring-4 focus:ring-violet-500/20 transition-all text-sm"
                                />
                            </div>
                        ) : null}

                        {/* Block on fail toggle */}
                        {!isCourtesy && (
                            <div className="flex items-center justify-between rounded-xl border border-k-border-subtle bg-glass-bg px-4 py-3">
                                <div className="flex items-center gap-2">
                                    {editBlockOnFail ? (
                                        <Shield size={16} className="text-violet-400" />
                                    ) : (
                                        <ShieldOff size={16} className="text-muted-foreground/40" />
                                    )}
                                    <div>
                                        <p className="text-sm font-medium text-k-text-primary">
                                            Bloquear se não pagar
                                        </p>
                                        <p className="text-xs text-k-text-secondary mt-0.5">
                                            O aluno perde acesso se o pagamento estiver pendente
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setEditBlockOnFail(!editBlockOnFail)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                                        editBlockOnFail ? 'bg-violet-600' : 'bg-gray-600'
                                    }`}
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                            editBlockOnFail ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                    />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Stripe cancel_at_period_end section */}
                    {isStripe && isActive && (
                        <>
                            <div className="border-t border-k-border-subtle" />

                            {contract.cancel_at_period_end ? (
                                <div className="space-y-3">
                                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 flex items-start gap-3">
                                        <AlertTriangle size={16} className="text-amber-400 mt-0.5 flex-shrink-0" />
                                        <div>
                                            <p className="text-sm font-medium text-amber-400">
                                                Cancelamento agendado
                                            </p>
                                            <p className="text-xs text-amber-400/70 mt-0.5">
                                                A assinatura será cancelada em {formatDate(contract.current_period_end)}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleKeepSubscription}
                                        disabled={cancelLoading}
                                        className="w-full py-2.5 text-sm font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl hover:bg-emerald-500/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {cancelLoading ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : null}
                                        Manter Assinatura
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <button
                                        onClick={handleScheduleCancel}
                                        disabled={cancelLoading}
                                        className="w-full py-2.5 text-sm font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl hover:bg-amber-500/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {cancelLoading ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : null}
                                        Agendar Cancelamento
                                    </button>
                                    <p className="text-xs text-muted-foreground/40 text-center">
                                        A assinatura continuará ativa até o final do período atual
                                    </p>
                                </div>
                            )}
                        </>
                    )}

                    {/* Danger zone for non-Stripe */}
                    {!isStripe && isActive && (
                        <>
                            <div className="border-t border-k-border-subtle" />
                            <button
                                onClick={handleScheduleCancel}
                                disabled={cancelLoading}
                                className="w-full py-2.5 text-sm font-semibold text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl hover:bg-red-500/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {cancelLoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : null}
                                Cancelar Assinatura
                            </button>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="flex gap-3 px-8 py-6 border-t border-k-border-subtle bg-surface-inset flex-shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-3 text-sm font-medium text-k-text-secondary hover:text-k-text-primary hover:bg-glass-bg rounded-xl transition-all"
                    >
                        Fechar
                    </button>
                    {hasChanges && (
                        <button
                            onClick={handleSave}
                            disabled={loading}
                            className="flex-1 inline-flex items-center justify-center gap-2 py-3 text-sm font-bold bg-violet-600 hover:bg-violet-500 text-white rounded-xl shadow-lg shadow-violet-500/20 transition-all active:scale-95 disabled:opacity-50"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="animate-spin w-4 h-4" />
                                    Salvando...
                                </>
                            ) : (
                                'Salvar Alterações'
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
