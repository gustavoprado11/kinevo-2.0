'use client'

import { useState } from 'react'
import type { WorkoutItem } from './program-builder-client'

interface WorkoutItemCardProps {
    item: WorkoutItem
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
            <div className="bg-gray-900/50 rounded-xl border border-gray-700/30 p-4 group flex items-start gap-3">
                {/* Drag Handle */}
                <div
                    {...dragHandleProps}
                    className="mt-1 text-gray-600 hover:text-gray-400 cursor-grab active:cursor-grabbing touch-none"
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
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-sm resize-none"
                    />
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={onMoveUp} disabled={index === 0} className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-white disabled:opacity-30">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                    </button>
                    <button onClick={onMoveDown} disabled={index === totalItems - 1} className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-white disabled:opacity-30">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                    <button onClick={onDelete} className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-red-400">
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
            <div className="bg-gradient-to-r from-violet-500/5 to-blue-500/5 rounded-xl border border-violet-500/20 p-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        {/* Drag Handle */}
                        <div
                            {...dragHandleProps}
                            className="text-violet-500/50 hover:text-violet-400 cursor-grab active:cursor-grabbing touch-none mr-1"
                        >
                            <GripVertical className="w-5 h-5" />
                        </div>

                        <div className="w-6 h-6 rounded-md bg-violet-500/20 flex items-center justify-center">
                            <svg className="w-3 h-3 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </div>
                        <span className="text-sm font-medium text-violet-300">Superset</span>
                        <span className="text-xs text-gray-500">({item.children?.length || 0} exercícios)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-400">Descanso:</span>
                            <input
                                type="number"
                                value={item.rest_seconds || ''}
                                onChange={(e) => onUpdate({ rest_seconds: parseInt(e.target.value) || null })}
                                placeholder="60"
                                className="w-14 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-xs text-center focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                            />
                            <span className="text-xs text-gray-500">seg</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <button onClick={onMoveUp} disabled={index === 0} className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-white disabled:opacity-30">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                </svg>
                            </button>
                            <button onClick={onMoveDown} disabled={index === totalItems - 1} className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-white disabled:opacity-30">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                            {/* Dissolve superset button */}
                            <button
                                onClick={onDissolveSuperset}
                                title="Dissolver superset"
                                className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-violet-400"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                </svg>
                            </button>
                            <button onClick={onDelete} className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-red-400">
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
                        className="w-full py-2 text-sm text-violet-400 hover:bg-violet-500/10 rounded-lg transition-colors flex items-center justify-center gap-1.5 border border-dashed border-violet-500/30"
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
    index,
    totalItems,
    onUpdate,
    onDelete,
    onMoveUp,
    onMoveDown,
    onRemoveFromSuperset,
}: {
    item: WorkoutItem
    index: number
    totalItems: number
    onUpdate: (updates: Partial<WorkoutItem>) => void
    onDelete: () => void
    onMoveUp: () => void
    onMoveDown: () => void
    onRemoveFromSuperset?: () => void
}) {
    return (
        <div className="bg-gray-900/50 rounded-xl border border-gray-700/30 p-3 group relative">
            <div className="flex items-start gap-3">
                {/* Exercise number */}
                <div className="w-6 h-6 text-xs rounded-lg bg-gray-800 flex items-center justify-center text-gray-400 font-medium flex-shrink-0">
                    {index + 1}
                </div>

                {/* Exercise info */}
                <div className="flex-1 min-w-0">
                    <div className="font-medium text-white text-sm mb-2 truncate">
                        {item.exercise?.name || 'Exercício sem nome'}
                    </div>

                    {/* Config inputs */}
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-500">Séries:</span>
                            <input
                                type="number"
                                value={item.sets || ''}
                                onChange={(e) => onUpdate({ sets: parseInt(e.target.value) || null })}
                                placeholder="3"
                                min="1"
                                className="w-12 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-xs text-center focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                            />
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-500">Reps:</span>
                            <input
                                type="text"
                                value={item.reps || ''}
                                onChange={(e) => onUpdate({ reps: e.target.value || null })}
                                placeholder="10-12"
                                className="w-16 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-xs text-center focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                            />
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button onClick={onMoveUp} disabled={index === 0} className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-white disabled:opacity-30">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                    </button>
                    <button onClick={onMoveDown} disabled={index === totalItems - 1} className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-white disabled:opacity-30">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    {/* More options menu */}
                    <button onClick={onDelete} className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-red-400">
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
        <div className="bg-gray-900/50 rounded-xl border border-gray-700/30 p-4 group relative">
            <div className="flex items-start gap-3">
                {/* Drag Handle */}
                <div
                    {...dragHandleProps}
                    className="mt-1.5 text-gray-600 hover:text-gray-400 cursor-grab active:cursor-grabbing touch-none"
                    title="Arrastar para reordenar"
                >
                    <GripVertical className="w-5 h-5" />
                </div>

                {/* Exercise number */}
                <div className="w-8 h-8 text-sm rounded-lg bg-gray-800 flex items-center justify-center text-gray-400 font-medium flex-shrink-0">
                    {index + 1}
                </div>

                {/* Exercise info */}
                <div className="flex-1 min-w-0">
                    <div className="font-medium text-white text-sm mb-2 truncate">
                        {item.exercise?.name || 'Exercício sem nome'}
                    </div>

                    {/* Config inputs */}
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-500">Séries:</span>
                            <input
                                type="number"
                                value={item.sets || ''}
                                onChange={(e) => onUpdate({ sets: parseInt(e.target.value) || null })}
                                placeholder="3"
                                min="1"
                                className="w-12 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-xs text-center focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                            />
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-500">Reps:</span>
                            <input
                                type="text"
                                value={item.reps || ''}
                                onChange={(e) => onUpdate({ reps: e.target.value || null })}
                                placeholder="10-12"
                                className="w-16 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-xs text-center focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                            />
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-500">Descanso:</span>
                            <input
                                type="number"
                                value={item.rest_seconds || ''}
                                onChange={(e) => onUpdate({ rest_seconds: parseInt(e.target.value) || null })}
                                placeholder="60"
                                className="w-14 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-xs text-center focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                            />
                            <span className="text-xs text-gray-500">seg</span>
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="mt-2">
                        <input
                            type="text"
                            value={item.notes || ''}
                            onChange={(e) => onUpdate({ notes: e.target.value || null })}
                            placeholder="Nota técnica (opcional)"
                            className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-xs placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                        />
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button onClick={onMoveUp} disabled={index === 0} className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-white disabled:opacity-30">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                    </button>
                    <button onClick={onMoveDown} disabled={index === totalItems - 1} className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-white disabled:opacity-30">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    {/* More options menu */}
                    <button onClick={onDelete} className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-red-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    )
}
