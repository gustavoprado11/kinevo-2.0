'use client'

import { useState } from 'react'
import { Sparkles, FileText, X, Loader2, Check, AlertTriangle, RotateCcw } from 'lucide-react'
import type { Exercise } from '@/types/exercise'
import type { Workout } from './program-builder-client'
import type { ParseTextResponse, ParsedExercise } from '@/app/api/prescription/parse-text/types'

type PanelState = 'idle' | 'loading' | 'success' | 'error'

interface AiPrescribePanelProps {
    onClose: () => void
    exercises: Exercise[]
    workouts: Workout[]
    activeWorkoutId: string | null
    onAddExerciseToWorkout: (workoutId: string, exercise: Exercise, options?: { sets?: number; reps?: string; rest_seconds?: number | null; notes?: string | null }) => void
    onCreateWorkout: (name: string) => string
}

export function AiPrescribePanel({
    onClose,
    exercises,
    workouts,
    activeWorkoutId,
    onAddExerciseToWorkout,
    onCreateWorkout,
}: AiPrescribePanelProps) {
    const [text, setText] = useState('')
    const [state, setState] = useState<PanelState>('idle')
    const [errorMessage, setErrorMessage] = useState('')
    const [result, setResult] = useState<ParseTextResponse | null>(null)
    const [stats, setStats] = useState({ matched: 0, unmatched: 0 })

    const handleGenerate = async () => {
        const trimmed = text.trim()
        if (!trimmed) return

        setState('loading')
        setErrorMessage('')
        setResult(null)

        try {
            const response = await fetch('/api/prescription/parse-text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: trimmed,
                    exercises: exercises.map(e => ({ id: e.id, name: e.name })),
                }),
            })

            if (!response.ok) {
                const err = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
                throw new Error(err.error || `HTTP ${response.status}`)
            }

            const data: ParseTextResponse = await response.json()
            setResult(data)

            // Insert matched exercises into workouts
            let matchedCount = 0
            let unmatchedCount = 0

            for (const parsedWorkout of data.workouts) {
                // Find or create the target workout
                let targetWorkoutId: string | null = null

                if (data.workouts.length === 1) {
                    // Single workout in response — add to active workout
                    targetWorkoutId = activeWorkoutId || workouts[0]?.id || null
                    if (!targetWorkoutId) {
                        targetWorkoutId = onCreateWorkout(parsedWorkout.name)
                    }
                } else {
                    // Multiple workouts — match by name or create new
                    const existing = workouts.find(w =>
                        w.name.toLowerCase() === parsedWorkout.name.toLowerCase()
                    )
                    targetWorkoutId = existing?.id ?? onCreateWorkout(parsedWorkout.name)
                }

                for (const parsedEx of parsedWorkout.exercises) {
                    if (parsedEx.matched && parsedEx.exercise_id) {
                        const exerciseObj = exercises.find(e => e.id === parsedEx.exercise_id)
                        if (exerciseObj) {
                            onAddExerciseToWorkout(targetWorkoutId, exerciseObj, {
                                sets: parsedEx.sets,
                                reps: parsedEx.reps,
                                rest_seconds: parsedEx.rest_seconds,
                                notes: parsedEx.notes,
                            })
                            matchedCount++
                        } else {
                            unmatchedCount++
                        }
                    } else {
                        unmatchedCount++
                    }
                }
            }

            setStats({ matched: matchedCount, unmatched: unmatchedCount })
            setState('success')
        } catch (err) {
            console.error('[AI Prescribe] Error:', err)
            setErrorMessage(err instanceof Error ? err.message : 'Erro ao processar prescrição')
            setState('error')
        }
    }

    const handleReset = () => {
        setState('idle')
        setText('')
        setResult(null)
        setErrorMessage('')
        setStats({ matched: 0, unmatched: 0 })
    }

    const allExercises = result?.workouts.flatMap(w => w.exercises) ?? []
    const unmatchedExercises = allExercises.filter(e => !e.matched)

    return (
        <div
            className="w-[420px] flex-shrink-0 sticky top-0 self-start flex flex-col bg-white dark:bg-surface-primary border-l border-[#E8E8ED] dark:border-k-border-subtle rounded-xl overflow-hidden"
            style={{ maxHeight: 'calc(100vh - 120px)' }}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#E8E8ED] dark:border-k-border-subtle flex-shrink-0">
                <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#007AFF] dark:text-violet-400" />
                    <span className="text-sm font-semibold text-[#1D1D1F] dark:text-k-text-primary">Texto para Treino</span>
                </div>
                <button
                    onClick={onClose}
                    className="p-1.5 rounded-md text-[#AEAEB2] dark:text-k-text-quaternary hover:text-[#1D1D1F] dark:hover:text-k-text-primary hover:bg-[#F5F5F7] dark:hover:bg-glass-bg transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Body */}
            <div className="flex-1 flex flex-col p-4 gap-3 min-h-0 overflow-y-auto">
                {state === 'idle' && (
                    <>
                        <p className="text-xs text-[#86868B] dark:text-k-text-quaternary leading-relaxed">
                            Cole ou digite a prescrição em texto livre. A IA vai interpretar os exercícios, séries, repetições e descanso automaticamente.
                        </p>
                        <textarea
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder={"Cole ou digite seu treino aqui...\n\nExemplo:\nSupino Inclinado Halter 3x8-10\nPuxada Aberta 3x10-12\nRemada Serrote 3x10"}
                            className="flex-1 min-h-[280px] resize-none rounded-lg border border-[#E8E8ED] dark:border-k-border-subtle bg-[#FAFAFA] dark:bg-surface-canvas px-3 py-3 text-sm text-[#1D1D1F] dark:text-k-text-primary placeholder:text-[#AEAEB2] dark:placeholder:text-k-text-quaternary focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 dark:focus:ring-violet-500/30 focus:border-[#007AFF] dark:focus:border-violet-500 transition-colors"
                        />
                        <button
                            onClick={handleGenerate}
                            disabled={text.trim().length === 0}
                            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#007AFF] hover:bg-[#0066D6] dark:bg-violet-600 dark:hover:bg-violet-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <Sparkles className="w-4 h-4" />
                            Gerar Treino
                        </button>
                    </>
                )}

                {state === 'loading' && (
                    <div className="flex-1 flex flex-col items-center justify-center gap-3 py-12">
                        <Loader2 className="w-6 h-6 text-[#007AFF] dark:text-violet-400 animate-spin" />
                        <p className="text-sm text-[#6E6E73] dark:text-k-text-tertiary">Analisando prescrição...</p>
                        <p className="text-xs text-[#AEAEB2] dark:text-k-text-quaternary">Identificando exercícios e parâmetros</p>
                    </div>
                )}

                {state === 'success' && result && (
                    <>
                        {/* Summary */}
                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/[0.08] border border-emerald-200 dark:border-emerald-500/20">
                            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                            <p className="text-xs text-emerald-700 dark:text-emerald-300">
                                <span className="font-semibold">{stats.matched} exercício{stats.matched !== 1 ? 's' : ''}</span> adicionado{stats.matched !== 1 ? 's' : ''} ao treino
                                {stats.unmatched > 0 && (
                                    <span className="text-amber-600 dark:text-amber-400">
                                        {' · '}{stats.unmatched} não encontrado{stats.unmatched !== 1 ? 's' : ''}
                                    </span>
                                )}
                            </p>
                        </div>

                        {/* Exercise list */}
                        <div className="flex flex-col gap-1">
                            {result.workouts.map((workout, wi) => (
                                <div key={wi}>
                                    {result.workouts.length > 1 && (
                                        <p className="text-[10px] uppercase tracking-wider font-bold text-[#86868B] dark:text-k-text-quaternary mt-2 mb-1 px-1">
                                            {workout.name}
                                        </p>
                                    )}
                                    {workout.exercises.map((ex, ei) => (
                                        <ExerciseResultRow key={`${wi}-${ei}`} exercise={ex} />
                                    ))}
                                </div>
                            ))}
                        </div>

                        {/* Unmatched warning */}
                        {unmatchedExercises.length > 0 && (
                            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 dark:bg-amber-500/[0.06] border border-amber-200 dark:border-amber-500/20">
                                <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                                <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                                    Exercícios não encontrados podem ser adicionados manualmente pela biblioteca à esquerda, ou criados como exercícios novos.
                                </p>
                            </div>
                        )}

                        {/* Reset button */}
                        <button
                            onClick={handleReset}
                            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg text-sm font-semibold text-[#007AFF] dark:text-violet-400 bg-[#007AFF]/5 hover:bg-[#007AFF]/10 dark:bg-violet-500/[0.08] dark:hover:bg-violet-500/[0.15] transition-colors"
                        >
                            <RotateCcw className="w-4 h-4" />
                            Nova prescrição
                        </button>
                    </>
                )}

                {state === 'error' && (
                    <div className="flex-1 flex flex-col items-center justify-center gap-4 py-12">
                        <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-500/[0.08] flex items-center justify-center">
                            <AlertTriangle className="w-5 h-5 text-red-500 dark:text-red-400" />
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-medium text-[#1D1D1F] dark:text-k-text-primary mb-1">Erro ao processar</p>
                            <p className="text-xs text-[#86868B] dark:text-k-text-quaternary">{errorMessage}</p>
                        </div>
                        <button
                            onClick={() => setState('idle')}
                            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-[#007AFF] dark:text-violet-400 bg-[#007AFF]/5 hover:bg-[#007AFF]/10 dark:bg-violet-500/[0.08] dark:hover:bg-violet-500/[0.15] transition-colors"
                        >
                            <RotateCcw className="w-4 h-4" />
                            Tentar novamente
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

function ExerciseResultRow({ exercise }: { exercise: ParsedExercise }) {
    if (exercise.matched) {
        return (
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-md">
                <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-[#1D1D1F] dark:text-k-text-primary truncate">{exercise.catalog_name}</p>
                    <p className="text-[11px] text-[#AEAEB2] dark:text-k-text-quaternary">
                        {exercise.sets}x{exercise.reps}
                        {exercise.rest_seconds ? ` · ${exercise.rest_seconds}s` : ''}
                        {exercise.notes ? ` · ${exercise.notes}` : ''}
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-amber-50/50 dark:bg-amber-500/[0.04]">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
                <p className="text-[13px] text-amber-700 dark:text-amber-300 truncate">{exercise.original_text}</p>
                <p className="text-[11px] text-amber-500/70 dark:text-amber-400/60">
                    Não encontrado no catálogo · {exercise.sets}x{exercise.reps}
                </p>
            </div>
        </div>
    )
}
