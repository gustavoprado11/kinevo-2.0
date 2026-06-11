'use client'

// Drag-and-drop da biblioteca de exercícios para o canvas do builder —
// idêntico nos dois builders, extraído pra cá.

import { useCallback, useState } from 'react'
import type { Exercise } from '@/types/exercise'

const MIME = 'application/kinevo-exercise-id'

export function useCanvasDnd({
    exercises,
    onDropExercise,
}: {
    exercises: Exercise[]
    onDropExercise: (exercise: Exercise) => void
}) {
    const [isDraggingOver, setIsDraggingOver] = useState(false)

    const handleCanvasDragOver = useCallback((e: React.DragEvent) => {
        if (e.dataTransfer.types.includes(MIME)) {
            e.preventDefault()
            e.dataTransfer.dropEffect = 'copy'
            setIsDraggingOver(true)
        }
    }, [])

    const handleCanvasDragLeave = useCallback((e: React.DragEvent) => {
        // Only trigger when leaving the container, not child elements
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setIsDraggingOver(false)
        }
    }, [])

    const handleCanvasDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDraggingOver(false)
        const exerciseId = e.dataTransfer.getData(MIME)
        if (!exerciseId) return
        const exercise = exercises.find(ex => ex.id === exerciseId)
        if (exercise) {
            onDropExercise(exercise)
        }
    }, [exercises, onDropExercise])

    return { isDraggingOver, handleCanvasDragOver, handleCanvasDragLeave, handleCanvasDrop }
}
