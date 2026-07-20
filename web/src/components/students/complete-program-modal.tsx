'use client'

import { useState } from 'react'
import { AlertTriangle, Check, Loader2 } from 'lucide-react'

interface CompleteProgramModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => Promise<void>
    programName: string
}

export function CompleteProgramModal({
    isOpen,
    onClose,
    onConfirm,
    programName
}: CompleteProgramModalProps) {
    const [completing, setCompleting] = useState(false)

    if (!isOpen) return null

    const handleConfirm = async () => {
        setCompleting(true)
        try {
            await onConfirm()
            onClose()
        } catch (error) {
            console.error('Error completing program:', error)
        } finally {
            setCompleting(false)
        }
    }

    return (
        <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-surface-card rounded-panel border border-k-border-primary shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-5 border-b border-k-border-subtle">
                    <h2 className="text-lg font-bold text-k-text-primary">Concluir programa</h2>
                    <p className="text-sm text-k-text-tertiary">Finalizar ciclo de treino</p>
                </div>

                {/* Content */}
                <div className="px-6 py-5">
                    <p className="text-sm text-k-text-secondary mb-3">
                        Você está prestes a concluir o programa:
                    </p>
                    <div className="rounded-control border border-k-border-subtle bg-surface-primary px-4 py-3 mb-4">
                        <span className="text-k-text-primary font-medium text-sm">{programName}</span>
                    </div>
                    <div className="flex items-start gap-2.5 rounded-control border border-k-border-subtle border-l-2 border-l-amber-500 px-3.5 py-3">
                        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-k-text-primary text-sm font-medium">Este programa será movido para o histórico</p>
                            <p className="text-k-text-tertiary text-sm mt-0.5">O aluno não poderá mais executar treinos deste programa no app.</p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-k-border-subtle flex items-center justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={completing}
                        className="px-4 py-2 text-sm text-k-text-tertiary hover:text-k-text-primary transition-colors disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={completing}
                        className="px-5 py-2 bg-primary hover:opacity-90 disabled:opacity-50 text-primary-foreground text-sm font-semibold rounded-control transition-opacity flex items-center gap-2"
                    >
                        {completing ? (
                            <>
                                <Loader2 className="animate-spin w-4 h-4" />
                                Concluindo...
                            </>
                        ) : (
                            <>
                                <Check className="w-4 h-4" />
                                Concluir programa
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
