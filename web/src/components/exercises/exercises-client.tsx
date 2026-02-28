'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout'
import { useMuscleGroups } from '@/hooks/use-muscle-groups'
import { createClient } from '@/lib/supabase/client'
import { ExerciseItem, ExerciseWithDetails } from './exercise-item'
import { ExerciseFormModal } from './exercise-form-modal'
import { MuscleGroupManagerModal } from './muscle-group-manager-modal'
import { useOnboardingStore } from '@/stores/onboarding-store'
import { Button } from '@/components/ui/button'
import { Plus, Search, Settings2, LayoutGrid, List, ChevronDown, Check } from 'lucide-react'
import { TourRunner } from '@/components/onboarding/tours/tour-runner'
import { TOUR_STEPS } from '@/components/onboarding/tours/tour-definitions'

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
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                    selected.length > 0
                        ? 'bg-violet-500/10 border-violet-500/30 text-violet-300'
                        : 'bg-glass-bg border-k-border-primary text-k-text-secondary hover:bg-glass-bg-active'
                }`}
            >
                {label}
                {selected.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-violet-500/20 text-[10px] font-bold">
                        {selected.length}
                    </span>
                )}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-64 max-h-72 overflow-y-auto bg-surface-card border border-k-border-primary rounded-xl shadow-2xl z-50">
                    {selected.length > 0 && (
                        <button
                            onClick={() => { onClear(); setIsOpen(false) }}
                            className="w-full px-4 py-2 text-left text-xs font-medium text-red-400/80 hover:bg-glass-bg-active border-b border-k-border-subtle"
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
                                    isSelected ? 'text-violet-300 bg-violet-500/5' : 'text-k-text-secondary hover:bg-glass-bg-active'
                                }`}
                            >
                                <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                    isSelected ? 'bg-violet-500 border-violet-500' : 'border-k-border-primary'
                                }`}>
                                    {isSelected && <Check className="w-3 h-3 text-white" />}
                                </div>
                                <span className="flex-1 truncate">{option}</span>
                                {count !== undefined && (
                                    <span className="text-[10px] font-bold text-k-text-quaternary">{count}</span>
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
}

export function ExercisesClient({
    initialExercises,
    currentTrainerId,
    trainerName,
    trainerEmail,
    trainerAvatarUrl,
    trainerTheme,
}: ExercisesClientProps) {
    const router = useRouter()
    const [exercises, setExercises] = useState(initialExercises)
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedMuscleGroups, setSelectedMuscleGroups] = useState<string[]>([])
    const [viewMode, setViewMode] = useState<ViewMode>('grid')

    // Modal states
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [isManagerOpen, setIsManagerOpen] = useState(false)
    const [editingExercise, setEditingExercise] = useState<ExerciseWithDetails | null>(null)

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

    // Dynamic count per muscle group
    const muscleGroupCounts = useMemo(() => {
        const counts: Record<string, number> = {}
        for (const exercise of deduplicatedExercises) {
            const muscles = exercise.muscle_groups?.map(g => g.name) || []
            for (const m of muscles) {
                counts[m] = (counts[m] || 0) + 1
            }
        }
        return counts
    }, [deduplicatedExercises])

    // Filter exercises (Search + Muscle Group)
    const filteredExercises = useMemo(() => {
        return deduplicatedExercises.filter(exercise => {
            const matchesSearch = exercise.name.toLowerCase().includes(searchQuery.toLowerCase())

            let matchesMuscle = true
            if (selectedMuscleGroups.length > 0) {
                const muscles = exercise.muscle_groups?.map(g => g.name) || []
                matchesMuscle = selectedMuscleGroups.some(group => muscles.includes(group))
            }

            return matchesSearch && matchesMuscle
        })
    }, [deduplicatedExercises, searchQuery, selectedMuscleGroups])

    const toggleMuscleGroup = (group: string) => {
        setSelectedMuscleGroups(prev =>
            prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]
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
            router.refresh()
        } catch (error) {
            console.error('Error archiving exercise:', error)
            alert('Erro ao arquivar exercício.')
        }
    }

    const handleSuccess = () => {
        useOnboardingStore.getState().completeMilestone('first_exercise_added')
        router.refresh()
    }

    return (
        <AppLayout
            trainerName={trainerName}
            trainerEmail={trainerEmail}
            trainerAvatarUrl={trainerAvatarUrl}
            trainerTheme={trainerTheme}
        >
            {/* Header — simplified */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold tracking-tight text-white">Exercícios</h1>
                    <span className="px-2 py-0.5 rounded-md bg-glass-bg text-xs font-bold text-k-text-tertiary border border-k-border-subtle">
                        {deduplicatedExercises.length}
                    </span>
                </div>
                <Button
                    data-onboarding="exercises-add-btn"
                    onClick={handleCreate}
                    className="gap-2 rounded-full border border-k-border-primary bg-glass-bg hover:bg-glass-bg-active text-k-text-secondary px-5 py-2 text-sm font-semibold transition-all"
                >
                    <Plus size={16} strokeWidth={2} />
                    Criar exercício
                </Button>
            </div>

            <div className="space-y-4">
                {/* Search + Filters + View Toggle */}
                <div className="flex flex-col md:flex-row gap-3">
                    <div data-onboarding="exercises-search" className="flex-1 relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 group-focus-within:text-violet-500 transition-colors" strokeWidth={1.5} />
                        <input
                            type="text"
                            placeholder="Buscar por nome..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full rounded-xl border border-k-border-primary bg-glass-bg py-2.5 pl-11 pr-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500/50 transition-all"
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

                        <button
                            onClick={() => setIsManagerOpen(true)}
                            className="p-2.5 rounded-xl border border-k-border-primary bg-glass-bg hover:bg-glass-bg-active text-k-text-secondary transition-all"
                            title="Gerenciar Grupos"
                        >
                            <Settings2 className="w-4 h-4" />
                        </button>

                        <div className="w-px h-6 bg-k-border-subtle mx-1" />

                        <div className="flex rounded-xl border border-k-border-primary overflow-hidden">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-2.5 transition-all ${viewMode === 'grid' ? 'bg-violet-500/10 text-violet-400' : 'bg-glass-bg text-k-text-quaternary hover:text-k-text-secondary'}`}
                                title="Grade"
                            >
                                <LayoutGrid className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-2.5 transition-all ${viewMode === 'list' ? 'bg-violet-500/10 text-violet-400' : 'bg-glass-bg text-k-text-quaternary hover:text-k-text-secondary'}`}
                                title="Lista"
                            >
                                <List className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Results Count */}
                <div className="text-[11px] font-bold uppercase tracking-wider text-k-text-quaternary pl-1">
                    {filteredExercises.length} exercícios
                    {(searchQuery || selectedMuscleGroups.length > 0) && ` de ${deduplicatedExercises.length}`}
                </div>

                {/* Exercise Grid / List */}
                {filteredExercises.length > 0 ? (
                    viewMode === 'grid' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {filteredExercises.map(exercise => (
                                <ExerciseItem
                                    key={exercise.id}
                                    exercise={exercise}
                                    currentTrainerId={currentTrainerId}
                                    onEdit={handleEdit}
                                    onDelete={handleArchive}
                                    viewMode="grid"
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {filteredExercises.map(exercise => (
                                <ExerciseItem
                                    key={exercise.id}
                                    exercise={exercise}
                                    currentTrainerId={currentTrainerId}
                                    onEdit={handleEdit}
                                    onDelete={handleArchive}
                                    viewMode="list"
                                />
                            ))}
                        </div>
                    )
                ) : (
                    <div className="text-center py-20 rounded-2xl border border-dashed border-k-border-primary">
                        <Search className="w-6 h-6 text-k-text-quaternary mx-auto mb-3" strokeWidth={1.5} />
                        <p className="text-sm font-semibold text-white">Nenhum exercício encontrado</p>
                        <p className="text-xs text-k-text-quaternary mt-1">Tente outro termo ou limpe os filtros</p>
                        {(searchQuery || selectedMuscleGroups.length > 0) && (
                            <button
                                onClick={() => { setSearchQuery(''); setSelectedMuscleGroups([]) }}
                                className="mt-4 text-xs font-medium text-violet-400 hover:text-violet-300 transition-colors"
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
            />

            <MuscleGroupManagerModal
                isOpen={isManagerOpen}
                onClose={() => setIsManagerOpen(false)}
                trainerId={currentTrainerId}
                manager={muscleGroupsManager}
            />

            {/* Tour */}
            <TourRunner tourId="exercises" steps={TOUR_STEPS.exercises} autoStart />
        </AppLayout>
    )
}
