'use client'

import { useState } from 'react'
import { SessionDetailSheet } from '@/components/students/session-detail-sheet'

interface DailyActivityItem {
    id: string
    sessionId: string
    studentName: string
    studentId: string
    workoutName: string
    completedAt: string
    duration: string
    rpe: number | null
}

interface DailyActivityFeedProps {
    activities: DailyActivityItem[]
}

export function DailyActivityFeed({ activities }: DailyActivityFeedProps) {
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
        if (!rpe) return 'border-border bg-muted text-muted-foreground'
        if (rpe <= 4) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
        if (rpe <= 7) return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
        return 'bg-red-500/10 text-red-400 border-red-500/20'
    }

    return (
        <div className="flex h-full flex-col rounded-xl border border-border bg-card shadow-soft">
            <div className="flex items-center justify-between border-b border-border p-5">
                <div>
                    <h2 className="flex items-center gap-2 text-lg font-semibold text-card-foreground">
                        Treinos de Hoje
                        <span className="px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 text-xs border border-violet-500/20 font-medium">
                            {new Date().toLocaleDateString('pt-BR')}
                        </span>
                    </h2>
                    <p className="mt-0.5 text-sm text-muted-foreground">Atividades recentes dos seus alunos</p>
                </div>
            </div>

            {activities.length === 0 ? (
                <div className="flex-1 p-12 text-center flex flex-col items-center justify-center">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                        <svg className="h-8 w-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <p className="mb-1 font-medium text-foreground">Nenhum treino concluído hoje</p>
                    <p className="text-sm text-muted-foreground">Incentive seus alunos a manterem a constância!</p>
                </div>
            ) : (
                <div className="divide-y divide-border">
                    {activities.map((activity) => (
                        <button
                            key={activity.id}
                            onClick={() => handleSessionClick(activity.sessionId)}
                            className="group flex w-full items-center justify-between px-5 py-4 text-left transition-all hover:bg-muted/60"
                        >
                            <div className="flex items-center gap-4">
                                {/* Avatar */}
                                <div className="h-10 w-10 shrink-0 rounded-full border border-border bg-gradient-to-br from-violet-500/20 to-blue-500/20 flex items-center justify-center">
                                    <span className="text-sm font-bold text-violet-300">
                                        {activity.studentName.charAt(0).toUpperCase()}
                                    </span>
                                </div>

                                <div>
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className="text-sm font-semibold text-card-foreground">
                                            {activity.studentName}
                                        </span>
                                        <span className="text-xs text-muted-foreground/70">•</span>
                                        <span className="text-sm text-muted-foreground">
                                            Concluiu <span className="font-medium text-foreground transition-colors group-hover:text-violet-500">{activity.workoutName}</span>
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {activity.rpe && (
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getRpeColor(activity.rpe)}`}>
                                                RPE {activity.rpe}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="text-right">
                                <p className="text-sm font-medium text-card-foreground">
                                    {new Date(activity.completedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                                <p className="mt-0.5 text-xs text-muted-foreground">
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
