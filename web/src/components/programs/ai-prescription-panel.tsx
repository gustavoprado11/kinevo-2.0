'use client'

import { useEffect } from 'react'
import { X, Sparkles } from 'lucide-react'
import { TourRunner } from '@/components/onboarding/tours/tour-runner'
import { TOUR_STEPS } from '@/components/onboarding/tours/tour-definitions'

import { usePrescriptionAgent, type PrescriptionAgentPageState } from './ai-prescription-panel/use-prescription-agent'
import { AiPrescriptionPanelStudentTab } from './ai-prescription-panel/student-tab'
import type { PrescriptionData } from '@/actions/prescription/get-prescription-data'

export interface AiPrescriptionPanelProps {
    open: boolean
    studentId: string
    studentName: string
    prescriptionData: PrescriptionData
    initialPageState?: PrescriptionAgentPageState
    initialGenerationId?: string
    onClose: () => void
    /**
     * Called when the user finishes a fresh generation from the panel and
     * wants the builder to show the generated program (via router.replace
     * to ?source=prescription&generationId=...). Not called for deeplink
     * opens (initialPageState='done').
     */
    onAcceptGeneratedProgram: (generationId: string) => void
}

export function AiPrescriptionPanel({
    open,
    studentId,
    studentName,
    prescriptionData,
    initialPageState,
    initialGenerationId,
    onClose,
    onAcceptGeneratedProgram,
}: AiPrescriptionPanelProps) {
    const agent = usePrescriptionAgent({
        studentId,
        studentName,
        prescriptionData,
        initialPageState,
        initialGenerationId,
    })

    // Close on Escape when no in-flight operation
    useEffect(() => {
        if (!open) return
        function onKey(e: KeyboardEvent) {
            if (e.key === 'Escape' && (agent.pageState === 'anamnese' || agent.pageState === 'done' || agent.pageState === 'error')) {
                onClose()
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [open, onClose, agent.pageState])

    if (!open) return null

    return (
        <>
            {/* Backdrop (click to close when safe). Subtle so the builder canvas
                stays legible while the panel is open — the user needs visual contact
                with the program being filled in on the left. */}
            <div
                className="fixed inset-0 bg-black/15 z-40 animate-in fade-in duration-200"
                onClick={() => {
                    if (agent.pageState === 'anamnese' || agent.pageState === 'done' || agent.pageState === 'error') {
                        onClose()
                    }
                }}
                aria-hidden
            />

            {/* Panel */}
            <aside
                role="dialog"
                aria-label={`IA · ${studentName}`}
                className="fixed top-0 right-0 h-full w-full max-w-[440px] bg-white dark:bg-surface-primary border-l border-k-border-subtle shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200"
                data-testid="ai-prescription-panel"
            >
                {/* Header */}
                <header className="flex-shrink-0 flex items-center gap-3 px-5 h-14 border-b border-k-border-subtle">
                    <Sparkles className="w-5 h-5 text-violet-500 flex-shrink-0" />
                    <h2 className="flex-1 text-sm font-semibold text-k-text-primary truncate">
                        IA · {studentName}
                    </h2>
                    <button
                        onClick={onClose}
                        aria-label="Fechar painel de IA"
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-k-text-quaternary hover:text-k-text-primary hover:bg-glass-bg transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </header>

                {/* Body (only student tab on Fase 1) */}
                <div className="flex-1 min-h-0">
                    <AiPrescriptionPanelStudentTab
                        studentId={studentId}
                        studentName={studentName}
                        prescriptionData={prescriptionData}
                        agent={agent}
                        onClose={onClose}
                        onAcceptGeneratedProgram={onAcceptGeneratedProgram}
                        // True when the panel was opened via deeplink (URL already
                        // carried generationId). The child uses this to skip the
                        // auto-navigation on pageState='done' — navigation already
                        // happened; triggering it again would loop.
                        deeplinkMode={initialPageState === 'done'}
                    />
                </div>
            </aside>

            {/* Tour (lives with the panel now that /prescribe is gone) */}
            <TourRunner tourId="prescribe" steps={TOUR_STEPS.prescribe} autoStart />
        </>
    )
}
