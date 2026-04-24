'use client'

import { useCallback, useState } from 'react'
import type { DragEndEvent } from '@dnd-kit/core'
import { rescheduleOccurrence } from '@/actions/appointments/reschedule-occurrence'
import type { AppointmentOccurrence } from '@kinevo/shared/types/appointments'
import { pixelsToTime } from './time-grid'

interface DraggableData {
    recurringAppointmentId: string
    originalDate: string
    occurrence: AppointmentOccurrence
}

interface DroppableData {
    date: string // YYYY-MM-DD
}

export interface UseDragDropResult {
    isDropping: boolean
    error: string | null
    clearError: () => void
    handleDragEnd: (event: DragEndEvent) => void
}

/**
 * Encapsula a lógica de drag-drop pro calendário:
 *  - recebe o `onDragEnd` do dnd-kit
 *  - calcula nova data+hora a partir dos dados dos droppables e do delta Y
 *  - chama `rescheduleOccurrence` com `scope='only_this'`
 *  - expõe loading/error pra UI
 */
export function useDragDropReschedule(options: {
    onRescheduled?: () => void
}): UseDragDropResult {
    const [isDropping, setIsDropping] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const clearError = useCallback(() => setError(null), [])

    const handleDragEnd = useCallback(
        (event: DragEndEvent) => {
            const { active, over, delta } = event
            if (!over) return
            const activeData = active.data.current as DraggableData | undefined
            const overData = over.data.current as DroppableData | undefined
            if (!activeData || !overData) return

            // A nova hora é a hora original + delta.y convertido em minutos
            // (snap de 30 em 30). Data vem do droppable.
            const { occurrence } = activeData
            const newDate = overData.date

            // timeToPixels pra hora original + delta.y
            const originalTop = hhmmToMinutes(occurrence.startTime) * (1 / 60)
            const deltaMinutes = Math.round((delta.y / (56 / 60)) / 1) // pixels/(px per min)
            const newTopMinutes = hhmmToMinutes(occurrence.startTime) + deltaMinutes
            const newTime = minutesToHHMM(Math.round(newTopMinutes / 30) * 30)

            // No-op se não mexeu.
            if (
                newDate === occurrence.date &&
                newTime === occurrence.startTime
            ) {
                return
            }

            void (async () => {
                setIsDropping(true)
                setError(null)
                try {
                    const result = await rescheduleOccurrence({
                        recurringAppointmentId: activeData.recurringAppointmentId,
                        originalDate: activeData.originalDate,
                        newDate,
                        newStartTime: newTime,
                        scope: 'only_this',
                    })
                    if (!result.success) {
                        setError(result.error ?? 'Erro ao remarcar')
                        return
                    }
                    options.onRescheduled?.()
                } finally {
                    setIsDropping(false)
                }
            })()

            // Silence unused-var linter for `originalTop` which exists only
            // pra tornar a ideia do cálculo mais legível durante debug.
            void originalTop
        },
        [options],
    )

    return { isDropping, error, clearError, handleDragEnd }
}

function hhmmToMinutes(hhmm: string): number {
    const [h, m] = hhmm.slice(0, 5).split(':').map(Number)
    return h * 60 + m
}

function minutesToHHMM(totalMinutes: number): string {
    const clamped = Math.max(0, Math.min(totalMinutes, 23 * 60 + 59))
    const h = Math.floor(clamped / 60)
    const m = clamped % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// Re-export pixelsToTime pra testes (mantém o módulo de testes auto-contido).
export { pixelsToTime }
