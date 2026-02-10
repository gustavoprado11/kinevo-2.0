import { useState } from 'react'
import { SessionDetailSheet } from './session-detail-sheet'

interface HistorySummary {
    totalSessions: number
    lastSessionDate: string | null
    completedThisWeek: number
}

interface HistorySummaryCardProps {
    summary: HistorySummary
    recentSessions?: any[]
}

export function HistorySummaryCard({ summary, recentSessions = [] }: HistorySummaryCardProps) {
    const hasHistory = summary.totalSessions > 0 || recentSessions.length > 0

    // Sheet State
    const [isSheetOpen, setIsSheetOpen] = useState(false)
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)

    const handleSessionClick = (sessionId: string) => {
        setSelectedSessionId(sessionId)
        setIsSheetOpen(true)
    }

    const handleSheetClose = () => {
        setIsSheetOpen(false)
        setTimeout(() => setSelectedSessionId(null), 300)
    }

    return (
        <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-lg font-semibold text-foreground">Resumo de Treinos</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">Histórico de atividades</p>
                </div>
            </div>

            {!hasHistory ? (
                <div className="text-center py-6">
                    <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                        <svg className="w-7 h-7 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                    </div>
                    <p className="text-muted-foreground text-sm">Nenhum treino realizado ainda</p>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="grid grid-cols-3 gap-4">
                        {/* Total Sessions */}
                        <div className="bg-card rounded-xl border border-border/70 p-4 text-center">
                            <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center mx-auto mb-3">
                                <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                                </svg>
                            </div>
                            <p className="text-2xl font-bold text-foreground mb-1">{summary.totalSessions}</p>
                            <p className="text-xs text-muted-foreground">Treinos totais</p>
                        </div>

                        {/* This Week */}
                        <div className="bg-card rounded-xl border border-border/70 p-4 text-center">
                            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
                                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <p className="text-2xl font-bold text-foreground mb-1">{summary.completedThisWeek}</p>
                            <p className="text-xs text-muted-foreground">Esta semana</p>
                        </div>

                        {/* Last Session */}
                        <div className="bg-card rounded-xl border border-border/70 p-4 text-center">
                            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center mx-auto mb-3">
                                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <p className="text-sm font-semibold text-foreground mb-1">
                                {summary.lastSessionDate
                                    ? new Date(summary.lastSessionDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
                                    : '-'}
                            </p>
                            <p className="text-xs text-muted-foreground">Último treino</p>
                        </div>
                    </div>

                    {/* Recent Sessions List */}
                    {recentSessions.length > 0 && (
                        <div>
                            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Últimas Sessões</h3>
                            <div className="space-y-2">
                                {recentSessions.map((session) => (
                                    <button
                                        key={session.id}
                                        onClick={() => handleSessionClick(session.id)}
                                        className="w-full bg-background/30 hover:bg-card border border-border/70 hover:border-violet-500/30 rounded-lg p-3 flex items-center justify-between transition-all group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${session.rpe
                                                    ? (session.rpe <= 4 ? 'bg-emerald-500/10 text-emerald-400' : session.rpe <= 7 ? 'bg-yellow-500/10 text-yellow-500' : 'bg-red-500/10 text-red-400')
                                                    : 'bg-muted/40 text-muted-foreground'
                                                }`}>
                                                <span className="text-xs font-bold">{session.rpe || '-'}</span>
                                            </div>
                                            <div className="text-left">
                                                <p className="text-sm font-medium text-foreground group-hover:text-violet-300 transition-colors">
                                                    {session.assigned_workouts?.name}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {new Date(session.completed_at).toLocaleDateString('pt-BR', {
                                                        weekday: 'short',
                                                        day: 'numeric',
                                                        month: 'short',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </p>
                                            </div>
                                        </div>
                                        <svg className="w-4 h-4 text-muted-foreground/80 group-hover:text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
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
