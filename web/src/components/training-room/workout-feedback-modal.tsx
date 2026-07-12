'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

interface WorkoutFeedbackModalProps {
    isOpen: boolean
    studentName: string
    workoutName: string
    isSubmitting: boolean
    onConfirm: (rpe: number | null, feedback: string | null) => void
    onCancel: () => void
}

// Escala PSE sem emojis (feedback do Gustavo 12/jul + regra do design system:
// ícones = Lucide, nunca emoji). Pills numeradas com preenchimento progressivo
// — a leitura de intensidade vem do fill, não de carinhas.
const RPE_OPTIONS = [
    { value: 1, label: 'Muito fácil' },
    { value: 2, label: 'Fácil' },
    { value: 3, label: 'Leve' },
    { value: 4, label: 'Moderado-' },
    { value: 5, label: 'Moderado' },
    { value: 6, label: 'Moderado+' },
    { value: 7, label: 'Difícil' },
    { value: 8, label: 'Muito difícil' },
    { value: 9, label: 'Extremo' },
    { value: 10, label: 'Máximo' },
]

export function WorkoutFeedbackModal({
    isOpen,
    studentName,
    workoutName,
    isSubmitting,
    onConfirm,
    onCancel,
}: WorkoutFeedbackModalProps) {
    const [selectedRpe, setSelectedRpe] = useState<number | null>(null)
    const [feedback, setFeedback] = useState('')

    if (!isOpen) return null

    const handleConfirm = () => {
        onConfirm(selectedRpe, feedback.trim() || null)
    }

    return (
        <div className="fixed inset-0 z-modal flex items-center justify-center">
            <div className="absolute inset-0 bg-black/30 dark:bg-black/60 backdrop-blur-sm" onClick={onCancel} />

            <div className="relative w-full max-w-md rounded-2xl border border-[#D2D2D7] dark:border-k-border-subtle bg-white dark:bg-surface-card shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-2xl mx-4">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-[#E8E8ED] dark:border-k-border-subtle p-5">
                    <div>
                        <h2 className="text-lg font-semibold text-[#1D1D1F] dark:text-foreground">Concluir Treino</h2>
                        <p className="text-xs text-[#86868B] dark:text-muted-foreground mt-0.5">
                            {studentName} — {workoutName}
                        </p>
                    </div>
                    <button
                        onClick={onCancel}
                        className="rounded-full p-1.5 text-[#AEAEB2] dark:text-muted-foreground hover:bg-[#F5F5F7] dark:hover:bg-glass-bg hover:text-[#6E6E73] dark:hover:text-foreground transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-5 space-y-5">
                    {/* RPE */}
                    <div>
                        <p className="text-[11px] font-semibold text-[#86868B] dark:text-muted-foreground/60 mb-3">
                            Percepção de Esforço (PSE)
                        </p>
                        <div className="grid grid-cols-10 gap-1">
                            {RPE_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() =>
                                        setSelectedRpe(selectedRpe === option.value ? null : option.value)
                                    }
                                    aria-label={`PSE ${option.value} — ${option.label}`}
                                    className={`h-9 rounded-lg text-[13px] font-bold transition-all ${
                                        selectedRpe === option.value
                                            ? 'bg-[#7C3AED] dark:bg-violet-600 text-white scale-110 shadow-sm'
                                            : selectedRpe && option.value < selectedRpe
                                                ? 'bg-[#7C3AED]/15 dark:bg-violet-500/20 text-[#6D28D9] dark:text-violet-300'
                                                : 'bg-[#F5F5F7] dark:bg-glass-bg border border-[#E8E8ED] dark:border-transparent text-[#6E6E73] dark:text-muted-foreground hover:bg-[#ECECF0] dark:hover:bg-glass-bg-hover'
                                    }`}
                                >
                                    {option.value}
                                </button>
                            ))}
                        </div>
                        <div className="mt-1.5 flex items-baseline justify-between text-[10px] text-[#AEAEB2] dark:text-muted-foreground/50">
                            <span>Muito fácil</span>
                            <span className="min-h-4 text-xs font-semibold text-[#7C3AED] dark:text-violet-400">
                                {selectedRpe ? RPE_OPTIONS[selectedRpe - 1].label : ''}
                            </span>
                            <span>Máximo</span>
                        </div>
                    </div>

                    {/* Feedback text */}
                    <div>
                        <p className="text-[11px] font-semibold text-[#86868B] dark:text-muted-foreground/60 mb-2">
                            Observações (opcional)
                        </p>
                        <textarea
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                            placeholder="Como foi o treino?"
                            rows={3}
                            className="w-full rounded-xl border border-[#D2D2D7] dark:border-k-border-subtle bg-white dark:bg-glass-bg px-4 py-3 text-sm text-[#1D1D1F] dark:text-foreground placeholder:text-[#AEAEB2] dark:placeholder:text-muted-foreground/40 focus:border-[#7C3AED] dark:focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-[#7C3AED]/20 dark:focus:ring-violet-500/50 resize-none"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="border-t border-[#E8E8ED] dark:border-k-border-subtle p-5 flex gap-3">
                    <button
                        onClick={onCancel}
                        disabled={isSubmitting}
                        className="flex-1 rounded-full border border-[#D2D2D7] dark:border-k-border-subtle py-3 text-sm font-medium text-[#6E6E73] dark:text-muted-foreground transition-colors hover:bg-[#F5F5F7] dark:hover:bg-glass-bg disabled:opacity-40"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={isSubmitting}
                        className="flex-1 rounded-full bg-[#7C3AED] dark:bg-violet-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#6D28D9] dark:hover:bg-violet-500 disabled:opacity-40"
                    >
                        {isSubmitting ? (
                            <span className="flex items-center justify-center gap-2">
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                Salvando...
                            </span>
                        ) : (
                            'Salvar Treino'
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
