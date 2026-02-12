'use client'

import { useState } from 'react'
import { SessionDetailSheet } from './session-detail-sheet'
import { WeeklyPerformanceTracker } from './weekly-performance-tracker'

interface AssignedProgram {
    id: string
    name: string
    description: string | null
    status: 'active' | 'completed' | 'paused' | 'scheduled'
    duration_weeks: number | null
    current_week: number | null
    started_at: string | null
    created_at: string
    assigned_workouts?: Array<{
        id: string
        name: string
        scheduled_days: number[]
    }>
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
    sessionsLast7Days?: any[]
    onAssignProgram?: () => void
    onEditProgram?: () => void
    onCompleteProgram?: () => void
    onCreateProgram?: () => void
}

export function ActiveProgramDashboard({
    program,
    summary,
    recentSessions = [],
    sessionsLast7Days = [],
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
                classes: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20',
                icon: (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                ),
            },
            completed: {
                label: 'Concluído',
                classes: 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20',
                icon: (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                ),
            },
            paused: {
                label: 'Pausado',
                classes: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
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
        <div className="space-y-6">
            {/* Main Program Card */}
            <div className="bg-surface-card rounded-2xl border border-k-border-primary p-8 shadow-sm">
                {/* Header / Actions */}
                <div className="flex items-start justify-between mb-8">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h2 className="text-2xl font-black text-k-text-primary dark:text-white tracking-tight">{program.name}</h2>
                            <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border ${statusConfig.classes.replace('text-emerald-400', 'text-emerald-300').replace('border-emerald-500/20', 'border-emerald-500/30')}`}>
                                {statusConfig.label}
                            </span>
                        </div>
                        {program.description && (
                            <p className="text-sm text-k-text-tertiary leading-relaxed max-w-md">{program.description}</p>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onEditProgram}
                            className="p-2 text-k-text-quaternary hover:text-k-text-primary hover:bg-glass-bg rounded-xl transition-all border border-transparent hover:border-k-border-primary"
                            title="Editar"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </button>
                        {program.status === 'active' && (
                            <button
                                onClick={onCompleteProgram}
                                className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/10 rounded-xl transition-all border border-emerald-500/20"
                            >
                                Concluir
                            </button>
                        )}
                        <button
                            onClick={onAssignProgram}
                            className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-violet-300 hover:text-violet-200 hover:bg-violet-500/10 rounded-xl transition-all border border-violet-500/20"
                        >
                            Trocar
                        </button>
                    </div>
                </div>

                {/* Progress Bar & Dates */}
                {program.duration_weeks && (
                    <div className="mb-10">
                        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.2em] text-k-text-quaternary mb-3">
                            <span>Progresso do Ciclo</span>
                            <span className="text-k-text-secondary">
                                Semana {program.current_week || 1} de {program.duration_weeks}
                            </span>
                        </div>
                        <div className="h-2.5 bg-glass-bg rounded-full overflow-hidden relative">
                            <div
                                className="h-full bg-gradient-to-r from-violet-600 to-indigo-400 rounded-full transition-all duration-1000 ease-out relative"
                                style={{ width: `${progressPercent}%` }}
                            >
                                {/* Glow tip */}
                                <div className="absolute right-0 top-0 bottom-0 w-4 bg-white/20 blur-sm rounded-full" />
                            </div>
                        </div>
                        <div className="mt-4 flex items-center gap-6 text-[10px] font-bold uppercase tracking-widest">
                            {program.started_at && (
                                <div className="flex items-center gap-2 text-k-text-quaternary">
                                    <svg className="w-3.5 h-3.5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    <span>Início <span className="text-k-text-tertiary ml-1">{new Date(program.started_at).toLocaleDateString('pt-BR')}</span></span>
                                </div>
                            )}
                            {program.duration_weeks && (
                                <div className="flex items-center gap-2 text-k-text-quaternary">
                                    <svg className="w-3.5 h-3.5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span>Duração <span className="text-k-text-tertiary ml-1">{program.duration_weeks} semanas</span></span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Stats Grid - Hero Style */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
                    {/* Total Sessions */}
                    <div className="relative group">
                        <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-k-text-quaternary">
                            <svg className="w-3.5 h-3.5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            Treinos totais
                        </div>
                        <p className="text-4xl font-black text-k-text-primary dark:text-white tracking-tighter">{summary.totalSessions}</p>
                    </div>

                    {/* This Week */}
                    <div className="relative group">
                        <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-k-text-quaternary">
                            <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Esta semana
                        </div>
                        <p className="text-4xl font-black text-k-text-primary dark:text-white tracking-tighter">{summary.completedThisWeek}</p>
                    </div>

                    {/* Last Session */}
                    <div className="relative group">
                        <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-k-text-quaternary">
                            <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Último treino
                        </div>
                        <p className="text-4xl font-black text-k-text-primary dark:text-white tracking-tighter leading-none">
                            {summary.lastSessionDate
                                ? new Date(summary.lastSessionDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')
                                : '-'}
                        </p>
                    </div>
                </div>

                {/* Weekly Performance Tracker */}
                {program.assigned_workouts && (
                    <WeeklyPerformanceTracker
                        scheduledWorkouts={program.assigned_workouts}
                        recentSessions={sessionsLast7Days}
                    />
                )}

                {/* Recent Sessions List - Compact Feed */}
                <div>
                    <h3 className="text-[10px] font-bold text-k-text-quaternary uppercase tracking-[0.3em] mb-6 flex items-center gap-4">
                        Últimas Sessões
                        <div className="h-px flex-1 bg-k-border-subtle" />
                    </h3>

                    {recentSessions.length === 0 ? (
                        <div className="text-center py-10 text-k-text-quaternary text-xs italic font-medium">
                            Nenhuma sessão registrada neste programa ainda.
                        </div>
                    ) : (
                        <div className="flex flex-col space-y-1">
                            {recentSessions.map((session) => (
                                <button
                                    key={session.id}
                                    onClick={() => handleSessionClick(session.id)}
                                    className="w-full bg-transparent hover:bg-glass-bg rounded-xl px-4 py-3 flex items-center justify-between transition-all group text-left border border-transparent hover:border-k-border-subtle"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center shrink-0 border transition-colors ${session.rpe
                                            ? (session.rpe <= 4 ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-400/60 group-hover:text-emerald-400 group-hover:border-emerald-500/20' : session.rpe <= 7 ? 'bg-amber-500/5 border-amber-500/10 text-amber-500/60 group-hover:text-amber-500 group-hover:border-amber-500/20' : 'bg-red-500/5 border-red-500/10 text-red-400/60 group-hover:text-red-400 group-hover:border-red-500/20')
                                            : 'bg-glass-bg border-k-border-subtle text-k-text-quaternary'
                                            }`}>
                                            <span className="text-[8px] uppercase font-black tracking-widest opacity-40">RPE</span>
                                            <span className="text-sm font-black leading-none">{session.rpe || '-'}</span>
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-k-text-secondary group-hover:text-k-text-primary transition-colors truncate">
                                                {session.assigned_workouts?.name}
                                            </p>
                                            <p className="text-[10px] font-medium text-k-text-quaternary uppercase tracking-widest">
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
                                    <svg className="w-4 h-4 text-k-border-subtle group-hover:text-k-text-tertiary group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <SessionDetailSheet
                isOpen={isSheetOpen}
                onClose={handleSheetClose}
                sessionId={selectedSessionId}
            />
        </div>
    )
}
