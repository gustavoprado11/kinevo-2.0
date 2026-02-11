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
        if (rpe <= 4) return 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20'
        if (rpe <= 7) return 'bg-yellow-50 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-100 dark:border-yellow-500/20'
        return 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-100 dark:border-red-500/20'
    }




    return (
        <div className="flex h-full flex-col rounded-2xl border border-k-border-primary bg-surface-card shadow-xl">
            <div className="flex items-center justify-between border-b border-k-border-subtle p-6">
                <div>
                    <h2 className="flex items-center gap-3 text-lg font-bold text-foreground">
                        Treinos de Hoje
                        <span className="px-3 py-1 rounded-full bg-violet-500/10 text-violet-400 text-xs font-semibold tracking-wide">
                            {new Date().toLocaleDateString('pt-BR')}
                        </span>
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">Atividades recentes dos seus alunos</p>
                </div>
            </div>

            {activities.length === 0 ? (
                <div className="flex-1 p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
                    <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-glass-bg">
                        <Clock className="h-5 w-5 text-muted-foreground/40" strokeWidth={1.5} />
                    </div>
                    <p className="mb-2 text-lg font-medium text-foreground">Nenhum treino concluído hoje</p>
                    <p className="text-sm text-muted-foreground/50 max-w-[250px]">Incentive seus alunos a manterem a constância nos treinos!</p>
                </div>
            ) : (
                <div className="divide-y divide-border">
                    {activities.map((activity) => (
                        <button
                            key={activity.id}
                            onClick={() => handleSessionClick(activity.sessionId)}
                            className="group flex w-full items-center justify-between px-5 py-4 text-left transition-all hover:bg-muted/50"
                        >
                            <div className="flex items-center gap-4">
                                {/* Avatar */}
                                <div className="h-10 w-10 shrink-0 rounded-full border border-border bg-muted flex items-center justify-center">
                                    <span className="text-sm font-bold text-primary">
                                        {activity.studentName.charAt(0).toUpperCase()}
                                    </span>
                                </div>

                                <div>
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className="text-sm font-bold text-foreground">
                                            {activity.studentName}
                                        </span>
                                        <span className="text-xs text-muted-foreground">•</span>
                                        <span className="text-sm text-muted-foreground font-medium">
                                            Concluiu <span className="font-bold text-foreground transition-colors group-hover:text-primary">{activity.workoutName}</span>
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {activity.rpe && (
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${getRpeColor(activity.rpe)}`}>
                                                RPE {activity.rpe}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="text-right">
                                <p className="text-sm font-semibold text-foreground">
                                    {new Date(activity.completedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                                <p className="mt-0.5 text-xs text-muted-foreground font-medium">
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
