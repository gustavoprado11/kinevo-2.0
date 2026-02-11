'use client'

import { useState } from 'react'
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

import { GripVertical, Trash2, MessageSquare, Repeat, Check } from 'lucide-react'

// ... existing imports ...

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
                    className="mt-1 text-k-border-subtle hover:text-k-text-tertiary cursor-grab active:cursor-grabbing touch-none transition-colors"
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
                        <div {...dragHandleProps} className="text-k-border-subtle hover:text-k-text-tertiary cursor-grab active:cursor-grabbing touch-none">
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
                            <span className="text-[10px] font-bold text-k-text-quaternary uppercase tracking-wider">Descanso</span>
                            <input
                                type="number"
                                value={item.rest_seconds || ''}
                                onChange={(e) => onUpdate({ rest_seconds: parseInt(e.target.value) || null })}
                                placeholder="0"
                                className="w-8 bg-transparent text-k-text-primary text-xs font-medium text-center focus:outline-none focus:text-violet-400 transition-colors placeholder:text-k-border-subtle"
                            />
                            <span className="text-[10px] text-k-text-quaternary">s</span>
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
    const [showNotes, setShowNotes] = useState(!!item.notes)

    return (
        <div className="bg-surface-card rounded-xl border border-k-border-subtle p-4 group relative transition-all hover:border-k-border-primary">
            <div className="flex items-start gap-3">
                {/* Drag Handle */}
                <div
                    {...dragHandleProps}
                    className="mt-1 text-k-border-subtle hover:text-k-text-tertiary cursor-grab active:cursor-grabbing touch-none transition-colors"
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
                            {item.exercise?.muscle_groups?.[0] && (
                                <span className="text-[9px] font-bold uppercase tracking-wider text-k-text-quaternary bg-glass-bg px-1.5 py-0.5 rounded border border-k-border-subtle whitespace-nowrap">
                                    {item.exercise.muscle_groups[0].name}
                                </span>
                            )}
                        </div>

                        {/* Hover Actions */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={() => setShowNotes(!showNotes)}
                                className={`p-1.5 rounded-md transition-colors ${showNotes ? 'text-violet-400 bg-violet-400/10' : 'text-k-text-quaternary hover:text-k-text-primary hover:bg-glass-bg'}`}
                            >
                                <MessageSquare className="w-3.5 h-3.5" />
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
                            <span className="text-[10px] font-bold text-k-text-quaternary uppercase tracking-wider">Séries</span>
                            <input
                                type="number"
                                value={item.sets || ''}
                                onChange={(e) => onUpdate({ sets: parseInt(e.target.value) || null })}
                                placeholder="0"
                                className="w-8 bg-transparent text-k-text-primary text-sm font-medium text-center focus:outline-none focus:text-violet-400 transition-colors placeholder:text-k-border-subtle border-b border-transparent focus:border-violet-500/50 p-0"
                            />
                        </div>

                        {/* Reps */}
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-k-text-quaternary uppercase tracking-wider">Reps</span>
                            <input
                                type="text"
                                value={item.reps || ''}
                                onChange={(e) => onUpdate({ reps: e.target.value || null })}
                                placeholder="0"
                                className="w-12 bg-transparent text-k-text-primary text-sm font-medium text-center focus:outline-none focus:text-violet-400 transition-colors placeholder:text-k-border-subtle border-b border-transparent focus:border-violet-500/50 p-0"
                            />
                        </div>

                        {/* Rest */}
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-k-text-quaternary uppercase tracking-wider">Descanso</span>
                            <div className="relative">
                                <input
                                    type="number"
                                    value={item.rest_seconds || ''}
                                    onChange={(e) => onUpdate({ rest_seconds: parseInt(e.target.value) || null })}
                                    placeholder="0"
                                    className="w-10 bg-transparent text-k-text-primary text-sm font-medium text-center focus:outline-none focus:text-violet-400 transition-colors placeholder:text-k-border-subtle border-b border-transparent focus:border-violet-500/50 p-0"
                                />
                                <span className="absolute -right-2 top-0.5 text-[9px] text-k-text-quaternary pointer-events-none">s</span>
                            </div>
                        </div>
                    </div>

                    {/* Notes (Conditional) */}
                    {showNotes && (
                        <div className="mt-3 pt-2 border-t border-k-border-subtle animate-in fade-in slide-in-from-top-1">
                            <textarea
                                value={item.notes || ''}
                                onChange={(e) => onUpdate({ notes: e.target.value })}
                                placeholder="Nota técnica..."
                                rows={1}
                                className="w-full bg-transparent text-xs text-k-text-secondary placeholder:text-k-border-subtle focus:outline-none focus:text-k-text-primary resize-none"
                            />
                        </div>
                    )}

                    <SubstituteSelector
                        item={item}
                        exercises={exercises}
                        onUpdate={onUpdate}
                    />
                </div>
            </div>
        </div>
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
                            <span className="text-[9px] font-bold text-k-text-quaternary uppercase">Sets</span>
                            <input
                                type="number"
                                value={item.sets || ''}
                                onChange={(e) => onUpdate({ sets: parseInt(e.target.value) || null })}
                                placeholder="0"
                                className="w-6 bg-transparent text-k-text-primary text-xs font-medium text-center focus:outline-none focus:text-violet-400 border-b border-transparent focus:border-violet-500/50 p-0"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold text-k-text-quaternary uppercase">Reps</span>
                            <input
                                type="text"
                                value={item.reps || ''}
                                onChange={(e) => onUpdate({ reps: e.target.value || null })}
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
                <Repeat className={`w-3 h-3 ${isOpen ? 'text-violet-400' : 'text-k-text-quaternary group-hover:text-k-text-primary'}`} />
                <span className={isOpen || selectedCount > 0 ? 'text-violet-400' : 'text-k-text-quaternary group-hover:text-k-text-secondary'}>
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
