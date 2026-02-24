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

const RPE_OPTIONS = [
    { value: 1, label: 'Muito fácil', emoji: '😌' },
    { value: 2, label: 'Fácil', emoji: '😊' },
    { value: 3, label: 'Leve', emoji: '🙂' },
    { value: 4, label: 'Moderado-', emoji: '😐' },
    { value: 5, label: 'Moderado', emoji: '😤' },
    { value: 6, label: 'Moderado+', emoji: '😮‍💨' },
    { value: 7, label: 'Difícil', emoji: '😰' },
    { value: 8, label: 'Muito difícil', emoji: '😫' },
    { value: 9, label: 'Extremo', emoji: '🥵' },
    { value: 10, label: 'Máximo', emoji: '💀' },
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
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />

            <div className="relative w-full max-w-md rounded-2xl border border-k-border-subtle bg-surface-card shadow-2xl mx-4">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-k-border-subtle p-5">
                    <div>
                        <h2 className="text-lg font-semibold text-foreground">Concluir Treino</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {studentName} — {workoutName}
                        </p>
                    </div>
                    <button
                        onClick={onCancel}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-glass-bg hover:text-foreground transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-5 space-y-5">
                    {/* RPE */}
                    <div>
                        <p className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground/60 mb-3">
                            Percepção de Esforço (PSE)
                        </p>
                        <div className="grid grid-cols-5 gap-1.5">
                            {RPE_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() =>
                                        setSelectedRpe(selectedRpe === option.value ? null : option.value)
                                    }
                                    className={`flex flex-col items-center gap-0.5 rounded-xl p-2 text-center transition-all ${
                                        selectedRpe === option.value
                                            ? 'bg-violet-600/20 border border-violet-500/40 scale-105'
                                            : 'bg-glass-bg border border-transparent hover:bg-glass-bg-hover'
                                    }`}
                                >
                                    <span className="text-lg">{option.emoji}</span>
                                    <span className="text-[10px] font-bold text-foreground">
                                        {option.value}
                                    </span>
                                </button>
                            ))}
                        </div>
                        {selectedRpe && (
                            <p className="mt-2 text-center text-xs text-violet-400">
                                {RPE_OPTIONS[selectedRpe - 1].label}
                            </p>
                        )}
                    </div>

                    {/* Feedback text */}
                    <div>
                        <p className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground/60 mb-2">
                            Observações (opcional)
                        </p>
                        <textarea
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                            placeholder="Como foi o treino?"
                            rows={3}
                            className="w-full rounded-xl border border-k-border-subtle bg-glass-bg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/50 resize-none"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="border-t border-k-border-subtle p-5 flex gap-3">
                    <button
                        onClick={onCancel}
                        disabled={isSubmitting}
                        className="flex-1 rounded-xl border border-k-border-subtle py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-glass-bg disabled:opacity-40"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={isSubmitting}
                        className="flex-1 rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:opacity-40"
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
