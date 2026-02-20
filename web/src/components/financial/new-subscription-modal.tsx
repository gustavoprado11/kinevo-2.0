'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, AlertCircle, CreditCard, HandCoins, Heart, Copy, Check, ExternalLink } from 'lucide-react'
import { createContract } from '@/actions/financial/create-contract'
import { generateCheckoutLink } from '@/actions/financial/generate-checkout-link'

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

interface NewSubscriptionModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    students: Student[]
    plans: Plan[]
    hasStripeConnect: boolean
}

type BillingType = 'stripe_auto' | 'manual_recurring' | 'courtesy'

export function NewSubscriptionModal({
    isOpen,
    onClose,
    onSuccess,
    students,
    plans,
    hasStripeConnect,
}: NewSubscriptionModalProps) {
    const [step, setStep] = useState<'type' | 'details'>('type')
    const [billingType, setBillingType] = useState<BillingType | null>(null)
    const [studentId, setStudentId] = useState('')
    const [planId, setPlanId] = useState('')
    const [blockOnFail, setBlockOnFail] = useState(true)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)

    // Reset when modal opens/closes
    useEffect(() => {
        if (isOpen) {
            setStep('type')
            setBillingType(null)
            setStudentId('')
            setPlanId('')
            setBlockOnFail(true)
            setLoading(false)
            setError('')
            setCheckoutUrl(null)
            setCopied(false)
        }
    }, [isOpen])

    const handleSelectType = (type: BillingType) => {
        setBillingType(type)
        setStep('details')
        setError('')
    }

    const handleBack = () => {
        setStep('type')
        setBillingType(null)
        setError('')
        setCheckoutUrl(null)
    }

    const handleCopyLink = async () => {
        if (!checkoutUrl) return
        await navigator.clipboard.writeText(checkoutUrl)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        if (!studentId) {
            setError('Selecione um aluno.')
            return
        }
        if (billingType !== 'courtesy' && !planId) {
            setError('Selecione um plano.')
            return
        }

        setLoading(true)

        try {
            if (billingType === 'stripe_auto') {
                // Generate checkout link
                const result = await generateCheckoutLink({
                    studentId,
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
                // Create manual or courtesy contract
                const result = await createContract({
                    studentId,
                    planId: planId || null,
                    billingType: billingType === 'courtesy' ? 'courtesy' : 'manual_recurring',
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
        } catch {
            setError('Erro ao processar. Tente novamente.')
            setLoading(false)
        }
    }

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        }).format(value)
    }

    const intervalLabels: Record<string, string> = {
        month: '/mês',
        quarter: '/trimestre',
        year: '/ano',
    }

    if (!isOpen) return null

    const typeTitle: Record<BillingType, string> = {
        stripe_auto: 'Cobrar via Stripe',
        manual_recurring: 'Controle Manual',
        courtesy: 'Acesso Gratuito',
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-transparent bg-surface-card backdrop-blur-xl shadow-2xl ring-1 ring-k-border-primary animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-k-border-subtle bg-surface-inset px-8 py-6">
                    <div>
                        <h2 className="text-xl font-bold text-white tracking-tight">
                            {step === 'type' ? 'Nova Assinatura' : typeTitle[billingType!]}
                        </h2>
                        <p className="text-xs text-muted-foreground/60 uppercase tracking-widest font-semibold mt-1">
                            {step === 'type' ? 'Escolha o tipo de cobrança' : 'Configure a assinatura'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="h-8 w-8 flex items-center justify-center text-muted-foreground/50 hover:text-k-text-primary hover:bg-glass-bg rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" strokeWidth={1.5} />
                    </button>
                </div>

                {/* Step 1: Choose billing type */}
                {step === 'type' && (
                    <div className="p-8 space-y-3">
                        {/* Stripe Auto */}
                        <button
                            onClick={() => handleSelectType('stripe_auto')}
                            disabled={!hasStripeConnect}
                            className={`w-full text-left rounded-2xl border p-4 transition-all ${
                                hasStripeConnect
                                    ? 'border-k-border-primary hover:border-violet-500/30 hover:bg-glass-bg cursor-pointer'
                                    : 'border-k-border-subtle opacity-50 cursor-not-allowed'
                            }`}
                        >
                            <div className="flex items-start gap-3">
                                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-violet-500/10">
                                    <CreditCard size={20} className="text-violet-400" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-sm font-semibold text-k-text-primary">
                                        Cobrar via Stripe
                                    </h3>
                                    <p className="text-xs text-k-text-secondary mt-0.5">
                                        Gera um link de pagamento automático. O aluno paga online.
                                    </p>
                                    {!hasStripeConnect && (
                                        <p className="text-xs text-amber-400 mt-1">
                                            Conecte o Stripe para usar esta opção
                                        </p>
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
                                    <HandCoins size={20} className="text-blue-400" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-sm font-semibold text-k-text-primary">
                                        Controle Manual
                                    </h3>
                                    <p className="text-xs text-k-text-secondary mt-0.5">
                                        Controle pagamentos feitos por dinheiro, Pix direto ou transferência.
                                    </p>
                                </div>
                            </div>
                        </button>

                        {/* Courtesy */}
                        <button
                            onClick={() => handleSelectType('courtesy')}
                            className="w-full text-left rounded-2xl border border-k-border-primary p-4 hover:border-emerald-500/30 hover:bg-glass-bg transition-all cursor-pointer"
                        >
                            <div className="flex items-start gap-3">
                                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/10">
                                    <Heart size={20} className="text-emerald-400" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-sm font-semibold text-k-text-primary">
                                        Acesso Gratuito
                                    </h3>
                                    <p className="text-xs text-k-text-secondary mt-0.5">
                                        Dê acesso sem cobrança para familiares, amigos ou parceiros.
                                    </p>
                                </div>
                            </div>
                        </button>
                    </div>
                )}

                {/* Step 2: Details */}
                {step === 'details' && !checkoutUrl && (
                    <form onSubmit={handleSubmit} className="p-8 space-y-6">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                {error}
                            </div>
                        )}

                        <div className="space-y-5">
                            {/* Student Select */}
                            <div>
                                <label className="mb-1.5 block text-[11px] font-bold text-k-text-tertiary uppercase tracking-wider">
                                    Aluno <span className="text-violet-500">*</span>
                                </label>
                                <select
                                    value={studentId}
                                    onChange={(e) => setStudentId(e.target.value)}
                                    className="w-full rounded-xl border border-k-border-subtle bg-glass-bg px-4 py-3 text-k-text-primary focus:outline-none focus:border-violet-500/50 focus:ring-4 focus:ring-violet-500/20 transition-all text-sm"
                                >
                                    <option value="">Selecione um aluno...</option>
                                    {students.map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.name} ({s.email})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Plan Select (hidden for courtesy) */}
                            {billingType !== 'courtesy' && (
                                <div>
                                    <label className="mb-1.5 block text-[11px] font-bold text-k-text-tertiary uppercase tracking-wider">
                                        Plano <span className="text-violet-500">*</span>
                                    </label>
                                    <select
                                        value={planId}
                                        onChange={(e) => setPlanId(e.target.value)}
                                        className="w-full rounded-xl border border-k-border-subtle bg-glass-bg px-4 py-3 text-k-text-primary focus:outline-none focus:border-violet-500/50 focus:ring-4 focus:ring-violet-500/20 transition-all text-sm"
                                    >
                                        <option value="">Selecione um plano...</option>
                                        {plans
                                            .filter((p) => {
                                                // For stripe_auto, only show plans with stripe_price_id
                                                if (billingType === 'stripe_auto') return !!p.stripe_price_id
                                                return true
                                            })
                                            .map((p) => (
                                                <option key={p.id} value={p.id}>
                                                    {p.title} — {formatCurrency(p.price)}{intervalLabels[p.interval] || '/mês'}
                                                </option>
                                            ))}
                                    </select>
                                </div>
                            )}

                            {/* Block on fail toggle (only for manual) */}
                            {billingType === 'manual_recurring' && (
                                <div className="flex items-center justify-between rounded-xl border border-k-border-subtle bg-glass-bg px-4 py-3">
                                    <div>
                                        <p className="text-sm font-medium text-k-text-primary">
                                            Bloquear se não pagar
                                        </p>
                                        <p className="text-xs text-k-text-secondary mt-0.5">
                                            O aluno perde acesso se o pagamento estiver pendente
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
                                className="flex-1 inline-flex items-center justify-center gap-2 py-3 text-sm font-bold bg-violet-600 hover:bg-violet-500 text-white rounded-xl shadow-lg shadow-violet-500/20 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="animate-spin w-4 h-4" />
                                        Processando...
                                    </>
                                ) : billingType === 'stripe_auto' ? (
                                    <>
                                        <ExternalLink size={16} />
                                        Gerar Link
                                    </>
                                ) : (
                                    'Criar Assinatura'
                                )}
                            </button>
                        </div>
                    </form>
                )}

                {/* Checkout URL result */}
                {step === 'details' && checkoutUrl && (
                    <div className="p-8 space-y-6">
                        <div className="text-center">
                            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/10 mx-auto mb-4">
                                <Check size={24} className="text-emerald-400" />
                            </div>
                            <h3 className="text-base font-semibold text-k-text-primary mb-2">
                                Link gerado com sucesso!
                            </h3>
                            <p className="text-sm text-k-text-secondary">
                                Compartilhe o link abaixo com seu aluno para que ele efetue o pagamento.
                            </p>
                        </div>

                        <div className="rounded-xl border border-k-border-subtle bg-glass-bg p-3">
                            <p className="text-xs text-k-text-secondary break-all font-mono">
                                {checkoutUrl}
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 py-3 text-sm font-medium text-k-text-secondary hover:text-k-text-primary hover:bg-glass-bg rounded-xl transition-all"
                            >
                                Fechar
                            </button>
                            <button
                                type="button"
                                onClick={handleCopyLink}
                                className="flex-1 inline-flex items-center justify-center gap-2 py-3 text-sm font-bold bg-violet-600 hover:bg-violet-500 text-white rounded-xl shadow-lg shadow-violet-500/20 transition-all active:scale-95"
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
                    </div>
                )}
            </div>
        </div>
    )
}
