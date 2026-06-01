'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { motion } from 'framer-motion'
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
    onDuplicate?: () => void
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
        isDragging,
        isSorting,
    } = useSortable({ id: props.item.id })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? Z.MODAL : 'auto',
        position: 'relative' as const,
    }

    return (
        // `layout` anima a troca de posição (FLIP) quando a ordem muda via setas,
        // dando a percepção de que o card se moveu. Desligado durante o
        // drag-and-drop (`isSorting`) para não brigar com o transform do dnd-kit.
        <motion.div
            ref={setNodeRef}
            layout={!isSorting}
            transition={{ type: 'spring', stiffness: 700, damping: 42, mass: 0.5 }}
            style={style}
            className="touch-none"
        >
            <WorkoutItemCard
                {...props}
                dragHandleProps={{ ...attributes, ...listeners }}
            />
        </motion.div>
    )
}
