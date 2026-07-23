'use client'

import { useCallback, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Check, AlertCircle } from 'lucide-react'

// M10B — port web do MeasurementWizard mobile. Otimizado pra desktop/tablet
// (decisão 4.4 da spec: mobile responsive é best-effort; trainer 100% mobile
// usa app nativo). Centered card layout em vez de fullscreen.

export interface RangePromptState {
    visible: boolean
    label: string
    value: number
    unit: string
    reason: 'below' | 'above'
    onConfirm: () => void
    onCancel: () => void
}

export interface MeasurementWizardWebProps {
    title: string
    subtitle?: string
    /** Current step index, 0-based. */
    stepIndex: number
    /** Total steps. */
    totalSteps: number
    /** Whether the "next" CTA is enabled. */
    canAdvance: boolean
    onPrev?: () => void
    onNext: () => void
    /** Whether this is the last step (changes "Próximo" to "Concluir"). */
    isLast?: boolean
    /** Optional range prompt — when visible=true, renders a confirm modal. */
    rangePrompt?: RangePromptState
    children: ReactNode
}

/**
 * Container chrome for the wizard: header com título + sub-progress bar,
 * scroll vertical, footer com Voltar/Próximo, e modal de confirmação de range.
 */
export function MeasurementWizardWeb(props: MeasurementWizardWebProps) {
    const {
        title,
        subtitle,
        stepIndex,
        totalSteps,
        canAdvance,
        onPrev,
        onNext,
        isLast,
        rangePrompt,
        children,
    } = props

    const progress = totalSteps > 0 ? Math.min(1, (stepIndex + 1) / totalSteps) : 0

    const handleNext = useCallback(() => {
        if (!canAdvance) return
        onNext()
    }, [canAdvance, onNext])

    return (
        <div className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-2xl flex-col">
            {/* Header */}
            <div className="rounded-t-panel border border-k-border-subtle border-b-0 bg-surface-card px-5 py-4">
                <div className="flex items-center gap-3">
                    {onPrev && (
                        <button
                            type="button"
                            onClick={onPrev}
                            aria-label="Voltar"
                            className="rounded-md p-1.5 text-k-text-secondary hover:bg-surface-inset hover:text-k-text-primary"
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </button>
                    )}
                    <div className="min-w-0 flex-1">
                        <div className="truncate text-base font-bold text-k-text-primary">
                            {title}
                        </div>
                        {subtitle && (
                            <div className="mt-0.5 truncate text-xs text-k-text-tertiary">
                                {subtitle}
                            </div>
                        )}
                    </div>
                    <span className="flex-shrink-0 font-mono text-xs tabular-nums text-k-text-secondary">
                        {stepIndex + 1}/{totalSteps}
                    </span>
                </div>

                {/* Progress bar */}
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface-inset">
                    <div
                        className="h-1 rounded-full bg-k-text-primary transition-all duration-300"
                        style={{ width: `${progress * 100}%` }}
                    />
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto border border-k-border-subtle border-y-0 bg-surface-card p-5">
                {children}
            </div>

            {/* Footer */}
            <div className="rounded-b-panel border border-k-border-subtle border-t bg-surface-card px-5 py-4">
                <button
                    type="button"
                    onClick={handleNext}
                    disabled={!canAdvance}
                    className={`flex w-full items-center justify-center gap-2 rounded-control py-3 text-sm font-semibold transition-colors ${
                        canAdvance
                            ? 'bg-primary text-primary-foreground hover:opacity-90'
                            : 'bg-surface-inset text-k-text-tertiary cursor-not-allowed'
                    }`}
                >
                    {isLast && <Check className="h-4 w-4" />}
                    {isLast ? 'Concluir' : 'Próximo'}
                    {!isLast && <ChevronRight className="h-4 w-4" />}
                </button>
            </div>

            {/* Range warning modal */}
            {rangePrompt?.visible && (
                <div
                    className="fixed inset-0 z-modal flex items-center justify-center bg-black/45 px-6"
                    onClick={rangePrompt.onCancel}
                >
                    <div
                        className="w-full max-w-md rounded-panel border border-k-border-subtle bg-surface-card p-5"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-amber-500" />
                            <h3 className="text-base font-bold text-k-text-primary">
                                Confirmar valor?
                            </h3>
                        </div>
                        <p className="mt-3 text-sm text-k-text-secondary">
                            Você inseriu{' '}
                            <strong className="font-bold text-k-text-primary">
                                {rangePrompt.value} {rangePrompt.unit}
                            </strong>{' '}
                            em {rangePrompt.label}.{' '}
                            {rangePrompt.reason === 'below'
                                ? 'Esse valor parece muito baixo. Quer mesmo continuar?'
                                : 'Esse valor parece muito alto. Quer mesmo continuar?'}
                        </p>
                        <div className="mt-5 flex gap-2">
                            <button
                                type="button"
                                onClick={rangePrompt.onCancel}
                                className="flex-1 rounded-control bg-surface-inset px-4 py-2.5 text-sm font-semibold text-k-text-primary hover:bg-surface-elevated"
                            >
                                Reescrever
                            </button>
                            <button
                                type="button"
                                onClick={rangePrompt.onConfirm}
                                className="flex-1 rounded-control bg-amber-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-600"
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
