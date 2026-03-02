'use client'

import { useState, useEffect } from 'react'
import { Lightbulb, X, ExternalLink } from 'lucide-react'

const STORAGE_KEY = 'kinevo_financial_onboarding_dismissed'

interface FinancialOnboardingBannerProps {
    courtesyCount: number
    hasStripeConnect: boolean
    onConfigureStripe?: () => void
}

export function FinancialOnboardingBanner({
    courtesyCount,
    hasStripeConnect,
    onConfigureStripe,
}: FinancialOnboardingBannerProps) {
    const [dismissed, setDismissed] = useState(true) // default hidden to avoid flash

    useEffect(() => {
        setDismissed(localStorage.getItem(STORAGE_KEY) === 'true')
    }, [])

    if (dismissed) return null

    const handleDismiss = () => {
        localStorage.setItem(STORAGE_KEY, 'true')
        setDismissed(true)
    }

    const handleConfigureStripe = () => {
        if (hasStripeConnect) {
            handleDismiss()
            // scroll to student list
            const list = document.querySelector('[data-student-list]')
            if (list) list.scrollIntoView({ behavior: 'smooth' })
        } else if (onConfigureStripe) {
            onConfigureStripe()
        } else {
            window.location.href = '/api/stripe/connect/onboard'
        }
    }

    return (
        <div className="relative rounded-2xl border border-violet-500/20 bg-gradient-to-r from-violet-500/5 via-violet-500/10 to-blue-500/5 p-6">
            <button
                onClick={handleDismiss}
                className="absolute top-4 right-4 h-6 w-6 flex items-center justify-center text-k-text-quaternary hover:text-k-text-secondary rounded-full hover:bg-glass-bg transition-colors"
            >
                <X size={14} />
            </button>

            <div className="flex items-start gap-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-violet-500/10 flex-shrink-0">
                    <Lightbulb size={20} className="text-violet-400" />
                </div>
                <div className="flex-1 pr-6">
                    <h3 className="text-sm font-semibold text-k-text-primary mb-1">
                        Seus alunos já estão aqui
                    </h3>
                    <p className="text-xs text-k-text-secondary leading-relaxed mb-4">
                        {courtesyCount > 0
                            ? `${courtesyCount} aluno${courtesyCount > 1 ? 's' : ''} cadastrado${courtesyCount > 1 ? 's' : ''} aparece${courtesyCount > 1 ? 'm' : ''} automaticamente como cortesia. `
                            : 'Seus alunos aparecem automaticamente como cortesia. '}
                        Você decide se e como cobrar cada um deles.
                        Quer cobrar via Stripe (automático) ou controlar manualmente?
                        Clique em qualquer aluno para configurar.
                    </p>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleDismiss}
                            className="px-4 py-2 text-xs font-medium text-k-text-secondary hover:text-k-text-primary border border-k-border-primary hover:bg-glass-bg rounded-lg transition-all"
                        >
                            Entendi, vou explorar
                        </button>
                        <button
                            onClick={handleConfigureStripe}
                            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-all active:scale-95"
                        >
                            {hasStripeConnect ? (
                                'Ver alunos'
                            ) : (
                                <>
                                    <ExternalLink size={12} />
                                    Configurar Stripe agora
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
