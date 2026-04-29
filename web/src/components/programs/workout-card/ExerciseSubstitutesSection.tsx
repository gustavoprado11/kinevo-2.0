'use client'

import { memo, useMemo, useState } from 'react'
import { Check, Repeat, Search } from 'lucide-react'

import type { WorkoutItem } from '../program-builder-client'
import type { Exercise } from '@/types/exercise'

interface ExerciseSubstitutesSectionProps {
    item: WorkoutItem
    exercises: Exercise[]
    onUpdate: (updates: Partial<WorkoutItem>) => void
}

export const ExerciseSubstitutesSection = memo(function ExerciseSubstitutesSection({
    item,
    exercises,
    onUpdate,
}: ExerciseSubstitutesSectionProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [query, setQuery] = useState('')

    const selectedIds = useMemo(
        () => item.substitute_exercise_ids || [],
        [item.substitute_exercise_ids],
    )
    const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
    const selectedCount = selectedIds.length
    const normalizedQuery = query.trim().toLowerCase()
    const currentExerciseId = item.exercise_id
    const currentGroups = useMemo(
        () => new Set((item.exercise?.muscle_groups || []).map((group) => group.name.toLowerCase())),
        [item.exercise?.muscle_groups],
    )

    const visibleCandidates = useMemo(() => {
        const sortedCandidates = [...exercises]
            .filter((exercise) => exercise.id !== currentExerciseId)
            .filter((exercise) => {
                if (!normalizedQuery) return true
                const muscleNames = (exercise.muscle_groups || []).map((group) => group.name.toLowerCase()).join(' ')
                return (
                    exercise.name.toLowerCase().includes(normalizedQuery) ||
                    (exercise.equipment || '').toLowerCase().includes(normalizedQuery) ||
                    muscleNames.includes(normalizedQuery)
                )
            })
            .sort((a, b) => {
                const aSelected = selectedSet.has(a.id) ? 1 : 0
                const bSelected = selectedSet.has(b.id) ? 1 : 0
                if (aSelected !== bSelected) return bSelected - aSelected

                const aOverlap = (a.muscle_groups || []).some((group) => currentGroups.has(group.name.toLowerCase())) ? 1 : 0
                const bOverlap = (b.muscle_groups || []).some((group) => currentGroups.has(group.name.toLowerCase())) ? 1 : 0
                if (aOverlap !== bOverlap) return bOverlap - aOverlap

                return a.name.localeCompare(b.name)
            })

        return sortedCandidates.slice(0, normalizedQuery ? 25 : 12)
    }, [currentExerciseId, currentGroups, exercises, normalizedQuery, selectedSet])

    const toggleSubstitute = (exerciseId: string) => {
        const next = selectedSet.has(exerciseId)
            ? selectedIds.filter((id) => id !== exerciseId)
            : [...selectedIds, exerciseId]
        onUpdate({ substitute_exercise_ids: next })
    }

    return (
        <div className="mt-2">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 text-[10px] font-semibold transition-colors group select-none"
            >
                <Repeat className={`w-3 h-3 ${isOpen ? 'text-[#007AFF] dark:text-violet-400' : 'text-[#6E6E73] dark:text-k-text-tertiary group-hover:text-[#1D1D1F] dark:group-hover:text-k-text-primary'}`} />
                <span className={isOpen || selectedCount > 0 ? 'text-[#007AFF] dark:text-violet-400' : 'text-[#6E6E73] dark:text-k-text-tertiary group-hover:text-[#1D1D1F] dark:group-hover:text-k-text-secondary'}>
                    {selectedCount > 0 ? `Substituições (${selectedCount})` : 'Substituições (nenhuma)'}
                </span>
            </button>

            <div className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${isOpen ? 'grid-rows-[1fr] mt-2' : 'grid-rows-[0fr]'}`}>
                <div className="overflow-hidden">
                    <div className="bg-[#F9F9FB] dark:bg-surface-inset rounded-xl border border-[#E8E8ED] dark:border-k-border-subtle p-3">
                        <div className="relative mb-2">
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Buscar exercício..."
                                className="w-full h-8 pl-8 pr-3 bg-white dark:bg-glass-bg border border-[#D2D2D7] dark:border-transparent rounded-lg text-[#1D1D1F] dark:text-k-text-primary text-xs placeholder:text-[#AEAEB2] dark:placeholder:text-k-text-quaternary focus:outline-none focus:ring-1 focus:ring-[#007AFF]/30 dark:focus:ring-violet-500/50 transition-all font-medium"
                            />
                            <Search className="w-3.5 h-3.5 text-k-text-quaternary absolute left-2.5 top-2.5" />
                        </div>

                        <div className="max-h-40 overflow-y-auto pr-1 space-y-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                            {visibleCandidates.length === 0 ? (
                                <div className="text-center py-4">
                                    <p className="text-[10px] text-k-text-quaternary">Nenhum exercício encontrado</p>
                                </div>
                            ) : (
                                visibleCandidates.map((exercise) => {
                                    const isSelected = selectedSet.has(exercise.id)
                                    return (
                                        <button
                                            key={exercise.id}
                                            onClick={() => toggleSubstitute(exercise.id)}
                                            className={`w-full text-left flex items-center justify-between p-2 rounded-lg transition-all group/item ${isSelected
                                                ? 'bg-[#007AFF]/10 dark:bg-violet-500/10 border border-[#007AFF]/20 dark:border-violet-500/20'
                                                : 'hover:bg-[#F5F5F7] dark:hover:bg-glass-bg border border-transparent hover:border-[#E8E8ED] dark:hover:border-k-border-subtle'
                                                }`}
                                        >
                                            <div className="min-w-0 flex-1 pr-2">
                                                <div className={`text-xs font-medium truncate transition-colors ${isSelected ? 'text-[#007AFF] dark:text-violet-300' : 'text-[#1D1D1F] dark:text-k-text-secondary group-hover/item:text-[#1D1D1F] dark:group-hover/item:text-k-text-primary'}`}>
                                                    {exercise.name}
                                                </div>
                                                <div className="text-[9px] text-k-text-quaternary truncate mt-0.5">
                                                    {(exercise.muscle_groups || []).map(g => g.name).join(', ') || 'Sem grupo'}
                                                </div>
                                            </div>

                                            {isSelected && (
                                                <div className="text-[#007AFF] dark:text-violet-400 animate-in zoom-in-50 duration-200">
                                                    <Check className="w-3.5 h-3.5" />
                                                </div>
                                            )}
                                        </button>
                                    )
                                })
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
})
