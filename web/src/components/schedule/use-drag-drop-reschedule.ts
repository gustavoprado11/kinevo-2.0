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
 * Encapsula a lógica de drag-drop pro calendário.
 *
 * Fluxo optimistic:
 * 1. Ao soltar, `onOptimisticMove` é chamado imediatamente — o caller
 *    (schedule-client) atualiza o state local pra mover o card na UI sem
 *    esperar o server.
 * 2. Em paralelo, `rescheduleOccurrence` é disparado.
 * 3. Se falhar, `onRevert` é chamado e o caller reverte o state. O erro
 *    aparece em `result.error` (consumido pelo alerta do WeeklyCalendar).
 * 4. Se suceder, `onRescheduled` é chamado pra eventual refetch silencioso
 *    (reconciliar com banco — google_sync_status, etc).
 */
export function useDragDropReschedule(options: {
    onRescheduled?: () => void
    /**
     * Movida antes da chamada ao server. Deve atualizar o state local pra
     * que o card apareça na nova data/hora imediatamente.
     */
    onOptimisticMove?: (args: {
        recurringAppointmentId: string
        originalDate: string
        newDate: string
        newStartTime: string
    }) => void
    /**
     * Chamada quando o server falha — deve reverter a mudança feita em
     * `onOptimisticMove`.
     */
    onRevert?: (args: {
        recurringAppointmentId: string
        originalDate: string
    }) => void
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

            const { occurrence } = activeData
            const newDate = overData.date

            const deltaMinutes = Math.round(delta.y / (56 / 60)) // pixels → minutos
            const newTopMinutes = hhmmToMinutes(occurrence.startTime) + deltaMinutes
            const newTime = minutesToHHMM(Math.round(newTopMinutes / 30) * 30)

            // No-op se não mexeu.
            if (
                newDate === occurrence.date &&
                newTime === occurrence.startTime
            ) {
                return
            }

            // Optimistic: move na UI imediatamente.
            options.onOptimisticMove?.({
                recurringAppointmentId: activeData.recurringAppointmentId,
                originalDate: activeData.originalDate,
                newDate,
                newStartTime: newTime,
            })

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
                        // Reverte o move optimistic.
                        options.onRevert?.({
                            recurringAppointmentId:
                                activeData.recurringAppointmentId,
                            originalDate: activeData.originalDate,
                        })
                        setError(
                            result.error ?? 'Não foi possível remarcar este treino. Tente novamente.',
                        )
                        return
                    }
                    // Sucesso: refetch silencioso pra reconciliar com banco.
                    options.onRescheduled?.()
                } catch (err) {
                    options.onRevert?.({
                        recurringAppointmentId:
                            activeData.recurringAppointmentId,
                        originalDate: activeData.originalDate,
                    })
                    setError('Não foi possível remarcar este treino. Tente novamente.')
                    console.error('[useDragDropReschedule] error:', err)
                } finally {
                    setIsDropping(false)
                }
            })()
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
