'use client'

import { useState, useMemo } from 'react'
import { SessionDetailSheet } from '@/components/students/session-detail-sheet'
import { Clock, Filter, MessageCircle } from 'lucide-react'


interface DailyActivityItem {
    id: string
    sessionId: string
    studentName: string
    studentId: string
    workoutName: string
    completedAt: string
    duration: string
    rpe: number | null
    feedback: string | null
}

interface ScheduledTodayItem {
    studentName: string
    workoutName: string
}

type RpeFilter = 'all' | 'low' | 'medium' | 'high'

interface DailyActivityFeedProps {
    activities: DailyActivityItem[]
    scheduledToday?: ScheduledTodayItem[]
}

// Redesign "ferramenta profissional": painel hairline, header mono micro-caps,
// horários/duração/PSE em Geist Mono tabular (dados = assinatura tipográfica),
// filtros como controle segmentado neutro (tinta sobre inset, sem fill violeta)
// e cor apenas no estado que pede atenção (PSE ≥8).

export function DailyActivityFeed({ activities, scheduledToday }: DailyActivityFeedProps) {
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
    const [isSheetOpen, setIsSheetOpen] = useState(false)
    const [showFilters, setShowFilters] = useState(false)
    const [studentFilter, setStudentFilter] = useState<string | null>(null)
    const [rpeFilter, setRpeFilter] = useState<RpeFilter>('all')
    const [feedbackOnly, setFeedbackOnly] = useState(false)

    // Unique student names for filter dropdown
    const studentNames = useMemo(() =>
        [...new Set(activities.map(a => a.studentName))].sort(),
        [activities]
    )

    const hasActiveFilters = studentFilter !== null || rpeFilter !== 'all' || feedbackOnly

    // Filtered activities
    const filteredActivities = useMemo(() => {
        let result = activities
        if (studentFilter) {
            result = result.filter(a => a.studentName === studentFilter)
        }
        if (rpeFilter !== 'all') {
            result = result.filter(a => {
                if (!a.rpe) return false
                if (rpeFilter === 'low') return a.rpe <= 4
                if (rpeFilter === 'medium') return a.rpe >= 5 && a.rpe <= 7
                if (rpeFilter === 'high') return a.rpe >= 8
                return true
            })
        }
        if (feedbackOnly) {
            result = result.filter(a => a.feedback)
        }
        return result
    }, [activities, studentFilter, rpeFilter, feedbackOnly])

    const clearFilters = () => {
        setStudentFilter(null)
        setRpeFilter('all')
        setFeedbackOnly(false)
    }

    const handleSessionClick = (sessionId: string) => {
        setSelectedSessionId(sessionId)
        setIsSheetOpen(true)
    }

    const handleSheetClose = () => {
        setIsSheetOpen(false)
        setTimeout(() => setSelectedSessionId(null), 300)
    }

    const segChipClass = (active: boolean) =>
        `text-[11px] font-medium px-2 py-[3px] rounded-[6px] transition-colors ${
            active
                ? 'bg-surface-card text-k-text-primary border border-k-border-subtle'
                : 'text-k-text-tertiary hover:text-k-text-primary border border-transparent'
        }`

    return (
        <div className="flex h-full flex-col rounded-panel border border-k-border-subtle bg-surface-card">
            <div className="flex items-center justify-between border-b border-k-border-subtle px-5 py-3">
                <div className="flex items-baseline gap-2">
                    <h2 className="font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-k-text-tertiary">
                        Treinos de hoje
                    </h2>
                    {activities.length > 0 && (
                        <span className="font-mono text-[10.5px] tabular-nums text-k-text-quaternary">
                            {hasActiveFilters ? `${filteredActivities.length}/${activities.length}` : activities.length}
                        </span>
                    )}
                </div>
                {activities.length > 0 && (
                    <div className="flex items-center gap-2">
                        {hasActiveFilters && (
                            <button
                                onClick={clearFilters}
                                className="text-[11px] text-k-text-quaternary hover:text-k-text-primary transition-colors"
                            >
                                Limpar filtros
                            </button>
                        )}
                        <button
                            onClick={() => setShowFilters(v => !v)}
                            className={`p-1.5 rounded-control transition-colors ${
                                showFilters || hasActiveFilters
                                    ? 'bg-surface-inset text-k-text-primary'
                                    : 'text-k-text-quaternary hover:text-k-text-secondary hover:bg-surface-inset'
                            }`}
                            title="Filtrar treinos"
                        >
                            <Filter className="w-3.5 h-3.5" strokeWidth={1.7} />
                        </button>
                    </div>
                )}
            </div>

            {/* Filter bar */}
            {showFilters && activities.length > 0 && (
                <div className="flex flex-wrap items-center gap-2.5 px-5 py-2.5 border-b border-k-border-subtle bg-surface-inset/50">
                    {/* Student filter */}
                    <select
                        value={studentFilter || ''}
                        onChange={(e) => setStudentFilter(e.target.value || null)}
                        className="text-[11px] font-medium px-2.5 py-1.5 rounded-control border border-k-border-subtle bg-surface-card text-k-text-primary appearance-none cursor-pointer pr-6 bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20fill%3D%22none%22%20stroke%3D%22%238A8681%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m2%204%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:12px] bg-[right_6px_center] bg-no-repeat focus:outline-none"
                    >
                        <option value="">Todos alunos</option>
                        {studentNames.map(name => (
                            <option key={name} value={name}>{name}</option>
                        ))}
                    </select>

                    {/* RPE filter — controle segmentado neutro */}
                    <div className="inline-flex items-center gap-0.5 rounded-control bg-surface-inset p-0.5">
                        {([
                            { value: 'all' as RpeFilter, label: 'Todas PSE' },
                            { value: 'low' as RpeFilter, label: '≤4' },
                            { value: 'medium' as RpeFilter, label: '5–7' },
                            { value: 'high' as RpeFilter, label: '≥8' },
                        ]).map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => setRpeFilter(opt.value)}
                                className={segChipClass(rpeFilter === opt.value)}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    {/* Feedback toggle */}
                    <button
                        onClick={() => setFeedbackOnly(v => !v)}
                        className={`flex items-center gap-1 ${segChipClass(feedbackOnly)}`}
                    >
                        <MessageCircle className="w-3 h-3" strokeWidth={1.7} />
                        Com feedback
                    </button>
                </div>
            )}

            {filteredActivities.length === 0 && hasActiveFilters ? (
                <div className="py-6 text-center">
                    <p className="text-[13px] text-k-text-secondary">Nenhum treino encontrado com esses filtros</p>
                    <button onClick={clearFilters} className="text-xs text-primary mt-1 hover:opacity-80 transition-opacity">
                        Limpar filtros
                    </button>
                </div>
            ) : activities.length === 0 ? (
                <div className="py-8 text-center">
                    <div className="mb-3 flex h-9 w-9 mx-auto items-center justify-center rounded-full bg-surface-inset">
                        <Clock className="h-4 w-4 text-k-text-quaternary" strokeWidth={1.7} />
                    </div>
                    <p className="text-[13px] text-k-text-secondary">Nenhum treino registrado ainda hoje</p>
                    <p className="text-xs text-k-text-quaternary mt-1">Os treinos dos seus alunos aparecerão aqui</p>
                    {scheduledToday && scheduledToday.length > 0 && (
                        <div className="mt-3 space-y-1">
                            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-k-text-quaternary block">Agendados para hoje</span>
                            {scheduledToday.map((s, i) => (
                                <div key={i} className="flex items-center justify-center gap-2 text-xs text-k-text-secondary">
                                    <span>{s.studentName}</span>
                                    <span className="text-k-text-quaternary">·</span>
                                    <span>{s.workoutName}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <div className="divide-y divide-k-border-subtle">
                    {filteredActivities.map((activity) => (
                        <button
                            key={activity.id}
                            onClick={() => handleSessionClick(activity.sessionId)}
                            className="group flex w-full items-center justify-between gap-4 px-5 py-3.5 text-left transition-colors hover:bg-surface-inset/60"
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                {/* Avatar neutro */}
                                <div className="h-8 w-8 shrink-0 rounded-full border border-k-border-subtle bg-surface-inset flex items-center justify-center">
                                    <span className="text-[11px] font-semibold text-k-text-secondary">
                                        {activity.studentName.charAt(0).toUpperCase()}
                                    </span>
                                </div>

                                <div className="min-w-0">
                                    <div className="flex items-baseline gap-1.5 flex-wrap">
                                        <span className="text-sm font-semibold text-k-text-primary">
                                            {activity.studentName}
                                        </span>
                                        <span className="text-[13px] text-k-text-tertiary">
                                            concluiu <span className="font-medium text-k-text-secondary">{activity.workoutName}</span>
                                        </span>
                                        {activity.rpe && (
                                            <span className={`font-mono text-[11px] tabular-nums ${
                                                activity.rpe >= 8
                                                    ? 'text-red-600 dark:text-red-400 font-medium'
                                                    : 'text-k-text-quaternary'
                                            }`}>
                                                PSE {activity.rpe}
                                            </span>
                                        )}
                                    </div>
                                    {activity.feedback && (
                                        <p className="text-xs text-k-text-quaternary italic mt-0.5 truncate flex items-center gap-1.5 max-w-md">
                                            <MessageCircle className="w-3 h-3 shrink-0 opacity-60" strokeWidth={1.7} />
                                            <span className="truncate">&ldquo;{activity.feedback}&rdquo;</span>
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="text-right shrink-0">
                                <p className="font-mono text-[13px] font-medium tabular-nums text-k-text-primary" suppressHydrationWarning>
                                    {new Date(activity.completedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                                <p className="mt-0.5 font-mono text-[11px] tabular-nums text-k-text-quaternary">
                                    {activity.duration}
                                </p>
                            </div>
                        </button>
                    ))}
                </div>
            )}

            <SessionDetailSheet
                isOpen={isSheetOpen}
                onClose={handleSheetClose}
                sessionId={selectedSessionId}
            />
        </div>
    )
}
