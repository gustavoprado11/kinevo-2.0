'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ExerciseWithDetails } from './exercise-item'
import { VideoPlayer } from './video-player'
import { useMuscleGroups } from '@/hooks/use-muscle-groups'
import { MuscleGroup } from '@/types/exercise'
import { X, Loader2, Plus, Check } from 'lucide-react'

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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
                onClick={onClose}
            />

            <div className="relative w-full max-w-2xl bg-surface-card backdrop-blur-2xl rounded-3xl shadow-2xl ring-1 ring-inset ring-k-border-primary max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="p-6 pb-4 flex items-center justify-between z-10">
                    <div>
                        <h2 className="text-xl font-bold text-white tracking-tight">
                            {isEditing ? 'Editar Exercício' : 'Novo Exercício'}
                        </h2>
                        <p className="text-xs text-muted-foreground/60 uppercase tracking-widest font-semibold mt-1">
                            {isEditing ? 'Atualize os detalhes do exercício' : 'Adicione um novo exercício à biblioteca'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-k-text-quaternary hover:text-k-text-primary transition-colors rounded-full hover:bg-glass-bg-active"
                    >
                        <X className="w-5 h-5" strokeWidth={1.5} />
                    </button>
                </div>

                <div className="p-6 pt-2 space-y-6 overflow-y-auto scrollbar-hide">
                    {/* Name */}
                    <div>
                        <label className="block text-[11px] font-bold text-k-text-tertiary uppercase tracking-widest mb-1.5">
                            Nome do Exercício
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Ex: Supino Reto"
                            className="w-full px-4 py-3 bg-glass-bg border border-k-border-subtle rounded-xl text-k-text-primary placeholder:text-k-text-quaternary focus:outline-none focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500/50 transition-all text-sm"
                        />
                    </div>

                    {/* Muscle Groups - Creatable MultiSelect */}
                    <div>
                        <label className="block text-[11px] font-bold text-k-text-tertiary uppercase tracking-widest mb-1.5">
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
                        <p className="text-[10px] text-k-text-quaternary mt-1.5 font-medium tracking-wide">
                            Selecione um ou mais grupos. Digite para buscar ou criar.
                        </p>
                    </div>

                    {/* Equipment */}
                    <div>
                        <label className="block text-[11px] font-bold text-k-text-tertiary uppercase tracking-widest mb-1.5">
                            Equipamento (Opcional)
                        </label>
                        <input
                            type="text"
                            value={equipment}
                            onChange={e => setEquipment(e.target.value)}
                            placeholder="Ex: Barra, Halteres, Máquina..."
                            className="w-full px-4 py-3 bg-glass-bg border border-k-border-subtle rounded-xl text-k-text-primary placeholder:text-k-text-quaternary focus:outline-none focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500/50 transition-all text-sm"
                        />
                    </div>

                    {/* Video URL */}
                    <div>
                        <label className="block text-[11px] font-bold text-k-text-tertiary uppercase tracking-widest mb-1.5">
                            Link do Vídeo (YouTube/Vimeo)
                        </label>
                        <input
                            type="url"
                            value={videoUrl}
                            onChange={e => setVideoUrl(e.target.value)}
                            placeholder="https://..."
                            className="w-full px-4 py-3 bg-glass-bg border border-k-border-subtle rounded-xl text-k-text-primary placeholder:text-k-text-quaternary focus:outline-none focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500/50 transition-all text-sm"
                        />
                        {videoUrl && (
                            <div className="mt-3 aspect-video rounded-xl overflow-hidden bg-surface-inset border border-k-border-subtle ring-1 ring-k-border-subtle">
                                <VideoPlayer url={videoUrl} title={name} />
                            </div>
                        )}
                    </div>

                    {/* Instructions */}
                    <div>
                        <label className="block text-[11px] font-bold text-k-text-tertiary uppercase tracking-widest mb-1.5">
                            Instruções (Opcional)
                        </label>
                        <textarea
                            value={instructions}
                            onChange={e => setInstructions(e.target.value)}
                            rows={3}
                            placeholder="Dicas de execução..."
                            className="w-full px-4 py-3 bg-glass-bg border border-k-border-subtle rounded-xl text-k-text-primary placeholder:text-k-text-quaternary focus:outline-none focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500/50 transition-all resize-none text-sm"
                        />
                    </div>

                    {/* Errors */}
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-medium flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                            {error}
                        </div>
                    )}
                </div>

                <div className="p-6 pt-4 border-t border-k-border-subtle flex justify-end gap-3 rounded-b-3xl">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 text-k-text-secondary hover:text-k-text-primary hover:bg-glass-bg rounded-xl transition-all text-sm font-medium"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-violet-500/20 active:scale-95 text-sm"
                    >
                        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
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
                className={`w-full bg-glass-bg border border-k-border-subtle rounded-xl min-h-[46px] p-1.5 flex flex-wrap gap-1.5 transition-all ${isOpen ? 'ring-2 ring-violet-500/10 border-violet-500/50' : ''}`}
                onClick={() => {
                    // Focus input when clicking container
                    const input = containerRef.current?.querySelector('input')
                    input?.focus()
                    setIsOpen(true)
                }}
            >
                {selectedGroups.map(group => (
                    <span key={group.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-500/10 text-violet-300 text-[11px] font-bold uppercase tracking-wider border border-violet-500/20">
                        {group.name}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation()
                                handleRemove(group.id)
                            }}
                            className="hover:text-white transition-colors ml-0.5"
                        >
                            <X className="w-3 h-3" strokeWidth={2.5} />
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
                    className="bg-transparent border-none outline-none text-k-text-primary text-sm flex-1 min-w-[120px] placeholder:text-k-text-quaternary h-8 px-1"
                    disabled={isCreating}
                />
            </div>

            {isOpen && (inputValue || filteredGroups.length > 0 || isLoading) && (
                <div className="absolute z-50 left-0 right-0 top-full mt-2 bg-surface-card border border-k-border-primary rounded-xl shadow-2xl max-h-60 overflow-y-auto ring-1 ring-k-border-subtle animate-in fade-in zoom-in-95 duration-150">
                    {isLoading ? (
                        <div className="p-4 text-center text-muted-foreground text-xs font-medium flex items-center justify-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Carregando...
                        </div>
                    ) : (
                        <>
                            {filteredGroups.map(group => (
                                <button
                                    key={group.id}
                                    onClick={() => handleSelect(group)}
                                    className="w-full px-4 py-2.5 text-left text-sm text-k-text-secondary hover:bg-glass-bg hover:text-k-text-primary flex items-center justify-between group transition-colors"
                                >
                                    <span>{group.name}</span>
                                    <div className="flex items-center gap-2">
                                        {group.owner_id && (
                                            <span className="text-[10px] font-bold text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded border border-violet-500/20">
                                                CUSTOM
                                            </span>
                                        )}
                                        {selectedGroups.some(g => g.id === group.id) && <Check className="w-4 h-4 text-violet-400" />}
                                    </div>

                                </button>
                            ))}

                            {showCreateOption && (
                                <button
                                    onClick={handleCreate}
                                    disabled={isCreating}
                                    className="w-full px-4 py-3 text-left text-sm text-violet-300 hover:bg-violet-500/10 flex items-center gap-2 border-t border-k-border-subtle transition-colors"
                                >
                                    {isCreating ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Plus className="w-4 h-4" />
                                    )}
                                    <span className="font-semibold">Criar "{inputValue}"</span>
                                </button>
                            )}

                            {filteredGroups.length === 0 && !showCreateOption && !isLoading && (
                                <div className="p-4 text-center text-k-text-quaternary text-xs font-medium">
                                    Nenhum resultado encontrado
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    )
}
