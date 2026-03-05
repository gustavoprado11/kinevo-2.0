'use client'

import { useState, useEffect } from 'react'
import {
    X, Loader2, AlertCircle, CreditCard, HandCoins, Heart,
    Copy, Check, ExternalLink, MessageCircle, AlertTriangle, ArrowRightLeft
} from 'lucide-react'
import { createContract } from '@/actions/financial/create-contract'
import { generateCheckoutLink } from '@/actions/financial/generate-checkout-link'
import { migrateContract } from '@/actions/financial/migrate-contract'
import type { FinancialStudent } from '@/types/financial'

interface Plan {
    id: string
    title: string
    price: number
    interval: string
    stripe_price_id: string | null
}

interface ConfigureBillingModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    student?: FinancialStudent | null
    allStudents?: { id: string; name: string; email: string }[]
    plans: Plan[]
    hasStripeConnect: boolean
    mode: 'new' | 'migrate'
}

type BillingType = 'stripe_auto' | 'manual_recurring' | 'manual_one_off' | 'courtesy'
type ModalStep = 'migration_alert' | 'type' | 'details'

const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

const intervalLabels: Record<string, string> = {
    month: '/mês',
    quarter: '/trimestre',
    year: '/ano',
}

const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('pt-BR')
}

function getMigrationAlertText(student: FinancialStudent, targetType: BillingType | null): string {
    const name = student.student_name
    const bt = student.billing_type

    if (bt === 'stripe_auto') {
        const dateStr = student.current_period_end ? formatDate(student.current_period_end) : 'o período atual'
        return `O aluno ${name} tem uma assinatura Stripe ativa que vence em ${dateStr}. Ao confirmar, a assinatura será cancelada imediatamente no Stripe e substituída pelo novo tipo de cobrança. Deseja continuar?`
    }

    if (bt?.startsWith('manual')) {
        if (targetType === 'courtesy' || !targetType) {
            return `O aluno ${name} tem um controle manual ativo. Ao confirmar, a cobrança será encerrada e o aluno passará para acesso gratuito. Deseja continuar?`
        }
        return `O aluno ${name} tem um controle manual ativo. Ao confirmar, o controle manual será encerrado e substituído pelo novo tipo de cobrança. Deseja continuar?`
    }

    return `O aluno ${name} já tem uma cobrança ativa. Ao confirmar, ela será substituída pela nova configuração. Deseja continuar?`
}

export function ConfigureBillingModal({
    isOpen,
    onClose,
    onSuccess,
    student,
    allStudents,
    plans,
    hasStripeConnect,
    mode,
}: ConfigureBillingModalProps) {
    const [step, setStep] = useState<ModalStep>('type')
    const [billingType, setBillingType] = useState<BillingType | null>(null)
    const [studentId, setStudentId] = useState('')
    const [planId, setPlanId] = useState('')
    const [blockOnFail, setBlockOnFail] = useState(false)
    const [recurrence, setRecurrence] = useState<'month' | 'quarter' | 'year' | 'one_off'>('month')
    const [customAmount, setCustomAmount] = useState('')
    const [useCustomAmount, setUseCustomAmount] = useState(false)
    const [firstDueDate, setFirstDueDate] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)

    // Reset when modal opens/closes
    useEffect(() => {
        if (isOpen) {
            setStep(mode === 'migrate' ? 'migration_alert' : 'type')
            setBillingType(null)
            setStudentId(student?.student_id || '')
            setPlanId('')
            setBlockOnFail(false)
            setRecurrence('month')
            setCustomAmount('')
            setUseCustomAmount(false)
            setFirstDueDate('')
            setLoading(false)
            setError('')
            setCheckoutUrl(null)
            setCopied(false)
        }
    }, [isOpen, student?.student_id, mode])

    const handleSelectType = (type: BillingType) => {
        setBillingType(type)
        setStep('details')
        setError('')
    }

    const handleBack = () => {
        if (step === 'details') {
            setStep('type')
            setBillingType(null)
            setError('')
            setCheckoutUrl(null)
        } else if (step === 'type' && mode === 'migrate') {
            setStep('migration_alert')
        }
    }

    const handleCopyLink = async () => {
        if (!checkoutUrl) return
        await navigator.clipboard.writeText(checkoutUrl)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const handleWhatsApp = () => {
        if (!checkoutUrl) return
        const s = student || allStudents?.find(st => st.id === studentId)
        const name = student?.student_name || (s && 'name' in s ? s.name : '')
        const phone = student?.phone
        const text = `Olá${name ? ` ${name}` : ''}! Segue o link para pagamento da sua consultoria:\n${checkoutUrl}`
        const base = phone ? `https://wa.me/55${phone.replace(/\D/g, '')}` : 'https://wa.me/'
        window.open(`${base}?text=${encodeURIComponent(text)}`, '_blank')
    }

    const resolvedStudentId = student?.student_id || studentId

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        if (!resolvedStudentId) {
            setError('Selecione um aluno.')
            return
        }

        if (billingType !== 'courtesy' && !planId && !useCustomAmount) {
            setError('Selecione um plano.')
            return
        }

        if (useCustomAmount && !customAmount) {
            setError('Informe o valor.')
            return
        }

        setLoading(true)

        try {
            if (mode === 'migrate' && student?.contract_id) {
                // Migration flow
                const effectiveBillingType: BillingType = billingType === 'manual_recurring' && recurrence === 'one_off'
                    ? 'manual_one_off'
                    : billingType!

                const result = await migrateContract({
                    studentId: resolvedStudentId,
                    fromContractId: student.contract_id,
                    toBillingType: effectiveBillingType,
                    planId: planId || undefined,
                    amount: useCustomAmount ? parseFloat(customAmount) : undefined,
                    blockOnFail,
                    firstDueDate: firstDueDate || undefined,
                })

                if (!result.success) {
                    setError(result.error || 'Erro na migração')
                    setLoading(false)
                    return
                }

                if (result.checkoutUrl) {
                    setCheckoutUrl(result.checkoutUrl)
                    setLoading(false)
                    return
                }

                setLoading(false)
                onSuccess()
                onClose()
            } else {
                // New contract flow
                if (billingType === 'stripe_auto') {
                    const result = await generateCheckoutLink({
                        studentId: resolvedStudentId,
                        planId,
                    })

                    if (result.error) {
                        setError(result.error)
                        setLoading(false)
                        return
                    }

                    setCheckoutUrl(result.url || null)
                    setLoading(false)
                } else {
                    const effectiveBillingType = billingType === 'manual_recurring' && recurrence === 'one_off'
                        ? 'manual_one_off' as const
                        : billingType === 'manual_recurring'
                            ? 'manual_recurring' as const
                            : 'courtesy' as const

                    const result = await createContract({
                        studentId: resolvedStudentId,
                        planId: planId || null,
                        billingType: effectiveBillingType,
                        blockOnFail: billingType === 'courtesy' ? false : blockOnFail,
                    })

                    if (result.error) {
                        setError(result.error)
                        setLoading(false)
                        return
                    }

                    setLoading(false)
                    onSuccess()
                    onClose()
                }
            }
        } catch {
            setError('Erro ao processar. Tente novamente.')
            setLoading(false)
        }
    }

    if (!isOpen) return null

    const studentName = student?.student_name
        || allStudents?.find(s => s.id === studentId)?.name
        || ''

    const showCourtesyOption = !(student && student.display_status === 'courtesy')

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
                onClick={onClose}
            />

            <div className="relative w-full max-w-md max-h-[85vh] overflow-hidden rounded-3xl border border-transparent bg-surface-card backdrop-blur-xl shadow-2xl ring-1 ring-k-border-primary animate-in fade-in zoom-in-95 duration-200 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-k-border-subtle bg-surface-inset px-8 py-6">
                    <div>
                        <h2 className="text-xl font-bold text-k-text-primary tracking-tight">
                            {step === 'migration_alert' ? 'Alterar Cobrança' :
                             step === 'type' ? (mode === 'migrate' ? 'Novo tipo de cobrança' : 'Nova Cobrança') :
                             billingType === 'stripe_auto' ? 'Cobrar via Stripe' :
                             billingType === 'courtesy' ? 'Acesso Gratuito' : 'Controle Manual'}
                        </h2>
                        <p className="text-xs text-k-text-secondary mt-1">
                            {step === 'migration_alert' ? 'Confirme a alteração' :
                             step === 'type' ? 'Escolha o tipo de cobrança' :
                             'Configure os detalhes'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="h-8 w-8 flex items-center justify-center text-muted-foreground/50 hover:text-k-text-primary hover:bg-glass-bg rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" strokeWidth={1.5} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {/* Migration Alert Step */}
                    {step === 'migration_alert' && student && (
                        <div className="p-8 space-y-5">
                            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
                                <div className="flex items-start gap-3">
                                    <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <h3 className="text-sm font-semibold text-amber-600 dark:text-amber-400 mb-2">
                                            Migração de cobrança
                                        </h3>
                                        <p className="text-xs text-k-text-secondary leading-relaxed">
                                            {getMigrationAlertText(student, null)}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 py-3 text-sm font-medium text-k-text-secondary hover:text-k-text-primary hover:bg-glass-bg rounded-xl transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setStep('type')}
                                    className="flex-1 inline-flex items-center justify-center gap-2 py-3 text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-xl transition-all active:scale-95"
                                >
                                    <ArrowRightLeft size={16} />
                                    Confirmar e prosseguir
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Type Selection Step */}
                    {step === 'type' && (
                        <div className="p-8 space-y-3">
                            {/* Stripe Auto */}
                            <button
                                onClick={() => hasStripeConnect ? handleSelectType('stripe_auto') : undefined}
                                className={`w-full text-left rounded-2xl border p-4 transition-all ${
                                    hasStripeConnect
                                        ? 'border-k-border-primary hover:border-violet-500/30 hover:bg-glass-bg cursor-pointer'
                                        : 'border-k-border-subtle cursor-default'
                                }`}
                            >
                                <div className="flex items-start gap-3">
                                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-violet-500/10">
                                        <CreditCard size={20} className="text-violet-600 dark:text-violet-400" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-sm font-semibold text-k-text-primary">
                                            Cobrar via Stripe
                                        </h3>
                                        <p className="text-xs text-k-text-secondary mt-0.5">
                                            Pagamento automático com cartão de crédito
                                        </p>
                                        {!hasStripeConnect && (
                                            <div className="mt-2">
                                                <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">
                                                    Para cobrar via Stripe, você precisa conectar sua conta. Leva menos de 5 minutos.
                                                </p>
                                                <a
                                                    href="/api/stripe/connect/onboard"
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-colors"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <ExternalLink size={12} />
                                                    Conectar Stripe
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </button>

                            {/* Manual */}
                            <button
                                onClick={() => handleSelectType('manual_recurring')}
                                className="w-full text-left rounded-2xl border border-k-border-primary p-4 hover:border-blue-500/30 hover:bg-glass-bg transition-all cursor-pointer"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-500/10">
                                        <HandCoins size={20} className="text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-sm font-semibold text-k-text-primary">
                                            Controle Manual
                                        </h3>
                                        <p className="text-xs text-k-text-secondary mt-0.5">
                                            Você registra os pagamentos manualmente
                                        </p>
                                    </div>
                                </div>
                            </button>

                            {/* Courtesy — only in migrate mode */}
                            {showCourtesyOption && (
                                <button
                                    onClick={() => handleSelectType('courtesy')}
                                    className="w-full text-left rounded-2xl border border-k-border-primary p-4 hover:border-emerald-500/30 hover:bg-glass-bg transition-all cursor-pointer"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/10">
                                            <Heart size={20} className="text-emerald-600 dark:text-emerald-400" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="text-sm font-semibold text-k-text-primary">
                                                Acesso Gratuito
                                            </h3>
                                            <p className="text-xs text-k-text-secondary mt-0.5">
                                                Sem cobrança
                                            </p>
                                        </div>
                                    </div>
                                </button>
                            )}

                            {mode === 'migrate' && (
                                <button
                                    type="button"
                                    onClick={handleBack}
                                    className="w-full py-2 text-xs font-medium text-k-text-tertiary hover:text-k-text-secondary transition-colors"
                                >
                                    Voltar
                                </button>
                            )}
                        </div>
                    )}

                    {/* Details Step — Form */}
                    {step === 'details' && !checkoutUrl && (
                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                            {error && (
                                <div className="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                    <span>{error}</span>
                                </div>
                            )}

                            <div className="space-y-5">
                                {/* Student Select — only if not pre-selected */}
                                {!student && allStudents && (
                                    <div>
                                        <label className="mb-1.5 block text-xs font-medium text-k-text-tertiary">
                                            Aluno <span className="text-violet-500">*</span>
                                        </label>
                                        <select
                                            value={studentId}
                                            onChange={(e) => setStudentId(e.target.value)}
                                            className="w-full rounded-xl border border-k-border-subtle bg-glass-bg px-4 py-3 text-k-text-primary focus:outline-none focus:border-violet-500/50 focus:ring-4 focus:ring-violet-500/20 transition-all text-sm"
                                        >
                                            <option value="">Selecione um aluno...</option>
                                            {allStudents.map((s) => (
                                                <option key={s.id} value={s.id}>
                                                    {s.name} ({s.email})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {/* Student name — read-only if pre-selected */}
                                {student && (
                                    <div className="rounded-xl border border-k-border-subtle bg-glass-bg px-4 py-3">
                                        <p className="text-xs text-k-text-tertiary mb-0.5">Aluno</p>
                                        <p className="text-sm font-medium text-k-text-primary">{student.student_name}</p>
                                    </div>
                                )}

                                {/* Courtesy — no extra form */}
                                {billingType === 'courtesy' && (
                                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
                                        <p className="text-xs text-emerald-600 dark:text-emerald-400">
                                            {mode === 'migrate'
                                                ? `A cobrança será encerrada e ${studentName || 'o aluno'} terá acesso gratuito.`
                                                : `${studentName || 'O aluno'} terá acesso completo aos treinos sem nenhuma cobrança.`}
                                        </p>
                                    </div>
                                )}

                                {/* Stripe — plan select */}
                                {billingType === 'stripe_auto' && (
                                    <div>
                                        <label className="mb-1.5 block text-xs font-medium text-k-text-tertiary">
                                            Plano <span className="text-violet-500">*</span>
                                        </label>
                                        <select
                                            value={planId}
                                            onChange={(e) => setPlanId(e.target.value)}
                                            className="w-full rounded-xl border border-k-border-subtle bg-glass-bg px-4 py-3 text-k-text-primary focus:outline-none focus:border-violet-500/50 focus:ring-4 focus:ring-violet-500/20 transition-all text-sm"
                                        >
                                            <option value="">Selecione um plano...</option>
                                            {plans
                                                .filter(p => !!p.stripe_price_id)
                                                .map((p) => (
                                                    <option key={p.id} value={p.id}>
                                                        {p.title} — {formatCurrency(p.price)}{intervalLabels[p.interval] || '/mês'}
                                                    </option>
                                                ))}
                                        </select>
                                        <p className="text-[11px] text-k-text-quaternary mt-2 leading-relaxed">
                                            O aluno receberá um link de pagamento por cartão. As renovações são automáticas — você não precisa fazer nada todo mês.
                                        </p>
                                    </div>
                                )}

                                {/* Manual — plan select + custom amount + recurrence + due date + block toggle */}
                                {billingType === 'manual_recurring' && (
                                    <>
                                        <p className="text-[11px] text-k-text-quaternary leading-relaxed">
                                            Você registra os pagamentos manualmente. O Kinevo avisa quando o vencimento estiver próximo.
                                        </p>

                                        {/* Plan or custom amount */}
                                        <div>
                                            <label className="mb-1.5 block text-xs font-medium text-k-text-tertiary">
                                                Plano
                                            </label>
                                            {!useCustomAmount ? (
                                                <>
                                                    <select
                                                        value={planId}
                                                        onChange={(e) => setPlanId(e.target.value)}
                                                        className="w-full rounded-xl border border-k-border-subtle bg-glass-bg px-4 py-3 text-k-text-primary focus:outline-none focus:border-violet-500/50 focus:ring-4 focus:ring-violet-500/20 transition-all text-sm"
                                                    >
                                                        <option value="">Selecione um plano...</option>
                                                        {plans.map((p) => (
                                                            <option key={p.id} value={p.id}>
                                                                {p.title} — {formatCurrency(p.price)}{intervalLabels[p.interval] || '/mês'}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <button
                                                        type="button"
                                                        onClick={() => { setUseCustomAmount(true); setPlanId('') }}
                                                        className="mt-2 text-xs text-violet-600 dark:text-violet-400 hover:text-violet-500 dark:hover:text-violet-300 transition-colors"
                                                    >
                                                        + Valor personalizado
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="relative">
                                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-k-text-tertiary">R$</span>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            placeholder="0,00"
                                                            value={customAmount}
                                                            onChange={(e) => setCustomAmount(e.target.value)}
                                                            className="w-full rounded-xl border border-k-border-subtle bg-glass-bg pl-10 pr-4 py-3 text-k-text-primary focus:outline-none focus:border-violet-500/50 focus:ring-4 focus:ring-violet-500/20 transition-all text-sm"
                                                        />
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => { setUseCustomAmount(false); setCustomAmount('') }}
                                                        className="mt-2 text-xs text-violet-600 dark:text-violet-400 hover:text-violet-500 dark:hover:text-violet-300 transition-colors"
                                                    >
                                                        Usar plano existente
                                                    </button>
                                                </>
                                            )}
                                        </div>

                                        {/* Recurrence */}
                                        <div>
                                            <label className="mb-1.5 block text-xs font-medium text-k-text-tertiary">
                                                Recorrência
                                            </label>
                                            <div className="grid grid-cols-4 gap-2">
                                                {([
                                                    { key: 'month', label: 'Mensal' },
                                                    { key: 'quarter', label: 'Trimestral' },
                                                    { key: 'year', label: 'Anual' },
                                                    { key: 'one_off', label: 'Único' },
                                                ] as const).map(opt => (
                                                    <button
                                                        key={opt.key}
                                                        type="button"
                                                        onClick={() => setRecurrence(opt.key)}
                                                        className={`py-2 text-xs font-medium rounded-lg border transition-all ${
                                                            recurrence === opt.key
                                                                ? 'border-violet-500/50 bg-violet-500/10 text-violet-600 dark:text-violet-400'
                                                                : 'border-k-border-subtle bg-glass-bg text-k-text-secondary hover:border-k-border-primary'
                                                        }`}
                                                    >
                                                        {opt.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* First due date */}
                                        <div>
                                            <label className="mb-1.5 block text-xs font-medium text-k-text-tertiary">
                                                Primeiro vencimento
                                            </label>
                                            <input
                                                type="date"
                                                value={firstDueDate}
                                                onChange={(e) => setFirstDueDate(e.target.value)}
                                                className="w-full rounded-xl border border-k-border-subtle bg-glass-bg px-4 py-3 text-k-text-primary focus:outline-none focus:border-violet-500/50 focus:ring-4 focus:ring-violet-500/20 transition-all text-sm"
                                            />
                                            <p className="mt-1 text-[10px] text-k-text-quaternary">
                                                Deixe vazio para calcular automaticamente
                                            </p>
                                        </div>

                                        {/* Block on fail toggle */}
                                        <div className="flex items-center justify-between rounded-xl border border-k-border-subtle bg-glass-bg px-4 py-3">
                                            <div>
                                                <p className="text-sm font-medium text-k-text-primary">
                                                    Bloquear se não pagar
                                                </p>
                                                <p className="text-xs text-k-text-secondary mt-0.5">
                                                    Se ativado, o aluno perde acesso aos treinos após 3 dias de atraso
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setBlockOnFail(!blockOnFail)}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                                    blockOnFail ? 'bg-violet-600' : 'bg-gray-600'
                                                }`}
                                            >
                                                <span
                                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                                        blockOnFail ? 'translate-x-6' : 'translate-x-1'
                                                    }`}
                                                />
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={handleBack}
                                    className="flex-1 py-3 text-sm font-medium text-k-text-secondary hover:text-k-text-primary hover:bg-glass-bg rounded-xl transition-all"
                                >
                                    Voltar
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 inline-flex items-center justify-center gap-2 py-3 text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-xl transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="animate-spin w-4 h-4" />
                                            Processando...
                                        </>
                                    ) : billingType === 'stripe_auto' ? (
                                        <>
                                            <ExternalLink size={16} />
                                            Gerar Link de Pagamento
                                        </>
                                    ) : billingType === 'courtesy' ? (
                                        'Confirmar acesso gratuito'
                                    ) : (
                                        'Criar contrato'
                                    )}
                                </button>
                            </div>
                        </form>
                    )}

                    {/* Checkout URL result */}
                    {step === 'details' && checkoutUrl && (
                        <div className="p-8 space-y-5">
                            <div className="text-center">
                                <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/10 mx-auto mb-3">
                                    <Check size={22} className="text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <h3 className="text-base font-semibold text-k-text-primary mb-1">
                                    Link de pagamento pronto
                                </h3>
                                <p className="text-xs text-k-text-secondary">
                                    Copie e envie para {studentName || 'o aluno'} via WhatsApp ou e-mail.
                                    O acesso é liberado automaticamente após o pagamento.
                                </p>
                                <p className="text-[11px] text-k-text-quaternary mt-1">
                                    O link expira em 24 horas. Se o aluno não pagar, gere um novo link a qualquer momento.
                                </p>
                            </div>

                            <div className="rounded-xl border border-k-border-subtle bg-glass-bg p-3 flex items-center gap-2">
                                <p className="text-xs text-k-text-secondary break-all font-mono flex-1 line-clamp-2">
                                    {checkoutUrl}
                                </p>
                                <button
                                    type="button"
                                    onClick={handleCopyLink}
                                    className="flex-shrink-0 p-2 rounded-lg hover:bg-glass-bg-active transition-colors"
                                    title="Copiar link"
                                >
                                    {copied ? (
                                        <Check size={14} className="text-emerald-600 dark:text-emerald-400" />
                                    ) : (
                                        <Copy size={14} className="text-k-text-quaternary" />
                                    )}
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={handleWhatsApp}
                                    disabled={!student?.phone}
                                    className="inline-flex items-center justify-center gap-2 py-3 text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <MessageCircle size={16} />
                                    WhatsApp
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCopyLink}
                                    className="inline-flex items-center justify-center gap-2 py-3 text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white rounded-xl transition-all active:scale-95"
                                >
                                    {copied ? (
                                        <>
                                            <Check size={16} />
                                            Copiado!
                                        </>
                                    ) : (
                                        <>
                                            <Copy size={16} />
                                            Copiar Link
                                        </>
                                    )}
                                </button>
                            </div>

                            <button
                                type="button"
                                onClick={() => { onSuccess(); onClose() }}
                                className="w-full py-2.5 text-xs font-medium text-k-text-tertiary hover:text-k-text-secondary transition-colors"
                            >
                                Fechar
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
