'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
    X, Loader2, AlertCircle, CheckCircle, XCircle, Shield, ShieldOff,
    Clock, CreditCard, HandCoins, Heart, MessageCircle, Copy, Check,
    UserPlus, ArrowRightLeft, Ban, DollarSign, Lock, Unlock,
    ExternalLink, AlertTriangle
} from 'lucide-react'
import type { FinancialStudent, ContractEvent, DisplayStatus } from '@/types/financial'
import { getStudentEvents } from '@/actions/financial/get-student-events'
import { toggleBlockOnFail } from '@/actions/financial/toggle-block-on-fail'
import { cancelContract } from '@/actions/financial/cancel-contract'
import { markAsPaid } from '@/actions/financial/mark-as-paid'
import { generateCheckoutLink } from '@/actions/financial/generate-checkout-link'
import { BillingTypeBadge } from './billing-type-badge'

interface Plan {
    id: string
    title: string
    price: number
    interval: string
    stripe_price_id: string | null
}

interface StudentFinancialModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    student: FinancialStudent | null
    plans: Plan[]
    hasStripeConnect: boolean
    onOpenNewSubscription?: (studentId: string) => void
    onMigrate?: (student: FinancialStudent) => void
}

const statusConfig: Record<DisplayStatus, { label: string; className: string }> = {
    courtesy: { label: 'Cortesia', className: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    awaiting_payment: { label: 'Aguardando', className: 'bg-sky-500/10 text-sky-400 border-sky-500/20' },
    active: { label: 'Ativo', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    grace_period: { label: 'Vence hoje', className: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
    canceling: { label: 'Cancelando', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    overdue: { label: 'Inadimplente', className: 'bg-red-500/10 text-red-400 border-red-500/20' },
    canceled: { label: 'Encerrado', className: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
}

const eventConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
    student_registered: { icon: UserPlus, color: 'text-gray-400', label: 'Aluno cadastrado' },
    contract_created: { icon: DollarSign, color: 'text-blue-400', label: 'Contrato criado' },
    contract_migrated: { icon: ArrowRightLeft, color: 'text-blue-400', label: 'Migração' },
    payment_received: { icon: CheckCircle, color: 'text-emerald-400', label: 'Pagamento recebido' },
    payment_failed: { icon: XCircle, color: 'text-red-400', label: 'Pagamento falhou' },
    contract_canceled: { icon: Ban, color: 'text-gray-400', label: 'Contrato cancelado' },
    contract_overdue: { icon: AlertTriangle, color: 'text-orange-400', label: 'Vencimento detectado' },
    plan_changed: { icon: ArrowRightLeft, color: 'text-gray-400', label: 'Plano alterado' },
    access_blocked: { icon: Lock, color: 'text-red-400', label: 'Bloqueio ativado' },
    access_unblocked: { icon: Unlock, color: 'text-emerald-400', label: 'Bloqueio desativado' },
}

const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('pt-BR')
}

const formatDateTime = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })

const intervalLabels: Record<string, string> = {
    month: '/mês',
    quarter: '/trimestre',
    year: '/ano',
}

function daysOverdue(dateStr: string | null): number {
    if (!dateStr) return 0
    const diff = Date.now() - new Date(dateStr).getTime()
    return Math.max(0, Math.floor(diff / 86400000))
}

export function StudentFinancialModal({
    isOpen,
    onClose,
    onSuccess,
    student,
    plans,
    hasStripeConnect,
    onOpenNewSubscription,
    onMigrate,
}: StudentFinancialModalProps) {
    const router = useRouter()
    const [activeTab, setActiveTab] = useState<'current' | 'history'>('current')
    const [events, setEvents] = useState<ContractEvent[]>([])
    const [eventsLoading, setEventsLoading] = useState(false)
    const [eventsLoaded, setEventsLoaded] = useState(false)
    const [actionLoading, setActionLoading] = useState(false)
    const [blockConfirm, setBlockConfirm] = useState(false)
    const [cancelConfirm, setCancelConfirm] = useState(false)
    const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)

    // Reset state on open/close
    useEffect(() => {
        if (isOpen) {
            setActiveTab('current')
            setEvents([])
            setEventsLoaded(false)
            setBlockConfirm(false)
            setCancelConfirm(false)
            setActionLoading(false)
            setCheckoutUrl(null)
            setCopied(false)
        }
    }, [isOpen, student?.student_id])

    // Lazy load events when history tab is selected
    const loadEvents = useCallback(async () => {
        if (!student || eventsLoaded || eventsLoading) return
        setEventsLoading(true)
        try {
            const data = await getStudentEvents(student.student_id)
            setEvents(data)
            setEventsLoaded(true)
        } catch {
            // silent fail
        } finally {
            setEventsLoading(false)
        }
    }, [student, eventsLoaded, eventsLoading])

    useEffect(() => {
        if (activeTab === 'history') {
            loadEvents()
        }
    }, [activeTab, loadEvents])

    if (!isOpen || !student) return null

    const s = student
    const hasContract = s.contract_id !== null && s.contract_status !== 'canceled'
    const showBlockToggle = hasContract && s.display_status !== 'courtesy' && s.display_status !== 'canceled'
    const showCancel = s.contract_id !== null && s.contract_status !== 'canceled' && s.display_status !== 'courtesy'

    const handleToggleBlock = async (value: boolean) => {
        if (!s.contract_id) return
        if (value && !blockConfirm) {
            setBlockConfirm(true)
            return
        }
        setBlockConfirm(false)
        setActionLoading(true)
        await toggleBlockOnFail(s.contract_id, value)
        setActionLoading(false)
        onSuccess()
    }

    const handleCancel = async () => {
        if (!s.contract_id) return
        setActionLoading(true)
        if (s.billing_type === 'stripe_auto' && s.stripe_subscription_id) {
            await cancelContract({ contractId: s.contract_id, cancelAtPeriodEnd: true })
        } else {
            await cancelContract({ contractId: s.contract_id })
        }
        setActionLoading(false)
        onSuccess()
        onClose()
    }

    const handleMarkPaid = async () => {
        if (!s.contract_id) return
        setActionLoading(true)
        await markAsPaid({ contractId: s.contract_id })
        setActionLoading(false)
        onSuccess()
    }

    const handleConfigureBilling = () => {
        onClose()
        if (onOpenNewSubscription) {
            onOpenNewSubscription(s.student_id)
        }
    }

    const handleMigrateBilling = () => {
        if (onMigrate) {
            onMigrate(s)
        }
    }

    const handleResendLink = async () => {
        // Find matching plan to generate a new checkout session
        const plan = plans.find(p => p.title === s.plan_title)
        if (!plan) return
        setActionLoading(true)
        try {
            const result = await generateCheckoutLink({
                studentId: s.student_id,
                planId: plan.id,
            })
            if (result.url) {
                setCheckoutUrl(result.url)
            }
        } catch {
            // silent
        } finally {
            setActionLoading(false)
        }
    }

    const handleCopyLink = async () => {
        if (!checkoutUrl) return
        await navigator.clipboard.writeText(checkoutUrl)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const handleWhatsAppLink = () => {
        if (!checkoutUrl) return
        const text = `Olá${s.student_name ? ` ${s.student_name}` : ''}! Segue o link para pagamento da sua consultoria:\n${checkoutUrl}`
        const base = s.phone ? `https://wa.me/55${s.phone.replace(/\D/g, '')}` : 'https://wa.me/'
        window.open(`${base}?text=${encodeURIComponent(text)}`, '_blank')
    }

    const whatsappUrl = s.phone
        ? `https://wa.me/55${s.phone.replace(/\D/g, '')}`
        : null

    const getEventDetail = (event: ContractEvent): string => {
        const m = event.metadata || {}
        switch (event.event_type) {
            case 'student_registered':
                return 'Cortesia'
            case 'contract_created':
                return `${m.billing_type || ''} ${m.amount ? `· ${formatCurrency(Number(m.amount))}` : ''}`.trim()
            case 'contract_migrated':
                return `De ${m.from || '?'} para ${m.to || '?'}`
            case 'payment_received':
                return `+${m.amount ? formatCurrency(Number(m.amount)) : '?'} (${m.method || '?'})`
            case 'payment_failed':
                return `${m.amount ? formatCurrency(Number(m.amount)) : '?'}${m.reason ? ` — ${m.reason}` : ''}`
            case 'contract_canceled':
                return `Por: ${m.canceled_by || 'sistema'}`
            case 'plan_changed':
                return `${m.from_amount ? formatCurrency(Number(m.from_amount)) : '?'} → ${m.to_amount ? formatCurrency(Number(m.to_amount)) : '?'}`
            case 'access_blocked':
            case 'access_unblocked':
            case 'contract_overdue':
                return ''
            default:
                return ''
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
                onClick={onClose}
            />

            <div className="relative w-full max-w-lg max-h-[85vh] overflow-hidden rounded-3xl border border-transparent bg-surface-card backdrop-blur-xl shadow-2xl ring-1 ring-k-border-primary animate-in fade-in zoom-in-95 duration-200 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-k-border-subtle bg-surface-inset px-8 py-5">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-k-border-primary bg-glass-bg overflow-hidden flex-shrink-0">
                            {s.avatar_url ? (
                                <Image
                                    src={s.avatar_url}
                                    alt={s.student_name}
                                    width={40}
                                    height={40}
                                    className="h-10 w-10 rounded-full object-cover"
                                    unoptimized
                                />
                            ) : (
                                <span className="text-sm font-semibold text-k-text-primary">
                                    {s.student_name?.charAt(0).toUpperCase() || '?'}
                                </span>
                            )}
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-white tracking-tight">
                                {s.student_name}
                            </h2>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${statusConfig[s.display_status].className}`}>
                                    {s.display_status === 'canceling' && s.current_period_end
                                        ? `Cancela em ${formatDate(s.current_period_end)}`
                                        : statusConfig[s.display_status].label}
                                </span>
                                {s.billing_type && (
                                    <BillingTypeBadge billingType={s.billing_type} />
                                )}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="h-8 w-8 flex items-center justify-center text-muted-foreground/50 hover:text-k-text-primary hover:bg-glass-bg rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" strokeWidth={1.5} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-k-border-subtle">
                    <button
                        onClick={() => setActiveTab('current')}
                        className={`flex-1 px-4 py-3 text-xs font-medium transition-all ${
                            activeTab === 'current'
                                ? 'text-k-text-primary border-b-2 border-violet-500'
                                : 'text-k-text-tertiary hover:text-k-text-secondary'
                        }`}
                    >
                        Situação Atual
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex-1 px-4 py-3 text-xs font-medium transition-all ${
                            activeTab === 'history'
                                ? 'text-k-text-primary border-b-2 border-violet-500'
                                : 'text-k-text-tertiary hover:text-k-text-secondary'
                        }`}
                    >
                        Histórico
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    {activeTab === 'current' ? (
                        <div className="p-6 space-y-5">
                            {/* Plan info */}
                            {s.plan_title && (
                                <div className="rounded-xl border border-k-border-subtle bg-glass-bg px-4 py-3">
                                    <p className="text-xs text-k-text-tertiary mb-0.5">Plano</p>
                                    <p className="text-sm font-medium text-k-text-primary">
                                        {s.plan_title}
                                        {s.amount ? (
                                            <span className="text-k-text-secondary ml-1">
                                                {formatCurrency(s.amount)}{intervalLabels[s.plan_interval || 'month'] || '/mês'}
                                            </span>
                                        ) : null}
                                    </p>
                                    {s.current_period_end && s.display_status !== 'canceling' && (
                                        <p className="text-xs text-k-text-quaternary mt-1">
                                            Vencimento: {formatDate(s.current_period_end)}
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Status-specific content */}
                            {s.display_status === 'courtesy' && (
                                <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3">
                                    <p className="text-xs text-blue-400">
                                        Sem cobrança configurada. Este aluno tem acesso gratuito.
                                    </p>
                                    <button
                                        onClick={handleConfigureBilling}
                                        className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-colors"
                                    >
                                        <CreditCard size={14} />
                                        Configurar cobrança
                                    </button>
                                </div>
                            )}

                            {s.display_status === 'awaiting_payment' && (
                                <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 px-4 py-3">
                                    <p className="text-xs text-sky-400 mb-3">
                                        Aguardando pagamento do aluno.
                                    </p>

                                    {!checkoutUrl ? (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={handleResendLink}
                                                disabled={actionLoading}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-colors disabled:opacity-50"
                                            >
                                                {actionLoading ? <Loader2 size={12} className="animate-spin" /> : <ExternalLink size={12} />}
                                                Gerar novo link
                                            </button>
                                            {whatsappUrl && (
                                                <a
                                                    href={whatsappUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-600/20 transition-colors"
                                                >
                                                    <MessageCircle size={12} />
                                                    Contatar
                                                </a>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <div className="rounded-lg border border-k-border-subtle bg-glass-bg p-2 flex items-center gap-2">
                                                <p className="text-[11px] text-k-text-secondary break-all font-mono flex-1 line-clamp-2">
                                                    {checkoutUrl}
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={handleCopyLink}
                                                    className="flex-shrink-0 p-1.5 rounded-md hover:bg-glass-bg-active transition-colors"
                                                >
                                                    {copied ? (
                                                        <Check size={12} className="text-emerald-400" />
                                                    ) : (
                                                        <Copy size={12} className="text-k-text-quaternary" />
                                                    )}
                                                </button>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={handleCopyLink}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-colors"
                                                >
                                                    {copied ? <Check size={12} /> : <Copy size={12} />}
                                                    {copied ? 'Copiado!' : 'Copiar link'}
                                                </button>
                                                {s.phone && (
                                                    <button
                                                        type="button"
                                                        onClick={handleWhatsAppLink}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                                                    >
                                                        <MessageCircle size={12} />
                                                        WhatsApp
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {s.display_status === 'grace_period' && (
                                <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 px-4 py-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <AlertTriangle size={14} className="text-orange-400" />
                                        <p className="text-xs font-semibold text-orange-400">
                                            Pagamento venceu há {daysOverdue(s.current_period_end)} dia{daysOverdue(s.current_period_end) !== 1 ? 's' : ''}
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleMarkPaid}
                                            disabled={actionLoading}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                                        >
                                            {actionLoading ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                                            Marcar pago
                                        </button>
                                        {whatsappUrl && (
                                            <a
                                                href={whatsappUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-600/20 transition-colors"
                                            >
                                                <MessageCircle size={12} />
                                                Contatar
                                            </a>
                                        )}
                                    </div>
                                </div>
                            )}

                            {s.display_status === 'canceling' && (
                                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Clock size={14} className="text-amber-400" />
                                        <p className="text-xs font-semibold text-amber-400">
                                            Aluno cancelou a assinatura
                                        </p>
                                    </div>
                                    <p className="text-xs text-k-text-secondary">
                                        O acesso permanecerá ativo até {formatDate(s.current_period_end)}.
                                    </p>
                                </div>
                            )}

                            {s.display_status === 'overdue' && (
                                <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <AlertCircle size={14} className="text-red-400" />
                                        <p className="text-xs font-semibold text-red-400">
                                            Inadimplente desde {formatDate(s.current_period_end)}
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        {s.billing_type !== 'stripe_auto' && (
                                            <button
                                                onClick={handleMarkPaid}
                                                disabled={actionLoading}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                                            >
                                                {actionLoading ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                                                Marcar pago
                                            </button>
                                        )}
                                        {whatsappUrl && (
                                            <a
                                                href={whatsappUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-600/20 transition-colors"
                                            >
                                                <MessageCircle size={12} />
                                                Contatar
                                            </a>
                                        )}
                                    </div>
                                </div>
                            )}

                            {s.display_status === 'active' && s.billing_type !== 'stripe_auto' && (
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleMarkPaid}
                                        disabled={actionLoading}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                                    >
                                        {actionLoading ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                                        Marcar pago
                                    </button>
                                </div>
                            )}

                            {s.display_status === 'canceled' && (
                                <div className="rounded-xl border border-gray-500/20 bg-gray-500/5 px-4 py-3">
                                    <p className="text-xs text-gray-400">
                                        Contrato encerrado{s.canceled_at ? ` em ${formatDate(s.canceled_at)}` : ''}.
                                    </p>
                                    <button
                                        onClick={handleConfigureBilling}
                                        className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-colors"
                                    >
                                        <CreditCard size={14} />
                                        Configurar cobrança
                                    </button>
                                </div>
                            )}

                            {/* Block on fail toggle */}
                            {showBlockToggle && (
                                <div className="rounded-xl border border-k-border-subtle bg-glass-bg px-4 py-3">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-k-text-primary">
                                                Controle de acesso
                                            </p>
                                            <p className="text-xs text-k-text-secondary mt-0.5">
                                                Bloquear acesso se inadimplente
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleToggleBlock(!s.block_on_fail)}
                                            disabled={actionLoading}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                                                s.block_on_fail ? 'bg-violet-600' : 'bg-gray-600'
                                            }`}
                                        >
                                            <span
                                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                                    s.block_on_fail ? 'translate-x-6' : 'translate-x-1'
                                                }`}
                                            />
                                        </button>
                                    </div>

                                    {/* Block confirm popover */}
                                    {blockConfirm && (
                                        <div className="mt-3 p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
                                            <p className="text-xs text-amber-400 mb-2">
                                                Bloquear acesso de {s.student_name} se inadimplente?
                                            </p>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleToggleBlock(true)}
                                                    disabled={actionLoading}
                                                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-colors disabled:opacity-50"
                                                >
                                                    {actionLoading ? <Loader2 size={12} className="animate-spin" /> : 'Confirmar'}
                                                </button>
                                                <button
                                                    onClick={() => setBlockConfirm(false)}
                                                    className="px-3 py-1.5 text-xs font-medium text-k-text-secondary hover:text-k-text-primary transition-colors"
                                                >
                                                    Cancelar
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Migrate billing type */}
                            {hasContract && onMigrate && s.display_status !== 'courtesy' && s.display_status !== 'canceled' && s.display_status !== 'canceling' && (
                                <button
                                    onClick={handleMigrateBilling}
                                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl border border-k-border-primary bg-glass-bg hover:bg-violet-500/10 text-k-text-secondary hover:text-violet-400 transition-all"
                                >
                                    <ArrowRightLeft size={14} />
                                    Alterar tipo de cobrança
                                </button>
                            )}

                            {/* Cancel contract */}
                            {showCancel && (
                                <div className="pt-3 border-t border-k-border-subtle">
                                    {!cancelConfirm ? (
                                        <button
                                            onClick={() => setCancelConfirm(true)}
                                            className="text-xs font-medium text-red-400/70 hover:text-red-400 transition-colors"
                                        >
                                            Cancelar contrato
                                        </button>
                                    ) : (
                                        <div className="p-3 rounded-xl border border-red-500/20 bg-red-500/5">
                                            <p className="text-xs text-red-400 mb-2">
                                                Cancelar contrato de {s.student_name}? Esta ação não pode ser desfeita.
                                            </p>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={handleCancel}
                                                    disabled={actionLoading}
                                                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-500 text-white transition-colors disabled:opacity-50"
                                                >
                                                    {actionLoading ? <Loader2 size={12} className="animate-spin" /> : 'Confirmar cancelamento'}
                                                </button>
                                                <button
                                                    onClick={() => setCancelConfirm(false)}
                                                    className="px-3 py-1.5 text-xs font-medium text-k-text-secondary hover:text-k-text-primary transition-colors"
                                                >
                                                    Voltar
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        /* History tab */
                        <div className="p-6">
                            {eventsLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="w-5 h-5 animate-spin text-k-text-quaternary" />
                                </div>
                            ) : events.length === 0 ? (
                                <div className="text-center py-12">
                                    <p className="text-xs text-k-text-quaternary">Nenhum evento registrado.</p>
                                </div>
                            ) : (
                                <div className="relative">
                                    {/* Timeline line */}
                                    <div className="absolute left-[11px] top-2 bottom-2 w-px bg-k-border-subtle" />

                                    <div className="space-y-4">
                                        {events.map((event) => {
                                            const config = eventConfig[event.event_type] || {
                                                icon: Clock,
                                                color: 'text-gray-400',
                                                label: event.event_type,
                                            }
                                            const Icon = config.icon
                                            const detail = getEventDetail(event)

                                            return (
                                                <div key={event.id} className="flex items-start gap-3 relative">
                                                    <div className={`flex-shrink-0 w-[22px] h-[22px] rounded-full bg-surface-card border border-k-border-subtle flex items-center justify-center z-10 ${config.color}`}>
                                                        <Icon size={11} strokeWidth={2} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-medium text-k-text-primary">
                                                            {config.label}
                                                        </p>
                                                        {detail && (
                                                            <p className="text-[11px] text-k-text-secondary mt-0.5">
                                                                {detail}
                                                            </p>
                                                        )}
                                                        <p className="text-[10px] text-k-text-quaternary mt-0.5">
                                                            {formatDateTime(event.created_at)}
                                                        </p>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
