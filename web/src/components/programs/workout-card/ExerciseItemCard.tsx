'use client'

import {
    ArrowLeftRight,
    ChevronDown,
    Copy,
    GripVertical,
    PlayCircle,
    Sliders,
    Trash2,
} from 'lucide-react'
import { useState, type HTMLAttributes } from 'react'

import { getMethodChipLabel } from '@kinevo/shared/lib/prescription/method-labels'
import {
    expandToSetScheme,
    summarizeSetScheme,
    summarizeWithRounds,
} from '@kinevo/shared/lib/prescription/set-scheme'
import { isCompoundMethod } from '@kinevo/shared/lib/prescription/set-scheme-presets'

import { FloatingExercisePlayer } from '@/components/exercises/floating-exercise-player'
import type { Exercise } from '@/types/exercise'

import type { WorkoutItem } from '../program-builder-client'
import { ExerciseAdvancedSection } from './ExerciseAdvancedSection'
import { TechnicalNote } from './ExerciseMetadataSection'
import { ExerciseMetricsTrack } from './ExerciseMetricsTrack'
import { ExerciseSubstitutesSection } from './ExerciseSubstitutesSection'
import { ExerciseSwapPanel } from './ExerciseSwapPanel'

interface ExerciseItemCardProps {
    item: WorkoutItem
    exercises: Exercise[]
    onUpdate: (updates: Partial<WorkoutItem>) => void
    onDelete: () => void
    onDuplicate?: () => void
    dragHandleProps?: HTMLAttributes<HTMLDivElement>
    readonly?: boolean
}

/**
 * Card de exercício do builder de treino.
 *
 * Layout:
 *   [grip] [Título · play · pills · método-chip] · · · [Sliders] [Swap] [Trash]
 *   ─────────────────────────────────────────────────────────────────────────
 *   [Séries] [Repetições] [Descanso] [Função]    ← trilho de métricas
 *
 *   <SetSchemeTable />                            ← apenas em modo avançado
 *
 *   <Nota técnica> · <Substituições>
 *
 * Decisões:
 * - Card sempre aberto (sem chevron / collapse).
 * - Trilho de métricas é o ponto de consistência simples ↔ avançado: mesmo
 *   layout, mesma altura. No simples, cada card é um input editável; no
 *   avançado, viram resumo derivado da tabela.
 * - "Editar séries" é um toggle em ícone (Sliders) no canto superior direito.
 *   Quando ativo, ganha destaque violeta.
 * - Ações sempre visíveis (sem hover-only).
 */
export function ExerciseItemCard({
    item,
    exercises,
    onUpdate,
    onDelete,
    onDuplicate,
    dragHandleProps,
    readonly,
}: ExerciseItemCardProps) {
    const [showVideo, setShowVideo] = useState(false)
    const [videoExercise, setVideoExercise] = useState<Exercise | null>(null)
    const [isSwapping, setIsSwapping] = useState(false)
    const [swapQuery, setSwapQuery] = useState('')
    /* Minimização manual: usuário pode esconder tabela/nota/substituições e
     * deixar só o header + trilho de métricas (que já é o resumo legível
     * da prescrição). Útil pra ganhar espaço numa tela com muitos cards. */
    const [isMinimized, setIsMinimized] = useState(false)

    const chipLabel = getMethodChipLabel(item.method_key ?? null)
    const hasSetScheme = !!item.set_scheme
    const canToggleAdvanced =
        !readonly && item.item_type === 'exercise' && item.parent_item_id === null

    const showExerciseVideo = (exercise: Exercise) => {
        setVideoExercise(exercise)
        setShowVideo(true)
    }

    const closeVideo = () => {
        setShowVideo(false)
        setVideoExercise(null)
    }

    const confirmSwap = (newExercise: Exercise) => {
        onUpdate({
            exercise_id: newExercise.id,
            exercise: newExercise,
        })
        setIsSwapping(false)
        setSwapQuery('')
    }

    const startSwap = () => {
        setIsSwapping(true)
        setSwapQuery('')
    }

    const toggleAdvancedMode = () => {
        if (item.set_scheme) {
            if (item.set_scheme.length > 0) {
                const ok = window.confirm(
                    'Você perderá as configurações específicas de cada série. Continuar?',
                )
                if (!ok) return
            }
            const compound = isCompoundMethod(item.method_key ?? null)
            const effectiveRounds = compound
                ? Math.max(1, Math.min(20, Math.floor(item.rounds ?? 1)))
                : 1
            const summary =
                item.set_scheme.length > 0
                    ? effectiveRounds > 1
                        ? summarizeWithRounds(item.set_scheme, effectiveRounds)
                        : summarizeSetScheme(item.set_scheme)
                    : { sets: item.sets ?? 3, reps: item.reps ?? '10', rest_seconds: item.rest_seconds ?? 60 }
            onUpdate({
                set_scheme: null,
                method_key: null,
                rounds: 1,
                sets: summary.sets,
                reps: summary.reps,
                rest_seconds: summary.rest_seconds,
            })
        } else {
            const initial = expandToSetScheme(item.sets, item.reps, item.rest_seconds)
            onUpdate({ set_scheme: initial, method_key: 'standard', rounds: 1 })
        }
    }

    if (isSwapping && !readonly) {
        return (
            <>
                <ExerciseSwapPanel
                    item={item}
                    exercises={exercises}
                    query={swapQuery}
                    onQueryChange={setSwapQuery}
                    onCancel={() => setIsSwapping(false)}
                    onConfirm={confirmSwap}
                    onShowVideo={showExerciseVideo}
                />
                <FloatingExercisePlayer
                    isOpen={showVideo}
                    onClose={closeVideo}
                    videoUrl={videoExercise?.video_url || null}
                    title={videoExercise?.name || ''}
                />
            </>
        )
    }

    return (
        <>
            <div className="bg-[var(--surface-card)] rounded-xl border border-[var(--border-subtle)] p-4 relative transition-colors hover:border-[var(--border-primary)]">
                <div className="flex items-start gap-3">
                    {/* Drag Handle */}
                    {!readonly && (
                        <div
                            {...(dragHandleProps ?? {})}
                            className="mt-1 text-[var(--text-quaternary)] hover:text-[var(--text-secondary)] cursor-grab active:cursor-grabbing touch-none transition-colors shrink-0"
                            aria-label="Reordenar"
                        >
                            <GripVertical className="w-4 h-4" />
                        </div>
                    )}

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-3">
                        {/* Header: title + play + pills + method chip + actions */}
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0 flex-wrap">
                                <span className="text-sm font-bold text-[var(--text-primary)] truncate">
                                    {item.exercise?.name || 'Exercício sem nome'}
                                </span>
                                {!readonly && item.exercise?.video_url && (
                                    <button
                                        type="button"
                                        onClick={() => showExerciseVideo(item.exercise!)}
                                        className="text-[#AEAEB2] dark:text-k-text-quaternary hover:text-[#007AFF] dark:hover:text-violet-400 transition-colors shrink-0"
                                        title="Ver vídeo demonstrativo"
                                        aria-label="Ver vídeo demonstrativo"
                                    >
                                        <PlayCircle className="w-4 h-4" />
                                    </button>
                                )}
                                {item.exercise?.muscle_groups?.map((g) => (
                                    <span
                                        key={g.id || g.name}
                                        className="text-[9px] font-bold text-[var(--text-tertiary)] bg-[var(--glass-bg)] px-1.5 py-0.5 rounded border border-[var(--border-subtle)] whitespace-nowrap"
                                    >
                                        {g.name}
                                    </span>
                                ))}
                                {chipLabel && (
                                    <span
                                        className="text-[9px] font-bold whitespace-nowrap inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 border border-violet-200 dark:bg-violet-900/40 dark:text-violet-300 dark:border-violet-800"
                                        title={`Método: ${chipLabel}`}
                                    >
                                        <Sliders className="w-2.5 h-2.5" />
                                        {chipLabel}
                                    </span>
                                )}
                            </div>

                            {/* Actions sempre visíveis */}
                            {!readonly && (
                                <div className="flex items-center gap-1 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => setIsMinimized((v) => !v)}
                                        className="p-1.5 rounded-md text-[var(--text-quaternary)] hover:text-[var(--text-secondary)] hover:bg-[var(--glass-bg)] transition-colors"
                                        title={isMinimized ? 'Expandir card' : 'Minimizar card'}
                                        aria-label={isMinimized ? 'Expandir card' : 'Minimizar card'}
                                        aria-expanded={!isMinimized}
                                    >
                                        <ChevronDown
                                            className={`w-3.5 h-3.5 transition-transform ${isMinimized ? '' : 'rotate-180'}`}
                                        />
                                    </button>
                                    {canToggleAdvanced && (
                                        <button
                                            type="button"
                                            onClick={toggleAdvancedMode}
                                            className={
                                                hasSetScheme
                                                    ? 'p-1.5 rounded-md text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10 hover:bg-violet-100 dark:hover:bg-violet-500/20 transition-colors'
                                                    : 'p-1.5 rounded-md text-[var(--text-quaternary)] hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-colors'
                                            }
                                            title={hasSetScheme ? 'Voltar para modo simples' : 'Editar séries (pirâmide, drop-set, etc)'}
                                            aria-label={hasSetScheme ? 'Voltar para modo simples' : 'Editar séries avançadas'}
                                            aria-pressed={hasSetScheme}
                                        >
                                            <Sliders className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                    {onDuplicate && (
                                        <button
                                            type="button"
                                            onClick={onDuplicate}
                                            className="p-1.5 rounded-md text-[var(--text-quaternary)] hover:text-[#007AFF] dark:hover:text-violet-400 hover:bg-[#007AFF]/10 dark:hover:bg-violet-400/10 transition-colors"
                                            title="Duplicar exercício"
                                            aria-label="Duplicar exercício"
                                        >
                                            <Copy className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={startSwap}
                                        className="p-1.5 rounded-md text-[var(--text-quaternary)] hover:text-[#007AFF] dark:hover:text-violet-400 hover:bg-[#007AFF]/10 dark:hover:bg-violet-400/10 transition-colors"
                                        title="Trocar exercício"
                                        aria-label="Trocar exercício"
                                    >
                                        <ArrowLeftRight className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={onDelete}
                                        className="p-1.5 rounded-md text-[var(--text-quaternary)] hover:text-[#FF3B30] dark:hover:text-red-400 hover:bg-[#FF3B30]/10 dark:hover:bg-red-400/10 transition-colors"
                                        title="Excluir exercício"
                                        aria-label="Excluir exercício"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Trilho de métricas — mesmo componente nos dois modos */}
                        <ExerciseMetricsTrack
                            item={item}
                            readonly={readonly}
                            onUpdate={onUpdate}
                        />

                        {/* Tudo abaixo do trilho some quando o card está
                         *  minimizado. O trilho continua visível porque já é
                         *  uma representação legível da prescrição. */}
                        {!isMinimized && (
                            <>
                                {/* Modo avançado: tabela editável de séries */}
                                <ExerciseAdvancedSection
                                    item={item}
                                    readonly={readonly}
                                    onUpdate={onUpdate}
                                />

                                {/* Nota técnica */}
                                <TechnicalNote
                                    value={item.notes || ''}
                                    onChange={(v) => onUpdate({ notes: v })}
                                    readonly={readonly}
                                />

                                {/* Substituições */}
                                {!readonly && (
                                    <ExerciseSubstitutesSection
                                        item={item}
                                        exercises={exercises}
                                        onUpdate={onUpdate}
                                    />
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            <FloatingExercisePlayer
                isOpen={showVideo}
                onClose={closeVideo}
                videoUrl={videoExercise?.video_url || null}
                title={videoExercise?.name || ''}
            />
        </>
    )
}
