'use client'

import { PlayCircle, Trash2, Unlink } from 'lucide-react'
import { useState } from 'react'

import { FloatingExercisePlayer } from '@/components/exercises/floating-exercise-player'

import type { WorkoutItem } from '../program-builder-client'
import { ExerciseMetricsTrack } from './ExerciseMetricsTrack'

interface SupersetChildCardProps {
    item: WorkoutItem
    onUpdate: (updates: Partial<WorkoutItem>) => void
    onDelete: () => void
    onRemoveFromSuperset?: () => void
    readonly?: boolean
}

/**
 * Card de exercício filho de um superset.
 *
 * Layout:
 *   ┌────────────────────────────────────────────────────────────┐
 *   │ Supino Inclinado Articulado ▶          [⊥] [🗑]            │
 *   │ ┌────────┬──────────────┬──────────┐                       │
 *   │ │ Séries │ Repetições   │ Função   │                       │
 *   │ │ 3      │ 10           │ —        │                       │
 *   │ └────────┴──────────────┴──────────┘                       │
 *   └────────────────────────────────────────────────────────────┘
 *
 * Decisões:
 * - Mesmo trilho do `ExerciseItemCard`, mas com `omitRest` — o tempo de
 *   descanso vive no superset pai (entre rodadas), não no exercício.
 * - Filhos de superset não suportam `set_scheme` (modo avançado), então o
 *   trilho fica sempre em modo simples — todos os campos editáveis.
 * - Sempre aberto, sem chevron / collapse. O superset pai já é a "caixa".
 * - Fundo levemente acinzentado (`--surface-inset`) pra distinguir do
 *   container do superset sem precisar de outra borda colorida.
 * - Ações (desvincular, excluir) sempre visíveis no canto superior direito.
 * - Play do vídeo inline com o título — mesmo padrão do card pai.
 */
export function SupersetChildCard({
    item,
    onUpdate,
    onDelete,
    onRemoveFromSuperset,
    readonly,
}: SupersetChildCardProps) {
    const [showVideo, setShowVideo] = useState(false)

    const openVideo = () => {
        if (item.exercise?.video_url) setShowVideo(true)
    }
    const closeVideo = () => setShowVideo(false)

    return (
        <>
            <div className="bg-[#F9F9FB] dark:bg-surface-inset rounded-lg border border-[var(--border-subtle)] p-3 relative hover:border-[var(--border-primary)] transition-colors">
                <div className="space-y-2.5">
                    {/* Header: title + play + actions */}
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs font-bold text-[var(--text-primary)] truncate">
                                {item.exercise?.name || 'Exercício sem nome'}
                            </span>
                            {!readonly && item.exercise?.video_url && (
                                <button
                                    type="button"
                                    onClick={openVideo}
                                    className="text-[var(--text-quaternary)] hover:text-[#7C3AED] dark:hover:text-violet-400 transition-colors shrink-0"
                                    title="Ver vídeo demonstrativo"
                                    aria-label="Ver vídeo demonstrativo"
                                >
                                    <PlayCircle className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        {!readonly && (
                            <div className="flex items-center gap-1 shrink-0">
                                {onRemoveFromSuperset && (
                                    <button
                                        type="button"
                                        onClick={onRemoveFromSuperset}
                                        className="p-1 rounded-md text-[var(--text-quaternary)] hover:text-amber-500 dark:hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                                        title="Desvincular do superset"
                                        aria-label="Desvincular do superset"
                                    >
                                        <Unlink className="w-3 h-3" />
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={onDelete}
                                    className="p-1 rounded-md text-[var(--text-quaternary)] hover:text-[#FF3B30] dark:hover:text-red-400 hover:bg-[#FF3B30]/10 dark:hover:bg-red-400/10 transition-colors"
                                    title="Excluir exercício"
                                    aria-label="Excluir exercício"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Trilho (3 cards: Séries / Repetições / Função) */}
                    <ExerciseMetricsTrack
                        item={item}
                        readonly={readonly}
                        onUpdate={onUpdate}
                        omitRest
                    />
                </div>
            </div>

            <FloatingExercisePlayer
                isOpen={showVideo}
                onClose={closeVideo}
                videoUrl={item.exercise?.video_url || null}
                title={item.exercise?.name || ''}
            />
        </>
    )
}
