'use client'

import { useState } from 'react'
import { Sparkles, FileText, X, Loader2, Check, AlertTriangle, RotateCcw } from 'lucide-react'
import type { Exercise } from '@/types/exercise'
import type { Workout } from './program-builder-client'
import type { ParseTextResponse, ParsedExercise } from '@/app/api/prescription/parse-text/types'
import { extractFrequencyFromName } from '@kinevo/shared/lib/prescription/extract-frequency'

type PanelState = 'idle' | 'loading' | 'success' | 'error'

interface AiPrescribePanelProps {
    onClose: () => void
    exercises: Exercise[]
    workouts: Workout[]
    activeWorkoutId: string | null
    onAddExerciseToWorkout: (
        workoutId: string,
        exercise: Exercise,
        options?: {
            sets?: number
            reps?: string
            rest_seconds?: number | null
            notes?: string | null
            method_key?: import('@kinevo/shared/types/prescription').MethodKey | null
            set_scheme?: import('@kinevo/shared/types/prescription').WorkoutSet[] | null
            rounds?: number | null
        },
    ) => void
    /** Cria um workout. `frequency` é opcional — usado quando o trainer
     *  embute o dia no nome (ex: "Superior A - segunda"). */
    onCreateWorkout: (name: string, frequency?: string[]) => string
    /** Remove workouts vazios criados como placeholder (ex: "Treino A" default
     *  do programa novo). Chamado depois da prescrição se o trainer criou
     *  workouts próprios e o placeholder ficou órfão. Não-obrigatório:
     *  se o pai não passar, a limpeza simplesmente não acontece. */
    onCleanupEmptyPlaceholders?: (workoutIds: string[]) => void
}

export function AiPrescribePanel({
    onClose,
    exercises,
    workouts,
    activeWorkoutId,
    onAddExerciseToWorkout,
    onCreateWorkout,
    onCleanupEmptyPlaceholders,
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

            // Case + accent insensitive match for workout names. Lets us treat
            // "Treino A" / "treino a" / "Treino  A " as the same workout, and
            // "Inferior A" / "inferior a" likewise.
            const normalizeWorkoutName = (s: string) =>
                s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

            // The LLM uses "Treino A" as a default when the trainer's text has
            // no heading at all (system prompt: "Se o texto não separar em
            // treinos distintos, coloque tudo em um treino chamado 'Treino A'").
            // We use this to distinguish "trainer pasted a single block with a
            // real heading" from "trainer pasted exercises with no heading".
            const LLM_DEFAULT_NAME = 'treino a'

            // Snapshot dos workouts vazios pré-existentes ANTES de criar
            // novos. Se o trainer prescrever workouts próprios (custom
            // headings), os placeholders vazios sobrantes ficam órfãos e
            // podem ser limpos no final.
            const emptyPlaceholderIdsBefore = workouts
                .filter(w => w.items.length === 0)
                .map(w => w.id)
            let createdAnyNewWorkout = false

            for (const parsedWorkout of data.workouts) {
                // Extrai dia da semana embutido no nome ("Superior A - segunda"
                // → name "Superior A", frequency ['mon']).
                const { name: cleanName, frequency: inferredDays } =
                    extractFrequencyFromName(parsedWorkout.name)

                // Find or create the target workout. Always try a name match
                // first — that way "Treino B / Agachamento 3x10" routes to the
                // existing Treino B (or creates one if missing) instead of
                // falling into the active workout. Only when the parsed name
                // is the LLM's default ("Treino A", indicating no heading in
                // the trainer's text) AND there's no existing workout with
                // that name do we fall back to the active workout — that
                // preserves the "paste with no heading" UX where exercises go
                // into whatever the trainer has open.
                let targetWorkoutId: string | null = null

                const targetName = normalizeWorkoutName(cleanName)
                const existing = workouts.find(w => normalizeWorkoutName(w.name) === targetName)

                if (existing) {
                    targetWorkoutId = existing.id
                    // Preserva a frequency que o trainer já configurou no
                    // workout existente — não sobrescrever.
                } else if (targetName === LLM_DEFAULT_NAME && (activeWorkoutId || workouts[0]?.id)) {
                    // No heading in the trainer's text and there's already a
                    // workout to drop into — use the active one (or first).
                    targetWorkoutId = activeWorkoutId || workouts[0]!.id
                } else {
                    // Real heading without a match (e.g., "Treino B" while
                    // only Treino A exists) → create a new workout for it,
                    // passando os dias inferidos do nome quando houver. Quando
                    // não houver, chamamos com 1 argumento só (compat com
                    // callers que esperam a assinatura antiga / testes que
                    // verificam arity).
                    targetWorkoutId = inferredDays.length > 0
                        ? onCreateWorkout(cleanName, inferredDays)
                        : onCreateWorkout(cleanName)
                    createdAnyNewWorkout = true
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
                                method_key: parsedEx.method_key,
                                set_scheme: parsedEx.set_scheme,
                                rounds: parsedEx.rounds ?? 1,
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

            // Limpa workouts placeholder vazios sobrantes — só faz isso quando
            // o trainer realmente CRIOU workouts próprios. Não toca em nada se
            // ele só usou os existentes (ex: prescrição com 1 workout default
            // que caiu no Treino A pré-existente).
            if (createdAnyNewWorkout && emptyPlaceholderIdsBefore.length > 0 && onCleanupEmptyPlaceholders) {
                onCleanupEmptyPlaceholders(emptyPlaceholderIdsBefore)
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
                    <FileText className="w-4 h-4 text-[#7C3AED] dark:text-violet-400" />
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
                            className="flex-1 min-h-[280px] resize-none rounded-lg border border-[#E8E8ED] dark:border-k-border-subtle bg-[#FAFAFA] dark:bg-surface-canvas px-3 py-3 text-sm text-[#1D1D1F] dark:text-k-text-primary placeholder:text-[#AEAEB2] dark:placeholder:text-k-text-quaternary focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30 dark:focus:ring-violet-500/30 focus:border-[#7C3AED] dark:focus:border-violet-500 transition-colors"
                        />
                        <button
                            onClick={handleGenerate}
                            disabled={text.trim().length === 0}
                            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-control text-sm font-semibold text-white bg-primary hover:opacity-90 dark:bg-violet-600 dark:hover:bg-violet-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <Sparkles className="w-4 h-4" />
                            Gerar Treino
                        </button>
                    </>
                )}

                {state === 'loading' && (
                    <div className="flex-1 flex flex-col items-center justify-center gap-3 py-12">
                        <Loader2 className="w-6 h-6 text-[#7C3AED] dark:text-violet-400 animate-spin" />
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
                            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg text-sm font-semibold text-[#7C3AED] dark:text-violet-400 bg-[#7C3AED]/5 hover:bg-[#7C3AED]/10 dark:bg-violet-500/[0.08] dark:hover:bg-violet-500/[0.15] transition-colors"
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
                            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-[#7C3AED] dark:text-violet-400 bg-[#7C3AED]/5 hover:bg-[#7C3AED]/10 dark:bg-violet-500/[0.08] dark:hover:bg-violet-500/[0.15] transition-colors"
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
