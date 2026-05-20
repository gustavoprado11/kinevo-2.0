'use client'

import { useState, useEffect } from 'react'
import { X, FileText, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { createPlan } from '@/actions/financial/create-plan'
import { updatePlan } from '@/actions/financial/update-plan'
import { FeesSimulationCard } from './fees-simulation-card'
import type { PaymentMethod } from '@/lib/asaas/fees'

interface Plan {
    id: string
    title: string
    price: number
    interval: string
    description: string | null
    visibility: string | null
    is_active: boolean
    stripe_product_id: string | null
    stripe_price_id: string | null
    allow_pix?: boolean
    allow_credit_card?: boolean
    allow_boleto?: boolean
}

interface PlanFormModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    plan?: Plan | null
    hasStripeConnect: boolean
}

export function PlanFormModal({
    isOpen,
    onClose,
    onSuccess,
    plan,
    hasStripeConnect,
}: PlanFormModalProps) {
    const [title, setTitle] = useState('')
    const [price, setPrice] = useState('')
    const [interval, setInterval] = useState('month')
    const [description, setDescription] = useState('')
    const [visibility, setVisibility] = useState('public')
    const [allowPix, setAllowPix] = useState(true)
    const [allowCreditCard, setAllowCreditCard] = useState(true)
    const [allowBoleto, setAllowBoleto] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const acceptedMethods: PaymentMethod[] = [
        allowPix ? 'PIX' : null,
        allowCreditCard ? 'CREDIT_CARD' : null,
        allowBoleto ? 'BOLETO' : null,
    ].filter(Boolean) as PaymentMethod[]

    const isEdit = !!plan

    // Reset form when modal opens/closes or plan changes.
    // Padrão idiomático pré-React-19 — cascading render é intencional aqui
    // (carrega valores ao abrir). Refatorar com `key` num pass futuro.
    /* Body scroll lock: enquanto o modal está aberto, prevenir scroll do
     * background. Sem isso, em telas menores o usuário tentando rolar o
     * modal acaba rolando a página atrás. Restaura overflow ao fechar. */
    useEffect(() => {
        if (!isOpen) return
        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
            document.body.style.overflow = previousOverflow
        }
    }, [isOpen])

    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => {
        if (isOpen) {
            if (plan) {
                setTitle(plan.title)
                // Formato BR: 149.9 → "149,90"
                setPrice(plan.price.toFixed(2).replace('.', ','))
                setInterval(plan.interval)
                setDescription(plan.description || '')
                setVisibility(plan.visibility || 'public')
                setAllowPix(plan.allow_pix ?? true)
                setAllowCreditCard(plan.allow_credit_card ?? true)
                setAllowBoleto(plan.allow_boleto ?? false)
            } else {
                setTitle('')
                setPrice('')
                setInterval('month')
                setDescription('')
                setVisibility('public')
                setAllowPix(true)
                setAllowCreditCard(true)
                setAllowBoleto(false)
            }
            setError('')
        }
    }, [isOpen, plan])
    /* eslint-enable react-hooks/set-state-in-effect */

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        if (!title.trim()) {
            setError('Preencha o título do plano.')
            return
        }

        if (!price.trim()) {
            setError('Preencha o preço.')
            return
        }

        const priceNum = parseFloat(price.replace(',', '.'))
        if (isNaN(priceNum) || priceNum <= 0) {
            setError('Insira um preço válido.')
            return
        }

        if (acceptedMethods.length === 0) {
            setError('Selecione ao menos um método de pagamento aceito.')
            return
        }

        setLoading(true)

        try {
            if (isEdit && plan) {
                const result = await updatePlan({
                    planId: plan.id,
                    title: title.trim(),
                    price: priceNum,
                    interval,
                    description: description.trim(),
                    visibility,
                    allowPix,
                    allowCreditCard,
                    allowBoleto,
                })

                if (result.error) {
                    setError(result.error)
                    setLoading(false)
                    return
                }
            } else {
                const result = await createPlan({
                    title: title.trim(),
                    price: priceNum,
                    interval,
                    description: description.trim(),
                    visibility,
                    hasStripeConnect,
                    allowPix,
                    allowCreditCard,
                    allowBoleto,
                })

                if (result.error) {
                    setError(result.error)
                    setLoading(false)
                    return
                }
            }

            setLoading(false)
            onSuccess()
            onClose()
        } catch {
            setError('Erro ao salvar plano. Tente novamente.')
            setLoading(false)
        }
    }

    if (!isOpen) return null

    return (
        // Wrapper externo com scroll vertical — em telas baixas o modal todo
        // (modal + padding em volta) pode rolar. Combina com max-h no modal
        // interno pra suportar tanto desktop quanto mobile pequeno.
        <div className="fixed inset-0 z-modal overflow-y-auto overscroll-contain">
            {/* Backdrop fixo cobrindo tudo, atrás do conteúdo */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
                onClick={onClose}
            />

            {/* Container que centraliza no eixo Y quando o modal cabe;
                em viewports baixas, o flex permite que o modal "encoste"
                no topo (com padding) e o scroll do wrapper resolva o resto. */}
            <div className="relative flex min-h-full items-start sm:items-center justify-center p-4">

                {/* Modal Content — flex-col com max-h e body scrollable */}
                <div className="relative w-full max-w-md flex flex-col max-h-[calc(100dvh-2rem)] rounded-3xl border border-transparent bg-surface-card backdrop-blur-xl shadow-2xl ring-1 ring-k-border-primary animate-in fade-in zoom-in-95 duration-200">
                    {/* Header sticky (sempre visível mesmo quando rola o body) */}
                    <div className="flex-shrink-0 flex items-center justify-between border-b border-k-border-subtle bg-surface-inset px-6 sm:px-8 py-5 sm:py-6 rounded-t-3xl">
                        <div>
                            <h2 className="text-xl font-bold text-k-text-primary tracking-tight">
                                {isEdit ? 'Editar Plano' : 'Novo Plano'}
                            </h2>
                            <p className="text-xs text-k-text-secondary mt-1">
                                {isEdit ? 'Atualize as informações' : 'Crie um plano de consultoria'}
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="h-8 w-8 flex items-center justify-center text-muted-foreground/50 hover:text-k-text-primary hover:bg-glass-bg rounded-full transition-colors"
                            type="button"
                        >
                            <X className="w-5 h-5" strokeWidth={1.5} />
                        </button>
                    </div>

                    {/* Form com scroll interno */}
                    <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                            {error}
                        </div>
                    )}

                    <div className="space-y-5">
                        {/* Title */}
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-k-text-tertiary">
                                Título do plano <span className="text-violet-500">*</span>
                            </label>
                            <div className="relative group">
                                <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-k-text-quaternary group-focus-within:text-violet-600 dark:group-focus-within:text-violet-400 transition-colors" strokeWidth={1.5} />
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Ex: Consultoria Mensal"
                                    className="w-full rounded-xl border border-k-border-subtle bg-glass-bg px-10 py-3 text-k-text-primary placeholder:text-k-text-quaternary focus:outline-none focus:border-violet-500/50 focus:ring-4 focus:ring-violet-500/20 transition-all text-sm"
                                />
                            </div>
                        </div>

                        {/* Price */}
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-k-text-tertiary">
                                Preço <span className="text-violet-500">*</span>
                            </label>
                            <div className="relative group">
                                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-k-text-quaternary group-focus-within:text-violet-600 dark:group-focus-within:text-violet-400 transition-colors">R$</span>
                                <input
                                    type="text"
                                    value={price}
                                    onChange={(e) => setPrice(e.target.value)}
                                    placeholder="150,00"
                                    className="w-full rounded-xl border border-k-border-subtle bg-glass-bg pl-10 pr-4 py-3 text-k-text-primary placeholder:text-k-text-quaternary focus:outline-none focus:border-violet-500/50 focus:ring-4 focus:ring-violet-500/20 transition-all text-sm"
                                />
                            </div>
                        </div>

                        {/* Interval */}
                        <div>
                            <label className="mb-2 block text-xs font-medium text-k-text-tertiary">
                                Intervalo
                            </label>
                            <div className="grid grid-cols-3 gap-1 bg-surface-inset p-1 rounded-xl">
                                {[
                                    { value: 'month', label: 'Mensal' },
                                    { value: 'quarter', label: 'Trimestral' },
                                    { value: 'year', label: 'Anual' },
                                ].map((opt) => (
                                    <label
                                        key={opt.value}
                                        className={`
                                            flex items-center justify-center rounded-lg px-3 py-2.5 cursor-pointer transition-all duration-200
                                            ${interval === opt.value
                                                ? 'bg-glass-bg-active text-k-text-primary shadow-sm ring-1 ring-k-border-subtle'
                                                : 'text-k-text-tertiary hover:text-k-text-secondary hover:bg-glass-bg'}
                                        `}
                                    >
                                        <input
                                            type="radio"
                                            name="interval"
                                            value={opt.value}
                                            checked={interval === opt.value}
                                            onChange={() => setInterval(opt.value)}
                                            className="sr-only"
                                        />
                                        <span className="font-semibold text-xs tracking-wide">{opt.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Description */}
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-k-text-tertiary">
                                Descrição <span className="text-k-text-quaternary ml-1">(opcional)</span>
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Descreva o que está incluso no plano..."
                                rows={3}
                                className="w-full rounded-xl border border-k-border-subtle bg-glass-bg px-4 py-3 text-k-text-primary placeholder:text-k-text-quaternary focus:outline-none focus:border-violet-500/50 focus:ring-4 focus:ring-violet-500/20 transition-all text-sm resize-none"
                            />
                        </div>

                        {/* Métodos de pagamento aceitos */}
                        <div>
                            <label className="mb-2 block text-xs font-medium text-k-text-tertiary">
                                Métodos de pagamento aceitos
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { value: 'pix', label: 'PIX', state: allowPix, set: setAllowPix },
                                    { value: 'credit', label: 'Cartão crédito', state: allowCreditCard, set: setAllowCreditCard },
                                    { value: 'boleto', label: 'Boleto', state: allowBoleto, set: setAllowBoleto },
                                ].map((opt) => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => opt.set(!opt.state)}
                                        className={`rounded-lg border px-2 py-2 text-xs font-medium transition-all ${
                                            opt.state
                                                ? 'border-violet-500/50 bg-violet-500/10 text-violet-700 dark:text-violet-300'
                                                : 'border-k-border-subtle bg-glass-bg text-k-text-tertiary hover:text-k-text-secondary'
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                            <p className="mt-1.5 text-[11px] text-k-text-quaternary">
                                O aluno escolhe entre os métodos que você aceitar.
                            </p>
                        </div>

                        {/* Simulação de taxas */}
                        <FeesSimulationCard
                            value={price}
                            methods={acceptedMethods.length > 0 ? acceptedMethods : ['PIX', 'CREDIT_CARD']}
                        />

                        {/* Visibility */}
                        <div>
                            <label className="mb-2 block text-xs font-medium text-k-text-tertiary">
                                Visibilidade
                            </label>
                            <div className="grid grid-cols-2 gap-1 bg-surface-inset p-1 rounded-xl">
                                <label
                                    className={`
                                        flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 cursor-pointer transition-all duration-200
                                        ${visibility === 'public'
                                            ? 'bg-glass-bg-active text-k-text-primary shadow-sm ring-1 ring-k-border-subtle'
                                            : 'text-k-text-tertiary hover:text-k-text-secondary hover:bg-glass-bg'}
                                    `}
                                >
                                    <input
                                        type="radio"
                                        name="visibility"
                                        value="public"
                                        checked={visibility === 'public'}
                                        onChange={() => setVisibility('public')}
                                        className="sr-only"
                                    />
                                    <Eye className="h-4 w-4" strokeWidth={1.5} />
                                    <span className="font-semibold text-xs tracking-wide">Visível</span>
                                </label>
                                <label
                                    className={`
                                        flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 cursor-pointer transition-all duration-200
                                        ${visibility === 'hidden'
                                            ? 'bg-glass-bg-active text-k-text-primary shadow-sm ring-1 ring-k-border-subtle'
                                            : 'text-k-text-tertiary hover:text-k-text-secondary hover:bg-glass-bg'}
                                    `}
                                >
                                    <input
                                        type="radio"
                                        name="visibility"
                                        value="hidden"
                                        checked={visibility === 'hidden'}
                                        onChange={() => setVisibility('hidden')}
                                        className="sr-only"
                                    />
                                    <EyeOff className="h-4 w-4" strokeWidth={1.5} />
                                    <span className="font-semibold text-xs tracking-wide">Oculto</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 text-sm font-medium text-k-text-secondary hover:text-k-text-primary hover:bg-glass-bg rounded-xl transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 inline-flex items-center justify-center gap-2 py-3 text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-xl transition-all active:scale-95 disabled:opacity-50"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="animate-spin w-4 h-4" />
                                    Salvando...
                                </>
                            ) : (
                                isEdit ? 'Salvar Alterações' : 'Criar Plano'
                            )}
                        </button>
                    </div>
                </form>
                </div>
            </div>
        </div>
    )
}
