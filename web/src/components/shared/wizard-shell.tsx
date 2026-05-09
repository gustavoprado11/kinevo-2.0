'use client'

import { useEffect, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Image from 'next/image'
import { X } from 'lucide-react'
import { Z } from '@/lib/z-index'

interface WizardShellProps {
    open: boolean
    /** Disparado quando user pede pra fechar (X / backdrop / Esc).
     *  O caller decide se mostra confirmação (via isDirty + diálogo próprio)
     *  ou fecha imediatamente. */
    onRequestClose: () => void
    /** Nome do aluno mostrado no header. */
    studentName: string
    /** Avatar URL opcional. */
    studentAvatar?: string | null
    /** Step atual (1-indexed). */
    currentStep: number
    /** Total de steps do wizard (default 2). */
    totalSteps?: number
    /** Conteúdo do step (controlado pelo caller). */
    children: ReactNode
    /** Footer com botões (Voltar/Pular/Próximo/Finalizar). */
    footer?: ReactNode
}

// M9 — sheet slide-in da direita compartilhado por wizards multi-step.
// Lifecycle distinto do <ModalShell> (centered fade): sheet 480px desktop /
// 100vw mobile, slide-in horizontal, sem confirmação interna (caller decide).
export function WizardShell({
    open,
    onRequestClose,
    studentName,
    studentAvatar,
    currentStep,
    totalSteps = 2,
    children,
    footer,
}: WizardShellProps) {
    useEffect(() => {
        if (!open) return
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onRequestClose()
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [open, onRequestClose])

    const initials = studentName
        ?.split(' ')
        .slice(0, 2)
        .map(w => w[0])
        .join('')
        .toUpperCase() || '?'

    return (
        <AnimatePresence>
            {open && (
                <>
                    <motion.div
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
                        style={{ zIndex: Z.MODAL }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onRequestClose}
                    />
                    <motion.aside
                        role="dialog"
                        aria-modal="true"
                        aria-label={`Onboarding de ${studentName}`}
                        className="fixed right-0 top-0 flex h-full w-full max-w-[480px] flex-col bg-surface-card shadow-2xl"
                        style={{ zIndex: Z.MODAL + 1 }}
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 30, stiffness: 280 }}
                    >
                        {/* Header */}
                        <header className="flex items-center gap-3 border-b border-k-border-subtle px-5 py-4">
                            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-k-border-subtle bg-surface-inset">
                                {studentAvatar ? (
                                    <Image
                                        src={studentAvatar}
                                        alt=""
                                        width={36}
                                        height={36}
                                        className="h-9 w-9 rounded-full object-cover"
                                        unoptimized
                                    />
                                ) : (
                                    <span className="text-xs font-bold text-k-text-secondary">{initials}</span>
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-semibold text-k-text-primary">
                                    {studentName}
                                </div>
                                <div className="truncate text-[11px] text-k-text-tertiary">
                                    Onboarding · Step {currentStep} de {totalSteps}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={onRequestClose}
                                aria-label="Fechar"
                                className="rounded-md p-1 text-k-text-tertiary hover:bg-surface-inset hover:text-k-text-primary"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </header>

                        {/* Step indicator */}
                        <div className="flex gap-1.5 border-b border-k-border-subtle px-5 py-3">
                            {Array.from({ length: totalSteps }).map((_, i) => {
                                const isActive = i + 1 === currentStep
                                const isDone = i + 1 < currentStep
                                return (
                                    <span
                                        key={i}
                                        className={`h-1 flex-1 rounded-full transition-colors ${
                                            isActive
                                                ? 'bg-violet-500'
                                                : isDone
                                                    ? 'bg-violet-500/60'
                                                    : 'bg-k-border-subtle'
                                        }`}
                                    />
                                )
                            })}
                        </div>

                        {/* Body */}
                        <div className="min-h-0 flex-1 overflow-y-auto p-5">
                            {children}
                        </div>

                        {/* Footer */}
                        {footer && (
                            <div className="border-t border-k-border-subtle bg-surface-card px-5 py-4">
                                {footer}
                            </div>
                        )}
                    </motion.aside>
                </>
            )}
        </AnimatePresence>
    )
}
