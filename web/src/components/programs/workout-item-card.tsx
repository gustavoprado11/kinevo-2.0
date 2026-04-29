'use client'

import type { HTMLAttributes } from 'react'
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
    onDuplicate?: () => void
    onMoveUp: () => void
    onMoveDown: () => void
    onUpdateChild?: (childId: string, updates: Partial<WorkoutItem>) => void
    onDeleteChild?: (childId: string) => void
    onMoveChild?: (childId: string, direction: 'up' | 'down') => void
    onRemoveFromSuperset?: (childId: string) => void
    onDissolveSuperset?: () => void
    onCreateSupersetWithNext?: () => void
    onAddToSuperset?: (supersetId: string) => void
    dragHandleProps?: HTMLAttributes<HTMLDivElement> // Passed from Sortable wrapper
    readonly?: boolean
}

import { FileText, GripVertical, Trash2 } from 'lucide-react'
import {
    ExerciseItemCard,
    WarmupItemCard,
    CardioItemCard,
    SupersetItemCard,
} from './workout-card'

export function WorkoutItemCard({
    item,
    exercises,
    onUpdate,
    onDelete,
    onDuplicate,
    onUpdateChild,
    onDeleteChild,
    onRemoveFromSuperset,
    onDissolveSuperset,
    dragHandleProps,
    readonly,
}: WorkoutItemCardProps) {
    if (item.item_type === 'note') {
        return (
            <div className="bg-white dark:bg-surface-card rounded-xl border border-[#E8E8ED] dark:border-k-border-subtle p-4 group flex items-start gap-3 relative transition-all hover:border-[#D2D2D7] dark:hover:border-k-border-primary">
                {!readonly && (
                    <div
                        {...dragHandleProps}
                        className="mt-1.5 text-k-text-quaternary hover:text-k-text-secondary cursor-grab active:cursor-grabbing touch-none transition-colors"
                    >
                        <GripVertical className="w-4 h-4" />
                    </div>
                )}

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                        <FileText className="w-4 h-4 text-k-text-quaternary shrink-0" />
                        <span className="text-sm font-bold text-k-text-primary">Nota</span>
                    </div>
                    {readonly ? (
                        !item.notes ? null : <p className="text-sm text-k-text-secondary">{item.notes}</p>
                    ) : (
                        <textarea
                            value={item.notes || ''}
                            onChange={(e) => onUpdate({ notes: e.target.value })}
                            placeholder="Escreva uma nota..."
                            rows={2}
                            className="w-full px-3 py-2 bg-[#F9F9FB] dark:bg-surface-inset border border-[#E8E8ED] dark:border-k-border-subtle rounded-lg text-k-text-primary placeholder:text-k-text-quaternary focus:outline-none focus:border-[#007AFF]/40 dark:focus:border-violet-500/40 text-sm resize-none"
                        />
                    )}
                </div>

                {!readonly && (
                    <button
                        onClick={onDelete}
                        className="p-1.5 rounded-md text-[#AEAEB2] dark:text-k-text-quaternary hover:text-[#FF3B30] dark:hover:text-red-400 hover:bg-[#FF3B30]/10 dark:hover:bg-red-400/10 transition-colors"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                )}
            </div>
        )
    }

    if (item.item_type === 'superset') {
        return (
            <SupersetItemCard
                item={item}
                onUpdate={onUpdate}
                onDelete={onDelete}
                onDuplicate={onDuplicate}
                onUpdateChild={onUpdateChild}
                onDeleteChild={onDeleteChild}
                onRemoveFromSuperset={onRemoveFromSuperset}
                onDissolveSuperset={onDissolveSuperset}
                dragHandleProps={dragHandleProps}
                readonly={readonly}
            />
        )
    }

    if (item.item_type === 'warmup') {
        return (
            <WarmupItemCard
                item={item}
                onUpdate={onUpdate}
                onDelete={onDelete}
                dragHandleProps={dragHandleProps}
                readonly={readonly}
            />
        )
    }

    if (item.item_type === 'cardio') {
        return (
            <CardioItemCard
                item={item}
                onUpdate={onUpdate}
                onDelete={onDelete}
                dragHandleProps={dragHandleProps}
                readonly={readonly}
            />
        )
    }

    // Exercise Item
    return (
        <ExerciseItemCard
            item={item}
            exercises={exercises}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onDuplicate={onDuplicate}
            dragHandleProps={dragHandleProps}
            readonly={readonly}
        />
    )
}


