'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout'
import { useMuscleGroups } from '@/hooks/use-muscle-groups'
import { createClient } from '@/lib/supabase/client'
import { ExerciseItem, ExerciseWithDetails } from './exercise-item'
import { ExerciseFormModal } from './exercise-form-modal'
import { MuscleGroupManagerModal } from './muscle-group-manager-modal'
import { Button } from '@/components/ui/button'
import { Plus, Search, Settings2, X } from 'lucide-react'

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

    // Modal states
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [isManagerOpen, setIsManagerOpen] = useState(false)
    const [editingExercise, setEditingExercise] = useState<ExerciseWithDetails | null>(null)

    // Sync with initial exercises if they change (e.g. after refresh)
    // Actually, usually we just rely on props updates, but optimistic UI + router.refresh() 
    // means props will update.
    useMemo(() => {
        setExercises(initialExercises)
    }, [initialExercises])

    // Hook for muscle groups (Single Source of Truth)
    const muscleGroupsManager = useMuscleGroups(currentTrainerId)
    const { muscleGroups: availableMuscleGroups } = muscleGroupsManager

    // Extract unique muscle groups (Use available groups from DB instead of derived from exercises)
    // This allows new groups to be distinct even if not used yet.
    const allMuscleGroups = useMemo(() => {
        return availableMuscleGroups.map(g => g.name).sort()
    }, [availableMuscleGroups])

    // Filter exercises (Search + Muscle + System Override Deduplication)
    const filteredExercises = useMemo(() => {
        // 1. Identify overrides
        const overrideSystemIds = new Set(
            exercises
                .filter(e => e.owner_id === currentTrainerId && e.original_system_id)
                .map(e => e.original_system_id)
        )

        return exercises.filter(exercise => {
            // Deduplication: Hide system exercise if override exists
            if (!exercise.owner_id && overrideSystemIds.has(exercise.id)) {
                return false
            }

            const matchesSearch = exercise.name.toLowerCase().includes(searchQuery.toLowerCase())

            let matchesMuscle = true
            if (selectedMuscleGroups.length > 0) {
                const exerciseMuscles = (ex: any) => {
                    if (ex.muscle_groups && ex.muscle_groups.length > 0) {
                        return ex.muscle_groups.map((g: any) => typeof g === 'object' ? g.name : g)
                    }
                    return []
                }
                const muscles = exerciseMuscles(exercise)
                matchesMuscle = selectedMuscleGroups.some(group => muscles.includes(group))
            }

            return matchesSearch && matchesMuscle
        })
    }, [exercises, searchQuery, selectedMuscleGroups, currentTrainerId])

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
        if (!confirm('Tem certeza que deseja arquivar este exercício? Ele não aparecerá mais na listagem.')) {
            return
        }

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
        router.refresh()
    }

    return (
        <AppLayout
            trainerName={trainerName}
            trainerEmail={trainerEmail}
            trainerAvatarUrl={trainerAvatarUrl}
            trainerTheme={trainerTheme}
        >
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tighter bg-gradient-to-br from-k-text-primary to-zinc-400 bg-clip-text text-transparent">Exercícios</h1>
                    <p className="mt-1 text-sm text-muted-foreground/60">Gerencie sua biblioteca e acesse exercícios do sistema</p>
                </div>

                <Button
                    onClick={handleCreate}
                    className="gap-2 bg-violet-600 hover:bg-violet-500 rounded-full px-6 py-2 text-sm font-semibold shadow-lg shadow-violet-500/20 transition-all duration-200"
                >
                    <Plus size={18} strokeWidth={2} />
                    Criar exercício
                </Button>
            </div>

            {/* Main Content Area */}
            <div className="space-y-8">
                {/* Search & Management Bar */}
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/50 group-focus-within:text-violet-500 transition-colors duration-300" strokeWidth={1.5} />
                        <input
                            type="text"
                            placeholder="Buscar por nome..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full rounded-2xl border border-k-border-primary bg-glass-bg py-3 pl-12 pr-4 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500/50 transition-all duration-300"
                        />
                    </div>
                    <Button
                        onClick={() => setIsManagerOpen(true)}
                        className="gap-2 rounded-full border border-k-border-primary bg-glass-bg hover:bg-glass-bg-active text-k-text-secondary transition-all duration-200 px-6"
                    >
                        <Settings2 className="w-4 h-4" />
                        Gerenciar Grupos
                    </Button>
                </div>

                {/* Tags Filter */}
                {allMuscleGroups.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {allMuscleGroups.map(group => {
                            const isSelected = selectedMuscleGroups.includes(group)
                            return (
                                <button
                                    key={group}
                                    onClick={() => toggleMuscleGroup(group)}
                                    className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-full border transition-all duration-200 ${isSelected
                                        ? 'bg-violet-500/20 border-violet-500/40 text-violet-300 shadow-sm shadow-violet-500/10'
                                        : 'bg-glass-bg border-k-border-subtle text-muted-foreground/60 hover:bg-glass-bg-active hover:text-k-text-secondary'
                                        }`}
                                >
                                    {group}
                                </button>
                            )
                        })}
                        {selectedMuscleGroups.length > 0 && (
                            <button
                                onClick={() => setSelectedMuscleGroups([])}
                                className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-red-400/80 hover:text-red-400 transition-colors flex items-center gap-1 ml-2"
                            >
                                <X className="w-3 h-3" />
                                Limpar
                            </button>
                        )}
                    </div>
                )}

                {/* Results Count */}
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-muted-foreground/40 pl-1">
                    <span>{filteredExercises.length} exercícios encontrados</span>
                </div>

                {/* List Grid */}
                {filteredExercises.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredExercises.map(exercise => (
                            <ExerciseItem
                                key={exercise.id}
                                exercise={exercise}
                                currentTrainerId={currentTrainerId}
                                onEdit={handleEdit}
                                onDelete={handleArchive}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-24 rounded-2xl border border-dashed border-k-border-primary bg-surface-inset">
                        <div className="w-16 h-16 rounded-full bg-glass-bg flex items-center justify-center mx-auto mb-4">
                            <Search className="w-6 h-6 text-muted-foreground/40" strokeWidth={1.5} />
                        </div>
                        <p className="text-white font-semibold">Nenhum exercício encontrado</p>
                        <p className="text-muted-foreground/60 text-sm mt-1">Tente buscar por outro termo ou limpar os filtros</p>
                        <Button
                            variant="outline"
                            onClick={() => { setSearchQuery(''); setSelectedMuscleGroups([]) }}
                            className="mt-6 border-k-border-primary bg-glass-bg hover:bg-glass-bg-active text-k-text-secondary"
                        >
                            Limpar busca
                        </Button>
                    </div>
                )}
            </div>

            {/* Modal */}
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
        </AppLayout>
    )
}
