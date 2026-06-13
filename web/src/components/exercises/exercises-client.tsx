'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout'
import { useMuscleGroups } from '@/hooks/use-muscle-groups'
import { createClient } from '@/lib/supabase/client'
import { ExerciseItem, ExerciseWithDetails } from './exercise-item'
import { ExerciseFormModal } from './exercise-form-modal'
import { MuscleGroupManagerModal } from './muscle-group-manager-modal'
import { TrainerVideoModal, type TrainerVideoData } from './trainer-video-modal'
import { ConciergeButton } from './concierge-button'
import { ConciergeModal } from './concierge-modal'
import { useOnboardingStore } from '@/stores/onboarding-store'
import { Button } from '@/components/ui/button'
import { Plus, Search, Settings2, LayoutGrid, List, ChevronDown, Check, Layers, User } from 'lucide-react'
import { TourRunner } from '@/components/onboarding/tours/tour-runner'
import { TOUR_STEPS } from '@/components/onboarding/tours/tour-definitions'
import { revalidateMyExerciseLibrary } from '@/actions/exercises/revalidate-library'
import { useToast } from '@/components/ui/toast'
import { patternLabel, sortPatternLabels } from '@/lib/movement-patterns'

type ViewMode = 'grid' | 'list'

// --- Filter Dropdown ---
function FilterDropdown({
    label,
    options,
    selected,
    onToggle,
    onClear,
    counts,
}: {
    label: string
    options: string[]
    selected: string[]
    onToggle: (option: string) => void
    onClear: () => void
    counts?: Record<string, number>
}) {
    const [isOpen, setIsOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                    selected.length > 0
                        ? 'bg-[#7C3AED]/10 border-[#7C3AED]/30 text-[#7C3AED] dark:bg-violet-500/10 dark:border-violet-500/30 dark:text-violet-300'
                        : 'bg-white dark:bg-glass-bg border-[#D2D2D7] dark:border-k-border-primary text-[#1D1D1F] dark:text-k-text-secondary hover:bg-[#F5F5F7] dark:hover:bg-glass-bg-active'
                }`}
            >
                {label}
                {selected.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-[#7C3AED]/20 dark:bg-violet-500/20 text-[10px] font-bold">
                        {selected.length}
                    </span>
                )}
                <ChevronDown className={`w-3.5 h-3.5 text-[#AEAEB2] dark:text-inherit transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-64 max-h-72 overflow-y-auto bg-white dark:bg-surface-card border border-[#D2D2D7] dark:border-k-border-primary rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-2xl z-modal">
                    {selected.length > 0 && (
                        <button
                            onClick={() => { onClear(); setIsOpen(false) }}
                            className="w-full px-4 py-2 text-left text-xs font-medium text-[#FF3B30] dark:text-red-400/80 hover:bg-[#F5F5F7] dark:hover:bg-glass-bg-active border-b border-[#E8E8ED] dark:border-k-border-subtle"
                        >
                            Limpar filtros
                        </button>
                    )}
                    {options.map(option => {
                        const isSelected = selected.includes(option)
                        const count = counts?.[option]
                        return (
                            <button
                                key={option}
                                onClick={() => onToggle(option)}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                                    isSelected ? 'text-[#7C3AED] dark:text-violet-300 bg-[#7C3AED]/5 dark:bg-violet-500/5' : 'text-[#1D1D1F] dark:text-k-text-secondary hover:bg-[#F5F5F7] dark:hover:bg-glass-bg-active'
                                }`}
                            >
                                <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                    isSelected ? 'bg-[#7C3AED] border-[#7C3AED] dark:bg-violet-500 dark:border-violet-500' : 'border-[#D2D2D7] dark:border-k-border-primary'
                                }`}>
                                    {isSelected && <Check className="w-3 h-3 text-white" />}
                                </div>
                                <span className="flex-1 truncate">{option}</span>
                                {count !== undefined && (
                                    <span className="text-[10px] font-bold text-[#AEAEB2] dark:text-k-text-quaternary">{count}</span>
                                )}
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

// --- Main Component ---
interface ExercisesClientProps {
    initialExercises: ExerciseWithDetails[]
    currentTrainerId: string
    trainerName: string
    trainerEmail?: string
    trainerAvatarUrl?: string | null
    trainerTheme?: 'light' | 'dark' | 'system'
    initialTrainerVideosMap?: Record<string, TrainerVideoData>
    /** All muscle groups (with parent_id) so the filter can expand parents to include descendants. */
    muscleGroupTree?: Array<{ id: string; name: string; parent_id: string | null }>
}

export function ExercisesClient({
    initialExercises,
    currentTrainerId,
    trainerName,
    trainerEmail,
    trainerAvatarUrl,
    trainerTheme,
    initialTrainerVideosMap = {},
    muscleGroupTree = [],
}: ExercisesClientProps) {
    const router = useRouter()
    const { toast } = useToast()
    const [exercises, setExercises] = useState(initialExercises)
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedMuscleGroups, setSelectedMuscleGroups] = useState<string[]>([])
    const [selectedPatterns, setSelectedPatterns] = useState<string[]>([])
    const [groupByPattern, setGroupByPattern] = useState(false)
    const [showOnlyMine, setShowOnlyMine] = useState(false)

    // Mapa parent -> children names (e.g. "Mobilidade" -> ["Mobilidade Quadril", "Mobilidade Ombro", ...])
    const childrenByParentName = useMemo(() => {
        const byId = new Map(muscleGroupTree.map(g => [g.id, g]))
        const map = new Map<string, string[]>()
        for (const g of muscleGroupTree) {
            if (!g.parent_id) continue
            const parent = byId.get(g.parent_id)
            if (!parent) continue
            const arr = map.get(parent.name) || []
            arr.push(g.name)
            map.set(parent.name, arr)
        }
        return map
    }, [muscleGroupTree])
    const [viewMode, setViewMode] = useState<ViewMode>('grid')

    // Modal states
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [isManagerOpen, setIsManagerOpen] = useState(false)
    const [isConciergeOpen, setIsConciergeOpen] = useState(false)
    const [conciergeSource, setConciergeSource] = useState<string>('biblioteca_button')
    const [editingExercise, setEditingExercise] = useState<ExerciseWithDetails | null>(null)
    const [trainerVideosMap, setTrainerVideosMap] = useState<Record<string, TrainerVideoData>>(initialTrainerVideosMap)
    const [videoModalExercise, setVideoModalExercise] = useState<ExerciseWithDetails | null>(null)

    useMemo(() => {
        setExercises(initialExercises)
    }, [initialExercises])

    // Hook for muscle groups (Single Source of Truth)
    const muscleGroupsManager = useMuscleGroups(currentTrainerId)
    const { muscleGroups: availableMuscleGroups } = muscleGroupsManager

    // Deduplicated muscle groups (case-insensitive)
    const allMuscleGroups = useMemo(() => {
        const seen = new Map<string, string>()
        for (const g of availableMuscleGroups) {
            const lower = g.name.toLowerCase().trim()
            if (!seen.has(lower)) {
                seen.set(lower, g.name)
            }
        }
        return Array.from(seen.values()).sort()
    }, [availableMuscleGroups])

    // Pre-dedup exercises (system override deduplication)
    const deduplicatedExercises = useMemo(() => {
        const overrideSystemIds = new Set(
            exercises
                .filter(e => e.owner_id === currentTrainerId && e.original_system_id)
                .map(e => e.original_system_id)
        )
        return exercises.filter(exercise => {
            if (!exercise.owner_id && overrideSystemIds.has(exercise.id)) return false
            return true
        })
    }, [exercises, currentTrainerId])

    // Dynamic count per muscle group. Counts both direct matches and
    // descendants — so "Mobilidade" shows the sum of its children too.
    const muscleGroupCounts = useMemo(() => {
        const counts: Record<string, number> = {}
        for (const exercise of deduplicatedExercises) {
            const muscles = exercise.muscle_groups?.filter(g => g != null).map(g => g.name) || []
            const namesForCount = new Set<string>(muscles)
            // For each muscle name on the exercise, also bump its ancestors' counts.
            // We invert the children map: child -> parent_name.
            for (const m of muscles) {
                for (const [parentName, children] of childrenByParentName.entries()) {
                    if (children.includes(m)) namesForCount.add(parentName)
                }
            }
            for (const m of namesForCount) {
                counts[m] = (counts[m] || 0) + 1
            }
        }
        return counts
    }, [deduplicatedExercises, childrenByParentName])

    // Contagem por Padrão de Movimento (rótulo PT). "Sem padrão" agrupa os null.
    const patternCounts = useMemo(() => {
        const counts: Record<string, number> = {}
        for (const exercise of deduplicatedExercises) {
            const label = patternLabel(exercise.movement_pattern)
            counts[label] = (counts[label] || 0) + 1
        }
        return counts
    }, [deduplicatedExercises])

    const availablePatterns = useMemo(
        () => sortPatternLabels(Object.keys(patternCounts)),
        [patternCounts]
    )

    // Expand each selected group to include its hierarchy descendants.
    // e.g. selecting "Mobilidade" also matches "Mobilidade Quadril", "Mobilidade Ombro", etc.
    const expandedSelection = useMemo(() => {
        const set = new Set<string>()
        for (const name of selectedMuscleGroups) {
            set.add(name)
            const children = childrenByParentName.get(name) || []
            for (const child of children) set.add(child)
        }
        return set
    }, [selectedMuscleGroups, childrenByParentName])

    // Filter exercises (Search + Muscle Group)
    const filteredExercises = useMemo(() => {
        return deduplicatedExercises.filter(exercise => {
            const matchesOwner = !showOnlyMine || exercise.owner_id === currentTrainerId

            const matchesSearch = exercise.name.toLowerCase().includes(searchQuery.toLowerCase())

            let matchesMuscle = true
            if (expandedSelection.size > 0) {
                const muscles = exercise.muscle_groups?.filter(g => g != null).map(g => g.name) || []
                matchesMuscle = muscles.some(m => expandedSelection.has(m))
            }

            const matchesPattern = selectedPatterns.length === 0
                || selectedPatterns.includes(patternLabel(exercise.movement_pattern))

            return matchesOwner && matchesSearch && matchesMuscle && matchesPattern
        })
    }, [deduplicatedExercises, showOnlyMine, currentTrainerId, searchQuery, expandedSelection, selectedPatterns])

    // Quantos exercícios são de autoria do próprio treinador (para o badge do toggle).
    const myExercisesCount = useMemo(
        () => deduplicatedExercises.filter(e => e.owner_id === currentTrainerId).length,
        [deduplicatedExercises, currentTrainerId]
    )

    // Agrupamento por Padrão de Movimento (seções ordenadas pela sequência canônica).
    const groupedByPattern = useMemo(() => {
        if (!groupByPattern) return null
        const groups = new Map<string, ExerciseWithDetails[]>()
        for (const exercise of filteredExercises) {
            const label = patternLabel(exercise.movement_pattern)
            const arr = groups.get(label) || []
            arr.push(exercise)
            groups.set(label, arr)
        }
        return sortPatternLabels(Array.from(groups.keys()))
            .map(label => ({ label, items: groups.get(label)! }))
    }, [filteredExercises, groupByPattern])

    const toggleMuscleGroup = (group: string) => {
        setSelectedMuscleGroups(prev =>
            prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]
        )
    }

    const togglePattern = (pattern: string) => {
        setSelectedPatterns(prev =>
            prev.includes(pattern) ? prev.filter(p => p !== pattern) : [...prev, pattern]
        )
    }

    // Actions
    const handleCreate = () => {
        setEditingExercise(null)
        setIsFormOpen(true)
    }

    const handleEdit = (exercise: ExerciseWithDetails) => {
        setEditingExercise(exercise)
        setIsFormOpen(true)
    }

    const handleArchive = async (exercise: ExerciseWithDetails) => {
        if (!confirm('Tem certeza que deseja arquivar este exercício?')) return

        const supabase = createClient()
        try {
            const { error } = await supabase
                .from('exercises')
                .update({ is_archived: true })
                .eq('id', exercise.id)
            if (error) throw error
            // Bust per-trainer Next cache; safe to fire-and-forget (60s TTL fallback).
            revalidateMyExerciseLibrary().catch(() => {})
            router.refresh()
        } catch (error) {
            console.error('Error archiving exercise:', error)
            toast({ message: 'Erro ao arquivar exercício.', type: 'error' })
        }
    }

    const handleCustomVideoClick = (exercise: ExerciseWithDetails) => {
        setVideoModalExercise(exercise)
    }

    const handleTrainerVideoChange = (exerciseId: string, video: TrainerVideoData | null) => {
        setTrainerVideosMap(prev => {
            const next = { ...prev }
            if (video) {
                next[exerciseId] = video
            } else {
                delete next[exerciseId]
            }
            return next
        })
    }

    const handleSuccess = () => {
        useOnboardingStore.getState().completeMilestone('first_exercise_added')
        router.refresh()
    }

    const hasActiveFilters = searchQuery !== '' || selectedMuscleGroups.length > 0 || selectedPatterns.length > 0

    // Renderiza uma lista de exercícios em grade ou lista (reusado no modo agrupado).
    const renderItems = (list: ExerciseWithDetails[]) => (
        viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {list.map(exercise => (
                    <ExerciseItem
                        key={exercise.id}
                        exercise={exercise}
                        currentTrainerId={currentTrainerId}
                        onEdit={handleEdit}
                        onDelete={handleArchive}
                        viewMode="grid"
                        trainerVideo={trainerVideosMap[exercise.id] || null}
                        onCustomVideoClick={handleCustomVideoClick}
                    />
                ))}
            </div>
        ) : (
            <div className="space-y-1">
                {list.map(exercise => (
                    <ExerciseItem
                        key={exercise.id}
                        exercise={exercise}
                        currentTrainerId={currentTrainerId}
                        onEdit={handleEdit}
                        onDelete={handleArchive}
                        viewMode="list"
                        trainerVideo={trainerVideosMap[exercise.id] || null}
                        onCustomVideoClick={handleCustomVideoClick}
                    />
                ))}
            </div>
        )
    )

    return (
        <AppLayout
            trainerName={trainerName}
            trainerEmail={trainerEmail}
            trainerAvatarUrl={trainerAvatarUrl}
            trainerTheme={trainerTheme}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold tracking-tight text-[#1D1D1F] dark:text-k-text-primary">Exercícios</h1>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#F5F5F7] dark:bg-glass-bg text-sm font-medium text-[#86868B] dark:text-k-text-tertiary border border-[#E8E8ED] dark:border-k-border-subtle">
                        {deduplicatedExercises.length}
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <ConciergeButton onClick={() => { setConciergeSource('biblioteca_button'); setIsConciergeOpen(true) }} />
                    <Button
                        data-onboarding="exercises-add-btn"
                        onClick={handleCreate}
                        className="gap-2 rounded-full bg-[#7C3AED] dark:bg-glass-bg dark:border dark:border-k-border-primary hover:bg-[#6D28D9] dark:hover:bg-glass-bg-active text-white dark:text-k-text-secondary px-5 py-2 text-sm font-medium transition-all"
                    >
                        <Plus size={16} strokeWidth={2} />
                        Criar exercício
                    </Button>
                </div>
            </div>

            <div className="space-y-4">
                {/* Search + Filters + View Toggle */}
                <div className="flex flex-col md:flex-row gap-3">
                    <div data-onboarding="exercises-search" className="flex-1 relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#AEAEB2] dark:text-muted-foreground/50 group-focus-within:text-[#7C3AED] dark:group-focus-within:text-violet-500 transition-colors" strokeWidth={1.5} />
                        <input
                            type="text"
                            placeholder="Buscar por nome..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full rounded-lg border border-[#D2D2D7] dark:border-k-border-primary bg-white dark:bg-glass-bg py-2.5 pl-11 pr-4 text-sm text-[#1D1D1F] dark:text-foreground placeholder:text-[#AEAEB2] dark:placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-[#7C3AED]/20 dark:focus:ring-2 dark:focus:ring-violet-500/20 focus:border-[#7C3AED] dark:focus:border-violet-500/50 transition-all"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        {allMuscleGroups.length > 0 && (
                            <div data-onboarding="exercises-muscle-filters">
                                <FilterDropdown
                                    label="Grupo Muscular"
                                    options={allMuscleGroups}
                                    selected={selectedMuscleGroups}
                                    onToggle={toggleMuscleGroup}
                                    onClear={() => setSelectedMuscleGroups([])}
                                    counts={muscleGroupCounts}
                                />
                            </div>
                        )}

                        {availablePatterns.length > 0 && (
                            <FilterDropdown
                                label="Padrão de Movimento"
                                options={availablePatterns}
                                selected={selectedPatterns}
                                onToggle={togglePattern}
                                onClear={() => setSelectedPatterns([])}
                                counts={patternCounts}
                            />
                        )}

                        <button
                            onClick={() => setShowOnlyMine(v => !v)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                                showOnlyMine
                                    ? 'bg-[#7C3AED]/10 border-[#7C3AED]/30 text-[#7C3AED] dark:bg-violet-500/10 dark:border-violet-500/30 dark:text-violet-300'
                                    : 'bg-white dark:bg-glass-bg border-[#D2D2D7] dark:border-k-border-primary text-[#1D1D1F] dark:text-k-text-secondary hover:bg-[#F5F5F7] dark:hover:bg-glass-bg-active'
                            }`}
                            title="Mostrar apenas exercícios criados por mim"
                        >
                            <User className="w-3.5 h-3.5" />
                            Meus exercícios
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                showOnlyMine ? 'bg-[#7C3AED]/20 dark:bg-violet-500/20' : 'bg-[#F5F5F7] dark:bg-glass-bg-active text-[#8E8E93] dark:text-k-text-quaternary'
                            }`}>
                                {myExercisesCount}
                            </span>
                        </button>

                        <button
                            onClick={() => setIsManagerOpen(true)}
                            className="p-2.5 rounded-lg border border-[#D2D2D7] dark:border-k-border-primary bg-white dark:bg-glass-bg hover:bg-[#F5F5F7] dark:hover:bg-glass-bg-active text-[#6E6E73] dark:text-k-text-secondary hover:text-[#1D1D1F] dark:hover:text-k-text-primary transition-all"
                            title="Gerenciar Grupos"
                        >
                            <Settings2 className="w-4 h-4" />
                        </button>

                        <button
                            onClick={() => setGroupByPattern(v => !v)}
                            className={`p-2.5 rounded-lg border transition-all ${
                                groupByPattern
                                    ? 'border-[#7C3AED]/30 bg-[#7C3AED]/10 text-[#7C3AED] dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300'
                                    : 'border-[#D2D2D7] dark:border-k-border-primary bg-white dark:bg-glass-bg text-[#6E6E73] dark:text-k-text-secondary hover:text-[#1D1D1F] dark:hover:text-k-text-primary'
                            }`}
                            title="Agrupar por padrão de movimento"
                        >
                            <Layers className="w-4 h-4" />
                        </button>

                        <div className="w-px h-6 bg-[#E8E8ED] dark:bg-k-border-subtle mx-1" />

                        <div className="flex rounded-lg border border-[#D2D2D7] dark:border-k-border-primary overflow-hidden">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-2.5 transition-all ${viewMode === 'grid' ? 'bg-[#F5F5F7] dark:bg-violet-500/10 text-[#7C3AED] dark:text-violet-400' : 'bg-white dark:bg-glass-bg text-[#AEAEB2] dark:text-k-text-quaternary hover:text-[#6E6E73] dark:hover:text-k-text-secondary'}`}
                                title="Grade"
                            >
                                <LayoutGrid className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-2.5 transition-all ${viewMode === 'list' ? 'bg-[#F5F5F7] dark:bg-violet-500/10 text-[#7C3AED] dark:text-violet-400' : 'bg-white dark:bg-glass-bg text-[#AEAEB2] dark:text-k-text-quaternary hover:text-[#6E6E73] dark:hover:text-k-text-secondary'}`}
                                title="Lista"
                            >
                                <List className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Results Count */}
                <div className="text-sm font-medium text-[#86868B] dark:text-k-text-quaternary pl-1">
                    {filteredExercises.length} exercícios
                    {hasActiveFilters && ` de ${deduplicatedExercises.length}`}
                </div>

                {/* Exercise Grid / List (agrupado por padrão ou plano) */}
                {filteredExercises.length > 0 ? (
                    groupByPattern && groupedByPattern ? (
                        <div className="space-y-8">
                            {groupedByPattern.map(group => (
                                <section key={group.label}>
                                    <div className="flex items-center gap-2 mb-3 pl-1">
                                        <h2 className="text-sm font-semibold text-[#1D1D1F] dark:text-k-text-primary tracking-tight">
                                            {group.label}
                                        </h2>
                                        <span className="px-2 py-0.5 rounded-full bg-[#F5F5F7] dark:bg-glass-bg text-xs font-medium text-[#86868B] dark:text-k-text-tertiary border border-[#E8E8ED] dark:border-k-border-subtle">
                                            {group.items.length}
                                        </span>
                                    </div>
                                    {renderItems(group.items)}
                                </section>
                            ))}
                        </div>
                    ) : (
                        renderItems(filteredExercises)
                    )
                ) : (
                    <div className="text-center py-20 rounded-2xl border border-dashed border-[#D2D2D7] dark:border-k-border-primary">
                        <Search className="w-6 h-6 text-[#AEAEB2] dark:text-k-text-quaternary mx-auto mb-3" strokeWidth={1.5} />
                        <p className="text-sm font-semibold text-[#1D1D1F] dark:text-k-text-primary">Nenhum exercício encontrado</p>
                        <p className="text-xs text-[#86868B] dark:text-k-text-quaternary mt-1">Tente outro termo ou limpe os filtros</p>
                        {hasActiveFilters && (
                            <button
                                onClick={() => { setSearchQuery(''); setSelectedMuscleGroups([]); setSelectedPatterns([]) }}
                                className="mt-4 text-xs font-medium text-[#7C3AED] hover:text-[#6D28D9] dark:text-violet-400 dark:hover:text-violet-300 transition-colors"
                            >
                                Limpar busca
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Modals */}
            <ExerciseFormModal
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                onSuccess={handleSuccess}
                exercise={editingExercise}
                trainerId={currentTrainerId}
                trainerVideo={editingExercise ? trainerVideosMap[editingExercise.id] || null : null}
                onTrainerVideoChange={handleTrainerVideoChange}
            />

            <MuscleGroupManagerModal
                isOpen={isManagerOpen}
                onClose={() => setIsManagerOpen(false)}
                trainerId={currentTrainerId}
                manager={muscleGroupsManager}
            />

            {videoModalExercise && (
                <TrainerVideoModal
                    isOpen={true}
                    onClose={() => setVideoModalExercise(null)}
                    exerciseId={videoModalExercise.id}
                    exerciseName={videoModalExercise.name}
                    currentCustomVideo={trainerVideosMap[videoModalExercise.id] || null}
                    onSuccess={(video) => handleTrainerVideoChange(videoModalExercise.id, video)}
                    onRequestConcierge={() => {
                        setVideoModalExercise(null)
                        setConciergeSource('exercise_empty')
                        setIsConciergeOpen(true)
                    }}
                />
            )}

            {/* Tour */}
            <TourRunner tourId="exercises" steps={TOUR_STEPS.exercises} autoStart />

            {/* Concierge — pedido p/ a equipe montar a biblioteca em 24h */}
            <ConciergeModal
                open={isConciergeOpen}
                source={conciergeSource}
                onClose={() => setIsConciergeOpen(false)}
            />
        </AppLayout>
    )
}
