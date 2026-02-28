'use client'

import { useState, useEffect } from 'react'
import { X, FileText, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { createPlan } from '@/actions/financial/create-plan'
import { updatePlan } from '@/actions/financial/update-plan'

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
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const isEdit = !!plan

    // Reset form when modal opens/closes or plan changes
    useEffect(() => {
        if (isOpen) {
            if (plan) {
                setTitle(plan.title)
                setPrice(String(plan.price))
                setInterval(plan.interval)
                setDescription(plan.description || '')
                setVisibility(plan.visibility || 'public')
            } else {
                setTitle('')
                setPrice('')
                setInterval('month')
                setDescription('')
                setVisibility('public')
            }
            setError('')
        }
    }, [isOpen, plan])

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
                            {isEdit ? 'Editar Plano' : 'Novo Plano'}
                        </h2>
                        <p className="text-xs text-k-text-secondary mt-1">
                            {isEdit ? 'Atualize as informações' : 'Crie um plano de consultoria'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="h-8 w-8 flex items-center justify-center text-muted-foreground/50 hover:text-k-text-primary hover:bg-glass-bg rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" strokeWidth={1.5} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm flex items-start gap-3">
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
                                <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-k-text-quaternary group-focus-within:text-violet-400 transition-colors" strokeWidth={1.5} />
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
                                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-k-text-quaternary group-focus-within:text-violet-400 transition-colors">R$</span>
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
    )
}
