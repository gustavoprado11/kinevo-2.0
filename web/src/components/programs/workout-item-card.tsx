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
    onAddExerciseToSuperset?: () => void
    onUpdateChild?: (childId: string, updates: Partial<WorkoutItem>) => void
    onDeleteChild?: (childId: string) => void
    onMoveChild?: (childId: string, direction: 'up' | 'down') => void
    onRemoveFromSuperset?: (childId: string) => void
    onDissolveSuperset?: () => void
    onCreateSupersetWithNext?: () => void
    onAddToSuperset?: (supersetId: string) => void
    dragHandleProps?: any // Passed from Sortable wrapper
}

import { GripVertical } from 'lucide-react'

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
    onAddExerciseToSuperset,
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
            <div className="bg-card rounded-xl border border-border/70 p-4 group flex items-start gap-3">
                {/* Drag Handle */}
                <div
                    {...dragHandleProps}
                    className="mt-1 text-muted-foreground/80 hover:text-muted-foreground cursor-grab active:cursor-grabbing touch-none"
                    title="Arrastar para reordenar"
                >
                    <GripVertical className="w-5 h-5" />
                </div>

                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                </div>
                <div className="flex-1">
                    <textarea
                        value={item.notes || ''}
                        onChange={(e) => onUpdate({ notes: e.target.value })}
                        placeholder="Escreva uma nota..."
                        rows={2}
                        className="w-full px-3 py-2 bg-muted dark:bg-slate-950 border border-border dark:border-slate-800 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-sm resize-none"
                    />
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={onMoveUp} disabled={index === 0} className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                    </button>
                    <button onClick={onMoveDown} disabled={index === totalItems - 1} className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                    <button onClick={onDelete} className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-red-400">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>
        )
    }

    if (item.item_type === 'superset') {
        return (
            <div className="bg-gradient-to-r from-violet-500/5 to-blue-500/5 dark:from-violet-500/10 dark:to-blue-500/10 rounded-xl border border-violet-500/20 dark:border-violet-500/30 p-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        {/* Drag Handle */}
                        <div
                            {...dragHandleProps}
                            className="text-violet-500/50 hover:text-violet-400 cursor-grab active:cursor-grabbing touch-none mr-1"
                        >
                            <GripVertical className="w-5 h-5" />
                        </div>

                        <div className="w-6 h-6 rounded-md bg-violet-500/20 dark:bg-violet-500/30 flex items-center justify-center">
                            <svg className="w-3 h-3 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </div>
                        <span className="text-sm font-medium text-violet-300 dark:text-violet-400">Superset</span>
                        <span className="text-xs text-muted-foreground dark:text-slate-500">({item.children?.length || 0} exercícios)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">Descanso:</span>
                            <input
                                type="number"
                                value={item.rest_seconds || ''}
                                onChange={(e) => onUpdate({ rest_seconds: parseInt(e.target.value) || null })}
                                placeholder="60"
                                className="w-14 px-2 py-1 bg-muted border border-border rounded text-foreground text-xs text-center focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                            />
                            <span className="text-xs text-muted-foreground">seg</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <button onClick={onMoveUp} disabled={index === 0} className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                </svg>
                            </button>
                            <button onClick={onMoveDown} disabled={index === totalItems - 1} className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                            {/* Dissolve superset button */}
                            <button
                                onClick={onDissolveSuperset}
                                title="Dissolver superset"
                                className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-violet-400"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                </svg>
                            </button>
                            <button onClick={onDelete} className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-red-400">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Superset children */}
                <div className="space-y-2 ml-4 border-l-2 border-violet-500/30 pl-3">
                    {item.children?.map((child, childIndex) => (
                        <SupersetChildCard
                            key={child.id}
                            item={child}
                            exercises={exercises}
                            index={childIndex}
                            totalItems={item.children?.length || 0}
                            onUpdate={(updates) => onUpdateChild?.(child.id, updates)}
                            onDelete={() => onDeleteChild?.(child.id)}
                            onMoveUp={() => onMoveChild?.(child.id, 'up')}
                            onMoveDown={() => onMoveChild?.(child.id, 'down')}
                            onRemoveFromSuperset={() => onRemoveFromSuperset?.(child.id)}
                        />
                    ))}

                    <button
                        onClick={onAddExerciseToSuperset}
                        className="w-full py-2 text-sm text-violet-400 dark:text-violet-500 hover:bg-violet-500/10 dark:hover:bg-violet-500/20 rounded-lg transition-colors flex items-center justify-center gap-1.5 border border-dashed border-violet-500/30 dark:border-violet-500/50"
                    >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Adicionar exercício
                    </button>
                </div>
            </div>
        )
    }

    // Exercise - calculate context for superset options
    const nextItem = allItems[index + 1]
    const prevItem = allItems[index - 1]
    const canCreateSupersetWithNext = nextItem?.item_type === 'exercise'
    const supersetAbove = prevItem?.item_type === 'superset' ? prevItem : null
    const supersetBelow = nextItem?.item_type === 'superset' ? nextItem : null

    return (
        <ExerciseItemCard
            item={item}
            exercises={exercises}
            index={index}
            totalItems={totalItems}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            canCreateSupersetWithNext={canCreateSupersetWithNext}
            onCreateSupersetWithNext={onCreateSupersetWithNext}
            supersetAbove={supersetAbove}
            supersetBelow={supersetBelow}
            onAddToSuperset={onAddToSuperset}
            dragHandleProps={dragHandleProps}
        />
    )
}

// Exercise item inside a superset (with remove option)
function SupersetChildCard({
    item,
    exercises,
    index,
    totalItems,
    onUpdate,
    onDelete,
    onMoveUp,
    onMoveDown,
    onRemoveFromSuperset,
}: {
    item: WorkoutItem
    exercises: Exercise[]
    index: number
    totalItems: number
    onUpdate: (updates: Partial<WorkoutItem>) => void
    onDelete: () => void
    onMoveUp: () => void
    onMoveDown: () => void
    onRemoveFromSuperset?: () => void
}) {
    return (
        <div className="bg-card rounded-xl border border-border/70 p-3 group relative">
            <div className="flex items-start gap-3">
                {/* Exercise number */}
                <div className="w-6 h-6 text-xs rounded-lg bg-muted dark:bg-slate-950 flex items-center justify-center text-muted-foreground dark:text-slate-500 font-medium flex-shrink-0 border dark:border-slate-800">
                    {index + 1}
                </div>

                {/* Exercise info */}
                <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground text-sm mb-2 truncate">
                        {item.exercise?.name || 'Exercício sem nome'}
                    </div>

                    {/* Config inputs */}
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground">Séries:</span>
                            <input
                                type="number"
                                value={item.sets || ''}
                                onChange={(e) => onUpdate({ sets: parseInt(e.target.value) || null })}
                                placeholder="3"
                                min="1"
                                className="w-12 px-2 py-1 bg-muted border border-border rounded text-foreground text-xs text-center focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                            />
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground dark:text-slate-500">Reps:</span>
                            <input
                                type="text"
                                value={item.reps || ''}
                                onChange={(e) => onUpdate({ reps: e.target.value || null })}
                                placeholder="10-12"
                                className="w-16 px-2 py-1 bg-muted dark:bg-slate-950 border border-border dark:border-slate-800 rounded text-foreground dark:text-slate-100 text-xs text-center focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                            />
                        </div>
                    </div>

                    <SubstituteSelector
                        item={item}
                        exercises={exercises}
                        onUpdate={onUpdate}
                    />
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button onClick={onMoveUp} disabled={index === 0} className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                    </button>
                    <button onClick={onMoveDown} disabled={index === totalItems - 1} className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    {/* More options menu */}
                    <button onClick={onDelete} className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-red-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    )
}

// Separate component for standalone exercise items with superset options
function ExerciseItemCard({
    item,
    exercises,
    index,
    totalItems,
    onUpdate,
    onDelete,
    onMoveUp,
    onMoveDown,
    canCreateSupersetWithNext,
    onCreateSupersetWithNext,
    supersetAbove,
    supersetBelow,
    onAddToSuperset,
    dragHandleProps,
}: {
    item: WorkoutItem
    exercises: Exercise[]
    index: number
    totalItems: number
    onUpdate: (updates: Partial<WorkoutItem>) => void
    onDelete: () => void
    onMoveUp: () => void
    onMoveDown: () => void
    canCreateSupersetWithNext?: boolean
    onCreateSupersetWithNext?: () => void
    supersetAbove?: WorkoutItem | null
    supersetBelow?: WorkoutItem | null
    onAddToSuperset?: (supersetId: string) => void
    dragHandleProps?: any
}) {
    return (
        <div className="bg-card rounded-xl border border-border/70 p-4 group relative">
            <div className="flex items-start gap-3">
                {/* Drag Handle */}
                <div
                    {...dragHandleProps}
                    className="mt-1.5 text-muted-foreground/80 hover:text-muted-foreground cursor-grab active:cursor-grabbing touch-none"
                    title="Arrastar para reordenar"
                >
                    <GripVertical className="w-5 h-5" />
                </div>

                {/* Exercise number */}
                <div className="w-8 h-8 text-sm rounded-lg bg-muted flex items-center justify-center text-muted-foreground font-medium flex-shrink-0">
                    {index + 1}
                </div>

                {/* Exercise info */}
                <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground text-sm mb-2 truncate">
                        {item.exercise?.name || 'Exercício sem nome'}
                    </div>

                    {/* Config inputs */}
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground">Séries:</span>
                            <input
                                type="number"
                                value={item.sets || ''}
                                onChange={(e) => onUpdate({ sets: parseInt(e.target.value) || null })}
                                placeholder="3"
                                min="1"
                                className="w-12 px-2 py-1 bg-muted border border-border rounded text-foreground text-xs text-center focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                            />
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground">Reps:</span>
                            <input
                                type="text"
                                value={item.reps || ''}
                                onChange={(e) => onUpdate({ reps: e.target.value || null })}
                                placeholder="10-12"
                                className="w-16 px-2 py-1 bg-muted border border-border rounded text-foreground text-xs text-center focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                            />
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground">Descanso:</span>
                            <input
                                type="number"
                                value={item.rest_seconds || ''}
                                onChange={(e) => onUpdate({ rest_seconds: parseInt(e.target.value) || null })}
                                placeholder="60"
                                className="w-14 px-2 py-1 bg-muted border border-border rounded text-foreground text-xs text-center focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                            />
                            <span className="text-xs text-muted-foreground">seg</span>
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="mt-2">
                        <input
                            type="text"
                            value={item.notes || ''}
                            onChange={(e) => onUpdate({ notes: e.target.value || null })}
                            placeholder="Nota técnica (opcional)"
                            className="w-full px-2 py-1.5 bg-muted border border-border rounded text-foreground text-xs placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                        />
                    </div>

                    <SubstituteSelector
                        item={item}
                        exercises={exercises}
                        onUpdate={onUpdate}
                    />
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button onClick={onMoveUp} disabled={index === 0} className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                    </button>
                    <button onClick={onMoveDown} disabled={index === totalItems - 1} className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    {/* More options menu */}
                    <button onClick={onDelete} className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-red-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
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
    const [query, setQuery] = useState('')

    const selectedIds = item.substitute_exercise_ids || []
    const selectedSet = new Set(selectedIds)
    const selectedCount = selectedIds.length

    const normalizedQuery = query.trim().toLowerCase()
    const currentExerciseId = item.exercise_id
    const currentGroups = new Set((item.exercise?.muscle_groups || []).map((group) => group.name.toLowerCase()))

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
        <details className="mt-2 rounded-lg border border-border/70 bg-muted/40 p-2">
            <summary className="cursor-pointer select-none text-xs font-medium text-foreground/90">
                Substituicoes
                <span className="ml-2 text-muted-foreground">
                    {selectedCount > 0 ? `(${selectedCount} selecionadas)` : '(nenhuma)'}
                </span>
            </summary>

            <div className="mt-2 space-y-2">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar exercicio..."
                    className="w-full px-2 py-1.5 bg-background border border-border rounded text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                />

                <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                    {visibleCandidates.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">Nenhum exercicio encontrado.</p>
                    ) : (
                        visibleCandidates.map((exercise) => {
                            const checked = selectedSet.has(exercise.id)
                            const sameGroup = (exercise.muscle_groups || []).some((group) =>
                                currentGroups.has(group.name.toLowerCase())
                            )

                            return (
                                <label
                                    key={exercise.id}
                                    className={`flex items-start gap-2 rounded-md border px-2 py-1.5 cursor-pointer transition-colors ${checked
                                        ? 'bg-violet-500/10 border-violet-500/40'
                                        : sameGroup
                                            ? 'bg-background border-border'
                                            : 'bg-background/60 border-border/60'
                                        }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => toggleSubstitute(exercise.id)}
                                        className="mt-0.5 h-3.5 w-3.5 rounded border-border bg-background"
                                    />
                                    <div className="min-w-0">
                                        <p className="text-xs font-medium text-foreground truncate">{exercise.name}</p>
                                        <p className="text-[11px] text-muted-foreground truncate">
                                            {(exercise.muscle_groups || []).map((group) => group.name).join(', ') || 'Grupo nao informado'}
                                        </p>
                                    </div>
                                </label>
                            )
                        })
                    )}
                </div>
            </div>
        </details>
    )
}
