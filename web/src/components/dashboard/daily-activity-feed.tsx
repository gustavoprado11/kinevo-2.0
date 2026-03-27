'use client'

import { useState } from 'react'
import { SessionDetailSheet } from '@/components/students/session-detail-sheet'
import { Clock } from 'lucide-react'


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

interface DailyActivityFeedProps {
    activities: DailyActivityItem[]
    scheduledToday?: ScheduledTodayItem[]
}

export function DailyActivityFeed({ activities, scheduledToday }: DailyActivityFeedProps) {
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
    const [isSheetOpen, setIsSheetOpen] = useState(false)

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
                            {activities.length}
                        </span>
                    )}
                </div>
            </div>

            {activities.length === 0 ? (
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
                    {activities.map((activity) => (
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
