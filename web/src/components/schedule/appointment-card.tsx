'use client'

import { useDraggable } from '@dnd-kit/core'
import { Package2 } from 'lucide-react'
import type { AppointmentOccurrence } from '@kinevo/shared/types/appointments'
import { OccurrencePopover } from '@/components/appointments/occurrence-popover'
import { HOUR_HEIGHT_PX, timeToPixels } from './time-grid'
import type { ScheduleStudent } from '@/app/schedule/schedule-client'

interface Props {
    occurrence: AppointmentOccurrence
    student: ScheduleStudent
    onChanged?: () => void
    /** Oferece destaque visual quando há conflito no mesmo slot (sobreposto). */
    isConflicting?: boolean
}

/**
 * Cores da faixa esquerda do card — 1 de 6 por hash do studentId. Usamos as
 * cores Apple hardcoded do sistema pra manter consistência com o resto do
 * app (nenhuma cor "inventada").
 */
const STUDENT_STRIPE_COLORS = [
    '#007AFF', // blue
    '#8b5cf6', // violet (principal do kinevo)
    '#34C759', // green
    '#FF9500', // orange
    '#FF2D92', // pink
    '#5AC8FA', // teal
]

function hashStudentId(id: string): number {
    let hash = 0
    for (let i = 0; i < id.length; i++) {
        hash = (hash * 31 + id.charCodeAt(i)) | 0
    }
    return Math.abs(hash) % STUDENT_STRIPE_COLORS.length
}

function addMinutesHHMM(hhmm: string, minutes: number): string {
    const [h, m] = hhmm.slice(0, 5).split(':').map(Number)
    const total = h * 60 + m + minutes
    const hh = Math.floor(total / 60) % 24
    const mm = total % 60
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

export function AppointmentCard({
    occurrence,
    student,
    onChanged,
    isConflicting,
}: Props) {
    const top = timeToPixels(occurrence.startTime)
    const heightPx = (occurrence.durationMinutes / 60) * HOUR_HEIGHT_PX
    const stripeColor =
        STUDENT_STRIPE_COLORS[hashStudentId(occurrence.studentId)]

    const endTime = addMinutesHHMM(occurrence.startTime, occurrence.durationMinutes)

    const dragId = `${occurrence.recurringAppointmentId}::${occurrence.originalDate}`
    const { attributes, listeners, setNodeRef, transform, isDragging } =
        useDraggable({
            id: dragId,
            data: {
                recurringAppointmentId: occurrence.recurringAppointmentId,
                originalDate: occurrence.originalDate,
                occurrence,
            },
        })

    const transformStyle = transform
        ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
        : undefined

    return (
        <div
            className="absolute inset-x-0.5 z-10"
            style={{ top: `${top}px`, height: `${Math.max(heightPx, 22)}px` }}
        >
            <div
                ref={setNodeRef}
                {...listeners}
                {...attributes}
                style={{
                    transform: transformStyle,
                    touchAction: 'none',
                    cursor: isDragging ? 'grabbing' : 'grab',
                }}
                className={`relative h-full ${isDragging ? 'opacity-70 z-40' : ''}`}
                data-testid={`card-${dragId}`}
            >
                <OccurrencePopover
                    occurrence={occurrence}
                    studentName={student.name}
                    studentAvatarUrl={student.avatarUrl}
                    onRescheduled={onChanged}
                    onCanceled={onChanged}
                >
                    <div
                        style={{
                            borderLeftColor: stripeColor,
                            borderLeftWidth: '3px',
                            borderLeftStyle: 'solid',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                        }}
                        className={`h-full rounded-lg px-2 py-1.5 bg-white dark:bg-surface-card border border-[#D2D2D7] dark:border-k-border-primary overflow-hidden ${
                            isConflicting
                                ? 'outline outline-2 outline-[#FF3B30]/60'
                                : ''
                        }`}
                    >
                        <div className="flex items-start gap-1.5">
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1">
                                    <p className="text-xs font-medium text-[#1D1D1F] dark:text-k-text-primary truncate">
                                        {student.name}
                                    </p>
                                    {occurrence.groupId && (
                                        <Package2
                                            className="w-3 h-3 flex-shrink-0"
                                            style={{ color: stripeColor }}
                                            strokeWidth={2}
                                            aria-label="Parte de um pacote multi-dia"
                                        />
                                    )}
                                </div>
                                <p className="text-[11px] text-[#86868B] dark:text-k-text-quaternary tabular-nums">
                                    {occurrence.startTime} – {endTime}
                                </p>
                            </div>
                        </div>
                        {occurrence.status === 'rescheduled' && (
                            <p className="text-[9px] font-semibold uppercase tracking-wider mt-0.5 text-[#FF9500] dark:text-amber-400">
                                Remarcado
                            </p>
                        )}
                        {occurrence.status === 'no_show' && (
                            <p className="text-[9px] font-semibold uppercase tracking-wider mt-0.5 text-[#FF3B30] dark:text-red-400">
                                Faltou
                            </p>
                        )}
                    </div>
                </OccurrencePopover>
            </div>
        </div>
    )
}
