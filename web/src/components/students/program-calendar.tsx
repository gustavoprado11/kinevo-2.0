'use client'

import { useState, useMemo, useCallback, useTransition } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays, LayoutGrid } from 'lucide-react'
import {
    generateCalendarDays,
    getWeekRange,
    getMonthGridRange,
    shiftWeek,
    shiftMonth,
    toDateKey,
    type CalendarDay,
    type ScheduledWorkoutRef,
    type SessionRef,
} from '@kinevo/shared/utils/schedule-projection'
import { getSessionsForRange, type RangeSession } from '@/app/students/[id]/actions/get-sessions-for-range'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProgramCalendarProps {
    programId: string
    programStartedAt: string
    programDurationWeeks: number | null
    scheduledWorkouts: ScheduledWorkoutRef[]
    initialSessions: RangeSession[]
    onDayClick?: (day: CalendarDay) => void
}

// ---------------------------------------------------------------------------
// Status visual config
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<CalendarDay['status'], { bg: string; ring?: string; text: string; icon?: 'check' | 'x' }> = {
    done: {
        bg: 'bg-violet-600 shadow-lg shadow-violet-600/20',
        text: 'text-white',
        icon: 'check',
    },
    missed: {
        bg: 'bg-red-500/15 border border-red-500/30',
        text: 'text-red-400',
        icon: 'x',
    },
    scheduled: {
        bg: 'border-2 border-dashed border-k-text-quaternary',
        text: 'text-k-text-quaternary',
    },
    rest: {
        bg: 'bg-glass-bg',
        text: 'text-k-text-quaternary',
    },
    out_of_program: {
        bg: 'bg-transparent',
        text: 'text-k-text-quaternary/30',
    },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function DayLabel({ text }: { text: string }) {
    return (
        <span className="text-[10px] font-bold uppercase tracking-widest text-k-text-quaternary">
            {text}
        </span>
    )
}

function CheckIcon() {
    return (
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
    )
}

function XIcon() {
    return (
        <svg className="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
        </svg>
    )
}

// ---------------------------------------------------------------------------
// Week View
// ---------------------------------------------------------------------------

function WeekView({
    days,
    onDayClick,
}: {
    days: CalendarDay[]
    onDayClick?: (day: CalendarDay) => void
}) {
    const dayLabels = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

    return (
        <div className="flex items-center justify-between flex-1 max-w-md">
            {days.map((day, idx) => {
                const cfg = STATUS_CONFIG[day.status]
                const isClickable = day.status !== 'out_of_program'

                return (
                    <div key={day.dateKey} className="flex flex-col items-center gap-2">
                        <DayLabel text={dayLabels[idx % 7]} />
                        <div className="relative group/day">
                            <button
                                onClick={() => isClickable && onDayClick?.(day)}
                                disabled={!isClickable}
                                className={`
                                    w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300
                                    ${cfg.bg}
                                    ${day.isToday ? 'ring-2 ring-white/20 ring-offset-2 ring-offset-surface-card' : ''}
                                    ${isClickable ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}
                                `}
                            >
                                {cfg.icon === 'check' ? (
                                    <CheckIcon />
                                ) : cfg.icon === 'x' ? (
                                    <XIcon />
                                ) : (
                                    <span className={`text-[10px] font-bold ${cfg.text}`}>
                                        {day.date.getDate()}
                                    </span>
                                )}
                            </button>

                            {/* Tooltip */}
                            {isClickable && (
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-surface-card border border-k-border-primary rounded-lg text-xs font-medium text-k-text-primary opacity-0 group-hover/day:opacity-100 transition-opacity pointer-events-none z-20 whitespace-nowrap shadow-xl">
                                    {day.status === 'done' ? (
                                        <span>Realizado</span>
                                    ) : day.status === 'missed' ? (
                                        <span className="text-red-400">
                                            Faltou: {day.scheduledWorkouts[0]?.name || 'Treino'}
                                        </span>
                                    ) : day.status === 'scheduled' ? (
                                        <span>Agendado: {day.scheduledWorkouts[0]?.name}</span>
                                    ) : (
                                        <span className="text-k-text-tertiary">Descanso</span>
                                    )}
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-[4px] border-transparent border-t-surface-card" />
                                </div>
                            )}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

// ---------------------------------------------------------------------------
// Month View
// ---------------------------------------------------------------------------

function MonthView({
    days,
    anchorDate,
    onDayClick,
}: {
    days: CalendarDay[]
    anchorDate: Date
    onDayClick?: (day: CalendarDay) => void
}) {
    const dayLabels = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
    const anchorMonth = anchorDate.getMonth()

    return (
        <div className="w-full">
            {/* Day-of-week header */}
            <div className="grid grid-cols-7 gap-1 mb-2">
                {dayLabels.map((l, i) => (
                    <div key={i} className="text-center">
                        <DayLabel text={l} />
                    </div>
                ))}
            </div>
            {/* Day grid */}
            <div className="grid grid-cols-7 gap-1">
                {days.map((day) => {
                    const cfg = STATUS_CONFIG[day.status]
                    const isCurrentMonth = day.date.getMonth() === anchorMonth
                    const isClickable = day.status !== 'out_of_program' && isCurrentMonth

                    return (
                        <button
                            key={day.dateKey}
                            onClick={() => isClickable && onDayClick?.(day)}
                            disabled={!isClickable}
                            className={`
                                relative w-full aspect-square rounded-lg flex flex-col items-center justify-center transition-all
                                ${!isCurrentMonth ? 'opacity-20' : ''}
                                ${isClickable ? 'cursor-pointer hover:bg-glass-bg' : 'cursor-default'}
                                ${day.isToday ? 'ring-1 ring-white/20' : ''}
                            `}
                        >
                            <span className={`text-xs font-semibold ${isCurrentMonth ? cfg.text : 'text-k-text-quaternary/30'}`}>
                                {day.date.getDate()}
                            </span>
                            {/* Status dot */}
                            {isCurrentMonth && day.status !== 'rest' && day.status !== 'out_of_program' && (
                                <div
                                    className={`mt-0.5 w-1.5 h-1.5 rounded-full ${
                                        day.status === 'done'
                                            ? 'bg-violet-500'
                                            : day.status === 'missed'
                                                ? 'bg-red-400'
                                                : 'bg-k-text-quaternary/50'
                                    }`}
                                />
                            )}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

function MetricsPanel({ days }: { days: CalendarDay[] }) {
    const metrics = useMemo(() => {
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const relevant = days.filter(d => d.isInProgram && d.date <= today)
        const scheduledPast = relevant.filter(d => d.scheduledWorkouts.length > 0).length
        const completedPast = relevant.filter(d => d.status === 'done').length
        const rate = scheduledPast > 0 ? Math.round((completedPast / scheduledPast) * 100) : 0

        // Simple streak: consecutive completed days going backwards from last completed
        let streak = 0
        const sorted = [...relevant].filter(d => d.scheduledWorkouts.length > 0).sort(
            (a, b) => b.date.getTime() - a.date.getTime()
        )
        for (const d of sorted) {
            if (d.status === 'done') streak++
            else break
        }

        return { rate, streak }
    }, [days])

    return (
        <div className="flex items-center gap-10">
            <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-k-text-quaternary mb-1">
                    Taxa de Adesão
                </p>
                <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-white">{metrics.rate}%</span>
                </div>
            </div>
            <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-k-text-quaternary mb-1">
                    Sequência
                </p>
                <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-violet-400">{metrics.streak}</span>
                    <span className="text-[10px] font-bold text-k-text-tertiary uppercase tracking-widest">treinos</span>
                </div>
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------------
// Navigation Label
// ---------------------------------------------------------------------------

function NavLabel({ anchorDate, viewMode }: { anchorDate: Date; viewMode: 'week' | 'month' }) {
    if (viewMode === 'month') {
        return (
            <span className="text-xs font-bold uppercase tracking-widest text-k-text-secondary min-w-[120px] text-center">
                {anchorDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </span>
        )
    }

    // Week view — show range
    const { start, end } = getWeekRange(anchorDate)
    const fmt = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')
    return (
        <span className="text-xs font-bold uppercase tracking-widest text-k-text-secondary min-w-[160px] text-center">
            {fmt(start)} — {fmt(end)}
        </span>
    )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function ProgramCalendar({
    programId,
    programStartedAt,
    programDurationWeeks,
    scheduledWorkouts,
    initialSessions,
    onDayClick,
}: ProgramCalendarProps) {
    const [viewMode, setViewMode] = useState<'week' | 'month'>('week')
    const [anchorDate, setAnchorDate] = useState(() => new Date())
    const [sessionsCache, setSessionsCache] = useState<Map<string, SessionRef>>(() => {
        const map = new Map<string, SessionRef>()
        for (const s of initialSessions) {
            map.set(s.id, s as SessionRef)
        }
        return map
    })
    const [isPending, startTransition] = useTransition()

    // Get the current date range
    const range = useMemo(() => {
        return viewMode === 'week'
            ? getWeekRange(anchorDate)
            : getMonthGridRange(anchorDate)
    }, [anchorDate, viewMode])

    // All cached sessions as array
    const allSessions = useMemo(() => Array.from(sessionsCache.values()), [sessionsCache])

    // Generate calendar days
    const calendarDays = useMemo(
        () =>
            generateCalendarDays(
                range.start,
                range.end,
                scheduledWorkouts,
                allSessions,
                programStartedAt,
                programDurationWeeks,
            ),
        [range, scheduledWorkouts, allSessions, programStartedAt, programDurationWeeks],
    )

    // Fetch sessions for a new range and merge into cache
    const fetchAndMerge = useCallback(
        (newAnchor: Date, mode: 'week' | 'month') => {
            const newRange = mode === 'week' ? getWeekRange(newAnchor) : getMonthGridRange(newAnchor)
            startTransition(async () => {
                const result = await getSessionsForRange(
                    programId,
                    newRange.start.toISOString(),
                    newRange.end.toISOString(),
                )
                if (result.success && result.data) {
                    setSessionsCache((prev) => {
                        const next = new Map(prev)
                        for (const s of result.data!) {
                            next.set(s.id, s as SessionRef)
                        }
                        return next
                    })
                }
            })
        },
        [programId],
    )

    // Navigation
    const navigate = useCallback(
        (direction: -1 | 1) => {
            const next = viewMode === 'week'
                ? shiftWeek(anchorDate, direction)
                : shiftMonth(anchorDate, direction)
            setAnchorDate(next)
            fetchAndMerge(next, viewMode)
        },
        [anchorDate, viewMode, fetchAndMerge],
    )

    // Toggle view mode
    const toggleView = useCallback(() => {
        const next = viewMode === 'week' ? 'month' : 'week'
        setViewMode(next)
        fetchAndMerge(anchorDate, next)
    }, [viewMode, anchorDate, fetchAndMerge])

    // Go to today
    const goToToday = useCallback(() => {
        const today = new Date()
        setAnchorDate(today)
        fetchAndMerge(today, viewMode)
    }, [viewMode, fetchAndMerge])

    // Check if current view includes today
    const todayKey = toDateKey(new Date())
    const viewIncludesToday = calendarDays.some((d) => d.dateKey === todayKey)

    return (
        <div className="bg-glass-bg backdrop-blur-md rounded-2xl border border-k-border-primary p-6 mb-8">
            {/* Top bar: navigation + view toggle */}
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-1.5 rounded-lg hover:bg-glass-bg text-k-text-quaternary hover:text-k-text-secondary transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <NavLabel anchorDate={anchorDate} viewMode={viewMode} />
                    <button
                        onClick={() => navigate(1)}
                        className="p-1.5 rounded-lg hover:bg-glass-bg text-k-text-quaternary hover:text-k-text-secondary transition-colors"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>

                    {!viewIncludesToday && (
                        <button
                            onClick={goToToday}
                            className="ml-2 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-violet-400 border border-violet-500/30 rounded-md hover:bg-violet-500/10 transition-colors"
                        >
                            Hoje
                        </button>
                    )}

                    {isPending && (
                        <div className="ml-2 w-3 h-3 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
                    )}
                </div>

                <button
                    onClick={toggleView}
                    className="p-1.5 rounded-lg hover:bg-glass-bg text-k-text-quaternary hover:text-k-text-secondary transition-colors"
                    title={viewMode === 'week' ? 'Visão mensal' : 'Visão semanal'}
                >
                    {viewMode === 'week' ? (
                        <LayoutGrid className="w-4 h-4" />
                    ) : (
                        <CalendarDays className="w-4 h-4" />
                    )}
                </button>
            </div>

            {/* Calendar body */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                {viewMode === 'week' ? (
                    <WeekView days={calendarDays} onDayClick={onDayClick} />
                ) : (
                    <MonthView days={calendarDays} anchorDate={anchorDate} onDayClick={onDayClick} />
                )}

                {/* Divider */}
                <div className="h-px w-full bg-k-border-subtle md:hidden" />
                <div className="hidden md:block w-px h-16 bg-k-border-subtle" />

                {/* Metrics */}
                <MetricsPanel days={calendarDays} />
            </div>
        </div>
    )
}
