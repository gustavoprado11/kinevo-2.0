'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ExerciseWithDetails } from './exercise-item'
import { VideoPlayer } from './video-player'
import { useMuscleGroups } from '@/hooks/use-muscle-groups'
import { MuscleGroup } from '@/types/exercise'

interface ExerciseFormModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: (exercise?: any) => void
    exercise?: ExerciseWithDetails | null
    trainerId: string
    defaultName?: string
}

export function ExerciseFormModal({ isOpen, onClose, onSuccess, exercise, trainerId, defaultName }: ExerciseFormModalProps) {
    const isEditing = !!exercise
    const isSystem = exercise && !exercise.owner_id

    // Hooks
    const { muscleGroups: availableMuscleGroups, loading: loadingMuscles, createMuscleGroup } = useMuscleGroups(trainerId)

    // Form State
    const [name, setName] = useState(defaultName || '')
    // Selected muscle groups (Objects)
    const [selectedMuscleGroups, setSelectedMuscleGroups] = useState<MuscleGroup[]>([])

    const [equipment, setEquipment] = useState('')
    const [videoUrl, setVideoUrl] = useState('')
    const [instructions, setInstructions] = useState('')

    // UI states
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Reset form when opening
    useEffect(() => {
        if (isOpen) {
            if (exercise) {
                setName(exercise.name)
                // Initialize selected groups from exercise
                // Note: fetch query logic update in parent ensures these are objects now.
                // However, safety check for legacy mixed data types is good.
                if (exercise.muscle_groups && exercise.muscle_groups.length > 0) {
                    // Filter out any strings if they snuck in
                    const validGroups = exercise.muscle_groups.filter((g: any) => typeof g === 'object' && g.id)
                    setSelectedMuscleGroups(validGroups)
                } else {
                    setSelectedMuscleGroups([])
                }

                setEquipment(exercise.equipment || '')
                setVideoUrl(exercise.video_url || '')
                setInstructions(exercise.instructions || '')
            } else {
                setName(defaultName || '')
                setSelectedMuscleGroups([])
                setEquipment('')
                setVideoUrl('')
                setInstructions('')
            }
            setError(null)
            setSaving(false)
        }
    }, [isOpen, exercise, defaultName])

    const handleSave = async () => {
        if (!name.trim()) {
            setError('Nome é obrigatório')
            return
        }

        if (selectedMuscleGroups.length === 0) {
            setError('Selecione pelo menos um grupo muscular')
            return
        }

        setSaving(true)
        setError(null)

        try {
            const supabase = createClient()

            // 1. Upsert Exercise
            const exercisePayload = {
                name: name.trim(),
                equipment: equipment.trim() || null,
                video_url: videoUrl.trim() || null,
                instructions: instructions.trim() || null,
                owner_id: isSystem ? null : trainerId, // Keep system if editing system (though usually read-only)
                updated_at: new Date().toISOString()
            }

            let savedExerciseId = exercise?.id

            if (isEditing && exercise) {
                const { error: updateError } = await supabase
                    .from('exercises')
                    .update(exercisePayload)
                    .eq('id', exercise.id)

                if (updateError) throw updateError
            } else {
                const { data: newExercise, error: createError } = await supabase
                    .from('exercises')
                    .insert({
                        ...exercisePayload,
                        owner_id: trainerId // Force owner for new
                    })
                    .select('id')
                    .single()

                if (createError) throw createError
                savedExerciseId = newExercise.id
            }

            if (!savedExerciseId) throw new Error('Falha ao salvar exercício')

            // 2. Manage Junction Table (exercise_muscle_groups)
            // Strategy: Delete all for this exercise, then Insert all selected
            // This handles adds, removes, and changes simply.

            // Delete existing relations
            const { error: deleteError } = await supabase
                .from('exercise_muscle_groups')
                .delete()
                .eq('exercise_id', savedExerciseId)

            if (deleteError) throw deleteError

            // Insert new relations
            if (selectedMuscleGroups.length > 0) {
                const relations = selectedMuscleGroups.map(mg => ({
                    exercise_id: savedExerciseId,
                    muscle_group_id: mg.id
                }))

                const { error: linkError } = await supabase
                    .from('exercise_muscle_groups')
                    .insert(relations)

                if (linkError) throw linkError
            }

            onSuccess()
            onClose()
        } catch (err: any) {
            console.error('Error saving exercise:', err)
            setError(err.message || 'Erro ao salvar exercício')
        } finally {
            setSaving(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-2xl bg-card rounded-2xl border border-border shadow-xl max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
                    <h2 className="text-xl font-semibold text-foreground">
                        {isEditing ? 'Editar Exercício' : 'Novo Exercício'}
                    </h2>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Name */}
                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">
                            Nome do Exercício
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Ex: Supino Reto"
                            className="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                        />
                    </div>

                    {/* Muscle Groups - Creatable MultiSelect */}
                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">
                            Grupos Musculares
                        </label>
                        <CreatableMultiSelect
                            availableGroups={availableMuscleGroups}
                            selectedGroups={selectedMuscleGroups}
                            onChange={setSelectedMuscleGroups}
                            onCreate={async (name) => {
                                const newGroup = await createMuscleGroup(name)
                                return newGroup
                            }}
                            isLoading={loadingMuscles}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            Selecione um ou mais grupos. Digite para buscar ou criar um novo.
                        </p>
                    </div>

                    {/* Equipment */}
                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">
                            Equipamento (Opcional)
                        </label>
                        <input
                            type="text"
                            value={equipment}
                            onChange={e => setEquipment(e.target.value)}
                            placeholder="Ex: Barra, Halteres, Máquina..."
                            className="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                        />
                    </div>

                    {/* Video URL */}
                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">
                            Link do Vídeo (YouTube/Vimeo)
                        </label>
                        <input
                            type="url"
                            value={videoUrl}
                            onChange={e => setVideoUrl(e.target.value)}
                            placeholder="https://..."
                            className="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                        />
                        {videoUrl && (
                            <div className="mt-2 aspect-video rounded-lg overflow-hidden bg-black border border-border">
                                <VideoPlayer url={videoUrl} title={name} />
                            </div>
                        )}
                    </div>

                    {/* Instructions */}
                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">
                            Instruções (Opcional)
                        </label>
                        <textarea
                            value={instructions}
                            onChange={e => setInstructions(e.target.value)}
                            rows={3}
                            placeholder="Dicas de execução..."
                            className="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/50 resize-none"
                        />
                    </div>

                    {/* Errors */}
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                            {error}
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-border bg-card sticky bottom-0 rounded-b-2xl flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-6 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {saving && (
                            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        )}
                        Salvar Exercício
                    </button>
                </div>
            </div>
        </div>
    )
}

// ----------------------------------------------------------------------------
// Internal Helper: Creatable MultiSelect Component
// ----------------------------------------------------------------------------

interface CreatableMultiSelectProps {
    availableGroups: MuscleGroup[]
    selectedGroups: MuscleGroup[]
    onChange: (groups: MuscleGroup[]) => void
    onCreate: (name: string) => Promise<MuscleGroup | null>
    isLoading: boolean
}

function CreatableMultiSelect({ availableGroups, selectedGroups, onChange, onCreate, isLoading }: CreatableMultiSelectProps) {
    const [inputValue, setInputValue] = useState('')
    const [isOpen, setIsOpen] = useState(false)
    const [isCreating, setIsCreating] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    // Filter available groups excluding already selected
    const filteredGroups = availableGroups.filter(g =>
        !selectedGroups.some(s => s.id === g.id) &&
        g.name.toLowerCase().includes(inputValue.toLowerCase())
    )

    const showCreateOption = inputValue.trim().length > 0 &&
        !availableGroups.some(g => g.name.toLowerCase() === inputValue.trim().toLowerCase())

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleSelect = (group: MuscleGroup) => {
        onChange([...selectedGroups, group])
        setInputValue('')
        setIsOpen(true) // Keep open for multi select
    }

    const handleRemove = (groupId: string) => {
        onChange(selectedGroups.filter(g => g.id !== groupId))
    }

    const handleCreate = async () => {
        if (!inputValue.trim()) return
        setIsCreating(true)
        const newGroup = await onCreate(inputValue.trim())
        if (newGroup) {
            onChange([...selectedGroups, newGroup])
            setInputValue('')
        }
        setIsCreating(false)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            if (showCreateOption) {
                handleCreate()
            } else if (filteredGroups.length > 0) {
                handleSelect(filteredGroups[0])
            }
        }
    }

    return (
        <div className="relative" ref={containerRef}>
            <div
                className={`w-full bg-muted border border-border rounded-lg min-h-[42px] p-1.5 flex flex-wrap gap-1.5 transition-colors ${isOpen ? 'ring-2 ring-violet-500/50 border-transparent' : ''}`}
                onClick={() => {
                    // Focus input when clicking container
                    const input = containerRef.current?.querySelector('input')
                    input?.focus()
                    setIsOpen(true)
                }}
            >
                {selectedGroups.map(group => (
                    <span key={group.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-500/20 text-violet-200 text-sm border border-violet-500/30">
                        {group.name}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation()
                                handleRemove(group.id)
                            }}
                            className="hover:text-foreground"
                        >
                            &times;
                        </button>
                    </span>
                ))}

                <input
                    type="text"
                    value={inputValue}
                    onChange={e => {
                        setInputValue(e.target.value)
                        setIsOpen(true)
                    }}
                    onFocus={() => setIsOpen(true)}
                    onKeyDown={handleKeyDown}
                    placeholder={selectedGroups.length === 0 ? "Selecione ou crie..." : ""}
                    className="bg-transparent border-none outline-none text-foreground text-sm flex-1 min-w-[120px] placeholder:text-muted-foreground h-7"
                    disabled={isCreating}
                />
            </div>

            {isOpen && (inputValue || filteredGroups.length > 0 || isLoading) && (
                <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-background border border-border rounded-lg shadow-xl max-h-60 overflow-y-auto">
                    {isLoading ? (
                        <div className="p-3 text-center text-muted-foreground text-sm">Carregando...</div>
                    ) : (
                        <>
                            {filteredGroups.map(group => (
                                <button
                                    key={group.id}
                                    onClick={() => handleSelect(group)}
                                    className="w-full px-3 py-2 text-left text-sm text-foreground/80 hover:bg-muted hover:text-foreground flex items-center justify-between group"
                                >
                                    <span>{group.name}</span>
                                    {group.owner_id && (
                                        <span className="text-xs text-violet-500 opacity-50 group-hover:opacity-100">
                                            Custom
                                        </span>
                                    )}
                                </button>
                            ))}

                            {showCreateOption && (
                                <button
                                    onClick={handleCreate}
                                    disabled={isCreating}
                                    className="w-full px-3 py-2 text-left text-sm text-violet-400 hover:bg-violet-500/10 flex items-center gap-2 border-t border-border"
                                >
                                    {isCreating ? (
                                        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <span>+</span>
                                    )}
                                    Criar "{inputValue}"
                                </button>
                            )}

                            {filteredGroups.length === 0 && !showCreateOption && !isLoading && (
                                <div className="p-3 text-center text-muted-foreground text-sm">
                                    Nenhum resultado
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    )
}
