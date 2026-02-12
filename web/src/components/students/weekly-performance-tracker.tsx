'use client'

import { useMemo } from 'react'

interface AssignedWorkout {
    id: string
    name: string
    scheduled_days: number[]
}

interface WorkoutSession {
    id: string
    started_at: string
    assigned_workout_id?: string
}

interface WeeklyPerformanceTrackerProps {
    scheduledWorkouts: AssignedWorkout[]
    recentSessions: WorkoutSession[]
}

export function WeeklyPerformanceTracker({
    scheduledWorkouts,
    recentSessions
}: WeeklyPerformanceTrackerProps) {
    // Generate last 7 days (including today)
    const days = useMemo(() => {
        const result = []
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        for (let i = 6; i >= 0; i--) {
            const date = new Date(today)
            date.setDate(date.getDate() - i)

            const dayOfWeek = date.getDay() // 0 (Sun) to 6 (Sat)

            // Find if there's a workout scheduled for this day of week
            const workoutsScheduled = scheduledWorkouts.filter(w =>
                w.scheduled_days.includes(dayOfWeek)
            )

            // Find if a session was performed on this specific date
            const session = recentSessions.find(s => {
                const sessionDate = new Date(s.started_at)
                return sessionDate.getFullYear() === date.getFullYear() &&
                    sessionDate.getMonth() === date.getMonth() &&
                    sessionDate.getDate() === date.getDate()
            })

            const isFuture = date > today
            const isToday = date.getTime() === today.getTime()

            result.push({
                date,
                dayLabel: date.toLocaleDateString('pt-BR', { weekday: 'short' }).charAt(0).toUpperCase(),
                dayNumber: date.getDate(),
                isScheduled: workoutsScheduled.length > 0,
                workoutsScheduled,
                session,
                isToday,
                isFuture,
                isMissed: workoutsScheduled.length > 0 && !session && !isFuture && !isToday
            })
        }
        return result
    }, [scheduledWorkouts, recentSessions])

    // Calculate Adherence Rate (Last 7 days excluding future)
    const metrics = useMemo(() => {
        const pastOrToday = days.filter(d => !d.isFuture)
        const scheduledPast = pastOrToday.filter(d => d.isScheduled).length
        const completedPast = pastOrToday.filter(d => d.session).length

        const rate = scheduledPast > 0 ? Math.round((completedPast / scheduledPast) * 100) : 0

        // Simple Streak calculation (weeks with at least one workout)
        // For a true streak we would need more data, but let's approximate
        // In a real scenario, we'd fetch this from a calculated column or more history
        const streak = 2 // Placeholder for mock/streak logic

        return { rate, streak }
    }, [days])

    return (
        <div className="bg-glass-bg backdrop-blur-md rounded-2xl border border-k-border-primary p-6 mb-8 group">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">

                {/* 7-Day Calendar View */}
                <div className="flex items-center justify-between flex-1 max-w-md">
                    {days.map((day, idx) => (
                        <div key={idx} className="flex flex-col items-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-k-text-quaternary">
                                {day.dayLabel}
                            </span>

                            <div className="relative group/day">
                                {/* Indicator Circle */}
                                <div className={`
                                    w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300
                                    ${day.session
                                        ? 'bg-violet-600 shadow-lg shadow-violet-500/30 dark:shadow-violet-600/20'
                                        : day.isMissed
                                            ? 'bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20'
                                            : day.isScheduled
                                                ? 'border-2 border-dashed border-k-text-quaternary'
                                                : 'bg-slate-100 dark:bg-glass-bg'
                                    }
                                    ${day.isToday ? 'ring-2 ring-violet-300 dark:ring-white/20 ring-offset-2 ring-offset-surface-primary dark:ring-offset-surface-card' : ''}
                                `}>
                                    {day.session ? (
                                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                    ) : day.isMissed ? (
                                        <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                    ) : (
                                        <span className={`text-[10px] font-bold ${day.isFuture ? 'text-k-border-subtle' : 'text-k-text-quaternary'}`}>
                                            {day.dayNumber}
                                        </span>
                                    )}
                                </div>

                                {/* Tooltip */}
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-surface-card border border-k-border-primary rounded-lg text-xs font-medium text-k-text-primary opacity-0 group-hover/day:opacity-100 transition-opacity pointer-events-none z-20 whitespace-nowrap shadow-xl">
                                    {day.session ? (
                                        <span>Realizado: {day.session.assigned_workout_id ? 'Treino' : 'Sessão'}</span>
                                    ) : day.isMissed ? (
                                        <span className="text-red-400">Faltou: {day.workoutsScheduled[0]?.name || 'Treino'}</span>
                                    ) : day.isScheduled ? (
                                        <span>Agendado: {day.workoutsScheduled[0]?.name}</span>
                                    ) : (
                                        <span className="text-k-text-tertiary">Descanso</span>
                                    )}
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-[4px] border-transparent border-t-surface-card" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Divider (Mobile only) */}
                <div className="h-px w-full bg-k-border-subtle md:hidden" />

                {/* Metrics Panel */}
                <div className="flex items-center gap-10">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-k-text-quaternary mb-1">Taxa de Adesão</p>
                        <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-black text-k-text-primary dark:text-white">{metrics.rate}%</span>
                        </div>
                    </div>
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-k-text-quaternary mb-1">Streak</p>
                        <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-black text-violet-400">{metrics.streak}</span>
                            <span className="text-[10px] font-bold text-k-text-tertiary uppercase tracking-widest">semanas</span>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    )
}
