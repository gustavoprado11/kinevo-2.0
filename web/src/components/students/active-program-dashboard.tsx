'use client'

import { useState } from 'react'
import { SessionDetailSheet } from './session-detail-sheet'

interface AssignedProgram {
    id: string
    name: string
    description: string | null
    status: 'active' | 'completed' | 'paused' | 'scheduled'
    duration_weeks: number | null
    current_week: number | null
    started_at: string | null
    created_at: string
}

interface HistorySummary {
    totalSessions: number
    lastSessionDate: string | null
    completedThisWeek: number
}

interface ActiveProgramDashboardProps {
    program: AssignedProgram | null
    summary: HistorySummary
    recentSessions?: any[]
    onAssignProgram?: () => void
    onEditProgram?: () => void
    onCompleteProgram?: () => void
    onCreateProgram?: () => void
}

export function ActiveProgramDashboard({
    program,
    summary,
    recentSessions = [],
    onAssignProgram,
    onEditProgram,
    onCompleteProgram,
    onCreateProgram
}: ActiveProgramDashboardProps) {
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

    const getStatusConfig = (status: AssignedProgram['status']) => {
        const config = {
            active: {
                label: 'Em andamento',
                classes: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                icon: (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                ),
            },
            completed: {
                label: 'Concluído',
                classes: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
                icon: (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                ),
            },
            paused: {
                label: 'Pausado',
                classes: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                icon: (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                ),
            },
            // Fallback for unexpected 'scheduled' here, though typically not active
            scheduled: {
                label: 'Agendado',
                classes: 'bg-muted/60 text-muted-foreground border-border/70',
                icon: null
            }
        }
        return config[status] || config.active
    }

    if (!program) {
        return (
            <div className="bg-card rounded-xl border border-border p-6 h-full flex flex-col">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-lg font-semibold text-foreground">Programa Atual</h2>
                        <p className="text-sm text-muted-foreground mt-0.5">Nenhum programa ativo no momento</p>
                    </div>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
                    <div className="w-20 h-20 rounded-full bg-muted/40 flex items-center justify-center mb-6">
                        <svg className="w-10 h-10 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-medium text-foreground mb-2">Comece um novo ciclo</h3>
                    <p className="text-muted-foreground text-sm max-w-sm mb-8">
                        Crie um programa personalizado do zero ou atribua um template da biblioteca para este aluno.
                    </p>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onCreateProgram}
                            className="px-6 py-3 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white font-medium rounded-xl transition-all shadow-lg shadow-violet-500/20 flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Criar Novo
                        </button>
                        <button
                            onClick={onAssignProgram}
                            className="px-6 py-3 bg-secondary hover:bg-secondary/80 text-secondary-foreground font-medium rounded-xl transition-all flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                            </svg>
                            Biblioteca
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    const statusConfig = getStatusConfig(program.status)
    const progressPercent = program.duration_weeks && program.current_week
        ? Math.min((program.current_week / program.duration_weeks) * 100, 100)
        : 0

    return (
        <div className="bg-card rounded-xl border border-border p-6">
            {/* Header / Actions */}
            <div className="flex items-start justify-between mb-6">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <h2 className="text-xl font-bold text-foreground">{program.name}</h2>
                        <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full border flex items-center gap-1.5 ${statusConfig.classes}`}>
                            {statusConfig.icon}
                            {statusConfig.label}
                        </span>
                    </div>
                    {program.description && (
                        <p className="text-sm text-muted-foreground">{program.description}</p>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onEditProgram}
                        className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors flex items-center gap-1.5"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Editar
                    </button>
                    {program.status === 'active' && (
                        <button
                            onClick={onCompleteProgram}
                            className="px-3 py-1.5 text-sm text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-lg transition-colors flex items-center gap-1.5"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Concluir
                        </button>
                    )}
                    <button
                        onClick={onAssignProgram}
                        className="px-3 py-1.5 text-sm text-violet-400 hover:text-violet-300 hover:bg-violet-500/10 rounded-lg transition-colors flex items-center gap-1.5"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Trocar
                    </button>
                </div>
            </div>

            {/* Progress Bar & Dates */}
            <div className="bg-card rounded-xl border border-border/70 p-5 mb-6">
                {program.duration_weeks && (
                    <div className="mb-4">
                        <div className="flex items-center justify-between text-sm mb-2">
                            <span className="text-muted-foreground">Progresso do Ciclo</span>
                            <span className="text-foreground font-medium">
                                Semana {program.current_week || 1} de {program.duration_weeks}
                            </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-violet-500 to-blue-500 rounded-full transition-all duration-1000 ease-out"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                    </div>
                )}

                <div className="flex items-center gap-6 text-sm">
                    {program.started_at && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span>Início: <span className="text-foreground/80">{new Date(program.started_at).toLocaleDateString('pt-BR')}</span></span>
                        </div>
                    )}
                    {program.duration_weeks && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>Duração: <span className="text-foreground/80">{program.duration_weeks} semanas</span></span>
                        </div>
                    )}
                </div>
            </div>

            <hr className="border-border my-6" />

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                {/* Total Sessions */}
                <div className="bg-background/30 rounded-xl border border-border/70 p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                        <svg className="w-6 h-6 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                        </svg>
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-foreground leading-none">{summary.totalSessions}</p>
                        <p className="text-xs text-muted-foreground mt-1">Treinos totais</p>
                    </div>
                </div>

                {/* This Week */}
                <div className="bg-background/30 rounded-xl border border-border/70 p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-foreground leading-none">{summary.completedThisWeek}</p>
                        <p className="text-xs text-muted-foreground mt-1">Esta semana</p>
                    </div>
                </div>

                {/* Last Session */}
                <div className="bg-background/30 rounded-xl border border-border/70 p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                        <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div>
                        <p className="text-sm font-bold text-foreground leading-tight">
                            {summary.lastSessionDate
                                ? new Date(summary.lastSessionDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
                                : '-'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">Último treino</p>
                    </div>
                </div>
            </div>

            {/* Recent Sessions List */}
            <div>
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                    Últimas Sessões
                    <span className="h-px flex-1 bg-muted"></span>
                </h3>

                {recentSessions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                        Nenhuma sessão registrada neste programa ainda.
                    </div>
                ) : (
                    <div className="flex flex-col space-y-2">
                        {recentSessions.map((session) => (
                            <button
                                key={session.id}
                                onClick={() => handleSessionClick(session.id)}
                                className="w-full bg-background/30 hover:bg-card border border-border/70 hover:border-violet-500/30 rounded-xl p-3 flex items-center justify-between transition-all group text-left"
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center shrink-0 ${session.rpe
                                        ? (session.rpe <= 4 ? 'bg-emerald-500/10 text-emerald-400' : session.rpe <= 7 ? 'bg-yellow-500/10 text-yellow-500' : 'bg-red-500/10 text-red-400')
                                        : 'bg-muted/40 text-muted-foreground'
                                        }`}>
                                        <span className="text-[10px] uppercase font-bold opacity-70">RPE</span>
                                        <span className="text-sm font-bold leading-none">{session.rpe || '-'}</span>
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-foreground group-hover:text-violet-300 transition-colors truncate">
                                            {session.assigned_workouts?.name}
                                        </p>
                                        <p className="text-xs text-muted-foreground truncate">
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
                )}
            </div>

            <SessionDetailSheet
                isOpen={isSheetOpen}
                onClose={handleSheetClose}
                sessionId={selectedSessionId}
            />
        </div>
    )
}
