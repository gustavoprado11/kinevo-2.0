'use client'

import { useEffect, useState, useRef } from 'react'
import { Brain, Check, Sparkles } from 'lucide-react'

// ============================================================================
// Props
// ============================================================================

interface GenerationStatusProps {
    studentName: string
    phase?: 'analyzing' | 'generating'
}

// ============================================================================
// Steps
// ============================================================================

const GENERATION_STEPS = [
    'Montando estrutura do programa...',
    'Selecionando exercícios...',
    'Calculando volume e progressão...',
    'Validando restrições...',
    'Revisando programa final...',
]

const ANALYSIS_STEPS = [
    'Analisando histórico de treinos...',
    'Comparando com programas anteriores...',
    'Verificando progressão de cargas...',
    'Pesquisando evidências científicas...',
    'Identificando lacunas no perfil...',
]

/** Rotating messages shown while waiting on the last step */
const THINKING_MESSAGES = [
    'A IA está raciocinando sobre a melhor combinação...',
    'Avaliando equilíbrio entre grupos musculares...',
    'Verificando compatibilidade dos exercícios...',
    'Refinando a seleção de substitutos...',
    'Quase lá, ajustando os últimos detalhes...',
    'Otimizando distribuição de volume...',
]

// ============================================================================
// Component
// ============================================================================

export function GenerationStatus({ studentName, phase = 'generating' }: GenerationStatusProps) {
    const STEPS = phase === 'analyzing' ? ANALYSIS_STEPS : GENERATION_STEPS
    const [currentStep, setCurrentStep] = useState(0)
    const [elapsedSeconds, setElapsedSeconds] = useState(0)
    const [thinkingIdx, setThinkingIdx] = useState(0)
    const startTime = useRef(Date.now())

    const isLastStep = currentStep >= STEPS.length - 1

    // Reset on phase change
    useEffect(() => {
        setCurrentStep(0)
        setElapsedSeconds(0)
        setThinkingIdx(0)
        startTime.current = Date.now()
    }, [phase])

    // Step progression
    useEffect(() => {
        const stepCount = STEPS.length
        const interval = setInterval(() => {
            setCurrentStep(prev => (prev < stepCount - 1 ? prev + 1 : prev))
        }, 2800)
        return () => clearInterval(interval)
    }, [STEPS.length])

    // Elapsed timer
    useEffect(() => {
        const interval = setInterval(() => {
            setElapsedSeconds(Math.floor((Date.now() - startTime.current) / 1000))
        }, 1000)
        return () => clearInterval(interval)
    }, [])

    // Rotate thinking messages when stuck on last step
    useEffect(() => {
        if (!isLastStep) return
        const interval = setInterval(() => {
            setThinkingIdx(prev => (prev + 1) % THINKING_MESSAGES.length)
        }, 4000)
        return () => clearInterval(interval)
    }, [isLastStep])

    const progress = Math.min(((currentStep + 1) / STEPS.length) * 100, 100)

    return (
        <div className="bg-gradient-to-b from-white to-gray-50 dark:from-glass-bg dark:to-glass-bg rounded-2xl border border-gray-200 dark:border-k-border-primary shadow-sm p-8 overflow-hidden">
            <div className="flex flex-col items-center text-center space-y-6">
                {/* Animated brain icon */}
                <div className="relative">
                    <div className="w-16 h-16 rounded-2xl bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/30 flex items-center justify-center">
                        <Brain className="w-8 h-8 text-violet-500 animate-[pulse-subtle_2s_ease-in-out_infinite]" />
                    </div>
                    {/* Orbiting sparkle */}
                    <div className="absolute -top-1 -right-1 animate-[spin_3s_linear_infinite]">
                        <Sparkles className="w-5 h-5 text-violet-400" />
                    </div>
                    {/* Ripple rings */}
                    <div className="absolute inset-0 rounded-2xl border-2 border-violet-300/40 animate-[ripple_2s_ease-out_infinite]" />
                    <div className="absolute inset-0 rounded-2xl border-2 border-violet-300/20 animate-[ripple_2s_ease-out_infinite_0.8s]" />
                    {/* Radar ping behind */}
                    <div className="absolute inset-0 rounded-2xl bg-violet-400/10 animate-ping" style={{ animationDuration: '3s' }} />
                </div>

                {/* Title */}
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-k-text-primary">
                        {phase === 'analyzing'
                            ? `Analisando contexto de ${studentName}`
                            : `Gerando programa para ${studentName}`
                        }
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-k-text-tertiary mt-1">
                        {phase === 'analyzing'
                            ? 'Analisando histórico e pesquisando evidências...'
                            : 'Isso costuma levar 15-30 segundos'
                        }
                    </p>
                </div>

                {/* Progress bar */}
                <div className="w-full max-w-sm">
                    <div className="h-1.5 rounded-full bg-gray-100 dark:bg-white/5 overflow-hidden">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-violet-400 to-violet-600 transition-all duration-1000 ease-out relative"
                            style={{ width: `${progress}%` }}
                        >
                            {/* Shimmer effect */}
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[shimmer_2s_linear_infinite]" />
                        </div>
                    </div>
                </div>

                {/* Steps */}
                <div className="w-full max-w-sm space-y-1">
                    {STEPS.map((step, i) => {
                        const isCompleted = i < currentStep
                        const isCurrent = i === currentStep
                        const isPending = i > currentStep

                        return (
                            <div
                                key={i}
                                className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-all duration-500 ${
                                    isCurrent
                                        ? 'bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/30'
                                        : isCompleted
                                            ? 'opacity-60'
                                            : 'opacity-0 h-0 py-0 overflow-hidden'
                                }`}
                                style={isPending ? { transition: 'all 0.5s ease-out' } : undefined}
                            >
                                {/* Step indicator */}
                                <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                                    {isCompleted ? (
                                        <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                                            <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                        </div>
                                    ) : isCurrent ? (
                                        <div className="w-3 h-3 rounded-full bg-violet-500 animate-[pulse-dot_1.5s_ease-in-out_infinite]" />
                                    ) : (
                                        <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-k-text-quaternary" />
                                    )}
                                </div>

                                <span className={`text-sm transition-colors duration-500 ${
                                    isCurrent
                                        ? 'text-violet-700 dark:text-violet-300 font-medium'
                                        : isCompleted
                                            ? 'text-gray-500 dark:text-k-text-quaternary line-through'
                                            : 'text-gray-400 dark:text-k-text-quaternary'
                                }`}>
                                    {step}
                                </span>
                            </div>
                        )
                    })}
                </div>

                {/* Thinking message — shown when waiting on last step */}
                {isLastStep && (
                    <div className="w-full max-w-sm px-4 animate-[fade-in_0.5s_ease-out]">
                        <p
                            key={thinkingIdx}
                            className="text-xs text-gray-400 dark:text-k-text-quaternary italic text-center animate-[fade-in_0.6s_ease-out]"
                        >
                            {THINKING_MESSAGES[thinkingIdx]}
                        </p>
                    </div>
                )}

                {/* Elapsed time */}
                <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-k-text-quaternary">
                    <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                    <span>{formatElapsed(elapsedSeconds)}</span>
                </div>
            </div>

            {/* Inline keyframes — global style tag (no styled-jsx) */}
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes ripple {
                    0% { transform: scale(1); opacity: 0.5; }
                    100% { transform: scale(1.5); opacity: 0; }
                }
                @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(200%); }
                }
                @keyframes pulse-subtle {
                    0%, 100% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.05); opacity: 0.8; }
                }
                @keyframes pulse-dot {
                    0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.4); }
                    50% { transform: scale(1.15); box-shadow: 0 0 0 6px rgba(139, 92, 246, 0); }
                }
                @keyframes fade-in {
                    from { opacity: 0; transform: translateY(4px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}} />
        </div>
    )
}

// ============================================================================
// Helpers
// ============================================================================

function formatElapsed(seconds: number): string {
    if (seconds < 10) return 'Processando...'
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    if (m === 0) return `${s}s`
    return `${m}min ${s.toString().padStart(2, '0')}s`
}
