'use client'

import { useState, useMemo, useCallback, useTransition, useEffect } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays, LayoutGrid, Check, X } from 'lucide-react'
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
    /**
     * Quando fornecido, posiciona o calendário nessa data ao montar e a cada
     * mudança de identidade do prop. Usado pelo `AdherenceTrendStrip` para
     * navegar até a semana clicada no sparkline. Não muda o `viewMode`.
     */
    initialWeekStart?: Date
}

// ---------------------------------------------------------------------------
// Status visual config
// ---------------------------------------------------------------------------

// Redesign "ferramenta profissional": dias concluídos preenchidos em TINTA
// (foreground) — o violeta saiu das células, onde em massa virava decoração.
// Perdido = contorno vermelho quieto; agendado = tracejado; descanso = inset.
const STATUS_CONFIG: Record<CalendarDay['status'], { bg: string; ring?: string; text: string; icon?: 'check' | 'x' }> = {
    done: {
        bg: 'bg-foreground',
        text: 'text-background',
    },
    done_historic: {
        bg: 'bg-foreground/50',
        text: 'text-background',
    },
    missed: {
        bg: 'border border-red-500/40',
        text: 'text-red-500 dark:text-red-400',
        icon: 'x',
    },
    scheduled: {
        bg: 'border border-dashed border-k-text-quaternary/60',
        text: 'text-k-text-tertiary',
    },
    rest: {
        bg: 'bg-surface-inset',
        text: 'text-k-text-quaternary',
    },
    out_of_program: {
        bg: 'bg-transparent',
        text: 'text-k-text-quaternary/30',
    },
    compensated: {
        bg: 'bg-surface-inset border border-k-border-primary',
        text: 'text-k-text-secondary',
        icon: 'check',
    },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function DayLabel({ text }: { text: string }) {
    return (
        <span className="font-mono text-[9px] font-medium uppercase tracking-[0.08em] text-k-text-quaternary">
            {text}
        </span>
    )
}

function CheckIcon({ className = 'w-4 h-4 text-background' }: { className?: string }) {
    return <Check className={className} strokeWidth={3} />
}

function XIcon() {
    return <X className="w-3.5 h-3.5 text-red-500 dark:text-red-400" strokeWidth={3} />
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
    const dayLabels = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'] // segunda → domingo

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
                                        w-9 h-9 rounded-lg flex items-center justify-center transition-colors
                                        bg-foreground/50
                                        ${day.isToday ? 'ring-2 ring-foreground/30 ring-offset-2 ring-offset-surface-card' : ''}
                                        cursor-pointer hover:opacity-80
                                    `}
                                >
                                    <CheckIcon className="w-3.5 h-3.5 text-background" />
                                </button>
                            ) : day.status === 'done' && day.completedSessions[0]?.rpe != null ? (
                                // PSE dentro da célula em tinta; sinal de alerta só quando
                                // a PSE é realmente alta (anel âmbar ≥8, vermelho ≥9).
                                <button
                                    onClick={() => isClickable && onDayClick?.(day)}
                                    className={`
                                        w-9 h-9 rounded-lg flex items-center justify-center transition-colors
                                        bg-foreground text-background
                                        ${day.completedSessions[0].rpe! >= 9
                                            ? 'ring-2 ring-red-500/60'
                                            : day.completedSessions[0].rpe! >= 8
                                                ? 'ring-2 ring-amber-500/60'
                                                : ''
                                        }
                                        ${day.isToday ? 'ring-offset-2 ring-offset-surface-card' : ''}
                                        cursor-pointer hover:opacity-80
                                        font-mono text-sm font-semibold tabular-nums
                                    `}
                                >
                                    {day.completedSessions[0].rpe}
                                </button>
                            ) : (
                                <button
                                    onClick={() => isClickable && onDayClick?.(day)}
                                    disabled={!isClickable}
                                    className={`
                                        w-9 h-9 rounded-lg flex items-center justify-center transition-colors
                                        ${cfg.bg}
                                        ${day.isToday ? 'ring-2 ring-foreground/30 ring-offset-2 ring-offset-surface-card' : ''}
                                        ${isClickable ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}
                                    `}
                                >
                                    {day.status === 'done' ? (
                                        <CheckIcon />
                                    ) : day.status === 'compensated' ? (
                                        <CheckIcon className="w-4 h-4 text-k-text-secondary" />
                                    ) : cfg.icon === 'x' ? (
                                        <XIcon />
                                    ) : (
                                        <span className={`font-mono text-[10px] font-medium tabular-nums ${cfg.text}`}>
                                            {day.date.getDate()}
                                        </span>
                                    )}
                                </button>
                            )}

                            {/* Tooltip */}
                            {isClickable && (
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-surface-card border border-k-border-primary rounded-lg text-xs font-medium text-k-text-primary opacity-0 group-hover/day:opacity-100 transition-opacity pointer-events-none z-header whitespace-nowrap shadow-xl">
                                    {day.status === 'done_historic' ? (
                                        <span className="text-k-text-secondary">Treino (programa anterior)</span>
                                    ) : day.status === 'done' ? (
                                        <span>Realizado{day.completedSessions[0]?.rpe != null ? ` · PSE ${day.completedSessions[0].rpe}` : ''}</span>
                                    ) : day.status === 'compensated' ? (
                                        <span className="text-k-text-secondary">
                                            Compensado em outro dia
                                        </span>
                                    ) : day.status === 'missed' ? (
                                        <span className="text-red-500 dark:text-red-400">
                                            Faltou: {day.scheduledWorkouts.map(w => w.name).join(' · ') || 'Treino'}
                                        </span>
                                    ) : day.status === 'scheduled' ? (
                                        <span>Agendado: {day.scheduledWorkouts.map(w => w.name).join(' · ')}</span>
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
    const dayLabels = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'] // segunda → domingo
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

                    const rpe = day.completedSessions[0]?.rpe

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
                            {/* Circle + number container — concluído preenche em tinta */}
                            <div className="relative flex items-center justify-center w-8 h-8">
                                {isCurrentMonth && isDone && (
                                    <div className="absolute inset-0.5 rounded-lg bg-foreground" />
                                )}
                                {/* Historic: tinta suavizada */}
                                {isCurrentMonth && isHistoric && (
                                    <div className="absolute inset-0.5 rounded-lg bg-foreground/15" />
                                )}
                                {/* Today: anel em tinta */}
                                {day.isToday && isCurrentMonth && (
                                    <div className="absolute inset-0 rounded-lg ring-2 ring-foreground/40" />
                                )}
                                {/* The number */}
                                <span className={`relative font-mono text-xs leading-none tabular-nums ${
                                    isDone && isCurrentMonth
                                        ? 'text-background font-semibold'
                                        : isHistoric && isCurrentMonth
                                            ? 'text-k-text-primary font-semibold'
                                            : isMissed && isCurrentMonth
                                                ? 'text-red-500 dark:text-red-400'
                                                : isCurrentMonth
                                                    ? 'text-k-text-secondary'
                                                    : 'text-k-text-quaternary/30'
                                }`}>
                                    {day.date.getDate()}
                                </span>
                            </div>

                            {/* Tiny dot below for scheduled/missed (no circle) */}
                            <div className="h-1 flex items-center justify-center">
                                {isCurrentMonth && isScheduled && (
                                    <div className="w-1 h-1 rounded-full bg-k-text-quaternary" />
                                )}
                                {isCurrentMonth && isMissed && (
                                    <div className="w-1 h-1 rounded-full bg-red-400 dark:bg-red-500/60" />
                                )}
                            </div>

                            {/* Tooltip — tinta invertida (padrão F2) */}
                            {isCurrentMonth && (isDone || isHistoric || isMissed) && (
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-foreground rounded-md font-mono text-[9px] font-medium text-background opacity-0 group-hover/cell:opacity-100 transition-opacity pointer-events-none z-50 whitespace-nowrap">
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
                    <div className="mt-1.5 relative h-1 rounded-full bg-surface-inset overflow-hidden">
                        <div
                            className="absolute inset-y-0 rounded-full bg-foreground/20"
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

    // Onda 2: removidos "Adesão %" e "N treinos" inline — duplicavam o stats grid
    // imediatamente acima do calendário e a faixa AdherenceTrendStrip nova.
    // Mantemos só o ruído útil que ainda não aparece em nenhum outro lugar:
    // contagem de sessões herdadas de outros programas e sequência atual.
    const showHistoric = metrics.historicCount > 0
    const showStreak = metrics.hasProgramDays && metrics.streak > 0
    if (!showHistoric && !showStreak) return null

    return (
        <div className="mt-4 pt-3 border-t border-k-border-subtle">
            <div className="flex items-center gap-4 flex-wrap">
                {/* Historic sessions */}
                {showHistoric && (
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-foreground/30" />
                        <span className="text-[10px] font-medium text-k-text-tertiary">
                            {metrics.historicCount} de outro programa
                        </span>
                    </div>
                )}

                {/* Streak (only when in-program and > 0) */}
                {showStreak && (
                    <div className="flex items-center gap-1.5 ml-auto">
                        <span className="font-mono text-[9px] font-medium uppercase tracking-[0.08em] text-k-text-quaternary">Sequência</span>
                        <span className="font-mono text-[11px] font-semibold text-k-text-primary tabular-nums">{metrics.streak}</span>
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
            <span className="font-mono text-[11px] font-medium text-k-text-secondary min-w-[120px] text-center tabular-nums">
                {anchorDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' })}
            </span>
        )
    }

    // Week view — show range
    const { start, end } = getWeekRange(anchorDate)
    const fmt = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: 'America/Sao_Paulo' }).replace('.', '')
    return (
        <span className="font-mono text-[11px] font-medium text-k-text-secondary min-w-[160px] text-center tabular-nums">
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
    initialWeekStart,
}: ProgramCalendarProps) {
    const [viewMode, setViewMode] = useState<'week' | 'month'>('week')
    const [anchorDate, setAnchorDate] = useState(() => initialWeekStart ?? new Date())
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

    // Onda 2 — quando o parent muda `initialWeekStart` (ex.: clique no
    // sparkline do AdherenceTrendStrip), reposicionamos o anchor e fetch
    // o range correspondente. Não muda viewMode propositalmente — o usuário
    // pode estar em mês e querer ver a semana específica em mês.
    useEffect(() => {
        if (!initialWeekStart) return
        setAnchorDate(initialWeekStart)
        fetchAndMerge(initialWeekStart, viewMode)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialWeekStart?.getTime()])

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
        <div className="rounded-panel border border-k-border-subtle p-5 mt-4">
            {/* Top bar: navigation + view toggle */}
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-1.5 rounded-control hover:bg-surface-inset text-k-text-quaternary hover:text-k-text-secondary transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <NavLabel anchorDate={anchorDate} viewMode={viewMode} />
                    <button
                        onClick={() => navigate(1)}
                        className="p-1.5 rounded-control hover:bg-surface-inset text-k-text-quaternary hover:text-k-text-secondary transition-colors"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>

                    {!viewIncludesToday && (
                        <button
                            onClick={goToToday}
                            className="ml-2 px-2 py-0.5 text-[10px] font-medium text-k-text-secondary border border-k-border-primary rounded-control hover:bg-surface-inset transition-colors"
                        >
                            Hoje
                        </button>
                    )}

                    {isPending && (
                        <div className="ml-2 w-3 h-3 rounded-full border-2 border-k-text-tertiary border-t-transparent animate-spin" />
                    )}
                </div>

                <button
                    onClick={toggleView}
                    className="p-1.5 rounded-control hover:bg-surface-inset text-k-text-quaternary hover:text-k-text-secondary transition-colors"
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
