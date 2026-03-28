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
    /** When provided, fetches ALL student sessions (full history) instead of only program sessions */
    studentId?: string
}

// ---------------------------------------------------------------------------
// Status visual config
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<CalendarDay['status'], { bg: string; ring?: string; text: string; icon?: 'check' | 'x' }> = {
    done: {
        bg: 'bg-violet-600 shadow-lg shadow-violet-600/20',
        text: 'text-white',
    },
    done_historic: {
        bg: 'bg-violet-400/60 shadow-sm shadow-violet-400/10',
        text: 'text-white',
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
    compensated: {
        bg: 'bg-slate-500/15 border border-slate-500/30',
        text: 'text-slate-400',
        icon: 'check',
    },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function DayLabel({ text }: { text: string }) {
    return (
        <span className="text-[10px] font-bold text-k-text-quaternary">
            {text}
        </span>
    )
}

function CheckIcon({ className = 'w-4 h-4 text-white' }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                            {/* Historic session from another program */}
                            {day.status === 'done_historic' ? (
                                <button
                                    onClick={() => onDayClick?.(day)}
                                    className={`
                                        w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300
                                        bg-violet-100 dark:bg-violet-500/15 ring-1 ring-violet-200 dark:ring-violet-500/20
                                        ${day.isToday ? 'ring-2 ring-white/20 ring-offset-2 ring-offset-surface-card' : ''}
                                        cursor-pointer hover:opacity-80
                                    `}
                                >
                                    <CheckIcon className="w-3.5 h-3.5 text-violet-400" />
                                </button>
                            ) : day.status === 'done' && day.completedSessions[0]?.rpe != null ? (
                                <button
                                    onClick={() => isClickable && onDayClick?.(day)}
                                    className={`
                                        w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300
                                        ${day.completedSessions[0].rpe! >= 10
                                            ? 'bg-red-100 dark:bg-red-500/20 ring-1 ring-red-300 dark:ring-red-500/30 text-red-600 dark:text-red-400'
                                            : day.completedSessions[0].rpe! >= 8
                                                ? 'bg-violet-100 dark:bg-yellow-500/20 ring-1 ring-violet-300 dark:ring-yellow-500/30 text-violet-600 dark:text-yellow-400'
                                                : day.completedSessions[0].rpe! >= 6
                                                    ? 'bg-emerald-100 dark:bg-emerald-500/20 ring-1 ring-emerald-300 dark:ring-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                                                    : 'bg-zinc-100 dark:bg-white/5 ring-1 ring-zinc-300 dark:ring-white/10 text-zinc-500 dark:text-k-text-tertiary'
                                        }
                                        ${day.isToday ? 'ring-2 ring-white/20 ring-offset-2 ring-offset-surface-card' : ''}
                                        cursor-pointer hover:opacity-80
                                        text-sm font-bold
                                    `}
                                >
                                    {day.completedSessions[0].rpe}
                                </button>
                            ) : (
                                <button
                                    onClick={() => isClickable && onDayClick?.(day)}
                                    disabled={!isClickable}
                                    className={`
                                        w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300
                                        ${day.status === 'done' ? cfg.bg : cfg.bg}
                                        ${day.isToday ? 'ring-2 ring-white/20 ring-offset-2 ring-offset-surface-card' : ''}
                                        ${isClickable ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}
                                    `}
                                >
                                    {day.status === 'done' ? (
                                        <CheckIcon />
                                    ) : day.status === 'compensated' ? (
                                        <CheckIcon className="w-4 h-4 text-slate-400" />
                                    ) : cfg.icon === 'x' ? (
                                        <XIcon />
                                    ) : (
                                        <span className={`text-[10px] font-bold ${cfg.text}`}>
                                            {day.date.getDate()}
                                        </span>
                                    )}
                                </button>
                            )}

                            {/* Tooltip */}
                            {isClickable && (
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-surface-card border border-k-border-primary rounded-lg text-xs font-medium text-k-text-primary opacity-0 group-hover/day:opacity-100 transition-opacity pointer-events-none z-header whitespace-nowrap shadow-xl">
                                    {day.status === 'done_historic' ? (
                                        <span className="text-violet-400">Treino (programa anterior)</span>
                                    ) : day.status === 'done' ? (
                                        <span>Realizado{day.completedSessions[0]?.rpe != null ? ` · PSE ${day.completedSessions[0].rpe}` : ''}</span>
                                    ) : day.status === 'compensated' ? (
                                        <span className="text-slate-400">
                                            Compensado em outro dia
                                        </span>
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
            <div className="grid grid-cols-7 mb-1">
                {dayLabels.map((l, i) => (
                    <div key={i} className="text-center py-1">
                        <DayLabel text={l} />
                    </div>
                ))}
            </div>
            {/* Day grid — clean, no row wrappers */}
            <div className="grid grid-cols-7">
                {days.map((day) => {
                    const isCurrentMonth = day.date.getMonth() === anchorMonth
                    const isDone = day.status === 'done'
                    const isHistoric = day.status === 'done_historic'
                    const isMissed = day.status === 'missed'
                    const isScheduled = day.status === 'scheduled'
                    const isClickable = (isDone || isHistoric || isMissed || isScheduled || day.status === 'compensated') && isCurrentMonth

                    // RPE-based circle color
                    const rpe = day.completedSessions[0]?.rpe
                    let circleBg = 'bg-emerald-500'
                    if (isDone && rpe != null) {
                        if (rpe >= 10) circleBg = 'bg-red-500'
                        else if (rpe >= 8) circleBg = 'bg-amber-500'
                        else circleBg = 'bg-emerald-500'
                    }

                    return (
                        <button
                            key={day.dateKey}
                            onClick={() => isClickable && onDayClick?.(day)}
                            disabled={!isClickable}
                            className={`
                                relative flex flex-col items-center justify-center py-1.5 group/cell
                                ${!isCurrentMonth ? 'opacity-15' : ''}
                                ${isClickable ? 'cursor-pointer' : 'cursor-default'}
                            `}
                        >
                            {/* Circle + number container */}
                            <div className="relative flex items-center justify-center w-8 h-8">
                                {/* Completed: solid colored circle */}
                                {isCurrentMonth && isDone && (
                                    <div className={`absolute inset-0.5 rounded-full ${circleBg}`} />
                                )}
                                {/* Historic: soft violet circle */}
                                {isCurrentMonth && isHistoric && (
                                    <div className="absolute inset-0.5 rounded-full bg-violet-100 dark:bg-violet-500/20" />
                                )}
                                {/* Today: violet ring */}
                                {day.isToday && isCurrentMonth && (
                                    <div className="absolute inset-0 rounded-full ring-2 ring-violet-500 dark:ring-violet-400" />
                                )}
                                {/* The number */}
                                <span className={`relative text-xs font-semibold leading-none ${
                                    isDone && isCurrentMonth
                                        ? 'text-white font-bold'
                                        : isHistoric && isCurrentMonth
                                            ? 'text-violet-600 dark:text-violet-300 font-bold'
                                            : isMissed && isCurrentMonth
                                                ? 'text-red-400'
                                                : isCurrentMonth
                                                    ? 'text-[#3C3C43] dark:text-k-text-secondary'
                                                    : 'text-[#D2D2D7] dark:text-k-text-quaternary/30'
                                }`}>
                                    {day.date.getDate()}
                                </span>
                            </div>

                            {/* Tiny dot below for scheduled/missed (no circle) */}
                            <div className="h-1 flex items-center justify-center">
                                {isCurrentMonth && isScheduled && (
                                    <div className="w-1 h-1 rounded-full bg-violet-300 dark:bg-violet-500/40" />
                                )}
                                {isCurrentMonth && isMissed && (
                                    <div className="w-1 h-1 rounded-full bg-red-300 dark:bg-red-500/40" />
                                )}
                            </div>

                            {/* Tooltip */}
                            {isCurrentMonth && (isDone || isHistoric || isMissed) && (
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-[#1C1C1E] dark:bg-surface-card border border-transparent dark:border-k-border-primary rounded-md text-[9px] font-bold text-white opacity-0 group-hover/cell:opacity-100 transition-opacity pointer-events-none z-50 whitespace-nowrap shadow-lg">
                                    {isDone ? (rpe != null ? `PSE ${rpe}` : 'Concluído') : isHistoric ? 'Programa anterior' : 'Faltou'}
                                </div>
                            )}
                        </button>
                    )
                })}
            </div>

            {/* Program period bar — thin and subtle */}
            {days.some(d => d.isInProgram && d.date.getMonth() === anchorMonth) && (() => {
                const firstIdx = days.findIndex(d => d.isInProgram && d.date.getMonth() === anchorMonth)
                const lastIdx = days.reduce((acc, d, i) => (d.isInProgram && d.date.getMonth() === anchorMonth) ? i : acc, 0)
                const leftPct = (firstIdx / days.length) * 100
                const rightPct = 100 - ((lastIdx + 1) / days.length) * 100
                return (
                    <div className="mt-1.5 relative h-1 rounded-full bg-[#F0F0F0] dark:bg-white/5 overflow-hidden">
                        <div
                            className="absolute inset-y-0 rounded-full bg-violet-400/50 dark:bg-violet-500/30"
                            style={{ left: `${leftPct}%`, right: `${rightPct}%` }}
                        />
                    </div>
                )
            })()}
        </div>
    )
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

function MetricsBar({ days }: { days: CalendarDay[] }) {
    const metrics = useMemo(() => {
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        // Count sessions from current program (in-program days)
        const relevant = days.filter(d => d.isInProgram && d.date <= today)
        const scheduledPast = relevant.filter(d => d.scheduledWorkouts.length > 0).length
        const fulfilledPast = relevant.filter(d => d.status === 'done' || d.status === 'compensated').length
        const rate = scheduledPast > 0 ? Math.round((fulfilledPast / scheduledPast) * 100) : 0

        // Count ALL completed sessions (including historic from other programs)
        const allCompleted = days.filter(d => d.date <= today && (d.status === 'done' || d.status === 'done_historic' || d.status === 'compensated')).length

        // Historic-only sessions
        const historicCount = days.filter(d => d.date <= today && d.status === 'done_historic').length
        const currentCount = days.filter(d => d.date <= today && d.status === 'done').length

        // Are we viewing a period that has program data?
        const hasProgramDays = relevant.length > 0

        // Streak: consecutive completed/compensated days going backwards
        let streak = 0
        const sorted = [...relevant].filter(d => d.scheduledWorkouts.length > 0).sort(
            (a, b) => b.date.getTime() - a.date.getTime()
        )
        for (const d of sorted) {
            if (d.status === 'done' || d.status === 'compensated') streak++
            else break
        }

        return { rate, streak, allCompleted, hasProgramDays, historicCount, currentCount }
    }, [days])

    if (metrics.allCompleted === 0 && !metrics.hasProgramDays) return null

    return (
        <div className="mt-4 pt-3 border-t border-[#F0F0F0] dark:border-k-border-subtle">
            <div className="flex items-center gap-4 flex-wrap">
                {/* Total sessions this period */}
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-[10px] font-bold text-[#6E6E73] dark:text-k-text-tertiary">
                        {metrics.currentCount} {metrics.currentCount === 1 ? 'treino' : 'treinos'}
                    </span>
                </div>

                {/* Historic sessions */}
                {metrics.historicCount > 0 && (
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-violet-300 dark:bg-violet-500/40" />
                        <span className="text-[10px] font-bold text-[#6E6E73] dark:text-k-text-tertiary">
                            {metrics.historicCount} de outro programa
                        </span>
                    </div>
                )}

                {/* Adherence rate (only when in-program) */}
                {metrics.hasProgramDays && (
                    <div className="flex items-center gap-1.5 ml-auto">
                        <span className="text-[10px] font-bold text-[#AEAEB2] dark:text-k-text-quaternary">Adesão</span>
                        <span className={`text-[11px] font-black ${
                            metrics.rate >= 80 ? 'text-emerald-500' : metrics.rate >= 50 ? 'text-amber-500' : 'text-red-500'
                        }`}>
                            {metrics.rate}%
                        </span>
                    </div>
                )}

                {/* Streak (only when in-program and > 0) */}
                {metrics.hasProgramDays && metrics.streak > 0 && (
                    <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-[#AEAEB2] dark:text-k-text-quaternary">Sequência</span>
                        <span className="text-[11px] font-black text-violet-500">{metrics.streak}</span>
                    </div>
                )}
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
            <span className="text-xs font-bold text-k-text-secondary min-w-[120px] text-center">
                {anchorDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' })}
            </span>
        )
    }

    // Week view — show range
    const { start, end } = getWeekRange(anchorDate)
    const fmt = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: 'America/Sao_Paulo' }).replace('.', '')
    return (
        <span className="text-xs font-bold text-k-text-secondary min-w-[160px] text-center">
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
    studentId,
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

    // Generate calendar days — pass allSessions as both program sessions and historic sessions
    // so that days outside the current program also show completed workouts
    const calendarDays = useMemo(
        () =>
            generateCalendarDays(
                range.start,
                range.end,
                scheduledWorkouts,
                allSessions,
                programStartedAt,
                programDurationWeeks,
                studentId ? allSessions : undefined,
            ),
        [range, scheduledWorkouts, allSessions, programStartedAt, programDurationWeeks, studentId],
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
                    studentId,
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
        [programId, studentId],
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
                            className="ml-2 px-2 py-0.5 text-[9px] font-bold text-violet-600 dark:text-violet-400 border border-violet-500/30 rounded-md hover:bg-violet-500/10 transition-colors"
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
            <div>
                {viewMode === 'week' ? (
                    <WeekView days={calendarDays} onDayClick={onDayClick} />
                ) : (
                    <MonthView days={calendarDays} anchorDate={anchorDate} onDayClick={onDayClick} />
                )}

                {/* Inline metrics bar */}
                <MetricsBar days={calendarDays} />
            </div>
        </div>
    )
}
