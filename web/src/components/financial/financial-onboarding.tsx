'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    Wallet, Heart, Repeat, ArrowRight, ChevronLeft, Loader2, Sparkles, Check,
} from 'lucide-react'

interface FinancialOnboardingProps {
    onComplete: () => void
}

export function FinancialOnboarding({ onComplete }: FinancialOnboardingProps) {
    const [step, setStep] = useState(1)

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
                <StepActivateWallet
                    onSkip={() => setStep(3)}
                    onBack={() => setStep(1)}
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
                Receba seus alunos direto no app
            </h2>
            <p className="text-k-text-secondary mb-10 max-w-lg mx-auto">
                Cobre via PIX e Cartão, libere acessos como Cortesia e crie planos
                recorrentes — tudo num lugar só, sem precisar de outra ferramenta.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
                <div className="rounded-2xl bg-surface-card border border-k-border-primary p-5 text-left">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-violet-500/10 mb-3">
                        <Wallet size={20} className="text-violet-600 dark:text-violet-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-k-text-primary mb-1">Carteira Kinevo</h3>
                    <p className="text-xs text-k-text-secondary leading-relaxed">
                        Receba via PIX e Cartão, em parceria com a Asaas. Saque sem taxa, quando quiser.
                    </p>
                </div>

                <div className="rounded-2xl bg-surface-card border border-k-border-primary p-5 text-left">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-500/10 mb-3">
                        <Repeat size={20} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-k-text-primary mb-1">Planos recorrentes</h3>
                    <p className="text-xs text-k-text-secondary leading-relaxed">
                        Mensal, trimestral ou anual. A cobrança roda sozinha — você não precisa lembrar.
                    </p>
                </div>

                <div className="rounded-2xl bg-surface-card border border-k-border-primary p-5 text-left">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/10 mb-3">
                        <Heart size={20} className="text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-k-text-primary mb-1">Cortesia</h3>
                    <p className="text-xs text-k-text-secondary leading-relaxed">
                        Libere acesso gratuito pra família, amigos ou parcerias — sem cobrar nada.
                    </p>
                </div>
            </div>

            <button
                onClick={onNext}
                className="inline-flex items-center gap-2 px-8 py-3 text-sm font-medium rounded-control bg-primary hover:opacity-90 text-primary-foreground transition-colors shadow-lg shadow-violet-500/20"
            >
                Começar
                <ArrowRight size={16} />
            </button>
        </div>
    )
}

function StepActivateWallet({
    onSkip,
    onBack,
}: {
    onSkip: () => void
    onBack: () => void
}) {
    const router = useRouter()
    const [navigating, setNavigating] = useState(false)

    function goToWallet() {
        setNavigating(true)
        router.push('/financial/wallet')
    }

    return (
        <div className="text-center">
            <h2 className="text-2xl font-bold text-k-text-primary mb-3">
                Ative sua Carteira Kinevo
            </h2>
            <p className="text-k-text-secondary mb-8 max-w-lg mx-auto">
                Pra cobrar seus alunos via PIX ou Cartão direto no app. Sem mensalidade,
                sem taxa de saque. Você pode pular essa etapa e ativar depois.
            </p>

            <div className="rounded-2xl bg-surface-card border border-k-border-primary p-8 mb-8 max-w-md mx-auto">
                <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-violet-500/10 mx-auto mb-4">
                    <Sparkles size={24} className="text-violet-600 dark:text-violet-400" />
                </div>
                <h3 className="text-base font-semibold text-k-text-primary mb-2">
                    Em parceria com a Asaas
                </h3>
                <p className="text-sm text-k-text-secondary mb-5">
                    Empresa brasileira regulada pelo Banco Central. A gente cuida da
                    configuração — você só preenche seus dados e em pouco tempo já tá
                    recebendo.
                </p>

                <ul className="text-xs text-k-text-secondary text-left space-y-2 mb-6">
                    <li className="flex gap-2"><Check size={14} className="text-emerald-600 shrink-0 mt-0.5" /> Recebe PIX e Cartão</li>
                    <li className="flex gap-2"><Check size={14} className="text-emerald-600 shrink-0 mt-0.5" /> Saque PIX sem taxa, na hora</li>
                    <li className="flex gap-2"><Check size={14} className="text-emerald-600 shrink-0 mt-0.5" /> Já tem conta Asaas? Vincula em 2 minutos</li>
                </ul>

                <button
                    onClick={goToWallet}
                    disabled={navigating}
                    className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium rounded-control bg-primary hover:opacity-90 text-primary-foreground transition-colors disabled:opacity-50"
                >
                    {navigating ? (
                        <Loader2 size={16} className="animate-spin" />
                    ) : (
                        <Wallet size={16} />
                    )}
                    Ativar Carteira
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
                    Configurar depois
                </button>
            </div>

            <p className="text-xs text-k-text-secondary/60 mt-6">
                Você pode ativar a Carteira a qualquer momento na aba Financeiro.
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
            const { createPlan } = await import('@/actions/financial/create-plan')
            const result = await createPlan({
                title: title.trim(),
                price: priceNum,
                interval,
                description: '',
                visibility: 'public',
                // Carteira Kinevo é a forma padrão — Stripe legacy não é mais oferecido
                // a novos treinadores no onboarding. O plano fica salvo e fica disponível
                // pra cobrança assim que a Carteira for ativada.
                hasStripeConnect: false,
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
                Defina o valor que você cobra. Você pode ajustar tudo depois — taxas,
                métodos de pagamento (PIX/Cartão), descrição e mais.
            </p>

            <div className="rounded-2xl bg-surface-card border border-k-border-primary p-6 max-w-md mx-auto text-left">
                {error && (
                    <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-600 dark:text-red-400">
                        {error}
                    </div>
                )}

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-k-text-secondary mb-1.5">
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
                        <label className="block text-xs font-medium text-k-text-secondary mb-1.5">
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
                        <label className="block text-xs font-medium text-k-text-secondary mb-1.5">
                            Recorrência
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
                    className="w-full mt-6 inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium rounded-control bg-primary hover:opacity-90 text-primary-foreground transition-colors disabled:opacity-50"
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
