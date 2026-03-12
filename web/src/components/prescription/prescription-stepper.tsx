'use client'

import { Check, Settings2, Brain, Dumbbell } from 'lucide-react'

// ============================================================================
// Props
// ============================================================================

interface PrescriptionStepperProps {
    currentStep: 1 | 2 | 3
    className?: string
}

// ============================================================================
// Steps config
// ============================================================================

const STEPS = [
    { label: 'Configurar', icon: Settings2 },
    { label: 'Refinar', icon: Brain },
    { label: 'Programa', icon: Dumbbell },
] as const

// ============================================================================
// Component
// ============================================================================

export function PrescriptionStepper({ currentStep, className = '' }: PrescriptionStepperProps) {
    return (
        <div className={`max-w-md mx-auto ${className}`}>
            <div className="flex items-center">
                {STEPS.map((step, i) => {
                    const stepNumber = (i + 1) as 1 | 2 | 3
                    const isCompleted = stepNumber < currentStep
                    const isActive = stepNumber === currentStep
                    const Icon = step.icon

                    return (
                        <div key={step.label} className="flex items-center flex-1 last:flex-initial">
                            {/* Step circle + label */}
                            <div className="flex flex-col items-center gap-1.5">
                                <div
                                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                                        isCompleted
                                            ? 'bg-emerald-500 text-white'
                                            : isActive
                                                ? 'border-2 border-violet-500 text-violet-500 bg-violet-500/10'
                                                : 'bg-glass-bg text-k-text-quaternary border border-k-border-subtle'
                                    }`}
                                >
                                    {isCompleted ? (
                                        <Check className="w-5 h-5" />
                                    ) : (
                                        <Icon className="w-5 h-5" />
                                    )}

                                    {/* Active ring pulse */}
                                    {isActive && (
                                        <span className="absolute w-10 h-10 rounded-full border-2 border-violet-400 animate-ping opacity-20" />
                                    )}
                                </div>
                                <span
                                    className={`text-xs text-center transition-all duration-300 hidden sm:block ${
                                        isActive
                                            ? 'font-semibold text-k-text-primary'
                                            : isCompleted
                                                ? 'text-emerald-500 font-medium'
                                                : 'text-k-text-quaternary'
                                    }`}
                                >
                                    {step.label}
                                </span>
                            </div>

                            {/* Connector line (not after last step) */}
                            {i < STEPS.length - 1 && (
                                <div
                                    className={`flex-1 h-0.5 mx-2 rounded-full transition-all duration-300 ${
                                        stepNumber < currentStep
                                            ? 'bg-emerald-500'
                                            : 'bg-k-border-subtle border-dashed border-t border-k-border-subtle h-0'
                                    }`}
                                />
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
