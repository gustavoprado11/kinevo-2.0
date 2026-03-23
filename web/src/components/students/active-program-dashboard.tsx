'use client'

import { useState } from 'react'
import { SessionDetailSheet } from './session-detail-sheet'
import { ProgramCalendar } from './program-calendar'
import { getProgramWeek, getProgramEndDate } from '@kinevo/shared/utils/schedule-projection'
import { Flame, Activity, ArrowUpRight, FileText } from 'lucide-react'
import { WARMUP_TYPE_LABELS, CARDIO_EQUIPMENT_LABELS } from '@kinevo/shared/types/workout-items'
import type { SessionItem } from '@/app/students/[id]/actions/get-session-details'
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
    return workouts.reduce((sum, w) => sum + (w.scheduled_days?.length || 0), 0)
}

// ── Compact item renderer for expanded session accordion ──

function ExpandedSessionItem({ item }: { item: SessionItem }) {
    if (item.itemType === 'warmup') {
        const cfg = item.itemConfig as any
        const label = cfg?.warmup_type ? (WARMUP_TYPE_LABELS as any)[cfg.warmup_type] || cfg.warmup_type : 'Aquecimento'
        const duration = cfg?.duration_minutes ? `${cfg.duration_minutes} min` : null
        return (
            <div className="flex items-center gap-2 text-sm py-1">
                <Flame size={13} className="text-orange-400 shrink-0" />
                <span className="text-k-text-secondary font-medium truncate flex-1">{label}</span>
                {duration && <span className="text-k-text-quaternary text-xs shrink-0">{duration}</span>}
            </div>
        )
    }

    if (item.itemType === 'cardio') {
        const cfg = item.itemConfig as any
        const equipment = cfg?.equipment ? (CARDIO_EQUIPMENT_LABELS as any)[cfg.equipment] || cfg.equipment : 'Cardio'
        const duration = cfg?.duration_minutes ? `${cfg.duration_minutes} min` : null
        const mode = cfg?.mode === 'interval' ? 'Intervalado' : null
        return (
            <div className="flex items-center gap-2 text-sm py-1">
                <Activity size={13} className="text-blue-400 shrink-0" />
                <span className="text-k-text-secondary font-medium truncate flex-1">
                    {equipment}{mode ? ` — ${mode}` : ''}
                </span>
                {duration && <span className="text-k-text-quaternary text-xs shrink-0">{duration}</span>}
            </div>
        )
    }

    if (item.itemType === 'note') {
        return (
            <div className="flex items-center gap-2 text-sm py-1">
                <span className="text-k-text-quaternary text-xs">●</span>
                <span className="text-k-text-quaternary italic text-xs truncate flex-1">{item.notes || 'Nota'}</span>
            </div>
        )
    }

    if (item.itemType === 'superset') {
        return (
            <div className="py-1">
                <div className="flex items-center gap-2 text-sm mb-1">
                    <span className="text-violet-400 text-xs">●</span>
                    <span className="text-violet-400 text-xs font-bold">Superset</span>
                </div>
                {item.children?.map(child => (
                    <ExpandedSessionItem key={child.id} item={child} />
                ))}
            </div>
        )
    }

    // exercise (default)
    return (
        <div className="flex items-center justify-between text-sm py-1">
            <span className="text-k-text-secondary font-medium truncate flex-1 mr-4">{item.exerciseName || 'Exercício'}</span>
            <div className="flex items-center gap-3 text-k-text-quaternary text-xs shrink-0">
                {item.setLogs.length > 0 ? (
                    <>
                        <span className="font-bold">{item.setLogs.length}×{item.setLogs[0]?.reps ?? '-'}</span>
                        {item.setLogs[0]?.weight > 0 && (
                            <span className="text-k-text-tertiary">@ {item.setLogs[0].weight}kg</span>
                        )}
                    </>
                ) : item.setsPrescribed ? (
                    <span className="font-bold">{item.setsPrescribed}×{item.repsPrescribed || '-'}</span>
                ) : null}
            </div>
        </div>
    )
}

interface AssignedProgram {
    id: string
    name: string
    description: string | null
    status: 'active' | 'completed' | 'paused' | 'scheduled' | 'expired'
    duration_weeks: number | null
    current_week: number | null
    started_at: string | null
    created_at: string
    expires_at?: string | null
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
    onExtendProgram?: () => void
    onCreateProgram?: () => void
    onPrescribeAI?: () => void
    onViewReport?: () => void
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
    onExtendProgram,
    onCreateProgram,
    onPrescribeAI,
    onViewReport,
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
            expired: {
                label: 'Expirado',
                classes: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                icon: (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
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
            <div className="bg-white dark:bg-glass-bg backdrop-blur-md rounded-2xl border border-[#E5E5EA] dark:border-k-border-primary p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-[#1C1C1E] dark:text-white flex items-center gap-2">
                        Programa Atual
                        <span className="px-2 py-0.5 rounded bg-glass-bg text-[10px] text-k-text-tertiary font-bold border border-k-border-subtle">
                            Ativo
                        </span>
                    </h3>
                </div>

                <div className="text-center py-4">
                    <p className="text-sm text-k-text-quaternary mb-3">Nenhum programa ativo no momento.</p>
                    <div className="flex items-center justify-center gap-2">
                        <button
                            onClick={onCreateProgram}
                            className="px-3 py-1.5 text-xs font-bold bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-all"
                        >
                            + Criar Novo
                        </button>
                        <button
                            onClick={onAssignProgram}
                            className="px-3 py-1.5 text-xs font-bold text-k-text-tertiary hover:text-k-text-primary border border-k-border-subtle rounded-lg transition-all"
                        >
                            Atribuir
                        </button>
                        {onPrescribeAI && (
                            <button
                                onClick={onPrescribeAI}
                                className="px-3 py-1.5 text-xs font-bold text-violet-400 hover:text-violet-300 border border-violet-500/30 rounded-lg transition-all"
                            >
                                Novo com IA
                            </button>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    const statusConfig = getStatusConfig(program.status)

    // Calculate current week dynamically from started_at instead of static DB value
    const isExpired = program.status === 'expired'
    const computedWeek = program.started_at
        ? getProgramWeek(new Date(), program.started_at, program.duration_weeks)
        : null
    const currentWeek = isExpired
        ? (program.duration_weeks ?? 1)
        : (computedWeek ?? program.duration_weeks ?? 1)

    const progressPercent = isExpired
        ? 100
        : (program.duration_weeks && currentWeek
            ? Math.min((currentWeek / program.duration_weeks) * 100, 100)
            : 0)

    return (
        <div className="space-y-6">
            {/* Main Program Card */}
            <div className="bg-surface-card rounded-2xl border border-k-border-primary p-8 shadow-sm">
                {/* Header */}
                <div className="mb-6">
                    <div className="flex items-center gap-3 mb-1">
                        <h2 className="text-2xl font-black text-[#1C1C1E] dark:text-white tracking-tight">{program.name}</h2>
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${statusConfig.classes}`}>
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
                            className="px-3 py-1.5 text-[10px] font-bold text-k-text-tertiary hover:text-k-text-primary hover:bg-glass-bg-active rounded-lg transition-all border border-k-border-subtle"
                        >
                            Editar
                        </button>
                        {(program.status === 'active' || program.status === 'expired') && (
                            <button
                                onClick={onCompleteProgram}
                                className="px-3 py-1.5 text-[10px] font-bold text-k-text-tertiary hover:text-k-text-primary hover:bg-glass-bg-active rounded-lg transition-all border border-k-border-subtle"
                            >
                                Concluir
                            </button>
                        )}
                        {program.status === 'expired' && onExtendProgram && (
                            <button
                                onClick={onExtendProgram}
                                className="px-3 py-1.5 text-[10px] font-bold text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 rounded-lg transition-all border border-amber-500/20"
                            >
                                Prorrogar
                            </button>
                        )}
                        <button
                            onClick={onAssignProgram}
                            className="px-3 py-1.5 text-[10px] font-bold text-k-text-tertiary hover:text-k-text-primary hover:bg-glass-bg-active rounded-lg transition-all border border-k-border-subtle"
                        >
                            Trocar
                        </button>
                        {onPrescribeAI && (
                            <button
                                onClick={onPrescribeAI}
                                className="px-3 py-1.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-300 hover:text-white hover:bg-gradient-to-r hover:from-violet-600 hover:to-indigo-500 rounded-lg transition-all border border-indigo-500/20"
                            >
                                Novo com IA
                            </button>
                        )}
                        {onViewReport && (
                            <button
                                onClick={onViewReport}
                                className="px-3 py-1.5 text-[10px] font-bold text-k-text-tertiary hover:text-k-text-primary hover:bg-glass-bg-active rounded-lg transition-all border border-k-border-subtle flex items-center gap-1"
                            >
                                <FileText className="w-3 h-3" />
                                Relatório
                            </button>
                        )}
                    </div>
                </div>

                {/* Progress Bar — Condensed */}
                {program.duration_weeks && (
                    <div className="mb-10">
                        <p className="text-sm font-semibold text-k-text-secondary mb-2">
                            {isExpired ? (
                                <>
                                    Programa encerrado
                                    {program.expires_at && (
                                        <span className="text-amber-400 ml-1">
                                            — expirou em {new Date(program.expires_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: TIMEZONE })}
                                        </span>
                                    )}
                                </>
                            ) : (
                                <>
                                    Semana {currentWeek} de {program.duration_weeks}
                                    {program.started_at && (() => {
                                        const remainingWeeks = Math.max(0, program.duration_weeks! - currentWeek)
                                        return remainingWeeks === 0
                                            ? <span className="text-emerald-400 ml-1">— última semana!</span>
                                            : <span className="text-k-text-quaternary ml-1">— faltam {remainingWeeks} semana{remainingWeeks > 1 ? 's' : ''}</span>
                                    })()}
                                </>
                            )}
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
                        <div className="mb-2 flex items-center gap-2 text-[10px] font-bold text-[#8E8E93] dark:text-k-text-quaternary">
                            <svg className="w-3.5 h-3.5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            Treinos totais
                        </div>
                        <p className="text-4xl font-black text-[#1C1C1E] dark:text-white tracking-tighter">{summary.totalSessions}</p>
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
                                <div className="mb-2 flex items-center gap-2 text-[10px] font-bold text-[#8E8E93] dark:text-k-text-quaternary">
                                    <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Esta semana
                                </div>
                                <p className="text-4xl font-black text-[#1C1C1E] dark:text-white tracking-tighter">
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
                        <div className="mb-2 flex items-center gap-2 text-[10px] font-bold text-[#8E8E93] dark:text-k-text-quaternary">
                            <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Último treino
                        </div>
                        <p className="text-4xl font-black text-[#1C1C1E] dark:text-white tracking-tighter leading-none">
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
                            <p className="text-[10px] font-bold text-k-text-quaternary">
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
                    <h3 className="text-sm font-semibold text-[#1C1C1E] dark:text-white mb-6 flex items-center gap-2">
                        Últimas Sessões
                        <span className="px-2 py-0.5 rounded bg-glass-bg text-[10px] text-k-text-tertiary font-bold border border-k-border-subtle">
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
                                                        Carregando detalhes...
                                                    </div>
                                                ) : details?.items?.length > 0 ? (
                                                    <>
                                                        {/* Summary stats */}
                                                        <div className="flex items-center gap-4 text-[10px] font-bold text-k-text-quaternary pb-2 border-b border-k-border-subtle">
                                                            {details.stats?.durationSeconds > 0 && (
                                                                <span>
                                                                    {Math.floor(details.stats.durationSeconds / 3600) > 0
                                                                        ? `${Math.floor(details.stats.durationSeconds / 3600)}h ${Math.floor((details.stats.durationSeconds % 3600) / 60)}m`
                                                                        : `${Math.floor(details.stats.durationSeconds / 60)}m`
                                                                    }
                                                                </span>
                                                            )}
                                                            {details.stats?.completedSets > 0 && (
                                                                <span>{details.stats.completedSets} séries</span>
                                                            )}
                                                            {details.stats?.totalTonnage > 0 && (
                                                                <span>{details.stats.totalTonnage.toLocaleString('pt-BR')}kg volume</span>
                                                            )}
                                                            <span>{details.items.length} itens</span>
                                                        </div>

                                                        {/* Item list — all types */}
                                                        {details.items.map((item: SessionItem) => (
                                                            <ExpandedSessionItem key={item.id} item={item} />
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

                                                        {/* Open full detail modal */}
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleSessionClick(session.id) }}
                                                            className="w-full mt-1 pt-2 border-t border-k-border-subtle flex items-center justify-center gap-1.5 text-[11px] font-bold text-k-text-tertiary hover:text-violet-400 transition-colors"
                                                        >
                                                            Ver detalhes
                                                            <ArrowUpRight size={12} />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <p className="text-xs text-k-text-quaternary italic py-2">Nenhum item registrado.</p>
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
