'use client'

import { useEffect, useMemo, useRef } from 'react'
import {
    DndContext,
    PointerSensor,
    useDroppable,
    useSensor,
    useSensors,
} from '@dnd-kit/core'
import type { AppointmentOccurrence } from '@kinevo/shared/types/appointments'
import { AppointmentCard } from './appointment-card'
import { NowIndicator } from './now-indicator'
import {
    CALENDAR_HEIGHT_PX,
    CALENDAR_START_HOUR,
    DEFAULT_VISIBLE_START_HOUR,
    HOURS,
    HOUR_HEIGHT_PX,
    TimeGrid,
    pixelsToTime,
} from './time-grid'
import { useDragDropReschedule } from './use-drag-drop-reschedule'
import type { ScheduleStudent } from '@/app/schedule/schedule-client'

interface Props {
    weekStart: string // YYYY-MM-DD (domingo)
    weekEnd: string // YYYY-MM-DD (sábado)
    occurrences: AppointmentOccurrence[]
    studentsById: Record<string, ScheduleStudent>
    onSlotClick: (date: string, time: string) => void
    onOccurrenceChanged: () => void
}

const DAY_ABBR_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function parseKey(key: string): Date {
    const [y, m, d] = key.split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, d))
}

function addDays(key: string, days: number): string {
    const d = parseKey(key)
    d.setUTCDate(d.getUTCDate() + days)
    return d.toISOString().slice(0, 10)
}

function todayKeyBR(): string {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

/**
 * Detecta sobreposições de treinos no mesmo dia (intervalos colidem).
 * Retorna um Set de `occurrenceKey` (recurringId::originalDate) com conflitos.
 */
function findConflicts(
    occurrences: AppointmentOccurrence[],
): Set<string> {
    const conflicts = new Set<string>()
    const byDay = new Map<string, AppointmentOccurrence[]>()
    for (const o of occurrences) {
        const arr = byDay.get(o.date) ?? []
        arr.push(o)
        byDay.set(o.date, arr)
    }
    for (const list of byDay.values()) {
        for (let i = 0; i < list.length; i++) {
            for (let j = i + 1; j < list.length; j++) {
                if (overlaps(list[i], list[j])) {
                    conflicts.add(
                        `${list[i].recurringAppointmentId}::${list[i].originalDate}`,
                    )
                    conflicts.add(
                        `${list[j].recurringAppointmentId}::${list[j].originalDate}`,
                    )
                }
            }
        }
    }
    return conflicts
}

function overlaps(a: AppointmentOccurrence, b: AppointmentOccurrence): boolean {
    const aStart = hhmmToMinutes(a.startTime)
    const aEnd = aStart + a.durationMinutes
    const bStart = hhmmToMinutes(b.startTime)
    const bEnd = bStart + b.durationMinutes
    return aStart < bEnd && bStart < aEnd
}

function hhmmToMinutes(hhmm: string): number {
    const [h, m] = hhmm.slice(0, 5).split(':').map(Number)
    return h * 60 + m
}

// ────────── Droppable column ──────────

interface DayColumnProps {
    date: string
    isToday: boolean
    occurrences: AppointmentOccurrence[]
    studentsById: Record<string, ScheduleStudent>
    conflicts: Set<string>
    onSlotClick: (date: string, time: string) => void
    onChanged: () => void
}

function DayColumn({
    date,
    isToday,
    occurrences,
    studentsById,
    conflicts,
    onSlotClick,
    onChanged,
}: DayColumnProps) {
    const { setNodeRef, isOver } = useDroppable({
        id: `day::${date}`,
        data: { date },
    })

    const handleBackgroundClick = (e: React.MouseEvent<HTMLDivElement>) => {
        // Só abre create se o click foi no background puro (não em cards)
        if (e.target !== e.currentTarget) return
        const rect = e.currentTarget.getBoundingClientRect()
        const y = e.clientY - rect.top
        const time = pixelsToTime(y)
        onSlotClick(date, time)
    }

    return (
        <div className="flex-1 min-w-0 relative border-r border-[#E8E8ED] dark:border-k-border-subtle last:border-r-0">
            <div
                ref={setNodeRef}
                onClick={handleBackgroundClick}
                role="gridcell"
                aria-label={`Coluna ${date}`}
                className={`absolute inset-0 cursor-pointer transition-colors ${
                    isOver ? 'bg-[#007AFF]/5 dark:bg-violet-500/10' : ''
                } ${isToday ? 'bg-[#F5F5F7] dark:bg-glass-bg' : ''}`}
                style={{ height: `${CALENDAR_HEIGHT_PX}px` }}
            >
                {/* Hour grid lines */}
                {HOURS.slice(0, -1).map((hour, idx) => (
                    <div
                        key={hour}
                        className="absolute left-0 right-0 border-b border-[#E8E8ED] dark:border-k-border-subtle pointer-events-none"
                        style={{ top: `${(idx + 1) * HOUR_HEIGHT_PX}px` }}
                    />
                ))}

                {/* Cards */}
                {occurrences.map((occ) => {
                    const key = `${occ.recurringAppointmentId}::${occ.originalDate}`
                    return (
                        <AppointmentCard
                            key={key}
                            occurrence={occ}
                            student={
                                studentsById[occ.studentId] ?? {
                                    name: 'Aluno',
                                    avatarUrl: null,
                                }
                            }
                            isConflicting={conflicts.has(key)}
                            onChanged={onChanged}
                        />
                    )
                })}
            </div>
        </div>
    )
}

// ────────── Calendar root ──────────

export function WeeklyCalendar({
    weekStart,
    weekEnd,
    occurrences,
    studentsById,
    onSlotClick,
    onOccurrenceChanged,
}: Props) {
    const days = useMemo(() => {
        const result: string[] = []
        for (let i = 0; i < 7; i++) result.push(addDays(weekStart, i))
        return result
    }, [weekStart])

    const occurrencesByDay = useMemo(() => {
        const map = new Map<string, AppointmentOccurrence[]>()
        for (const day of days) map.set(day, [])
        for (const o of occurrences) {
            const arr = map.get(o.date)
            if (arr) arr.push(o)
        }
        return map
    }, [days, occurrences])

    const conflicts = useMemo(() => findConflicts(occurrences), [occurrences])

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    )
    const { handleDragEnd, error, clearError } = useDragDropReschedule({
        onRescheduled: onOccurrenceChanged,
    })

    const todayKey = todayKeyBR()

    // Scroll inicial pra posicionar DEFAULT_VISIBLE_START_HOUR (05h) no topo
    // da viewport. Mount-only (array de deps vazio) — navegar entre semanas
    // preserva o scroll vertical. "auto" (instant) em vez de "smooth" pra
    // evitar animação visível na primeira visita.
    const scrollRef = useRef<HTMLDivElement | null>(null)
    useEffect(() => {
        const el = scrollRef.current
        if (!el) return
        const offset = (DEFAULT_VISIBLE_START_HOUR - CALENDAR_START_HOUR) * HOUR_HEIGHT_PX
        el.scrollTop = offset
    }, [])

    return (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <div
                ref={scrollRef}
                className="flex-1 overflow-auto max-h-[calc(100vh-200px)] rounded-xl border border-[#D2D2D7] dark:border-k-border-primary bg-white dark:bg-surface-card shadow-apple-card dark:shadow-none"
            >
                {error && (
                    <div
                        role="alert"
                        className="px-6 py-2 bg-[#FF3B30]/5 dark:bg-red-500/10 border-b border-[#FF3B30]/20 dark:border-red-500/20 text-[#FF3B30] dark:text-red-400 text-xs flex items-center justify-between"
                    >
                        <span>{error}</span>
                        <button
                            type="button"
                            onClick={clearError}
                            className="ml-4 font-semibold hover:underline"
                        >
                            Fechar
                        </button>
                    </div>
                )}

                {/* Header row with day labels — sticky */}
                <div className="sticky top-0 z-30 flex border-b border-[#E8E8ED] dark:border-k-border-subtle bg-white dark:bg-surface-card">
                    <div className="w-14 flex-shrink-0 border-r border-[#E8E8ED] dark:border-k-border-subtle" />
                    {days.map((day) => {
                        const dateObj = parseKey(day)
                        const dayLabel = DAY_ABBR_PT[dateObj.getUTCDay()]
                        const dayNum = dateObj.getUTCDate()
                        const isToday = day === todayKey
                        return (
                            <div
                                key={day}
                                className={`flex-1 min-w-0 text-center py-2 border-r border-[#E8E8ED] dark:border-k-border-subtle last:border-r-0 ${
                                    isToday
                                        ? 'bg-[#F5F5F7] dark:bg-glass-bg'
                                        : ''
                                }`}
                            >
                                <div
                                    className={`text-[10px] font-medium uppercase tracking-wider ${
                                        isToday
                                            ? 'text-[#007AFF] dark:text-violet-400'
                                            : 'text-[#86868B] dark:text-k-text-quaternary'
                                    }`}
                                >
                                    {dayLabel}
                                </div>
                                <div
                                    className={`text-sm font-medium tabular-nums ${
                                        isToday
                                            ? 'text-[#007AFF] dark:text-violet-400'
                                            : 'text-[#1D1D1F] dark:text-k-text-primary'
                                    }`}
                                >
                                    {dayNum}
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Body: time column + 7 day columns */}
                <div className="flex relative">
                    <TimeGrid />
                    <div className="flex-1 relative flex">
                        {days.map((day) => (
                            <DayColumn
                                key={day}
                                date={day}
                                isToday={day === todayKey}
                                occurrences={occurrencesByDay.get(day) ?? []}
                                studentsById={studentsById}
                                conflicts={conflicts}
                                onSlotClick={onSlotClick}
                                onChanged={onOccurrenceChanged}
                            />
                        ))}
                        <NowIndicator daysOfWeek={days} />
                    </div>
                </div>

                {/* weekEnd kept in scope pra satisfazer o lint se usuários
                    consumirem a prop no futuro (debugability). */}
                <div className="hidden" aria-hidden="true" data-week-end={weekEnd} />
            </div>
        </DndContext>
    )
}
