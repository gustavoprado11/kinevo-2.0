'use client'

import { useState } from 'react'

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
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-gray-800 rounded-2xl border border-gray-700/50 shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                {/* Header */}
                <div className="px-6 py-5 border-b border-gray-700/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-white">Concluir Programa</h2>
                            <p className="text-sm text-gray-400">Finalizar ciclo de treino</p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="px-6 py-5">
                    <p className="text-gray-300 mb-4">
                        Você está prestes a concluir o programa:
                    </p>
                    <div className="bg-gray-900/50 rounded-xl border border-gray-700/50 px-4 py-3 mb-4">
                        <span className="text-white font-medium">{programName}</span>
                    </div>
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
                        <div className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <div>
                                <p className="text-amber-400 text-sm font-medium">Este programa será movido para o histórico</p>
                                <p className="text-amber-400/70 text-sm mt-1">O aluno não poderá mais executar treinos deste programa no app.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-900/30 flex items-center justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={completing}
                        className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={completing}
                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                    >
                        {completing ? (
                            <>
                                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                Concluindo...
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Concluir Programa
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
