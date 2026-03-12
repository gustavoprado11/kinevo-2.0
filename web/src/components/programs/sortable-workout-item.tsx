'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { WorkoutItemCard } from './workout-item-card'
import type { WorkoutItem } from './program-builder-client'
import type { Exercise } from '@/types/exercise'
import { Z } from '@/lib/z-index'

interface SortableWorkoutItemProps {
    item: WorkoutItem
    exercises: Exercise[]
    index: number
    totalItems: number
    allItems: WorkoutItem[]
    onUpdate: (updates: Partial<WorkoutItem>) => void
    onDelete: () => void
    // Legacy move props (still used for buttons)
    onMoveUp: () => void
    onMoveDown: () => void
    // Superset props
    onUpdateChild?: (childId: string, updates: Partial<WorkoutItem>) => void
    onDeleteChild?: (childId: string) => void
    onMoveChild?: (childId: string, direction: 'up' | 'down') => void
    onCreateSupersetWithNext?: () => void
    onAddToSuperset?: (supersetId: string) => void
    onRemoveFromSuperset?: (childId: string) => void
    onDissolveSuperset?: () => void
    readonly?: boolean
}

export function SortableWorkoutItem(props: SortableWorkoutItemProps) {
    // In readonly mode, skip DnD entirely — render a plain div
    if (props.readonly) {
        return (
            <div style={{ position: 'relative' }}>
                <WorkoutItemCard {...props} readonly />
            </div>
        )
    }

    return <DraggableSortableItem {...props} />
}

function DraggableSortableItem(props: SortableWorkoutItemProps) {
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
        zIndex: isDragging ? Z.MODAL : 'auto',
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
