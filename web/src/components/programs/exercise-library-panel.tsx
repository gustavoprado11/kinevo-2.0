'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, PlayCircle, Plus, Search, X } from 'lucide-react'
import { FloatingExercisePlayer } from '@/components/exercises/floating-exercise-player'
import { ExerciseFormModal } from '@/components/exercises/exercise-form-modal'

import type { Exercise } from '@/types/exercise'

// "Barra Fixa Gráviton (Pegada Pronada)" → ["Barra Fixa Gráviton", "Pegada Pronada"]
// "Remada Unilateral Halteres - Pegada Neutra" → ["Remada Unilateral Halteres", "Pegada Neutra"]
function splitExerciseName(name: string): [string, string?] {
    const dashMatch = name.match(/^(.+?)\s*[-–]\s*(.+)$/)
    if (dashMatch) return [dashMatch[1], dashMatch[2]]

    const parenMatch = name.match(/^(.+?)\s*\((.+)\)$/)
    if (parenMatch) return [parenMatch[1], parenMatch[2]]

    return [name]
}

function ScrollableChips({ children }: { children: React.ReactNode }) {
    const scrollRef = useRef<HTMLDivElement>(null)
    const [showLeft, setShowLeft] = useState(false)
    const [showRight, setShowRight] = useState(false)

    const checkArrows = useCallback(() => {
        const el = scrollRef.current
        if (!el) return
        setShowLeft(el.scrollLeft > 0)
        setShowRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
    }, [])

    useEffect(() => {
        checkArrows()
        const el = scrollRef.current
        if (!el) return
        el.addEventListener('scroll', checkArrows, { passive: true })
        const observer = new ResizeObserver(checkArrows)
        observer.observe(el)
        return () => {
            el.removeEventListener('scroll', checkArrows)
            observer.disconnect()
        }
    }, [checkArrows, children])

    const scroll = (direction: 'left' | 'right') => {
        scrollRef.current?.scrollBy({ left: direction === 'left' ? -150 : 150, behavior: 'smooth' })
    }

    return (
        <div className="relative px-3 pb-2">
            {showLeft && (
                <button
                    onClick={() => scroll('left')}
                    className="absolute left-1 top-0 z-10 h-[26px] flex items-center pl-0.5 pr-1 bg-gradient-to-r from-white via-white/90 to-transparent dark:from-surface-primary dark:via-surface-primary/90"
                >
                    <ChevronLeft className="w-3.5 h-3.5 text-[#8E8E93] dark:text-k-text-quaternary" />
                </button>
            )}

            <div
                ref={scrollRef}
                onWheel={(e) => {
                    if (scrollRef.current && e.deltaY !== 0) {
                        e.preventDefault()
                        scrollRef.current.scrollLeft += e.deltaY
                    }
                }}
                className="flex gap-1 overflow-x-auto pb-0.5"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                {children}
            </div>

            {showRight && (
                <button
                    onClick={() => scroll('right')}
                    className="absolute right-1 top-0 z-10 h-[26px] flex items-center pr-0.5 pl-1 bg-gradient-to-l from-white via-white/90 to-transparent dark:from-surface-primary dark:via-surface-primary/90"
                >
                    <ChevronRight className="w-3.5 h-3.5 text-[#8E8E93] dark:text-k-text-quaternary" />
                </button>
            )}
        </div>
    )
}

interface ExerciseLibraryPanelProps {
    exercises: Exercise[]
    trainerId: string
    onAddExercise: (exercise: Exercise) => void
    onExerciseCreated?: (exercise: Exercise) => void
    activeWorkoutId: string | null
}

export function ExerciseLibraryPanel({
    exercises,
    trainerId,
    onAddExercise,
    onExerciseCreated,
    activeWorkoutId
}: ExerciseLibraryPanelProps) {
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
    const [previewExercise, setPreviewExercise] = useState<Exercise | null>(null)
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

    // Get unique muscle groups
    const muscleGroups = useMemo(() => {
        const groups = new Set<string>()
        exercises.forEach(e => {
            if (e.muscle_groups && e.muscle_groups.length > 0) {
                e.muscle_groups.forEach(g => {
                    if (typeof g === 'object' && g.name) groups.add(g.name)
                })
            }
        })
        return Array.from(groups).sort()
    }, [exercises])

    // Identify overrides (trainer customizations of system exercises)
    const overrideSystemIds = useMemo(() => {
        return new Set(
            exercises
                .filter(e => e.owner_id === trainerId && e.original_system_id)
                .map(e => e.original_system_id)
        )
    }, [exercises, trainerId])

    // Filter exercises
    const filteredExercises = useMemo(() => {
        return exercises.filter(exercise => {
            if (!exercise.owner_id && overrideSystemIds.has(exercise.id)) {
                return false
            }

            const matchesSearch = exercise.name.toLowerCase().includes(searchQuery.toLowerCase())

            const exerciseMuscles = exercise.muscle_groups && exercise.muscle_groups.length > 0
                ? exercise.muscle_groups.map(g => g.name)
                : []

            const matchesMuscle = !selectedGroup ||
                exerciseMuscles.includes(selectedGroup)

            return matchesSearch && matchesMuscle
        })
    }, [exercises, searchQuery, selectedGroup, overrideSystemIds])

    return (
        <>
            <div className="flex flex-col h-full bg-white dark:bg-surface-primary">
                {/* Search — dominant element */}
                <div className="px-3 pt-3 pb-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#AEAEB2] dark:text-k-text-quaternary" />
                        <input
                            type="text"
                            placeholder="Buscar exercício..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-8 py-2.5 text-sm bg-[#F5F5F7] dark:bg-glass-bg border border-[#E8E8ED] dark:border-k-border-subtle rounded-xl text-[#1D1D1F] dark:text-k-text-primary placeholder:text-[#AEAEB2] dark:placeholder:text-k-text-quaternary focus:outline-none focus:ring-1 focus:ring-[#007AFF]/30 dark:focus:ring-violet-500/50 focus:border-[#007AFF] dark:focus:border-violet-500/50 transition-all"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-k-text-quaternary hover:text-k-text-secondary transition-colors"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Scrollable filter pills with arrow navigation */}
                {muscleGroups.length > 0 && (
                    <ScrollableChips>
                        <button
                            onClick={() => setSelectedGroup(null)}
                            className={`px-3 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition-colors shrink-0 ${
                                !selectedGroup
                                    ? 'bg-[#007AFF] dark:bg-violet-600 text-white'
                                    : 'bg-[#F5F5F7] dark:bg-glass-bg text-[#6E6E73] dark:text-k-text-tertiary hover:text-[#1D1D1F] dark:hover:text-k-text-secondary'
                            }`}
                        >
                            Todos
                        </button>
                        {muscleGroups.map(group => (
                            <button
                                key={group}
                                onClick={() => setSelectedGroup(prev => prev === group ? null : group)}
                                className={`px-3 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition-colors shrink-0 ${
                                    selectedGroup === group
                                        ? 'bg-[#007AFF] dark:bg-violet-600 text-white'
                                        : 'bg-[#F5F5F7] dark:bg-glass-bg text-[#6E6E73] dark:text-k-text-tertiary hover:text-[#1D1D1F] dark:hover:text-k-text-secondary'
                                }`}
                            >
                                {group}
                            </button>
                        ))}
                    </ScrollableChips>
                )}

                {/* Result count */}
                <div className="px-4 py-1.5 border-y border-[#E8E8ED] dark:border-k-border-subtle">
                    <span className="text-[10px] text-[#8E8E93] dark:text-k-text-quaternary font-medium">
                        {filteredExercises.length} exercício{filteredExercises.length !== 1 ? 's' : ''}
                        {selectedGroup && <> em <span className="text-[#6E6E73] dark:text-k-text-tertiary">{selectedGroup}</span></>}
                    </span>
                </div>

                {/* Compact exercise list */}
                <div className="flex-1 overflow-y-auto">
                    {filteredExercises.length === 0 ? (
                        <div className="text-center py-8 px-4">
                            <p className="text-k-text-quaternary text-sm mb-3">
                                Nenhum exercício encontrado
                                {searchQuery.trim() && <> para &ldquo;{searchQuery}&rdquo;</>}
                            </p>

                            {searchQuery.trim() && (
                                <button
                                    onClick={() => setIsCreateModalOpen(true)}
                                    className="text-[#007AFF] dark:text-violet-400 hover:text-[#0056B3] dark:hover:text-violet-300 text-sm font-medium transition-colors"
                                >
                                    + Criar &ldquo;{searchQuery}&rdquo;
                                </button>
                            )}

                            {selectedGroup && (
                                <button
                                    onClick={() => setSelectedGroup(null)}
                                    className="text-[#007AFF] dark:text-violet-400 text-xs hover:text-[#0056B3] dark:hover:text-violet-300 mt-3 block mx-auto"
                                >
                                    Limpar filtro
                                </button>
                            )}
                        </div>
                    ) : (
                        filteredExercises.map(exercise => {
                            const primaryGroup = exercise.muscle_groups?.[0]
                            const groupName = primaryGroup ? (typeof primaryGroup === 'object' ? primaryGroup.name : primaryGroup) : null
                            const [mainName, variant] = splitExerciseName(exercise.name)

                            return (
                                <div
                                    key={exercise.id}
                                    draggable={!!activeWorkoutId}
                                    onDragStart={(e) => {
                                        e.dataTransfer.setData('application/kinevo-exercise-id', exercise.id)
                                        e.dataTransfer.effectAllowed = 'copy'
                                    }}
                                    className={`flex items-center gap-2 py-2 px-3 min-h-[56px] border-b border-[#E8E8ED]/50 dark:border-k-border-subtle/50 transition-colors group/item ${
                                        activeWorkoutId
                                            ? 'cursor-grab hover:bg-[#F5F5F7] dark:hover:bg-glass-bg active:bg-[#ECECF0] dark:active:bg-glass-bg-active active:cursor-grabbing'
                                            : 'cursor-not-allowed opacity-50'
                                    }`}
                                    title={exercise.name}
                                >
                                    {/* Name — uniform 2-line height */}
                                    <button
                                        onClick={() => {
                                            if (activeWorkoutId) onAddExercise(exercise)
                                        }}
                                        className="flex-1 min-w-0 text-left mr-1"
                                        disabled={!activeWorkoutId}
                                    >
                                        {variant ? (
                                            <>
                                                <span className={`text-[13px] font-medium truncate block leading-tight transition-colors ${
                                                    activeWorkoutId ? 'text-k-text-secondary group-hover/item:text-k-text-primary' : 'text-k-text-tertiary'
                                                }`}>
                                                    {mainName}
                                                </span>
                                                <span className="text-[11px] text-k-text-quaternary truncate block leading-tight">
                                                    {variant}
                                                </span>
                                            </>
                                        ) : (
                                            <span className={`text-[13px] font-medium leading-tight line-clamp-2 transition-colors ${
                                                activeWorkoutId ? 'text-k-text-secondary group-hover/item:text-k-text-primary' : 'text-k-text-tertiary'
                                            }`}>
                                                {exercise.name}
                                            </span>
                                        )}
                                    </button>

                                    {/* Badge + actions — right-aligned, vertically centered */}
                                    <div className="flex items-center gap-2 shrink-0">
                                        {groupName && (
                                            <span className="text-[9px] text-[#8E8E93] dark:text-k-text-quaternary font-bold">
                                                {groupName}
                                            </span>
                                        )}

                                        <div className="flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                            {exercise.video_url && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        e.preventDefault()
                                                        setPreviewExercise(exercise)
                                                    }}
                                                    className="p-1 text-[#AEAEB2] dark:text-k-text-quaternary hover:text-[#007AFF] dark:hover:text-violet-400 transition-colors"
                                                    title="Ver vídeo"
                                                >
                                                    <PlayCircle className="w-4 h-4" />
                                                </button>
                                            )}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    e.preventDefault()
                                                    if (activeWorkoutId) onAddExercise(exercise)
                                                }}
                                                className="p-1 text-k-text-quaternary hover:text-emerald-400 transition-colors"
                                                title="Adicionar ao treino"
                                                disabled={!activeWorkoutId}
                                            >
                                                <Plus className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="px-3 py-2.5 border-t border-[#E8E8ED] dark:border-k-border-subtle bg-[#F9F9FB] dark:bg-glass-bg">
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white dark:bg-glass-bg hover:bg-[#F5F5F7] dark:hover:bg-glass-bg-active text-[#007AFF] dark:text-k-text-secondary hover:text-[#0056B3] dark:hover:text-k-text-primary text-xs font-medium rounded-lg transition-colors border border-[#E8E8ED] dark:border-transparent"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Criar novo exercício
                    </button>
                </div>
            </div>

            {/* Floating PiP Video Player */}
            <FloatingExercisePlayer
                isOpen={!!previewExercise}
                onClose={() => setPreviewExercise(null)}
                videoUrl={previewExercise?.video_url || null}
                title={previewExercise?.name || ''}
            />

            {/* Create Exercise Modal */}
            <ExerciseFormModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={(newExercise) => {
                    if (onExerciseCreated && newExercise) {
                        onExerciseCreated(newExercise)
                        setSearchQuery(newExercise.name)
                    } else {
                        setSearchQuery('')
                    }
                }}
                trainerId={trainerId}
                defaultName={searchQuery}
            />
        </>
    )
}
