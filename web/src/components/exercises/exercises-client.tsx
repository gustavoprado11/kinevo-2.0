'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout'
import { useMuscleGroups } from '@/hooks/use-muscle-groups'
import { createClient } from '@/lib/supabase/client'
import { ExerciseItem, ExerciseWithDetails } from './exercise-item'
import { ExerciseFormModal } from './exercise-form-modal'
import { MuscleGroupManagerModal } from './muscle-group-manager-modal'

interface ExercisesClientProps {
    initialExercises: ExerciseWithDetails[]
    currentTrainerId: string
    trainerName: string
    trainerEmail?: string
}

export function ExercisesClient({ initialExercises, currentTrainerId, trainerName, trainerEmail }: ExercisesClientProps) {
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
        <AppLayout trainerName={trainerName} trainerEmail={trainerEmail}>
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-white">Exercícios</h1>
                    <p className="text-gray-400 mt-1">Gerencie sua biblioteca e acesse exercícios do sistema</p>
                </div>

                <button
                    onClick={handleCreate}
                    className="px-4 py-2.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white text-sm font-medium rounded-lg transition-all shadow-lg shadow-violet-500/20 flex items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Criar exercício
                </button>
            </div>

            {/* List Container */}
            <div className="bg-gray-900/50 rounded-xl border border-gray-800/50 p-6 min-h-[500px]">
                <div className="space-y-6">
                    {/* Filters */}
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative">
                            {/* ... Search Input ... */}
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text"
                                placeholder="Buscar por nome..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all"
                            />
                        </div>
                        <button
                            onClick={() => setIsManagerOpen(true)}
                            className="px-4 py-2.5 bg-gray-800 border border-gray-700 hover:bg-gray-700 hover:text-white text-gray-300 text-sm font-medium rounded-lg transition-all flex items-center gap-2 whitespace-nowrap"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                            </svg>
                            Gerenciar Grupos
                        </button>
                    </div>

                    {/* Tags */}
                    {allMuscleGroups.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {allMuscleGroups.map(group => {
                                const isSelected = selectedMuscleGroups.includes(group)
                                return (
                                    <button
                                        key={group}
                                        onClick={() => toggleMuscleGroup(group)}
                                        className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-all ${isSelected
                                            ? 'bg-violet-500/20 text-violet-300 border-violet-500/30 shadow-sm shadow-violet-500/10'
                                            : 'bg-gray-800/50 text-gray-400 border-gray-700 hover:border-gray-600 hover:text-gray-300'
                                            }`}
                                    >
                                        {group}
                                    </button>
                                )
                            })}
                            {selectedMuscleGroups.length > 0 && (
                                <button
                                    onClick={() => setSelectedMuscleGroups([])}
                                    className="px-3 py-1.5 text-sm font-medium text-red-400 hover:text-red-300 transition-colors ml-2"
                                >
                                    Limpar filtros
                                </button>
                            )}
                        </div>
                    )}

                    {/* Results Count */}
                    <div className="flex items-center justify-between text-sm text-gray-400 pb-2 border-b border-gray-800">
                        <span>{filteredExercises.length} exercícios encontrados</span>
                    </div>

                    {/* List */}
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
                        <div className="text-center py-16 bg-gray-800/30 rounded-xl border border-gray-800 border-dashed">
                            <div className="w-16 h-16 rounded-full bg-gray-800/50 flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                            <p className="text-gray-400 font-medium">Nenhum exercício encontrado</p>
                            <p className="text-gray-500 text-sm mt-1">Tente buscar por outro termo ou limpar os filtros</p>
                            <button
                                onClick={() => { setSearchQuery(''); setSelectedMuscleGroups([]) }}
                                className="mt-4 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors border border-gray-700"
                            >
                                Limpar busca
                            </button>
                        </div>
                    )}
                </div>
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
