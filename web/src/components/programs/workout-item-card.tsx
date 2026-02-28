'use client'

import { useState, useRef } from 'react'
import type { WorkoutItem } from './program-builder-client'
import type { Exercise } from '@/types/exercise'

interface WorkoutItemCardProps {
    item: WorkoutItem
    exercises: Exercise[]
    index: number
    totalItems: number
    allItems: WorkoutItem[]  // All items in the workout for context
    onUpdate: (updates: Partial<WorkoutItem>) => void
    onDelete: () => void
    onMoveUp: () => void
    onMoveDown: () => void
    onUpdateChild?: (childId: string, updates: Partial<WorkoutItem>) => void
    onDeleteChild?: (childId: string) => void
    onMoveChild?: (childId: string, direction: 'up' | 'down') => void
    onRemoveFromSuperset?: (childId: string) => void
    onDissolveSuperset?: () => void
    onCreateSupersetWithNext?: () => void
    onAddToSuperset?: (supersetId: string) => void
    dragHandleProps?: any // Passed from Sortable wrapper
}

import { GripVertical, Trash2, MessageSquare, Repeat, Check, PlayCircle, ArrowLeftRight, Search, X, Pencil } from 'lucide-react'
import { FloatingExercisePlayer } from '@/components/exercises/floating-exercise-player'

export function WorkoutItemCard({
    item,
    exercises,
    index,
    totalItems,
    allItems,
    onUpdate,
    onDelete,
    onMoveUp,
    onMoveDown,
    onUpdateChild,
    onDeleteChild,
    onMoveChild,
    onCreateSupersetWithNext,
    onAddToSuperset,
    onRemoveFromSuperset,
    onDissolveSuperset,
    dragHandleProps,
}: WorkoutItemCardProps) {
    if (item.item_type === 'note') {
        return (
            <div className="bg-surface-card rounded-xl border border-k-border-subtle p-4 group flex items-start gap-3 relative">
                {/* Drag Handle */}
                <div
                    {...dragHandleProps}
                    className="mt-1 text-k-text-quaternary hover:text-k-text-secondary cursor-grab active:cursor-grabbing touch-none transition-colors"
                >
                    <GripVertical className="w-4 h-4" />
                </div>

                <div className="flex-1">
                    <textarea
                        value={item.notes || ''}
                        onChange={(e) => onUpdate({ notes: e.target.value })}
                        placeholder="Escreva uma nota..."
                        rows={2}
                        className="w-full px-0 py-0 bg-transparent border-0 text-k-text-primary placeholder:text-k-text-quaternary focus:outline-none focus:ring-0 text-sm resize-none"
                    />
                </div>

                <button
                    onClick={onDelete}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-k-text-quaternary hover:text-red-400 p-1"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        )
    }

    if (item.item_type === 'superset') {
        return (
            <div className="bg-surface-card rounded-xl border border-k-border-subtle p-4 relative group">
                {/* Vertical Accent */}
                <div className="absolute top-4 bottom-4 left-0 w-1 bg-violet-600/20 rounded-r-full" />

                {/* Header */}
                <div className="flex items-center justify-between mb-4 pl-3">
                    <div className="flex items-center gap-3">
                        <div {...dragHandleProps} className="text-k-text-quaternary hover:text-k-text-secondary cursor-grab active:cursor-grabbing touch-none">
                            <GripVertical className="w-4 h-4" />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-violet-400 uppercase tracking-widest">Superset</span>
                            <span className="flex items-center justify-center bg-violet-500/10 text-violet-300 text-[10px] font-bold px-1.5 py-0.5 rounded border border-violet-500/20">
                                {item.children?.length || 0}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-k-text-tertiary uppercase tracking-wider">Descanso</span>
                            <input
                                type="number"
                                value={item.rest_seconds || ''}
                                onChange={(e) => onUpdate({ rest_seconds: parseInt(e.target.value) || null })}
                                placeholder="0"
                                className="w-8 bg-transparent text-k-text-primary text-xs font-medium text-center focus:outline-none focus:text-violet-400 transition-colors placeholder:text-k-border-subtle"
                            />
                            <span className="text-[10px] text-k-text-tertiary">s</span>
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={onDissolveSuperset} className="text-k-text-quaternary hover:text-k-text-primary p-1" title="Dissolver">
                                <Repeat className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={onDelete} className="text-k-text-quaternary hover:text-red-400 p-1">
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Children */}
                <div className="space-y-2 pl-3">
                    {item.children?.map((child, childIndex) => (
                        <SupersetChildCard
                            key={child.id}
                            item={child}
                            exercises={exercises}
                            onUpdate={(updates) => onUpdateChild?.(child.id, updates)}
                            onDelete={() => onDeleteChild?.(child.id)}
                            onRemoveFromSuperset={() => onRemoveFromSuperset?.(child.id)}
                        />
                    ))}


                </div>
            </div>
        )
    }

    // Exercise Item
    return (
        <ExerciseItemCard
            item={item}
            exercises={exercises}
            onUpdate={onUpdate}
            onDelete={onDelete}
            dragHandleProps={dragHandleProps}
        />
    )
}

function ExerciseItemCard({
    item,
    exercises,
    onUpdate,
    onDelete,
    dragHandleProps,
}: {
    item: WorkoutItem
    exercises: Exercise[]
    onUpdate: (updates: Partial<WorkoutItem>) => void
    onDelete: () => void
    dragHandleProps?: any
}) {
    const [showVideo, setShowVideo] = useState(false)
    const [videoExercise, setVideoExercise] = useState<Exercise | null>(null)
    const [isSwapping, setIsSwapping] = useState(false)
    const [swapQuery, setSwapQuery] = useState('')
    const swapInputRef = useRef<HTMLInputElement>(null)

    // Swap: filter exercises by query, prioritize same muscle group
    const currentGroups = new Set((item.exercise?.muscle_groups || []).map(g => g.name.toLowerCase()))
    const swapCandidates = exercises
        .filter(ex => ex.id !== item.exercise_id)
        .filter(ex => {
            if (!swapQuery.trim()) return true
            const q = swapQuery.toLowerCase()
            return ex.name.toLowerCase().includes(q) ||
                (ex.muscle_groups || []).some(g => g.name.toLowerCase().includes(q))
        })
        .sort((a, b) => {
            const aOverlap = (a.muscle_groups || []).some(g => currentGroups.has(g.name.toLowerCase())) ? 1 : 0
            const bOverlap = (b.muscle_groups || []).some(g => currentGroups.has(g.name.toLowerCase())) ? 1 : 0
            if (aOverlap !== bOverlap) return bOverlap - aOverlap
            return a.name.localeCompare(b.name)
        })
        .slice(0, 8)

    const confirmSwap = (newExercise: Exercise) => {
        onUpdate({
            exercise_id: newExercise.id,
            exercise: newExercise,
        })
        setIsSwapping(false)
        setSwapQuery('')
    }

    const startSwap = () => {
        setIsSwapping(true)
        setSwapQuery('')
        setTimeout(() => swapInputRef.current?.focus(), 50)
    }

    if (isSwapping) {
        return (
            <>
            <div className="bg-surface-card rounded-xl border border-violet-500/30 p-4 relative transition-all">
                <div className="flex items-center gap-3 mb-3">
                    <Search className="w-4 h-4 text-k-text-quaternary shrink-0" />
                    <input
                        ref={swapInputRef}
                        type="text"
                        value={swapQuery}
                        onChange={(e) => setSwapQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Escape' && setIsSwapping(false)}
                        placeholder="Buscar exercício para substituir..."
                        className="flex-1 bg-transparent text-sm text-k-text-primary placeholder:text-k-text-quaternary focus:outline-none"
                    />
                    <button
                        onClick={() => setIsSwapping(false)}
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
                                className="flex items-center gap-1 rounded-lg hover:bg-violet-500/10 transition-colors group/swap"
                            >
                                <button
                                    onClick={() => confirmSwap(ex)}
                                    className="flex-1 flex items-center justify-between px-3 py-2 text-left min-w-0"
                                >
                                    <span className="text-xs font-medium text-k-text-secondary group-hover/swap:text-k-text-primary truncate">
                                        {ex.name}
                                    </span>
                                    <div className="flex gap-1 shrink-0 ml-2">
                                        {(ex.muscle_groups || []).slice(0, 2).map(g => (
                                            <span key={g.id || g.name} className="text-[9px] text-k-text-quaternary bg-glass-bg px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">
                                                {g.name}
                                            </span>
                                        ))}
                                    </div>
                                </button>
                                {ex.video_url && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            setVideoExercise(ex)
                                            setShowVideo(true)
                                        }}
                                        className="p-1.5 text-k-text-quaternary hover:text-violet-400 transition-colors shrink-0 mr-1"
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
            <FloatingExercisePlayer
                isOpen={showVideo}
                onClose={() => { setShowVideo(false); setVideoExercise(null) }}
                videoUrl={videoExercise?.video_url || null}
                title={videoExercise?.name || ''}
            />
            </>
        )
    }

    return (
        <>
        <div className="bg-surface-card rounded-xl border border-k-border-subtle p-4 group relative transition-all hover:border-k-border-primary">
            <div className="flex items-start gap-3">
                {/* Drag Handle */}
                <div
                    {...dragHandleProps}
                    className="mt-1 text-k-text-quaternary hover:text-k-text-secondary cursor-grab active:cursor-grabbing touch-none transition-colors"
                >
                    <GripVertical className="w-4 h-4" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    {/* Header: Name + Tag */}
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                            <span className="text-sm font-bold text-k-text-primary truncate">
                                {item.exercise?.name || 'Exercício sem nome'}
                            </span>
                            {item.exercise?.video_url && (
                                <button
                                    onClick={() => { setVideoExercise(item.exercise!); setShowVideo(true) }}
                                    className="text-k-text-quaternary hover:text-violet-400 transition-colors shrink-0"
                                    title="Ver vídeo demonstrativo"
                                >
                                    <PlayCircle className="w-4 h-4" />
                                </button>
                            )}
                            {item.exercise?.muscle_groups?.map(g => (
                                <span key={g.id || g.name} className="text-[9px] font-bold uppercase tracking-wider text-k-text-tertiary bg-glass-bg px-1.5 py-0.5 rounded border border-k-border-subtle whitespace-nowrap">
                                    {g.name}
                                </span>
                            ))}
                        </div>

                        {/* Hover Actions */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={startSwap}
                                className="p-1.5 rounded-md text-k-text-quaternary hover:text-violet-400 hover:bg-violet-400/10 transition-colors"
                                title="Trocar exercício"
                            >
                                <ArrowLeftRight className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={onDelete}
                                className="p-1.5 rounded-md text-k-text-quaternary hover:text-red-400 hover:bg-red-400/10 transition-colors"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* Inline Parameters */}
                    <div className="flex items-center gap-6">
                        {/* Sets */}
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-k-text-tertiary uppercase tracking-wider">Séries</span>
                            <input
                                type="number"
                                min={1}
                                step={1}
                                value={item.sets || ''}
                                onChange={(e) => onUpdate({ sets: parseInt(e.target.value) || null })}
                                onFocus={(e) => e.target.select()}
                                placeholder="0"
                                className="w-8 bg-transparent text-k-text-primary text-sm font-medium text-center focus:outline-none focus:text-violet-400 transition-colors placeholder:text-k-border-subtle border-b border-transparent focus:border-violet-500/50 p-0"
                            />
                        </div>

                        {/* Reps */}
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-k-text-tertiary uppercase tracking-wider">Reps</span>
                            <input
                                type="text"
                                value={item.reps || ''}
                                onChange={(e) => onUpdate({ reps: e.target.value || null })}
                                onFocus={(e) => e.target.select()}
                                placeholder="0"
                                className="w-12 bg-transparent text-k-text-primary text-sm font-medium text-center focus:outline-none focus:text-violet-400 transition-colors placeholder:text-k-border-subtle border-b border-transparent focus:border-violet-500/50 p-0"
                            />
                        </div>

                        {/* Rest */}
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-k-text-tertiary uppercase tracking-wider">Descanso</span>
                            <div className="relative">
                                <input
                                    type="number"
                                    min={0}
                                    step={15}
                                    value={item.rest_seconds || ''}
                                    onChange={(e) => onUpdate({ rest_seconds: parseInt(e.target.value) || null })}
                                    onFocus={(e) => e.target.select()}
                                    placeholder="0"
                                    className="w-10 bg-transparent text-k-text-primary text-sm font-medium text-center focus:outline-none focus:text-violet-400 transition-colors placeholder:text-k-border-subtle border-b border-transparent focus:border-violet-500/50 p-0"
                                />
                                <span className="absolute -right-2 top-0.5 text-[9px] text-k-text-tertiary pointer-events-none">s</span>
                            </div>
                        </div>
                    </div>

                    {/* Technical Note */}
                    <TechnicalNote
                        value={item.notes || ''}
                        onChange={(v) => onUpdate({ notes: v })}
                    />

                    <SubstituteSelector
                        item={item}
                        exercises={exercises}
                        onUpdate={onUpdate}
                    />
                </div>
            </div>
        </div>

        <FloatingExercisePlayer
            isOpen={showVideo}
            onClose={() => { setShowVideo(false); setVideoExercise(null) }}
            videoUrl={videoExercise?.video_url || null}
            title={videoExercise?.name || ''}
        />
        </>
    )
}

function SupersetChildCard({
    item,
    exercises,
    onUpdate,
    onDelete,
    onRemoveFromSuperset,
}: {
    item: WorkoutItem
    exercises: Exercise[]
    onUpdate: (updates: Partial<WorkoutItem>) => void
    onDelete: () => void
    onRemoveFromSuperset?: () => void
}) {
    return (
        <div className="bg-surface-inset rounded-lg border border-k-border-subtle p-3 group/child relative hover:border-k-border-primary transition-colors">
            <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-k-text-primary truncate">
                            {item.exercise?.name}
                        </span>

                        <div className="flex items-center gap-1 opacity-0 group-hover/child:opacity-100 transition-opacity">
                            <button onClick={onRemoveFromSuperset} className="text-k-text-quaternary hover:text-amber-400 p-1">
                                <span className="sr-only">Desvincular</span>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                            </button>
                            <button onClick={onDelete} className="text-k-text-quaternary hover:text-red-400 p-1">
                                <Trash2 className="w-3 h-3" />
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold text-k-text-tertiary uppercase">Sets</span>
                            <input
                                type="number"
                                min={1}
                                step={1}
                                value={item.sets || ''}
                                onChange={(e) => onUpdate({ sets: parseInt(e.target.value) || null })}
                                onFocus={(e) => e.target.select()}
                                placeholder="0"
                                className="w-6 bg-transparent text-k-text-primary text-xs font-medium text-center focus:outline-none focus:text-violet-400 border-b border-transparent focus:border-violet-500/50 p-0"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold text-k-text-tertiary uppercase">Reps</span>
                            <input
                                type="text"
                                value={item.reps || ''}
                                onChange={(e) => onUpdate({ reps: e.target.value || null })}
                                onFocus={(e) => e.target.select()}
                                placeholder="0"
                                className="w-8 bg-transparent text-k-text-primary text-xs font-medium text-center focus:outline-none focus:text-violet-400 border-b border-transparent focus:border-violet-500/50 p-0"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

function TechnicalNote({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    const [editing, setEditing] = useState(false)
    const [local, setLocal] = useState(value)
    const inputRef = useRef<HTMLInputElement>(null)

    const commit = () => {
        setEditing(false)
        onChange(local)
    }

    const startEditing = () => {
        setLocal(value)
        setEditing(true)
        setTimeout(() => {
            inputRef.current?.focus()
            inputRef.current?.select()
        }, 30)
    }

    if (editing) {
        return (
            <div className="mt-2 flex items-center gap-2 py-1.5">
                <MessageSquare size={14} className="text-violet-400 shrink-0" />
                <input
                    ref={inputRef}
                    value={local}
                    onChange={e => setLocal(e.target.value)}
                    onBlur={commit}
                    onKeyDown={e => {
                        if (e.key === 'Enter') commit()
                        if (e.key === 'Escape') { setLocal(value); setEditing(false) }
                    }}
                    placeholder="Ex: Manter lombar neutra, descer até 90°..."
                    className="bg-transparent text-k-text-secondary text-xs outline-none flex-1 border-b border-violet-400 placeholder:text-k-text-quaternary pb-0.5"
                />
            </div>
        )
    }

    if (value) {
        return (
            <div
                onClick={startEditing}
                className="mt-2 flex items-center gap-2 py-1.5 px-2 -mx-2 rounded-lg bg-violet-500/5 border-l-2 border-violet-500/40 cursor-pointer hover:bg-violet-500/10 transition-colors group/note"
            >
                <MessageSquare size={14} className="text-violet-400/70 shrink-0" />
                <span className="text-k-text-secondary text-xs flex-1">{value}</span>
                <Pencil size={12} className="text-k-text-quaternary opacity-0 group-hover/note:opacity-100 transition-opacity shrink-0" />
            </div>
        )
    }

    return (
        <div
            onClick={startEditing}
            className="mt-2 flex items-center gap-2 py-1.5 cursor-pointer text-k-text-quaternary hover:text-k-text-tertiary transition-colors group/note"
        >
            <MessageSquare size={14} className="shrink-0 group-hover/note:text-violet-400/50" />
            <span className="text-xs">Adicionar nota técnica...</span>
        </div>
    )
}

function SubstituteSelector({
    item,
    exercises,
    onUpdate,
}: {
    item: WorkoutItem
    exercises: Exercise[]
    onUpdate: (updates: Partial<WorkoutItem>) => void
}) {
    const [isOpen, setIsOpen] = useState(false)
    const [query, setQuery] = useState('')

    const selectedIds = item.substitute_exercise_ids || []
    const selectedSet = new Set(selectedIds)
    const selectedCount = selectedIds.length

    const normalizedQuery = query.trim().toLowerCase()
    const currentExerciseId = item.exercise_id
    const currentGroups = new Set((item.exercise?.muscle_groups || []).map((group) => group.name.toLowerCase()))

    // Filter and sort mechanics (same as before)
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

    const visibleCandidates = sortedCandidates.slice(0, normalizedQuery ? 25 : 12)

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
                <Repeat className={`w-3 h-3 ${isOpen ? 'text-violet-400' : 'text-k-text-tertiary group-hover:text-k-text-primary'}`} />
                <span className={isOpen || selectedCount > 0 ? 'text-violet-400' : 'text-k-text-tertiary group-hover:text-k-text-secondary'}>
                    {selectedCount > 0 ? `Substituições (${selectedCount})` : 'Substituições (nenhuma)'}
                </span>
            </button>

            <div className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${isOpen ? 'grid-rows-[1fr] mt-2' : 'grid-rows-[0fr]'}`}>
                <div className="overflow-hidden">
                    <div className="bg-surface-inset rounded-xl border border-k-border-subtle p-3">
                        {/* Search */}
                        <div className="relative mb-2">
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Buscar exercício..."
                                className="w-full h-8 pl-8 pr-3 bg-glass-bg border-none rounded-lg text-k-text-primary text-xs placeholder:text-k-text-quaternary focus:outline-none focus:ring-1 focus:ring-violet-500/50 transition-all font-medium"
                            />
                            <svg className="w-3.5 h-3.5 text-k-text-quaternary absolute left-2.5 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>

                        {/* List */}
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
                                                ? 'bg-violet-500/10 border border-violet-500/20'
                                                : 'hover:bg-glass-bg border border-transparent hover:border-k-border-subtle'
                                                }`}
                                        >
                                            <div className="min-w-0 flex-1 pr-2">
                                                <div className={`text-xs font-medium truncate transition-colors ${isSelected ? 'text-violet-300' : 'text-k-text-secondary group-hover/item:text-k-text-primary'}`}>
                                                    {exercise.name}
                                                </div>
                                                <div className="text-[9px] text-k-text-quaternary uppercase tracking-wider truncate mt-0.5">
                                                    {(exercise.muscle_groups || []).map(g => g.name).join(', ') || 'Sem grupo'}
                                                </div>
                                            </div>

                                            {isSelected && (
                                                <div className="text-violet-400 animate-in zoom-in-50 duration-200">
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
}
