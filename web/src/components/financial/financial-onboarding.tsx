'use client'

import { useState } from 'react'
import { CreditCard, HandCoins, Heart, ExternalLink, Loader2, ArrowRight, ChevronLeft } from 'lucide-react'

interface FinancialOnboardingProps {
    onComplete: () => void
}

export function FinancialOnboarding({ onComplete }: FinancialOnboardingProps) {
    const [step, setStep] = useState(1)
    const [connectLoading, setConnectLoading] = useState(false)

    const handleConnectStripe = async () => {
        setConnectLoading(true)
        try {
            const res = await fetch('/api/stripe/connect/onboard', { method: 'POST' })
            const data = await res.json()
            if (data.url) {
                window.location.href = data.url
            }
        } catch {
            setConnectLoading(false)
        }
    }

    return (
        <div className="max-w-2xl mx-auto">
            {/* Progress indicator */}
            <div className="flex items-center justify-center gap-2 mb-10">
                {[1, 2, 3].map((s) => (
                    <div
                        key={s}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                            s === step
                                ? 'w-8 bg-violet-500'
                                : s < step
                                    ? 'w-8 bg-violet-500/40'
                                    : 'w-8 bg-glass-bg'
                        }`}
                    />
                ))}
            </div>

            {step === 1 && <StepWelcome onNext={() => setStep(2)} />}
            {step === 2 && (
                <StepConnect
                    onConnect={handleConnectStripe}
                    onSkip={() => setStep(3)}
                    onBack={() => setStep(1)}
                    loading={connectLoading}
                />
            )}
            {step === 3 && (
                <StepCreatePlan
                    onComplete={onComplete}
                    onBack={() => setStep(2)}
                />
            )}
        </div>
    )
}

function StepWelcome({ onNext }: { onNext: () => void }) {
    return (
        <div className="text-center">
            <h2 className="text-2xl font-bold text-k-text-primary mb-3">
                Gerencie seus planos e cobranças
            </h2>
            <p className="text-k-text-secondary mb-10 max-w-lg mx-auto">
                Crie planos de consultoria, cobre seus alunos automaticamente via Stripe
                ou controle pagamentos manuais. Tudo em um só lugar.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
                <div className="rounded-2xl bg-surface-card border border-k-border-primary p-5 text-left">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-violet-500/10 mb-3">
                        <CreditCard size={20} className="text-violet-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-k-text-primary mb-1">Stripe</h3>
                    <p className="text-xs text-k-text-secondary leading-relaxed">
                        Pagamento automático via cartão ou Pix. O aluno recebe um link e paga online.
                    </p>
                </div>

                <div className="rounded-2xl bg-surface-card border border-k-border-primary p-5 text-left">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-500/10 mb-3">
                        <HandCoins size={20} className="text-blue-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-k-text-primary mb-1">Manual</h3>
                    <p className="text-xs text-k-text-secondary leading-relaxed">
                        Controle pagamentos feitos por dinheiro, Pix direto ou transferência.
                    </p>
                </div>

                <div className="rounded-2xl bg-surface-card border border-k-border-primary p-5 text-left">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/10 mb-3">
                        <Heart size={20} className="text-emerald-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-k-text-primary mb-1">Cortesia</h3>
                    <p className="text-xs text-k-text-secondary leading-relaxed">
                        Dê acesso gratuito para familiares, amigos ou parceiros.
                    </p>
                </div>
            </div>

            <button
                onClick={onNext}
                className="inline-flex items-center gap-2 px-8 py-3 text-sm font-medium rounded-xl bg-violet-600 hover:bg-violet-500 text-white transition-colors shadow-lg shadow-violet-500/20"
            >
                Começar
                <ArrowRight size={16} />
            </button>
        </div>
    )
}

function StepConnect({
    onConnect,
    onSkip,
    onBack,
    loading,
}: {
    onConnect: () => void
    onSkip: () => void
    onBack: () => void
    loading: boolean
}) {
    return (
        <div className="text-center">
            <h2 className="text-2xl font-bold text-k-text-primary mb-3">
                Conectar com Stripe
            </h2>
            <p className="text-k-text-secondary mb-8 max-w-lg mx-auto">
                Conecte sua conta Stripe para cobrar seus alunos automaticamente.
                Você pode pular essa etapa e usar apenas cobranças manuais.
            </p>

            <div className="rounded-2xl bg-surface-card border border-k-border-primary p-8 mb-8 max-w-md mx-auto">
                <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-violet-500/10 mx-auto mb-4">
                    <ExternalLink size={24} className="text-violet-400" />
                </div>
                <h3 className="text-base font-semibold text-k-text-primary mb-2">
                    Pagamentos automáticos
                </h3>
                <p className="text-sm text-k-text-secondary mb-5">
                    Com o Stripe, seus alunos podem pagar por cartão de crédito ou Pix.
                    O dinheiro vai direto para sua conta.
                </p>
                <button
                    onClick={onConnect}
                    disabled={loading}
                    className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium rounded-xl bg-violet-600 hover:bg-violet-500 text-white transition-colors disabled:opacity-50"
                >
                    {loading ? (
                        <Loader2 size={16} className="animate-spin" />
                    ) : (
                        <ExternalLink size={16} />
                    )}
                    Conectar com Stripe
                </button>
            </div>

            <div className="flex items-center justify-center gap-4">
                <button
                    onClick={onBack}
                    className="inline-flex items-center gap-1 text-sm text-k-text-secondary hover:text-k-text-primary transition-colors"
                >
                    <ChevronLeft size={16} />
                    Voltar
                </button>
                <button
                    onClick={onSkip}
                    className="text-sm text-k-text-secondary hover:text-k-text-primary transition-colors underline underline-offset-4"
                >
                    Pular por agora
                </button>
            </div>

            <p className="text-xs text-k-text-secondary/60 mt-6">
                Você pode conectar o Stripe a qualquer momento nas configurações financeiras.
            </p>
        </div>
    )
}

function StepCreatePlan({
    onComplete,
    onBack,
}: {
    onComplete: () => void
    onBack: () => void
}) {
    const [title, setTitle] = useState('')
    const [price, setPrice] = useState('')
    const [interval, setInterval] = useState('month')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const handleCreate = async () => {
        if (!title.trim() || !price.trim()) {
            setError('Preencha o título e o preço.')
            return
        }

        const priceNum = parseFloat(price.replace(',', '.'))
        if (isNaN(priceNum) || priceNum <= 0) {
            setError('Insira um preço válido.')
            return
        }

        setLoading(true)
        setError('')

        try {
            const res = await fetch('/api/stripe/connect/status')
            const connectStatus = await res.json()

            // Import dynamically to avoid issues
            const { createPlan } = await import('@/actions/financial/create-plan')
            const result = await createPlan({
                title: title.trim(),
                price: priceNum,
                interval,
                description: '',
                visibility: 'public',
                hasStripeConnect: connectStatus.connected && connectStatus.charges_enabled,
            })

            if (result.error) {
                setError(result.error)
                setLoading(false)
                return
            }

            onComplete()
        } catch {
            setError('Erro ao criar plano. Tente novamente.')
            setLoading(false)
        }
    }

    return (
        <div className="text-center">
            <h2 className="text-2xl font-bold text-k-text-primary mb-3">
                Criar seu primeiro plano
            </h2>
            <p className="text-k-text-secondary mb-8 max-w-lg mx-auto">
                Configure um plano de consultoria para seus alunos.
            </p>

            <div className="rounded-2xl bg-surface-card border border-k-border-primary p-6 max-w-md mx-auto text-left">
                {error && (
                    <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                        {error}
                    </div>
                )}

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-k-text-secondary uppercase tracking-wider mb-1.5">
                            Título do Plano
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Ex: Consultoria Mensal"
                            className="w-full px-4 py-2.5 rounded-xl border border-k-border-subtle bg-glass-bg text-k-text-primary placeholder:text-k-text-secondary/40 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 text-sm"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-k-text-secondary uppercase tracking-wider mb-1.5">
                            Preço (R$)
                        </label>
                        <input
                            type="text"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            placeholder="150,00"
                            className="w-full px-4 py-2.5 rounded-xl border border-k-border-subtle bg-glass-bg text-k-text-primary placeholder:text-k-text-secondary/40 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 text-sm"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-k-text-secondary uppercase tracking-wider mb-1.5">
                            Intervalo
                        </label>
                        <select
                            value={interval}
                            onChange={(e) => setInterval(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-k-border-subtle bg-glass-bg text-k-text-primary focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 text-sm"
                        >
                            <option value="month">Mensal</option>
                            <option value="quarter">Trimestral</option>
                            <option value="year">Anual</option>
                        </select>
                    </div>
                </div>

                <button
                    onClick={handleCreate}
                    disabled={loading}
                    className="w-full mt-6 inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium rounded-xl bg-violet-600 hover:bg-violet-500 text-white transition-colors disabled:opacity-50"
                >
                    {loading && <Loader2 size={16} className="animate-spin" />}
                    Criar Plano
                </button>
            </div>

            <div className="flex items-center justify-center gap-4 mt-6">
                <button
                    onClick={onBack}
                    className="inline-flex items-center gap-1 text-sm text-k-text-secondary hover:text-k-text-primary transition-colors"
                >
                    <ChevronLeft size={16} />
                    Voltar
                </button>
                <button
                    onClick={onComplete}
                    className="text-sm text-k-text-secondary hover:text-k-text-primary transition-colors underline underline-offset-4"
                >
                    Criar depois
                </button>
            </div>
        </div>
    )
}
