'use client'

import { useState } from 'react'
import { SessionDetailSheet } from './session-detail-sheet'
import { ProgramCalendar } from './program-calendar'
import { getProgramWeek, getProgramEndDate } from '@kinevo/shared/utils/schedule-projection'
import type { RangeSession } from '@/app/students/[id]/actions/get-sessions-for-range'

// --- Helpers ---

const TIMEZONE = 'America/Sao_Paulo'

function timeAgo(dateStr: string): string {
    const now = new Date()
    const date = new Date(dateStr)
    // Compare calendar dates in Brasília timezone
    const todayKey = now.toLocaleDateString('en-CA', { timeZone: TIMEZONE })
    const dateKey = date.toLocaleDateString('en-CA', { timeZone: TIMEZONE })
    const diffDays = Math.floor((new Date(todayKey).getTime() - new Date(dateKey).getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Hoje'
    if (diffDays === 1) return 'Ontem'
    if (diffDays < 7) return `há ${diffDays} dias`
    const diffWeeks = Math.floor(diffDays / 7)
    if (diffWeeks < 5) return `há ${diffWeeks} semana${diffWeeks > 1 ? 's' : ''}`
    const diffMonths = Math.floor(diffDays / 30)
    return `há ${diffMonths} ${diffMonths > 1 ? 'meses' : 'mês'}`
}

function getExpectedPerWeek(workouts?: Array<{ scheduled_days: number[] }>): number {
    if (!workouts || workouts.length === 0) return 0
    const uniqueDays = new Set<number>()
    workouts.forEach(w => w.scheduled_days?.forEach(d => uniqueDays.add(d)))
    return uniqueDays.size
}

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
    calendarInitialSessions?: RangeSession[]
    weeklyAdherence?: { week: number; rate: number }[]
    tonnageMap?: Record<string, { tonnage: number; previousTonnage: number | null; percentChange: number | null }>
    onAssignProgram?: () => void
    onEditProgram?: () => void
    onCompleteProgram?: () => void
    onCreateProgram?: () => void
    onPrescribeAI?: () => void
    hasActiveProgram?: boolean
}

export function ActiveProgramDashboard({
    program,
    summary,
    recentSessions = [],
    calendarInitialSessions = [],
    weeklyAdherence = [],
    tonnageMap = {},
    onAssignProgram,
    onEditProgram,
    onCompleteProgram,
    onCreateProgram,
    onPrescribeAI,
    hasActiveProgram = false
}: ActiveProgramDashboardProps) {
    // Sheet State (for calendar day clicks)
    const [isSheetOpen, setIsSheetOpen] = useState(false)
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)

    // Accordion State (for recent sessions inline expand)
    const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null)
    const [sessionDetails, setSessionDetails] = useState<Record<string, any>>({})
    const [loadingSession, setLoadingSession] = useState<Record<string, boolean>>({})

    const handleSessionClick = (sessionId: string) => {
        setSelectedSessionId(sessionId)
        setIsSheetOpen(true)
    }

    const handleSheetClose = () => {
        setIsSheetOpen(false)
        setTimeout(() => setSelectedSessionId(null), 300)
    }

    const handleSessionExpand = async (sessionId: string) => {
        if (expandedSessionId === sessionId) {
            setExpandedSessionId(null)
            return
        }
        setExpandedSessionId(sessionId)
        if (!sessionDetails[sessionId]) {
            setLoadingSession(prev => ({ ...prev, [sessionId]: true }))
            try {
                const { getSessionDetails } = await import('@/app/students/[id]/actions/get-session-details')
                const result = await getSessionDetails(sessionId)
                if (result.success && result.data) {
                    setSessionDetails(prev => ({ ...prev, [sessionId]: result.data }))
                }
            } catch (e) {
                console.error('Failed to load session details', e)
            } finally {
                setLoadingSession(prev => ({ ...prev, [sessionId]: false }))
            }
        }
    }

    const getStatusConfig = (status: AssignedProgram['status']) => {
        const config = {
            active: {
                label: 'Em andamento',
                classes: 'bg-emerald-500/5 text-emerald-400/70 border-emerald-500/15',
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
            <div className="bg-glass-bg backdrop-blur-md rounded-2xl border border-k-border-primary p-8 h-full flex flex-col">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h3 className="text-xl font-black text-white tracking-tight">Programa Atual</h3>
                        <p className="text-sm text-k-text-tertiary mt-1">Nenhum programa ativo no momento</p>
                    </div>
                </div>

                <div className="flex-1 text-center py-10 border border-dashed border-k-border-primary rounded-2xl flex flex-col items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-glass-bg flex items-center justify-center mx-auto mb-6">
                        <svg className="w-8 h-8 text-k-text-quaternary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                    </div>
                    <p className="text-k-text-tertiary font-medium mb-8">Nenhum programa ativo no momento.</p>

                    <div className="flex items-center justify-center gap-4">
                        <button
                            onClick={onCreateProgram}
                            className="px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white text-[11px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-violet-600/20 flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Criar Novo
                        </button>
                        <button
                            onClick={onAssignProgram}
                            className="px-6 py-3 bg-transparent hover:bg-glass-bg text-k-text-secondary hover:text-k-text-primary text-[11px] font-black uppercase tracking-widest rounded-xl transition-all border border-k-border-primary flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                            </svg>
                            Atribuir
                        </button>
                        {onPrescribeAI && (
                            <button
                                onClick={onPrescribeAI}
                                className="px-6 py-3 bg-gradient-to-r from-violet-600 to-indigo-500 hover:from-violet-500 hover:to-indigo-400 text-white text-[11px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2"
                            >
                                Prescrever com IA
                            </button>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    const statusConfig = getStatusConfig(program.status)

    // Calculate current week dynamically from started_at instead of static DB value
    const currentWeek = program.started_at
        ? getProgramWeek(new Date(), program.started_at, program.duration_weeks) ?? 1
        : (program.current_week || 1)

    const progressPercent = program.duration_weeks && currentWeek
        ? Math.min((currentWeek / program.duration_weeks) * 100, 100)
        : 0

    return (
        <div className="space-y-6">
            {/* Main Program Card */}
            <div className="bg-surface-card rounded-2xl border border-k-border-primary p-8 shadow-sm">
                {/* Header */}
                <div className="mb-6">
                    <div className="flex items-center gap-3 mb-1">
                        <h2 className="text-2xl font-black text-white tracking-tight">{program.name}</h2>
                        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border ${statusConfig.classes}`}>
                            {statusConfig.label}
                        </span>
                    </div>
                    {program.description && (
                        <p className="text-sm text-k-text-tertiary leading-relaxed max-w-md mb-3">{program.description}</p>
                    )}
                    {/* Action toolbar */}
                    <div className="flex items-center gap-2 mt-3">
                        <button
                            onClick={onEditProgram}
                            className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-k-text-tertiary hover:text-k-text-primary hover:bg-glass-bg-active rounded-lg transition-all border border-k-border-subtle"
                        >
                            Editar
                        </button>
                        {program.status === 'active' && (
                            <button
                                onClick={onCompleteProgram}
                                className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-k-text-tertiary hover:text-k-text-primary hover:bg-glass-bg-active rounded-lg transition-all border border-k-border-subtle"
                            >
                                Concluir
                            </button>
                        )}
                        <button
                            onClick={onAssignProgram}
                            className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-k-text-tertiary hover:text-k-text-primary hover:bg-glass-bg-active rounded-lg transition-all border border-k-border-subtle"
                        >
                            Trocar
                        </button>
                        {onPrescribeAI && (
                            <button
                                onClick={onPrescribeAI}
                                className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-300 hover:text-white hover:bg-gradient-to-r hover:from-violet-600 hover:to-indigo-500 rounded-lg transition-all border border-indigo-500/20"
                            >
                                Novo com IA
                            </button>
                        )}
                    </div>
                </div>

                {/* Progress Bar — Condensed */}
                {program.duration_weeks && (
                    <div className="mb-10">
                        <p className="text-sm font-semibold text-k-text-secondary mb-2">
                            Semana {currentWeek} de {program.duration_weeks}
                            {program.started_at && (() => {
                                const remainingWeeks = Math.max(0, program.duration_weeks! - currentWeek)
                                return remainingWeeks === 0
                                    ? <span className="text-emerald-400 ml-1">— última semana!</span>
                                    : <span className="text-k-text-quaternary ml-1">— faltam {remainingWeeks} semana{remainingWeeks > 1 ? 's' : ''}</span>
                            })()}
                        </p>
                        <div className="h-2 bg-glass-bg rounded-full overflow-hidden relative">
                            <div
                                className="h-full bg-gradient-to-r from-violet-600 to-indigo-400 rounded-full transition-all duration-1000 ease-out relative"
                                style={{ width: `${progressPercent}%` }}
                            >
                                <div className="absolute right-0 top-0 bottom-0 w-4 bg-white/20 blur-sm rounded-full" />
                            </div>
                        </div>
                        {program.started_at && (
                            <div className="mt-2 flex items-center gap-1 text-[10px] font-medium text-k-text-quaternary">
                                <span>{new Date(program.started_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: TIMEZONE })}</span>
                                <span className="flex-1 h-px bg-k-border-subtle mx-1" />
                                <span>{getProgramEndDate(program.started_at, program.duration_weeks!).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: TIMEZONE })}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Stats Grid - Hero Style */}
                <div data-onboarding="student-history-summary" className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
                    {/* Total Sessions */}
                    <div className="relative group">
                        <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-k-text-quaternary">
                            <svg className="w-3.5 h-3.5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            Treinos totais
                        </div>
                        <p className="text-4xl font-black text-white tracking-tighter">{summary.totalSessions}</p>
                        {summary.completedThisWeek > 0 && (
                            <p className="text-[11px] font-semibold text-k-text-quaternary mt-1">
                                +{summary.completedThisWeek} esta semana
                            </p>
                        )}
                    </div>

                    {/* This Week */}
                    {(() => {
                        const expected = getExpectedPerWeek(program.assigned_workouts)
                        const completed = summary.completedThisWeek
                        const remaining = Math.max(0, expected - completed)
                        return (
                            <div className="relative group">
                                <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-k-text-quaternary">
                                    <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Esta semana
                                </div>
                                <p className="text-4xl font-black text-white tracking-tighter">
                                    {expected > 0 ? `${completed}/${expected}` : completed}
                                </p>
                                {expected > 0 && (
                                    <p className={`text-[11px] font-semibold mt-1 ${
                                        completed >= expected
                                            ? 'text-emerald-400'
                                            : completed > 0
                                                ? 'text-yellow-400'
                                                : 'text-red-400'
                                    }`}>
                                        {completed >= expected
                                            ? 'Meta atingida!'
                                            : completed > 0
                                                ? `Falta${remaining > 1 ? 'm' : ''} ${remaining} treino${remaining > 1 ? 's' : ''}`
                                                : 'Nenhum treino esta semana'}
                                    </p>
                                )}
                            </div>
                        )
                    })()}

                    {/* Last Session */}
                    <div className="relative group">
                        <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-k-text-quaternary">
                            <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Último treino
                        </div>
                        <p className="text-4xl font-black text-white tracking-tighter leading-none">
                            {summary.lastSessionDate ? timeAgo(summary.lastSessionDate) : '-'}
                        </p>
                        {summary.lastSessionDate && (
                            <p className="text-[10px] font-medium text-k-text-quaternary mt-1">
                                {new Date(summary.lastSessionDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: TIMEZONE }).replace('.', '')}
                            </p>
                        )}
                    </div>
                </div>

                {/* Adherence Sparkline */}
                {weeklyAdherence.length > 1 && (
                    <div className="mb-8 bg-glass-bg rounded-xl p-4 border border-k-border-subtle">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-k-text-quaternary">
                                Adesão por semana
                            </p>
                            <p className="text-[10px] font-bold text-k-text-quaternary">
                                {weeklyAdherence.length} semanas
                            </p>
                        </div>
                        <div className="flex items-end gap-1 h-8">
                            {weeklyAdherence.slice(-12).map((w) => (
                                <div
                                    key={w.week}
                                    className={`flex-1 rounded-t-sm transition-all min-w-[6px] ${
                                        w.rate >= 80 ? 'bg-emerald-500' :
                                        w.rate >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                                    }`}
                                    style={{ height: `${Math.max(w.rate, 4)}%` }}
                                    title={`Semana ${w.week}: ${w.rate}%`}
                                />
                            ))}
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-[9px] text-k-text-quaternary">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500" /> ≥80%</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-yellow-500" /> ≥50%</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500" /> &lt;50%</span>
                        </div>
                    </div>
                )}

                {/* Navigable Calendar */}
                {program.assigned_workouts && program.started_at && (
                    <div data-onboarding="student-calendar">
                        <ProgramCalendar
                            programId={program.id}
                            programStartedAt={program.started_at}
                            programDurationWeeks={program.duration_weeks}
                            scheduledWorkouts={program.assigned_workouts}
                            initialSessions={calendarInitialSessions}
                            onDayClick={(day) => {
                                if (day.status === 'done' && day.completedSessions.length > 0) {
                                    handleSessionClick(day.completedSessions[0].id)
                                }
                            }}
                        />
                    </div>
                )}

                {/* Recent Sessions List - Compact Feed */}
                <div>
                    <h3 className="text-sm font-semibold text-white mb-6 flex items-center gap-2">
                        Últimas Sessões
                        <span className="px-2 py-0.5 rounded bg-glass-bg text-[10px] text-k-text-tertiary font-bold uppercase tracking-widest border border-k-border-subtle">
                            Recentes
                        </span>
                    </h3>

                    {recentSessions.length === 0 ? (
                        <div className="text-center py-10 text-k-text-quaternary text-xs italic font-medium">
                            Nenhuma sessão registrada neste programa ainda.
                        </div>
                    ) : (
                        <div className="flex flex-col space-y-1">
                            {recentSessions.map((session) => {
                                const isExpanded = expandedSessionId === session.id
                                const details = sessionDetails[session.id]
                                const isLoading = loadingSession[session.id]
                                return (
                                    <div key={session.id} className="rounded-xl overflow-hidden">
                                        <button
                                            onClick={() => handleSessionExpand(session.id)}
                                            className={`w-full bg-transparent hover:bg-glass-bg rounded-xl px-4 py-3 flex items-center justify-between transition-all group text-left border ${isExpanded ? 'border-k-border-subtle bg-glass-bg' : 'border-transparent hover:border-k-border-subtle'}`}
                                        >
                                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-sm font-bold text-k-text-secondary group-hover:text-k-text-primary transition-colors truncate">
                                                            {session.assigned_workouts?.name}
                                                        </p>
                                                        {session.rpe != null && (
                                                            <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded shrink-0 ${
                                                                session.rpe >= 10 ? 'bg-red-500/10 text-red-400' :
                                                                session.rpe >= 8 ? 'bg-yellow-500/10 text-yellow-400' :
                                                                session.rpe >= 6 ? 'bg-emerald-500/10 text-emerald-400' :
                                                                'bg-white/5 text-k-text-tertiary'
                                                            }`}>
                                                                PSE {session.rpe}
                                                            </span>
                                                        )}
                                                        {tonnageMap[session.id]?.percentChange != null && (
                                                            <span className={`text-[10px] font-bold shrink-0 ${
                                                                tonnageMap[session.id].percentChange! > 0 ? 'text-emerald-400' :
                                                                tonnageMap[session.id].percentChange! < 0 ? 'text-red-400' : 'text-k-text-quaternary'
                                                            }`}>
                                                                {tonnageMap[session.id].percentChange! > 0 ? '↑' : tonnageMap[session.id].percentChange! < 0 ? '↓' : '='}
                                                                {tonnageMap[session.id].percentChange! > 0 ? '+' : ''}{tonnageMap[session.id].percentChange!.toFixed(1)}%
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[10px] font-medium text-k-text-quaternary mt-0.5">
                                                        {new Date(session.completed_at).toLocaleDateString('pt-BR', {
                                                            weekday: 'short',
                                                            day: 'numeric',
                                                            month: 'short',
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                            timeZone: TIMEZONE
                                                        })}
                                                    </p>
                                                    {!isExpanded && session.feedback && (
                                                        <p className="text-xs text-k-text-tertiary italic mt-1 truncate flex items-center gap-1.5">
                                                            <svg className="w-3 h-3 shrink-0 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                                            </svg>
                                                            <span className="truncate">&ldquo;{session.feedback}&rdquo;</span>
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <svg className={`w-4 h-4 text-k-border-subtle group-hover:text-k-text-tertiary transition-all ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>

                                        {/* Expanded Exercise Details */}
                                        {isExpanded && (
                                            <div className="px-4 pb-4 pt-1 bg-glass-bg rounded-b-xl border-x border-b border-k-border-subtle space-y-3">
                                                {isLoading ? (
                                                    <div className="text-center py-4 text-k-text-quaternary text-xs font-medium animate-pulse">
                                                        Carregando exercícios...
                                                    </div>
                                                ) : details?.exercises?.length > 0 ? (
                                                    <>
                                                        {/* Summary stats */}
                                                        <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-k-text-quaternary pb-2 border-b border-k-border-subtle">
                                                            {details.duration_seconds > 0 && (
                                                                <span>
                                                                    {Math.floor(details.duration_seconds / 3600) > 0
                                                                        ? `${Math.floor(details.duration_seconds / 3600)}h ${Math.floor((details.duration_seconds % 3600) / 60)}m`
                                                                        : `${Math.floor(details.duration_seconds / 60)}m`
                                                                    }
                                                                </span>
                                                            )}
                                                            <span>
                                                                {details.exercises.reduce((t: number, ex: any) => t + ex.sets.length, 0)} séries
                                                            </span>
                                                            {(() => {
                                                                const tonnage = details.exercises.reduce((t: number, ex: any) =>
                                                                    t + ex.sets.reduce((s: number, set: any) => s + ((set.weight || 0) * (set.reps || 0)), 0), 0)
                                                                return tonnage > 0 ? <span>{tonnage.toLocaleString('pt-BR')}kg volume</span> : null
                                                            })()}
                                                        </div>

                                                        {/* Exercise list */}
                                                        {details.exercises.map((ex: any) => (
                                                            <div key={ex.exercise_id} className="flex items-center justify-between text-sm py-1">
                                                                <span className="text-k-text-secondary font-medium truncate flex-1 mr-4">{ex.name}</span>
                                                                <div className="flex items-center gap-3 text-k-text-quaternary text-xs shrink-0">
                                                                    <span className="font-bold">{ex.sets.length}×{ex.sets[0]?.reps ?? '-'}</span>
                                                                    {ex.sets[0]?.weight > 0 && (
                                                                        <span className="text-k-text-tertiary">@ {ex.sets[0].weight}kg</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}

                                                        {/* Feedback */}
                                                        {session.feedback && (
                                                            <p className="text-xs text-k-text-tertiary italic pt-2 border-t border-k-border-subtle flex items-start gap-1.5">
                                                                <svg className="w-3 h-3 shrink-0 opacity-50 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                                                </svg>
                                                                &ldquo;{session.feedback}&rdquo;
                                                            </p>
                                                        )}
                                                    </>
                                                ) : (
                                                    <p className="text-xs text-k-text-quaternary italic py-2">Nenhum exercício registrado.</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
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
