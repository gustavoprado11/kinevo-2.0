'use client'

import { memo, useEffect, useMemo, useRef } from 'react'
import { PlayCircle, Search, X } from 'lucide-react'

import type { WorkoutItem } from '../program-builder-client'
import type { Exercise } from '@/types/exercise'

interface ExerciseSwapPanelProps {
    item: WorkoutItem
    exercises: Exercise[]
    query: string
    onQueryChange: (query: string) => void
    onCancel: () => void
    onConfirm: (exercise: Exercise) => void
    onShowVideo: (exercise: Exercise) => void
}

export const ExerciseSwapPanel = memo(function ExerciseSwapPanel({
    item,
    exercises,
    query,
    onQueryChange,
    onCancel,
    onConfirm,
    onShowVideo,
}: ExerciseSwapPanelProps) {
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        const id = window.setTimeout(() => inputRef.current?.focus(), 50)
        return () => window.clearTimeout(id)
    }, [])

    const swapCandidates = useMemo(() => {
        const currentGroups = new Set((item.exercise?.muscle_groups || []).map(g => g.name.toLowerCase()))
        const normalizedQuery = query.toLowerCase()

        return exercises
            .filter(ex => ex.id !== item.exercise_id)
            .filter(ex => {
                if (!query.trim()) return true
                return ex.name.toLowerCase().includes(normalizedQuery) ||
                    (ex.muscle_groups || []).some(g => g.name.toLowerCase().includes(normalizedQuery))
            })
            .sort((a, b) => {
                const aOverlap = (a.muscle_groups || []).some(g => currentGroups.has(g.name.toLowerCase())) ? 1 : 0
                const bOverlap = (b.muscle_groups || []).some(g => currentGroups.has(g.name.toLowerCase())) ? 1 : 0
                if (aOverlap !== bOverlap) return bOverlap - aOverlap
                return a.name.localeCompare(b.name)
            })
            .slice(0, 8)
    }, [exercises, item.exercise?.muscle_groups, item.exercise_id, query])

    return (
        <div className="bg-white dark:bg-surface-card rounded-xl border border-[#7C3AED]/30 dark:border-violet-500/30 p-4 relative transition-all">
            <div className="flex items-center gap-3 mb-3">
                <Search className="w-4 h-4 text-k-text-quaternary shrink-0" />
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => onQueryChange(e.target.value)}
                    onKeyDown={(e) => e.key === 'Escape' && onCancel()}
                    placeholder="Buscar exercício para substituir..."
                    className="flex-1 bg-transparent text-sm text-k-text-primary placeholder:text-k-text-quaternary focus:outline-none"
                />
                <button
                    onClick={onCancel}
                    className="text-k-text-quaternary hover:text-k-text-primary transition-colors shrink-0"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            <div className="max-h-52 overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                {swapCandidates.length === 0 ? (
                    <p className="text-center text-xs text-k-text-quaternary py-4">Nenhum exercício encontrado</p>
                ) : (
                    swapCandidates.map(ex => (
                        <div
                            key={ex.id}
                            className="flex items-center gap-1 rounded-lg hover:bg-[#7C3AED]/10 dark:hover:bg-violet-500/10 transition-colors group/swap"
                        >
                            <button
                                onClick={() => onConfirm(ex)}
                                className="flex-1 flex items-center justify-between px-3 py-2 text-left min-w-0"
                            >
                                <span className="text-xs font-medium text-k-text-secondary group-hover/swap:text-k-text-primary truncate">
                                    {ex.name}
                                </span>
                                <div className="flex gap-1 shrink-0 ml-2">
                                    {(ex.muscle_groups || []).slice(0, 2).map(g => (
                                        <span key={g.id || g.name} className="text-[9px] text-k-text-quaternary bg-glass-bg px-1.5 py-0.5 rounded font-bold">
                                            {g.name}
                                        </span>
                                    ))}
                                </div>
                            </button>
                            {ex.video_url && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onShowVideo(ex)
                                    }}
                                    className="p-1.5 text-[#AEAEB2] dark:text-k-text-quaternary hover:text-[#7C3AED] dark:hover:text-violet-400 transition-colors shrink-0 mr-1"
                                    title="Ver vídeo demonstrativo"
                                >
                                    <PlayCircle className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    ))
                )}
            </div>

            <div className="mt-3 pt-2 border-t border-k-border-subtle text-[10px] text-k-text-quaternary">
                Mantendo: {item.sets || 0} séries × {item.reps || '0'} reps, {item.rest_seconds || 0}s descanso
            </div>
        </div>
    )
})
