'use client'

import { useState, useCallback } from 'react'
import { ClipboardCheck, Camera } from 'lucide-react'
import { submitWorkoutForm } from '@/actions/training-room/submit-workout-form'
import type { FormTriggerData } from '@/stores/training-room-store'

interface WorkoutFormInlineProps {
    trigger: FormTriggerData
    triggerContext: 'pre_workout' | 'post_workout'
    studentId: string
    trainerId: string
    formTemplateId: string
    onSubmit: (submissionId: string) => void
    onSkip: () => void
}

interface Question {
    id: string
    type: 'short_text' | 'long_text' | 'single_choice' | 'multi_choice' | 'scale' | 'photo'
    label: string
    required?: boolean
    options?: string[]
    scale?: { min: number; max: number; minLabel?: string; maxLabel?: string }
}

export function WorkoutFormInline({
    trigger,
    triggerContext,
    studentId,
    trainerId,
    formTemplateId,
    onSubmit,
    onSkip,
}: WorkoutFormInlineProps) {
    const questions: Question[] = trigger.schemaJson?.questions || []
    const [answers, setAnswers] = useState<Record<string, any>>({})
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const updateAnswer = useCallback((questionId: string, value: any) => {
        setAnswers((prev) => ({ ...prev, [questionId]: value }))
    }, [])

    const handleSubmit = async () => {
        // Validate required fields
        for (const q of questions) {
            if (q.required && (answers[q.id] === undefined || answers[q.id] === '' || answers[q.id] === null)) {
                setError(`Campo obrigatório: ${q.label}`)
                return
            }
        }

        setIsSubmitting(true)
        setError(null)

        const result = await submitWorkoutForm({
            formTemplateId,
            studentId,
            trainerId,
            answers,
            triggerContext,
        })

        setIsSubmitting(false)

        if (!result.success || !result.submissionId) {
            setError(result.error || 'Erro ao enviar formulário')
            return
        }

        onSubmit(result.submissionId)
    }

    return (
        <div className="mx-auto max-w-lg space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-k-border-subtle bg-white dark:bg-surface-card p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 dark:bg-violet-600/20">
                    <ClipboardCheck size={20} className="text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-foreground">
                        {trigger.title}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-muted-foreground">
                        {triggerContext === 'pre_workout' ? 'Check-in pré-treino' : 'Check-in pós-treino'}
                    </p>
                </div>
            </div>

            {/* Questions */}
            <div className="space-y-4">
                {questions.map((q) => (
                    <div
                        key={q.id}
                        className="rounded-2xl border border-slate-200 dark:border-k-border-subtle bg-white dark:bg-surface-card p-5"
                    >
                        <label className="mb-3 block text-sm font-medium text-slate-900 dark:text-foreground">
                            {q.label}
                            {q.required && <span className="ml-1 text-red-500">*</span>}
                        </label>
                        <QuestionField
                            question={q}
                            value={answers[q.id]}
                            onChange={(v) => updateAnswer(q.id, v)}
                        />
                    </div>
                ))}
            </div>

            {/* Error */}
            {error && (
                <p className="text-center text-xs text-red-500 dark:text-red-400">{error}</p>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3">
                <button
                    onClick={onSkip}
                    disabled={isSubmitting}
                    className="flex-1 rounded-full border border-slate-200 dark:border-k-border-subtle bg-white dark:bg-glass-bg py-3 text-sm font-semibold text-slate-600 dark:text-muted-foreground transition-colors hover:bg-slate-50 dark:hover:bg-glass-bg-hover disabled:opacity-40"
                >
                    Pular
                </button>
                <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="flex-1 rounded-full bg-violet-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:opacity-40"
                >
                    {isSubmitting ? (
                        <span className="flex items-center justify-center gap-2">
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            Enviando...
                        </span>
                    ) : (
                        'Enviar e continuar'
                    )}
                </button>
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------------
// Question field renderer
// ---------------------------------------------------------------------------

function QuestionField({
    question,
    value,
    onChange,
}: {
    question: Question
    value: any
    onChange: (v: any) => void
}) {
    switch (question.type) {
        case 'short_text':
            return (
                <input
                    type="text"
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-k-border-subtle bg-white dark:bg-glass-bg px-3 py-2.5 text-sm text-slate-900 dark:text-foreground placeholder:text-slate-400 dark:placeholder:text-muted-foreground/50 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/30"
                    placeholder="Resposta curta..."
                />
            )

        case 'long_text':
            return (
                <textarea
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-slate-200 dark:border-k-border-subtle bg-white dark:bg-glass-bg px-3 py-2.5 text-sm text-slate-900 dark:text-foreground placeholder:text-slate-400 dark:placeholder:text-muted-foreground/50 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/30 resize-none"
                    placeholder="Resposta longa..."
                />
            )

        case 'single_choice':
            return (
                <div className="space-y-2">
                    {(question.options || []).map((opt) => (
                        <label
                            key={opt}
                            className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                                value === opt
                                    ? 'border-violet-500 bg-violet-500/5 dark:border-violet-500/40 dark:bg-violet-600/10'
                                    : 'border-slate-200 dark:border-k-border-subtle hover:bg-slate-50 dark:hover:bg-glass-bg'
                            }`}
                        >
                            <div
                                className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                                    value === opt
                                        ? 'border-violet-500'
                                        : 'border-slate-300 dark:border-muted-foreground/30'
                                }`}
                            >
                                {value === opt && (
                                    <div className="h-2 w-2 rounded-full bg-violet-500" />
                                )}
                            </div>
                            <span className="text-sm text-slate-700 dark:text-foreground">{opt}</span>
                        </label>
                    ))}
                </div>
            )

        case 'multi_choice': {
            const selected: string[] = value || []
            return (
                <div className="space-y-2">
                    {(question.options || []).map((opt) => {
                        const isChecked = selected.includes(opt)
                        return (
                            <label
                                key={opt}
                                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                                    isChecked
                                        ? 'border-violet-500 bg-violet-500/5 dark:border-violet-500/40 dark:bg-violet-600/10'
                                        : 'border-slate-200 dark:border-k-border-subtle hover:bg-slate-50 dark:hover:bg-glass-bg'
                                }`}
                            >
                                <div
                                    className={`flex h-4 w-4 items-center justify-center rounded border-2 ${
                                        isChecked
                                            ? 'border-violet-500 bg-violet-500'
                                            : 'border-slate-300 dark:border-muted-foreground/30'
                                    }`}
                                >
                                    {isChecked && (
                                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    )}
                                </div>
                                <span className="text-sm text-slate-700 dark:text-foreground">{opt}</span>
                                <input
                                    type="checkbox"
                                    className="sr-only"
                                    checked={isChecked}
                                    onChange={() => {
                                        const next = isChecked
                                            ? selected.filter((s) => s !== opt)
                                            : [...selected, opt]
                                        onChange(next)
                                    }}
                                />
                            </label>
                        )
                    })}
                </div>
            )
        }

        case 'scale': {
            const { min = 1, max = 10, minLabel, maxLabel } = question.scale || {}
            const range = Array.from({ length: max - min + 1 }, (_, i) => min + i)
            return (
                <div>
                    <div className="flex gap-1.5 flex-wrap">
                        {range.map((n) => (
                            <button
                                key={n}
                                type="button"
                                onClick={() => onChange(n)}
                                className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                                    value === n
                                        ? 'bg-violet-600 text-white'
                                        : 'bg-slate-100 dark:bg-glass-bg text-slate-600 dark:text-muted-foreground hover:bg-slate-200 dark:hover:bg-glass-bg-hover'
                                }`}
                            >
                                {n}
                            </button>
                        ))}
                    </div>
                    {(minLabel || maxLabel) && (
                        <div className="mt-2 flex justify-between text-[11px] text-slate-400 dark:text-muted-foreground/50">
                            <span>{minLabel}</span>
                            <span>{maxLabel}</span>
                        </div>
                    )}
                </div>
            )
        }

        case 'photo':
            return (
                <div className="flex items-center gap-3 rounded-lg border border-dashed border-slate-300 dark:border-k-border-subtle p-4 text-slate-400 dark:text-muted-foreground/50">
                    <Camera size={20} />
                    <span className="text-sm">Foto não disponível na Training Room</span>
                </div>
            )

        default:
            return (
                <p className="text-xs text-slate-400 dark:text-muted-foreground">
                    Tipo de campo não suportado: {question.type}
                </p>
            )
    }
}
