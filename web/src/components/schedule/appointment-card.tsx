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
    /**
     * Largura do card em percentual da coluna do dia. Default 100 (card
     * ocupa coluna inteira). Quando há overlap com outros cards, cada um
     * recebe 100/N. Calculado em `weekly-calendar.computeOverlapLayout`.
     */
    widthPercent?: number
    /** Offset horizontal (left) em percentual da coluna. Default 0. */
    leftPercent?: number
}

/**
 * Cores da faixa esquerda do card — 1 de 6 por hash do studentId. Usamos as
 * cores Apple hardcoded do sistema pra manter consistência com o resto do
 * app (nenhuma cor "inventada").
 */
const STUDENT_STRIPE_COLORS = [
    '#3B82F6', // blue
    '#8B5CF6', // violet
    '#10B981', // emerald
    '#F59E0B', // amber
    '#EC4899', // pink
    '#06B6D4', // cyan
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
    widthPercent = 100,
    leftPercent = 0,
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
            className="absolute z-10 px-0.5"
            style={{
                top: `${top}px`,
                height: `${Math.max(heightPx, 22)}px`,
                left: `${leftPercent}%`,
                width: `${widthPercent}%`,
            }}
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
                    onStatusChanged={onChanged}
                >
                    <div
                        style={{
                            borderLeftColor: stripeColor,
                            borderLeftWidth: '3px',
                            borderLeftStyle: 'solid',
                        }}
                        className="h-full rounded-[6px] px-2 py-1.5 bg-surface-elevated border border-k-border-primary overflow-hidden"
                    >
                        <div className="flex items-start gap-1.5">
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1">
                                    <p className="text-xs font-semibold text-k-text-primary truncate">
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
                                <p className="font-mono text-[10px] text-k-text-tertiary tabular-nums">
                                    {occurrence.startTime} – {endTime}
                                </p>
                            </div>
                        </div>
                        {occurrence.status === 'rescheduled' && (
                            <p className="font-mono text-[9px] uppercase tracking-[0.1em] mt-0.5 text-amber-600 dark:text-amber-400">
                                Remarcado
                            </p>
                        )}
                        {occurrence.status === 'no_show' && (
                            <p className="font-mono text-[9px] uppercase tracking-[0.1em] mt-0.5 text-red-600 dark:text-red-400">
                                Faltou
                            </p>
                        )}
                        {occurrence.status === 'completed' && (
                            <p className="font-mono text-[9px] uppercase tracking-[0.1em] mt-0.5 text-emerald-600 dark:text-emerald-400">
                                Concluído
                            </p>
                        )}
                    </div>
                </OccurrencePopover>
            </div>
        </div>
    )
}
