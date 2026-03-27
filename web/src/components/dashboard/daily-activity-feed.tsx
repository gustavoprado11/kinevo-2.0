'use client'

import { useState, useMemo } from 'react'
import { SessionDetailSheet } from '@/components/students/session-detail-sheet'
import { Clock, Filter, MessageCircle, X } from 'lucide-react'


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

    const getRpeColor = (rpe: number | null) => {
        if (!rpe) return 'border-[#E8E8ED] dark:border-border bg-[#F5F5F7] dark:bg-muted text-[#6E6E73] dark:text-muted-foreground'
        if (rpe <= 4) return 'bg-emerald-500/10 text-[#34C759] dark:text-emerald-400 border-emerald-500/20'
        if (rpe <= 7) return 'bg-yellow-500/10 text-[#FF9500] dark:text-yellow-400 border-yellow-500/20'
        return 'bg-red-500/10 text-[#FF3B30] dark:text-red-400 border-red-500/20'
    }

    return (
        <div className="flex h-full flex-col rounded-xl border border-[#D2D2D7] dark:border-k-border-primary bg-white dark:bg-surface-card shadow-apple-card dark:shadow-xl">
            <div className="flex items-center justify-between border-b border-[#E8E8ED] dark:border-k-border-subtle px-6 py-4">
                <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-[#1D1D1F] dark:text-k-text-primary">Treinos de hoje</h2>
                    {activities.length > 0 && (
                        <span className="text-[10px] text-[#86868B] dark:text-k-text-quaternary bg-[#F5F5F7] dark:bg-glass-bg px-1.5 py-0.5 rounded">
                            {hasActiveFilters ? `${filteredActivities.length}/${activities.length}` : activities.length}
                        </span>
                    )}
                </div>
                {activities.length > 0 && (
                    <div className="flex items-center gap-2">
                        {hasActiveFilters && (
                            <button
                                onClick={clearFilters}
                                className="text-[10px] text-[#AEAEB2] dark:text-k-text-quaternary hover:text-[#1D1D1F] dark:hover:text-foreground transition-colors"
                            >
                                Limpar filtros
                            </button>
                        )}
                        <button
                            onClick={() => setShowFilters(v => !v)}
                            className={`p-1.5 rounded-lg transition-colors ${
                                showFilters || hasActiveFilters
                                    ? 'bg-[#007AFF]/10 text-[#007AFF] dark:bg-primary/10 dark:text-primary'
                                    : 'text-[#AEAEB2] dark:text-k-text-quaternary hover:text-[#6E6E73] dark:hover:text-k-text-secondary hover:bg-[#F5F5F7] dark:hover:bg-muted'
                            }`}
                            title="Filtrar treinos"
                        >
                            <Filter className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}
            </div>

            {/* Filter bar */}
            {showFilters && activities.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 px-6 py-3 border-b border-[#E8E8ED] dark:border-k-border-subtle bg-[#FAFAFA] dark:bg-muted/30">
                    {/* Student filter */}
                    <select
                        value={studentFilter || ''}
                        onChange={(e) => setStudentFilter(e.target.value || null)}
                        className="text-[11px] font-medium px-2.5 py-1.5 rounded-lg border border-[#E8E8ED] dark:border-k-border-subtle bg-white dark:bg-surface-card text-[#1D1D1F] dark:text-foreground appearance-none cursor-pointer pr-6 bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20fill%3D%22none%22%20stroke%3D%22%23AEAEB2%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m2%204%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:12px] bg-[right_6px_center] bg-no-repeat"
                    >
                        <option value="">Todos alunos</option>
                        {studentNames.map(name => (
                            <option key={name} value={name}>{name}</option>
                        ))}
                    </select>

                    {/* RPE filter chips */}
                    <div className="flex items-center gap-1">
                        {([
                            { value: 'all' as RpeFilter, label: 'Todas PSE' },
                            { value: 'low' as RpeFilter, label: 'PSE ≤4' },
                            { value: 'medium' as RpeFilter, label: 'PSE 5-7' },
                            { value: 'high' as RpeFilter, label: 'PSE ≥8' },
                        ]).map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => setRpeFilter(opt.value)}
                                className={`text-[10px] font-medium px-2 py-1 rounded-md transition-colors ${
                                    rpeFilter === opt.value
                                        ? 'bg-[#007AFF] text-white dark:bg-primary dark:text-primary-foreground'
                                        : 'bg-white dark:bg-surface-card border border-[#E8E8ED] dark:border-k-border-subtle text-[#6E6E73] dark:text-k-text-secondary hover:bg-[#F5F5F7] dark:hover:bg-muted'
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    {/* Feedback toggle */}
                    <button
                        onClick={() => setFeedbackOnly(v => !v)}
                        className={`flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md transition-colors ${
                            feedbackOnly
                                ? 'bg-[#007AFF] text-white dark:bg-primary dark:text-primary-foreground'
                                : 'bg-white dark:bg-surface-card border border-[#E8E8ED] dark:border-k-border-subtle text-[#6E6E73] dark:text-k-text-secondary hover:bg-[#F5F5F7] dark:hover:bg-muted'
                        }`}
                    >
                        <MessageCircle className="w-3 h-3" />
                        Com feedback
                    </button>
                </div>
            )}

            {filteredActivities.length === 0 && hasActiveFilters ? (
                <div className="py-6 text-center">
                    <p className="text-sm text-[#6E6E73] dark:text-k-text-secondary">Nenhum treino encontrado com esses filtros</p>
                    <button onClick={clearFilters} className="text-xs text-[#007AFF] dark:text-primary mt-1 hover:opacity-80 transition-colors">
                        Limpar filtros
                    </button>
                </div>
            ) : activities.length === 0 ? (
                <div className="py-6 text-center">
                    <div className="mb-3 flex h-10 w-10 mx-auto items-center justify-center rounded-full bg-[#F5F5F7] dark:bg-glass-bg">
                        <Clock className="h-4 w-4 text-[#AEAEB2] dark:text-k-text-quaternary" strokeWidth={1.5} />
                    </div>
                    <p className="text-sm text-[#6E6E73] dark:text-k-text-secondary">Nenhum treino registrado ainda hoje</p>
                    <p className="text-xs text-[#86868B] dark:text-k-text-tertiary mt-1">Os treinos dos seus alunos aparecerão aqui</p>
                    {scheduledToday && scheduledToday.length > 0 && (
                        <div className="mt-3 space-y-1">
                            <span className="text-xs text-[#86868B] dark:text-k-text-quaternary block">Agendados para hoje:</span>
                            {scheduledToday.map((s, i) => (
                                <div key={i} className="flex items-center justify-center gap-2 text-xs text-[#6E6E73] dark:text-k-text-secondary">
                                    <span>{s.studentName}</span>
                                    <span className="text-[#AEAEB2] dark:text-k-text-quaternary">·</span>
                                    <span>{s.workoutName}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <div className="divide-y divide-[#E8E8ED] dark:divide-border">
                    {filteredActivities.map((activity) => (
                        <button
                            key={activity.id}
                            onClick={() => handleSessionClick(activity.sessionId)}
                            className="group flex w-full items-center justify-between px-6 py-4 text-left transition-all hover:bg-[#F5F5F7] dark:hover:bg-muted/50"
                        >
                            <div className="flex items-center gap-4">
                                {/* Avatar */}
                                <div className="h-9 w-9 shrink-0 rounded-full border border-[#E8E8ED] dark:border-border bg-[#F5F5F7] dark:bg-muted flex items-center justify-center">
                                    <span className="text-xs font-bold text-[#007AFF] dark:text-primary">
                                        {activity.studentName.charAt(0).toUpperCase()}
                                    </span>
                                </div>

                                <div>
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className="text-sm font-semibold text-[#1D1D1F] dark:text-foreground">
                                            {activity.studentName}
                                        </span>
                                        <span className="text-xs text-[#AEAEB2] dark:text-muted-foreground">•</span>
                                        <span className="text-sm text-[#6E6E73] dark:text-muted-foreground font-medium">
                                            Concluiu <span className="font-semibold text-[#1D1D1F] dark:text-foreground">{activity.workoutName}</span>
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {activity.rpe && (
                                            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${getRpeColor(activity.rpe)}`}>
                                                PSE {activity.rpe}
                                            </span>
                                        )}
                                    </div>
                                    {activity.feedback && (
                                        <p className="text-xs text-[#86868B] dark:text-muted-foreground/70 italic mt-1 truncate flex items-center gap-1.5 max-w-md">
                                            <svg className="w-3 h-3 shrink-0 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                            </svg>
                                            <span className="truncate">&ldquo;{activity.feedback}&rdquo;</span>
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="text-right">
                                <p className="text-sm font-semibold text-[#1D1D1F] dark:text-foreground" suppressHydrationWarning>
                                    {new Date(activity.completedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                                <p className="mt-0.5 text-xs text-[#86868B] dark:text-muted-foreground font-medium">
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
