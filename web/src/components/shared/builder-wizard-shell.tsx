'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { ArrowLeft, Check, Loader2, Save } from 'lucide-react'

export interface BuilderWizardShellProps {
    /** Texto principal do header (título do template em edição ou "Novo template"). */
    title: string
    /** Subtítulo opcional (versão, "Editando", etc.). */
    subtitle?: string | null
    /** Step ativo (1, 2 ou 3). */
    currentStep: 1 | 2 | 3
    /** Labels dos 3 steps. Default: ['Tipo', 'Configurar', 'Editor']. */
    stepLabels?: [string, string, string]
    /**
     * Quando true, esconde o progress indicator. Usado em edit mode
     * (entra direto no Step 3 e os Steps 1+2 não fazem sentido visualmente).
     */
    hideStepIndicator?: boolean
    /** Indica que existem alterações não salvas. */
    isDirty?: boolean
    /** Render do botão Salvar mostra spinner + desabilita ações. */
    isSaving?: boolean
    /** Habilita botão Próximo (Steps 1 e 2) quando true. */
    canAdvance?: boolean
    /** Habilita botão Salvar (Step 3) quando true. */
    canSave?: boolean
    /** Disparado ao clicar Próximo (Steps 1 e 2). Caller decide o avanço de step. */
    onAdvance?: () => void
    /** Disparado ao clicar Voltar. Steps 1: navega pra exit (com confirmação se dirty). Steps 2+: caller decide voltar 1 step. */
    onBack?: () => void
    /** Disparado ao clicar Salvar (Step 3). */
    onSave?: () => void | Promise<void>
    /** Disparado quando user pede saída (header voltar). Shell mostra modal "Sair sem salvar?" se dirty. */
    onExit: () => void
    /** Conteúdo extra no header, após o título (ex.: TourHelpButton). */
    headerExtra?: ReactNode
    /** Conteúdo do step ativo. */
    children: ReactNode
}

const DEFAULT_STEP_LABELS: [string, string, string] = ['Tipo', 'Configurar', 'Editor']

// M16 — wizard shell compartilhado pelos builders de Form e Assessment.
// 3-step progress horizontal + footer Cancelar/Próximo/Salvar.
// Caller controla state machine (step, validations); shell só renderiza chrome.
//
// beforeunload guard, modal "Sair sem salvar?" e exit confirmation são
// preservados (mesmo pattern do BuilderShell M8/D2).
export function BuilderWizardShell({
    title,
    subtitle,
    currentStep,
    stepLabels = DEFAULT_STEP_LABELS,
    hideStepIndicator = false,
    isDirty = false,
    isSaving = false,
    canAdvance = true,
    canSave = false,
    onAdvance,
    onBack,
    onSave,
    onExit,
    headerExtra,
    children,
}: BuilderWizardShellProps) {
    const [confirmExitOpen, setConfirmExitOpen] = useState(false)

    const requestExit = () => {
        if (isDirty) {
            setConfirmExitOpen(true)
        } else {
            onExit()
        }
    }

    // beforeunload guard — protege F5/fechar aba quando dirty.
    useEffect(() => {
        if (!isDirty) return
        const handler = (e: BeforeUnloadEvent) => {
            e.preventDefault()
            e.returnValue = ''
        }
        window.addEventListener('beforeunload', handler)
        return () => window.removeEventListener('beforeunload', handler)
    }, [isDirty])

    const isLastStep = currentStep === 3
    const statusLabel = isSaving
        ? 'Salvando...'
        : isDirty
            ? 'Alterações não salvas'
            : null

    return (
        <div className="flex min-h-[calc(100vh-8rem)] flex-col">
            {/* Header */}
            <div className="mb-4 flex items-center gap-3 rounded-2xl border border-k-border-subtle bg-surface-card px-4 py-3">
                <button
                    type="button"
                    onClick={requestExit}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-k-text-secondary hover:bg-surface-inset"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar
                </button>
                <div className="min-w-0 flex-1">
                    <div className="truncate text-base font-semibold text-k-text-primary">
                        {title || 'Sem título'}
                    </div>
                    {subtitle && (
                        <div className="mt-0.5 truncate text-xs text-k-text-tertiary">
                            {subtitle}
                        </div>
                    )}
                </div>
                {headerExtra}
                {statusLabel && (
                    <span className="text-[11px] text-k-text-tertiary whitespace-nowrap">
                        {statusLabel}
                    </span>
                )}
            </div>

            {/* Step indicator */}
            {!hideStepIndicator && (
                <div className="mb-6 flex items-center justify-center gap-3">
                    {stepLabels.map((label, i) => {
                        const stepNum = (i + 1) as 1 | 2 | 3
                        const isCompleted = stepNum < currentStep
                        const isActive = stepNum === currentStep
                        return (
                            <div key={label} className="flex items-center gap-2">
                                <div
                                    className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold transition-all duration-300 ${
                                        isCompleted
                                            ? 'bg-[#34C759] text-white dark:bg-emerald-500'
                                            : isActive
                                                ? 'bg-[#7C3AED] text-white dark:bg-violet-600'
                                                : 'bg-[#E8E8ED] text-[#AEAEB2] dark:bg-surface-elevated dark:text-k-text-quaternary'
                                    }`}
                                >
                                    {isCompleted ? <Check size={12} /> : stepNum}
                                </div>
                                <span className={`text-xs font-medium transition-colors ${
                                    isCompleted || isActive
                                        ? 'text-[#1D1D1F] dark:text-k-text-primary'
                                        : 'text-[#AEAEB2] dark:text-k-text-quaternary'
                                }`}>
                                    {label}
                                </span>
                                {i < stepLabels.length - 1 && (
                                    <div className={`w-8 h-px ml-1 ${isCompleted ? 'bg-[#7C3AED] dark:bg-emerald-500' : 'bg-[#E8E8ED] dark:bg-surface-elevated'}`} />
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Content */}
            <div className="flex min-h-0 flex-1 flex-col">{children}</div>

            {/* Footer — só aparece se houver onAdvance ou onSave (steps com nav) */}
            {(onAdvance || onSave) && (
                <div className="mt-6 flex items-center justify-between">
                    <button
                        type="button"
                        onClick={() => {
                            if (currentStep === 1 || !onBack) {
                                requestExit()
                            } else {
                                onBack()
                            }
                        }}
                        className="rounded-lg border border-k-border-primary bg-transparent px-4 py-2 text-sm font-medium text-k-text-secondary hover:bg-surface-inset"
                    >
                        {currentStep === 1 ? 'Cancelar' : 'Voltar'}
                    </button>
                    {isLastStep ? (
                        <button
                            type="button"
                            onClick={() => { void onSave?.() }}
                            disabled={!canSave || isSaving}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#7C3AED] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#6D28D9] disabled:cursor-not-allowed disabled:opacity-40 dark:bg-violet-600 dark:hover:bg-violet-500"
                        >
                            {isSaving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Save className="h-4 w-4" />
                            )}
                            Salvar
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={onAdvance}
                            disabled={!canAdvance}
                            className="rounded-lg bg-[#7C3AED] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#6D28D9] disabled:cursor-not-allowed disabled:opacity-40 dark:bg-violet-600 dark:hover:bg-violet-500"
                        >
                            Próximo
                        </button>
                    )}
                </div>
            )}

            {/* Confirm exit modal */}
            {confirmExitOpen && (
                <div
                    className="fixed inset-0 z-modal flex items-center justify-center bg-black/60 backdrop-blur-sm"
                    onClick={() => setConfirmExitOpen(false)}
                >
                    <div
                        className="w-full max-w-md rounded-2xl border border-k-border-subtle bg-surface-card p-6 shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    >
                        <h3 className="text-base font-semibold text-k-text-primary">
                            Sair sem salvar?
                        </h3>
                        <p className="mt-2 text-sm text-k-text-tertiary">
                            Você tem alterações não salvas. Se sair agora elas serão perdidas.
                        </p>
                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setConfirmExitOpen(false)}
                                className="rounded-lg border border-k-border-primary bg-transparent px-3 py-1.5 text-sm font-medium text-k-text-secondary hover:bg-surface-inset"
                            >
                                Continuar editando
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setConfirmExitOpen(false)
                                    onExit()
                                }}
                                className="rounded-lg bg-red-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-600"
                            >
                                Sair sem salvar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
