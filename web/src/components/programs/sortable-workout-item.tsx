'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { WorkoutItemCard } from './workout-item-card'
import type { WorkoutItem } from './program-builder-client'

interface SortableWorkoutItemProps {
    item: WorkoutItem
    index: number
    totalItems: number
    allItems: WorkoutItem[]
    onUpdate: (updates: Partial<WorkoutItem>) => void
    onDelete: () => void
    // Legacy move props (still used for buttons)
    onMoveUp: () => void
    onMoveDown: () => void
    // Superset props
    onAddExerciseToSuperset?: () => void
    onUpdateChild?: (childId: string, updates: Partial<WorkoutItem>) => void
    onDeleteChild?: (childId: string) => void
    onMoveChild?: (childId: string, direction: 'up' | 'down') => void
    onCreateSupersetWithNext?: () => void
    onAddToSuperset?: (supersetId: string) => void
    onRemoveFromSuperset?: (childId: string) => void
    onDissolveSuperset?: () => void
}

export function SortableWorkoutItem(props: SortableWorkoutItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: props.item.id })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        // Ensure z-index is higher while dragging
        zIndex: isDragging ? 50 : 'auto',
        position: 'relative' as const,
    }

    return (
        <div ref={setNodeRef} style={style} className="touch-none">
            <WorkoutItemCard
                {...props}
                dragHandleProps={{ ...attributes, ...listeners }}
            />
        </div>
    )
}
