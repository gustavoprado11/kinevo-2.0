'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Loader2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { resetPrescriptionPreferences } from '@/actions/trainer/reset-prescription-preferences'
import { useToast } from '@/components/ui/toast'
import { track } from '@/lib/analytics'
import { Z } from '@/lib/z-index'
import { usePrescriptionPreferencesStore } from '@/stores/prescription-preferences-store'
import { KINEVO_DEFAULT_PREFERENCES } from '@/types/prescription-preferences'
import { AddExerciseSection } from './sections/add-exercise-section'
import { AiSection } from './sections/ai-section'
import { ProgramStructureSection } from './sections/program-structure-section'
import { QuickBlocksSection } from './sections/quick-blocks-section'
import { SetDefaultsSection } from './sections/set-defaults-section'
import { VisualizationSection } from './sections/visualization-section'

interface PreferencesDrawerProps {
    /**
     * Ref do botão da engrenagem que abriu o drawer. Ao fechar, devolve foco
     * pra esse botão (a11y). Pode ser null se o drawer foi aberto programaticamente.
     */
    triggerRef?: React.RefObject<HTMLButtonElement | null>
}

/**
 * Drawer de preferências de prescrição. 380px slide-in pela direita, com
 * 6 sections colapsáveis e rodapé fixo (Refazer onboarding + Restaurar padrões).
 */
export function PreferencesDrawer({ triggerRef }: PreferencesDrawerProps) {
    const isOpen = usePrescriptionPreferencesStore((s) => s.isDrawerOpen)
    const closeDrawer = usePrescriptionPreferencesStore((s) => s.closeDrawer)
    const openWizard = usePrescriptionPreferencesStore((s) => s.openWizard)
    const closeButtonRef = useRef<HTMLButtonElement | null>(null)
    const { toast } = useToast()
    const [isResetting, setIsResetting] = useState(false)

    const handleReset = async () => {
        if (isResetting) return
        track('prescription_preferences_reset')
        const confirmed = window.confirm(
            'Restaurar todos os campos para os padrões da Kinevo? Sua resposta do onboarding não será afetada.',
        )
        if (!confirmed) return

        const previous = usePrescriptionPreferencesStore.getState().preferences
        usePrescriptionPreferencesStore.getState().setPreferences({
            ...KINEVO_DEFAULT_PREFERENCES,
            wizard_completed: previous.wizard_completed,
            wizard_dismissed: previous.wizard_dismissed,
        })
        setIsResetting(true)
        try {
            const result = await resetPrescriptionPreferences()
            if (!result.success) {
                usePrescriptionPreferencesStore.getState().rollback(previous)
                toast({ type: 'error', message: result.message ?? 'Não foi possível restaurar os padrões.' })
                return
            }
            usePrescriptionPreferencesStore.getState().setPreferences(result.preferences)
            toast({ message: 'Padrões restaurados' })
        } finally {
            setIsResetting(false)
        }
    }

    // ESC fecha + foco gerenciado.
    useEffect(() => {
        if (!isOpen) return

        // Snapshot do gatilho no momento da abertura — usado no cleanup para
        // devolver foco. Evita ler `triggerRef.current` mutável dentro do cleanup.
        const triggerNode = triggerRef?.current ?? null

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.stopPropagation()
                closeDrawer()
            }
        }
        window.addEventListener('keydown', onKeyDown)

        // Foco no botão de fechar ao abrir (após a animação iniciar).
        const focusTimer = setTimeout(() => {
            closeButtonRef.current?.focus()
        }, 50)

        return () => {
            window.removeEventListener('keydown', onKeyDown)
            clearTimeout(focusTimer)
            // Devolve foco pro gatilho ao fechar.
            triggerNode?.focus()
        }
    }, [isOpen, closeDrawer, triggerRef])

    return (
        <AnimatePresence>
            {isOpen && (
                <div
                    className="fixed inset-0"
                    style={{ zIndex: Z.DRAWER }}
                >
                    {/* Overlay — clique fora fecha */}
                    <motion.div
                        onClick={closeDrawer}
                        className="absolute inset-0 bg-black/40"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                    />

                    {/* Drawer container */}
                    <motion.aside
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="preferences-drawer-title"
                        onClick={(e) => e.stopPropagation()}
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'tween', duration: 0.2 }}
                        className="absolute top-0 right-0 h-full w-[380px] bg-surface-card border-l border-k-border-primary flex flex-col shadow-2xl"
                    >
                        {/* Header */}
                        <header className="flex items-start justify-between px-4 py-3 border-b border-k-border-subtle">
                            <div className="flex flex-col gap-0.5">
                                <h2 id="preferences-drawer-title" className="text-base font-medium text-k-text-primary">Preferências</h2>
                                <p className="text-xs text-k-text-tertiary">Aplicam apenas em novos treinos</p>
                            </div>
                            <button
                                ref={closeButtonRef}
                                onClick={closeDrawer}
                                aria-label="Fechar preferências"
                                className="w-8 h-8 flex items-center justify-center rounded-lg text-k-text-tertiary hover:bg-glass-bg/50 hover:text-k-text-primary transition-colors duration-150"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </header>

                        {/* Body — sections colapsáveis (ordem da spec literal) */}
                        <div className="flex-1 overflow-y-auto">
                            <VisualizationSection />
                            <SetDefaultsSection />
                            <AddExerciseSection />
                            <QuickBlocksSection />
                            <ProgramStructureSection />
                            <AiSection />
                        </div>

                        {/* Footer */}
                        <footer className="flex items-center justify-between px-4 py-3 border-t border-k-border-subtle bg-surface-inset">
                            <button
                                type="button"
                                onClick={() => {
                                    track('prescription_preferences_wizard_started', { source: 'redo_link' })
                                    closeDrawer()
                                    openWizard()
                                }}
                                className="text-sm text-violet-600 dark:text-violet-400 hover:underline"
                            >
                                Refazer onboarding
                            </button>
                            <button
                                onClick={handleReset}
                                disabled={isResetting}
                                className="flex items-center gap-1.5 text-xs text-k-text-tertiary px-3 py-1.5 rounded-lg border border-k-border-primary hover:bg-surface-card hover:text-k-text-primary transition-colors duration-150 disabled:opacity-50 disabled:cursor-wait"
                            >
                                {isResetting && <Loader2 className="w-3 h-3 animate-spin" aria-hidden />}
                                Restaurar padrões
                            </button>
                        </footer>
                    </motion.aside>
                </div>
            )}
        </AnimatePresence>
    )
}
