'use client'

import { useEffect, useState } from 'react'
import { Brain, Loader2 } from 'lucide-react'

// ============================================================================
// Props
// ============================================================================

interface GenerationStatusProps {
    studentName: string
}

// ============================================================================
// Component
// ============================================================================

const STEPS = [
    'Analisando perfil do aluno...',
    'Consultando regras de prescrição...',
    'Montando estrutura do programa...',
    'Selecionando exercícios...',
    'Validando volume e restrições...',
    'Finalizando programa...',
]

export function GenerationStatus({ studentName }: GenerationStatusProps) {
    const [currentStep, setCurrentStep] = useState(0)

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentStep(prev => (prev < STEPS.length - 1 ? prev + 1 : prev))
        }, 2500)
        return () => clearInterval(interval)
    }, [])

    return (
        <div className="bg-glass-bg backdrop-blur-md rounded-2xl border border-k-border-primary p-8">
            <div className="flex flex-col items-center text-center space-y-6">
                {/* Animated icon */}
                <div className="relative">
                    <div className="w-16 h-16 rounded-2xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center">
                        <Brain className="w-8 h-8 text-violet-400" />
                    </div>
                    <div className="absolute -top-1 -right-1">
                        <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
                    </div>
                </div>

                {/* Title */}
                <div>
                    <h2 className="text-lg font-bold text-k-text-primary">
                        Gerando programa para {studentName}
                    </h2>
                    <p className="text-sm text-k-text-tertiary mt-1">
                        Isso pode levar alguns segundos...
                    </p>
                </div>

                {/* Steps */}
                <div className="w-full max-w-sm space-y-2">
                    {STEPS.map((step, i) => (
                        <div
                            key={i}
                            className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-all duration-500 ${
                                i < currentStep
                                    ? 'opacity-50'
                                    : i === currentStep
                                        ? 'bg-violet-500/10 border border-violet-500/20'
                                        : 'opacity-20'
                            }`}
                        >
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors duration-500 ${
                                i < currentStep
                                    ? 'bg-emerald-400'
                                    : i === currentStep
                                        ? 'bg-violet-400 animate-pulse'
                                        : 'bg-k-text-quaternary'
                            }`} />
                            <span className={`text-sm ${
                                i === currentStep ? 'text-violet-300 font-medium' : 'text-k-text-tertiary'
                            }`}>
                                {step}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
