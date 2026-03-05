'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Heart, CreditCard, Link2, BellRing, ShieldCheck,
    HandCoins, ChevronRight, ChevronLeft, X
} from 'lucide-react'
import { useOnboardingStore } from '@/stores/onboarding-store'

const TOUR_ID = 'financial_intro'

interface Step {
    title: string
    description: string
    details: string[]
    icon: React.ReactNode
    accent: string     // bg color for icon container
    accentText: string // text color for icon
}

const STEPS: Step[] = [
    {
        title: 'Liberdade total',
        description:
            'Todos os seus alunos começam com acesso gratuito. Você decide individualmente quem cobrar e como.',
        details: [
            'Todo aluno cadastrado aparece como Cortesia automaticamente',
            'Você não precisa cobrar ninguém — o Kinevo funciona sem cobrança',
            'Configure cobrança individual a qualquer momento',
        ],
        icon: <Heart size={24} />,
        accent: 'bg-emerald-500/10',
        accentText: 'text-emerald-600 dark:text-emerald-400',
    },
    {
        title: 'Duas formas de cobrar',
        description:
            'Escolha entre cobrança automática via cartão ou controle manual.',
        details: [
            'Stripe: gere um link, envie ao aluno, renovação automática',
            'Manual: registre pagamentos (Pix, dinheiro) no seu ritmo',
            'Você pode misturar — alguns alunos no Stripe, outros manual',
        ],
        icon: <CreditCard size={24} />,
        accent: 'bg-violet-500/10',
        accentText: 'text-violet-600 dark:text-violet-400',
    },
    {
        title: 'Links de pagamento',
        description: 'Gere links em segundos e envie pelo WhatsApp.',
        details: [
            'Clique em "Configurar" no aluno, escolha Stripe e o plano',
            'Copie o link ou envie direto pelo WhatsApp',
            'O status atualiza automaticamente quando o aluno pagar',
            'Links expiram em 24h — gere um novo se precisar',
        ],
        icon: <Link2 size={24} />,
        accent: 'bg-blue-500/10',
        accentText: 'text-blue-600 dark:text-blue-400',
    },
    {
        title: 'Cancelamento pelo app',
        description:
            'Alunos com Stripe podem cancelar a assinatura pelo próprio app.',
        details: [
            'Você recebe uma notificação imediata quando isso acontecer',
            'O acesso do aluno continua até o fim do período pago',
            'Após o período, o aluno volta para cortesia',
            'Você pode reconfigurar a cobrança quando quiser',
        ],
        icon: <BellRing size={24} />,
        accent: 'bg-amber-500/10',
        accentText: 'text-amber-600 dark:text-amber-400',
    },
    {
        title: 'Controle de inadimplência',
        description:
            'Você decide se o aluno perde acesso aos treinos quando atrasar.',
        details: [
            'Padrão: acesso liberado mesmo com atraso (você resolve no seu tempo)',
            'Opcional: ative "Bloquear se inadimplente" por aluno',
            'Com bloqueio: após 3 dias de atraso, o aluno perde acesso no app',
            'Pagamentos manuais têm 3 dias de graça antes de contar como atraso',
        ],
        icon: <ShieldCheck size={24} />,
        accent: 'bg-red-500/10',
        accentText: 'text-red-600 dark:text-red-400',
    },
]

export function FinancialOnboardingModal() {
    const isHydrated = useOnboardingStore((s) => s.isHydrated)
    const isTourCompleted = useOnboardingStore((s) => s.isTourCompleted)
    const completeTour = useOnboardingStore((s) => s.completeTour)

    const [isOpen, setIsOpen] = useState(false)
    const [currentStep, setCurrentStep] = useState(0)
    const [direction, setDirection] = useState(1) // 1 = forward, -1 = backward

    useEffect(() => {
        if (isHydrated && !isTourCompleted(TOUR_ID)) {
            const timer = setTimeout(() => setIsOpen(true), 500)
            return () => clearTimeout(timer)
        }
    }, [isHydrated, isTourCompleted])

    const handleClose = useCallback(() => {
        setIsOpen(false)
        completeTour(TOUR_ID)
    }, [completeTour])

    const handleNext = () => {
        if (currentStep < STEPS.length - 1) {
            setDirection(1)
            setCurrentStep((s) => s + 1)
        } else {
            handleClose()
        }
    }

    const handlePrev = () => {
        if (currentStep > 0) {
            setDirection(-1)
            setCurrentStep((s) => s - 1)
        }
    }

    const step = STEPS[currentStep]
    const isLast = currentStep === STEPS.length - 1

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                        className="relative bg-surface-card border border-k-border-primary rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden"
                    >
                        {/* Background glow */}
                        <div className="absolute -top-24 -right-24 w-48 h-48 bg-violet-500/10 blur-3xl rounded-full pointer-events-none" />
                        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-500/8 blur-3xl rounded-full pointer-events-none" />

                        {/* Header bar */}
                        <div className="relative flex items-center justify-between px-8 pt-6">
                            <span className="text-[10px] font-semibold text-k-text-quaternary">
                                Como funciona o Financeiro
                            </span>
                            <button
                                onClick={handleClose}
                                className="p-1.5 text-muted-foreground/40 hover:text-foreground rounded-lg transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Step content — animated */}
                        <div className="relative px-8 pt-6 pb-2 min-h-[320px]">
                            <AnimatePresence mode="wait" initial={false}>
                                <motion.div
                                    key={currentStep}
                                    initial={{ opacity: 0, x: direction * 40 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: direction * -40 }}
                                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                                >
                                    {/* Icon */}
                                    <div
                                        className={`w-14 h-14 ${step.accent} rounded-2xl flex items-center justify-center mb-5 border border-white/5`}
                                    >
                                        <span className={step.accentText}>{step.icon}</span>
                                    </div>

                                    {/* Title */}
                                    <h2 className="text-xl font-bold text-foreground tracking-tight mb-2">
                                        {step.title}
                                    </h2>

                                    {/* Description */}
                                    <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                                        {step.description}
                                    </p>

                                    {/* Detail bullets */}
                                    <ul className="space-y-2.5">
                                        {step.details.map((detail, i) => (
                                            <li key={i} className="flex items-start gap-2.5">
                                                <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${step.accent.replace('/10', '/40')}`} />
                                                <span className="text-xs text-k-text-secondary leading-relaxed">
                                                    {detail}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </motion.div>
                            </AnimatePresence>
                        </div>

                        {/* Footer: dots + navigation */}
                        <div className="relative px-8 pb-6 pt-4 flex items-center justify-between">
                            {/* Progress dots */}
                            <div className="flex items-center gap-1.5">
                                {STEPS.map((_, i) => (
                                    <div
                                        key={i}
                                        className={`h-1.5 rounded-full transition-all duration-300 ${
                                            i === currentStep
                                                ? 'w-5 bg-violet-500'
                                                : i < currentStep
                                                    ? 'w-1.5 bg-violet-500/40'
                                                    : 'w-1.5 bg-white/10'
                                        }`}
                                    />
                                ))}
                            </div>

                            {/* Navigation buttons */}
                            <div className="flex items-center gap-2">
                                {currentStep > 0 && (
                                    <button
                                        onClick={handlePrev}
                                        className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-k-text-secondary hover:text-k-text-primary rounded-lg hover:bg-glass-bg transition-colors"
                                    >
                                        <ChevronLeft size={14} />
                                        Anterior
                                    </button>
                                )}
                                {currentStep === 0 && (
                                    <button
                                        onClick={handleClose}
                                        className="px-3 py-2 text-xs font-medium text-k-text-quaternary hover:text-k-text-secondary transition-colors"
                                    >
                                        Pular
                                    </button>
                                )}
                                <button
                                    onClick={handleNext}
                                    className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-xl transition-all active:scale-[0.97] shadow-lg shadow-violet-500/20"
                                >
                                    {isLast ? 'Começar' : 'Próximo'}
                                    {!isLast && <ChevronRight size={14} />}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}
