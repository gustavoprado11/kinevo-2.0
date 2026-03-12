'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Z } from '@/lib/z-index'

interface SortableWorkoutTabProps {
    id: string
    children: React.ReactNode
}

export function SortableWorkoutTab({ id, children }: SortableWorkoutTabProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? Z.MODAL : 'auto',
        position: 'relative' as const,
        cursor: 'grab',
    }

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="touch-none">
            {children}
        </div>
    )
}
