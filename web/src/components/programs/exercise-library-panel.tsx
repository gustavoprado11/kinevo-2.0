'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { FloatingExercisePlayer } from '@/components/exercises/floating-exercise-player'
import { ExerciseFormModal } from '@/components/exercises/exercise-form-modal'

import type { Exercise } from '@/types/exercise'

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
    const [selectedMuscleGroups, setSelectedMuscleGroups] = useState<Set<string>>(new Set())
    const [previewExercise, setPreviewExercise] = useState<Exercise | null>(null)
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [showMoreFilters, setShowMoreFilters] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowMoreFilters(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Get unique muscle groups (from array of objects)
    const muscleGroups = useMemo(() => {
        const groups = new Set<string>()
        exercises.forEach(e => {
            if (e.muscle_groups && e.muscle_groups.length > 0) {
                e.muscle_groups.forEach(g => {
                    // Safety check if it's an object
                    if (typeof g === 'object' && g.name) groups.add(g.name)
                })
            }
        })
        return Array.from(groups).sort()
    }, [exercises])

    // Split into visible chips and hidden ones
    const visibleChipsCount = 5
    const visibleGroups = muscleGroups.slice(0, visibleChipsCount)
    const hiddenGroups = muscleGroups.slice(visibleChipsCount)

    // Identify overrides (trainer customizations of system exercises)
    const overrideSystemIds = useMemo(() => {
        return new Set(
            exercises
                .filter(e => e.owner_id === trainerId && e.original_system_id)
                .map(e => e.original_system_id)
        )
    }, [exercises, trainerId])

    // Filter exercises with multi-select OR logic
    const filteredExercises = useMemo(() => {
        return exercises.filter(exercise => {
            // Deduplication: Hide system exercise if override exists
            if (!exercise.owner_id && overrideSystemIds.has(exercise.id)) {
                return false
            }

            const matchesSearch = exercise.name.toLowerCase().includes(searchQuery.toLowerCase())

            // Check muscle group filter (OR logic - match ANY selected group)
            const exerciseMuscles = exercise.muscle_groups && exercise.muscle_groups.length > 0
                ? exercise.muscle_groups.map(g => g.name)
                : []

            const matchesMuscle = selectedMuscleGroups.size === 0 ||
                exerciseMuscles.some(m => selectedMuscleGroups.has(m))

            return matchesSearch && matchesMuscle
        })
    }, [exercises, searchQuery, selectedMuscleGroups, overrideSystemIds])

    // Toggle a muscle group filter
    const toggleMuscleGroup = (group: string) => {
        setSelectedMuscleGroups(prev => {
            const newSet = new Set(prev)
            if (newSet.has(group)) {
                newSet.delete(group)
            } else {
                newSet.add(group)
            }
            return newSet
        })
    }

    // Clear all filters
    const clearFilters = () => {
        setSelectedMuscleGroups(new Set())
    }

    // Count of selected filters in hidden groups
    const hiddenSelectedCount = hiddenGroups.filter(g => selectedMuscleGroups.has(g)).length

    return (
        <>
            <div className="flex flex-col h-full bg-surface-primary">
                {/* Header */}
                <div className="px-4 py-4 border-b border-k-border-subtle">
                    <h3 className="text-sm font-semibold text-k-text-primary">Biblioteca</h3>
                    <p className="text-xs text-k-text-tertiary mt-0.5">{filteredExercises.length} exercícios</p>
                </div>

                {/* Search & Filters */}
                <div className="px-4 py-3 border-b border-k-border-subtle space-y-3">
                    <div className="relative">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-k-text-quaternary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Buscar exercício..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-glass-bg border border-slate-200 dark:border-k-border-subtle rounded-lg text-k-text-primary placeholder:text-k-text-quaternary focus:outline-none focus:ring-1 focus:ring-violet-500/50 transition-all"
                        />
                    </div>

                    {/* Muscle group filters - Multi-select */}
                    {muscleGroups.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {/* "Todos" chip - clears all filters */}
                            <button
                                onClick={clearFilters}
                                className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md border transition-colors ${selectedMuscleGroups.size === 0
                                    ? 'bg-violet-500/20 text-violet-300 border-violet-500/30'
                                    : 'text-k-text-tertiary border-k-border-subtle hover:border-k-border-primary hover:text-k-text-primary'
                                    }`}
                            >
                                Todos
                            </button>

                            {/* Visible muscle group chips */}
                            {visibleGroups.map(group => (
                                <button
                                    key={group}
                                    onClick={() => toggleMuscleGroup(group)}
                                    className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md border transition-colors ${selectedMuscleGroups.has(group)
                                        ? 'bg-violet-500/20 text-violet-300 border-violet-500/30'
                                        : 'text-k-text-tertiary border-k-border-subtle hover:border-k-border-primary hover:text-k-text-primary'
                                        }`}
                                >
                                    {group}
                                </button>
                            ))}

                            {/* +N button with dropdown */}
                            {hiddenGroups.length > 0 && (
                                <div className="relative" ref={dropdownRef}>
                                    <button
                                        onClick={() => setShowMoreFilters(!showMoreFilters)}
                                        className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md border transition-colors flex items-center gap-1 ${hiddenSelectedCount > 0
                                            ? 'bg-violet-500/20 text-violet-300 border-violet-500/30'
                                            : 'text-k-text-tertiary border-k-border-subtle hover:border-k-border-primary hover:text-k-text-primary'
                                            }`}
                                    >
                                        +{hiddenGroups.length}
                                        {hiddenSelectedCount > 0 && (
                                            <span className="w-4 h-4 flex items-center justify-center bg-violet-500 text-white text-[9px] rounded-full ml-1">
                                                {hiddenSelectedCount}
                                            </span>
                                        )}
                                    </button>

                                    {/* Dropdown menu */}
                                    {showMoreFilters && (
                                        <div className="absolute z-50 top-full left-0 mt-1 w-48 bg-surface-card border border-k-border-primary rounded-lg shadow-xl py-1 max-h-64 overflow-y-auto">
                                            {hiddenGroups.map(group => (
                                                <button
                                                    key={group}
                                                    onClick={() => toggleMuscleGroup(group)}
                                                    className="w-full px-3 py-2 text-left text-xs font-medium uppercase tracking-wide flex items-center justify-between hover:bg-glass-bg transition-colors"
                                                >
                                                    <span className={selectedMuscleGroups.has(group) ? 'text-violet-400' : 'text-k-text-secondary'}>
                                                        {group}
                                                    </span>
                                                    {selectedMuscleGroups.has(group) && (
                                                        <svg className="w-3 h-3 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Exercise List */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {filteredExercises.length === 0 ? (
                        <div className="text-center py-8">
                            <p className="text-k-text-quaternary text-sm mb-4">Nenhum exercício encontrado</p>

                            {/* Create Exercise CTA */}
                            {searchQuery.trim() && (
                                <button
                                    onClick={() => setIsCreateModalOpen(true)}
                                    className="flex items-center justify-center gap-2 mx-auto px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-all shadow-lg shadow-violet-500/20"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    Criar "{searchQuery}"
                                </button>
                            )}

                            {selectedMuscleGroups.size > 0 && (
                                <button
                                    onClick={clearFilters}
                                    className="text-violet-400 text-xs hover:text-violet-300 mt-4 block mx-auto"
                                >
                                    Limpar filtros
                                </button>
                            )}
                        </div>
                    ) : (
                        filteredExercises.map(exercise => (
                            <div
                                key={exercise.id}
                                onClick={() => {
                                    if (activeWorkoutId) {
                                        onAddExercise(exercise)
                                    }
                                }}
                                className={`group w-full text-left px-3 py-3 rounded-lg transition-all border border-transparent ${activeWorkoutId
                                    ? 'cursor-pointer hover:bg-glass-bg active:bg-glass-bg-active'
                                    : 'cursor-not-allowed opacity-50'
                                    }`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-sm font-medium truncate transition-colors ${activeWorkoutId ? 'text-k-text-secondary group-hover:text-k-text-primary' : 'text-k-text-tertiary'}`}>
                                                {exercise.name}
                                            </span>
                                        </div>

                                        <div className="flex flex-wrap gap-1">
                                            {(exercise.muscle_groups || []).slice(0, 2).map(group => {
                                                const groupName = typeof group === 'object' ? group.name : group
                                                const groupKey = typeof group === 'object' ? group.id : group
                                                return (
                                                    <span key={groupKey} className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-k-text-quaternary bg-glass-bg rounded-md">
                                                        {groupName}
                                                    </span>
                                                )
                                            })}
                                            {exercise.equipment && (
                                                <span className="px-1.5 py-0.5 text-[9px] bg-glass-bg text-k-text-quaternary rounded-md">
                                                    {exercise.equipment}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Play button - Opens video preview modal */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            e.preventDefault()
                                            setPreviewExercise(exercise)
                                        }}
                                        className={`w-7 h-7 flex items-center justify-center rounded-md transition-all flex-shrink-0 ${exercise.video_url
                                            ? 'text-k-text-quaternary hover:text-k-text-primary hover:bg-glass-bg-active'
                                            : 'text-k-border-subtle cursor-default'
                                            }`}
                                        disabled={!exercise.video_url}
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer/Help */}
                <div className="px-4 py-3 border-t border-k-border-subtle bg-glass-bg">
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-glass-bg hover:bg-glass-bg-active text-k-text-secondary hover:text-k-text-primary text-xs font-medium rounded-lg transition-colors"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
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
                    }
                    setSearchQuery('')
                }}
                trainerId={trainerId}
                defaultName={searchQuery}
            />
        </>
    )
}
