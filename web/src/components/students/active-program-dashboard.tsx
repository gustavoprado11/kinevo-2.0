'use client'

import { useState, useEffect, useRef } from 'react'
import { SessionDetailSheet } from './session-detail-sheet'
import { ProgramCalendar } from './program-calendar'
import { AdherenceTrendStrip } from './adherence-trend-strip'
import { getProgramWeek, getProgramEndDate } from '@kinevo/shared/utils/schedule-projection'
import { Flame, Activity, ArrowUpRight, FileText, CalendarPlus, Plus, MoreHorizontal, CheckCircle, ArrowLeftRight, ChevronDown, MessageSquare, Dumbbell, Zap } from 'lucide-react'
import { WARMUP_TYPE_LABELS, CARDIO_EQUIPMENT_LABELS } from '@kinevo/shared/types/workout-items'
import type { SessionItem } from '@/app/students/[id]/actions/get-session-details'
import type { RangeSession } from '@/app/students/[id]/actions/get-sessions-for-range'

// --- Helpers ---

const TIMEZONE = 'America/Sao_Paulo'

// Onda 2 — converter "semana N do programa" (1-indexed) em Date.
// Local pra não tocar shared/utils nesta onda; eventualmente vai pra
// schedule-projection (ver follow-ups).
function addWeeks(start: Date, n: number): Date {
    const d = new Date(start)
    d.setDate(d.getDate() + n * 7)
    return d
}

function formatDuration(seconds: number): string {
    if (seconds >= 3600) return `${Math.floor(seconds / 3600)}h${Math.floor((seconds % 3600) / 60)}m`
    return `${Math.floor(seconds / 60)}min`
}

// PSE como texto: cor só quando é alerta (≥9 vermelho, ≥8 âmbar).
function rpeClass(rpe: number): string {
    if (rpe >= 9) return 'text-red-600 dark:text-red-400'
    if (rpe >= 8) return 'text-amber-600 dark:text-amber-400'
    return 'text-k-text-tertiary'
}

// ── Compact item renderer for expanded session accordion ──

function ExpandedSessionItem({ item }: { item: SessionItem }) {
    if (item.itemType === 'warmup') {
        const cfg = item.itemConfig as any
        const label = cfg?.warmup_type ? (WARMUP_TYPE_LABELS as any)[cfg.warmup_type] || cfg.warmup_type : 'Aquecimento'
        const duration = cfg?.duration_minutes ? `${cfg.duration_minutes} min` : null
        return (
            <div className="flex items-center gap-2 text-sm py-1">
                <Flame size={13} className="text-k-text-quaternary shrink-0" />
                <span className="text-k-text-secondary font-medium truncate flex-1">{label}</span>
                {duration && <span className="font-mono text-[11px] text-k-text-quaternary shrink-0 tabular-nums">{duration}</span>}
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
                <Activity size={13} className="text-k-text-quaternary shrink-0" />
                <span className="text-k-text-secondary font-medium truncate flex-1">
                    {equipment}{mode ? ` — ${mode}` : ''}
                </span>
                {duration && <span className="font-mono text-[11px] text-k-text-quaternary shrink-0 tabular-nums">{duration}</span>}
            </div>
        )
    }

    if (item.itemType === 'note') {
        return (
            <div className="flex items-center gap-2 text-sm py-1">
                <span className="text-k-text-quaternary italic text-xs truncate flex-1">{item.notes || 'Nota'}</span>
            </div>
        )
    }

    if (item.itemType === 'superset') {
        return (
            <div className="py-1">
                <div className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-k-text-tertiary mb-1">
                    Superset
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
            <div className="flex items-center gap-3 font-mono text-[11px] text-k-text-tertiary shrink-0 tabular-nums">
                {item.setLogs.length > 0 ? (
                    <>
                        <span>{item.setLogs.length}×{item.setLogs[0]?.reps ?? '-'}</span>
                        {item.setLogs[0]?.weight > 0 && (
                            <span className="text-k-text-quaternary">@ {item.setLogs[0].weight}kg</span>
                        )}
                    </>
                ) : item.setsPrescribed ? (
                    <span>{item.setsPrescribed}×{item.repsPrescribed || '-'}</span>
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
        workout_type?: string | null
        order_index?: number
    }>
}

interface ActiveProgramDashboardProps {
    program: AssignedProgram | null
    recentSessions?: any[]
    calendarInitialSessions?: RangeSession[]
    /**
     * Adesão por semana do programa (1-indexed). Onda 2 voltou a consumir esse
     * valor para alimentar o `AdherenceTrendStrip` acima do calendário —
     * sparkline + delta. Cliques nos pontos navegam o calendário até a semana
     * correspondente via `initialWeekStart`.
     */
    weeklyAdherence?: { week: number; rate: number }[]
    tonnageMap?: Record<string, { tonnage: number; previousTonnage: number | null; percentChange: number | null }>
    onAssignProgram?: () => void
    onEditProgram?: () => void
    onCompleteProgram?: () => void
    onExtendProgram?: () => void
    onCreateProgram?: () => void
    onViewReport?: () => void
    /**
     * Affordance "Próximo programa" na toolbar do card. A Onda 1 escondeu o
     * card "Próximos Programas" quando o programa atual está em <75% e a
     * fila está vazia — sem essa porta, o treinador não consegue prescrever
     * antecipadamente. Este botão usa o mesmo handler que o card usa quando
     * está visível, garantindo um único caminho até `AssignProgramModal`
     * em modo scheduled.
     */
    onAssignScheduled?: () => void
    onCreateScheduled?: () => void
    hasActiveProgram?: boolean
    /** Pass to show full student history in calendar, not just current program */
    studentId?: string
}

// Redesign "ferramenta profissional": painel hairline sem sombra, status como
// ponto + texto, "Editar programa" é a ÚNICA ação violeta da tela, progresso
// em tinta (sem gradiente/glow) e sessões como linhas flat com dados em mono.

const STATUS_DOT: Record<AssignedProgram['status'], { label: string; dot: string }> = {
    active: { label: 'Em andamento', dot: 'bg-emerald-500' },
    completed: { label: 'Concluído', dot: 'bg-k-text-quaternary' },
    paused: { label: 'Pausado', dot: 'bg-amber-500' },
    expired: { label: 'Expirado', dot: 'bg-red-500' },
    scheduled: { label: 'Agendado', dot: 'bg-k-text-quaternary' },
}

export function ActiveProgramDashboard({
    program,
    recentSessions = [],
    calendarInitialSessions = [],
    weeklyAdherence = [],
    tonnageMap = {},
    onAssignProgram,
    onEditProgram,
    onCompleteProgram,
    onExtendProgram,
    onCreateProgram,
    onViewReport,
    onAssignScheduled,
    onCreateScheduled,
    hasActiveProgram = false,
    studentId,
}: ActiveProgramDashboardProps) {
    // Sheet State (for calendar day clicks)
    const [isSheetOpen, setIsSheetOpen] = useState(false)
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)

    // Onda 2 — semana clicada no AdherenceTrendStrip. Quando muda, o
    // ProgramCalendar reposiciona o anchor via initialWeekStart.
    const [calendarStartWeek, setCalendarStartWeek] = useState<number | string | null>(null)

    // Menu overflow da toolbar: ações de fim de ciclo (Concluir, Trocar,
    // Criar próximo, Atribuir próximo). Mesmo padrão do StudentHeader
    // (mousedown listener + ref + ESC).
    const [showOverflowMenu, setShowOverflowMenu] = useState(false)
    const overflowMenuRef = useRef<HTMLDivElement>(null)
    useEffect(() => {
        if (!showOverflowMenu) return
        const handleClick = (e: MouseEvent) => {
            if (overflowMenuRef.current && !overflowMenuRef.current.contains(e.target as Node)) {
                setShowOverflowMenu(false)
            }
        }
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setShowOverflowMenu(false)
        }
        document.addEventListener('mousedown', handleClick)
        document.addEventListener('keydown', handleKey)
        return () => {
            document.removeEventListener('mousedown', handleClick)
            document.removeEventListener('keydown', handleKey)
        }
    }, [showOverflowMenu])

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

    const menuItem = 'w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-medium text-k-text-primary hover:bg-surface-inset transition-colors'

    if (!program) {
        return (
            <div className="bg-surface-card rounded-panel border border-k-border-subtle p-6">
                <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-k-text-tertiary">
                    Programa atual
                </span>

                <div className="text-center py-5">
                    <p className="text-sm text-k-text-tertiary mb-4">Nenhum programa ativo no momento.</p>
                    <div className="flex items-center justify-center gap-2">
                        <button
                            onClick={onCreateProgram}
                            className="px-3.5 py-2 text-xs font-semibold bg-primary hover:opacity-90 text-primary-foreground rounded-control transition-opacity"
                        >
                            + Criar Novo
                        </button>
                        <button
                            onClick={onAssignProgram}
                            className="px-3.5 py-2 text-xs font-medium text-k-text-secondary hover:text-k-text-primary hover:bg-surface-inset border border-k-border-primary rounded-control transition-colors"
                        >
                            Atribuir
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    const statusCfg = STATUS_DOT[program.status] || STATUS_DOT.active

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

    const workoutsPerWeek = (program.assigned_workouts ?? [])
        .reduce((sum, w) => sum + (w.scheduled_days?.length || 0), 0)

    // Grade da semana: a prescrição visível sem abrir o builder — força e
    // aeróbio lado a lado, com os dias de cada um (semana começa na segunda).
    const weekGridWorkouts = (program.assigned_workouts ?? [])
        .slice()
        .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
    const DAY_ABBR = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']
    const MONDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]
    const formatScheduledDays = (days: number[] | null | undefined) =>
        MONDAY_ORDER.filter((d) => days?.includes(d)).map((d) => DAY_ABBR[d]).join(' · ')

    return (
        <div className="space-y-6">
            {/* Main Program Card */}
            <div className="bg-surface-card rounded-panel border border-k-border-subtle">
                {/* Header */}
                <div className="px-6 pt-5 pb-4 border-b border-k-border-subtle">
                    <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                            <h2 className="text-lg font-bold text-k-text-primary tracking-tight truncate">{program.name}</h2>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-k-text-tertiary">
                                <span className="inline-flex items-center gap-1.5">
                                    <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                                    {statusCfg.label}
                                </span>
                                {(workoutsPerWeek > 0 || program.duration_weeks) && (
                                    <span className="font-mono text-[10.5px] tabular-nums">
                                        {workoutsPerWeek > 0 && `${workoutsPerWeek} treinos/sem`}
                                        {workoutsPerWeek > 0 && program.duration_weeks && ' · '}
                                        {program.duration_weeks && `${program.duration_weeks} semanas`}
                                    </span>
                                )}
                            </div>
                            {program.description && (
                                <p className="text-[12.5px] text-k-text-tertiary leading-relaxed max-w-md mt-1.5">{program.description}</p>
                            )}
                        </div>

                        {/* Action toolbar — Editar programa é a ação primária (violeta)
                            da tela; o resto é quieto. Overflow com ações de fim de ciclo. */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                            {program.status === 'expired' && onExtendProgram && (
                                <button
                                    onClick={onExtendProgram}
                                    className="px-3 py-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 rounded-control transition-colors border border-amber-500/30"
                                >
                                    Prorrogar
                                </button>
                            )}
                            {onViewReport && (
                                <button
                                    onClick={onViewReport}
                                    className="px-3 py-1.5 text-xs font-medium text-k-text-secondary hover:text-k-text-primary hover:bg-surface-inset rounded-control transition-colors border border-k-border-primary flex items-center gap-1.5"
                                >
                                    <FileText className="w-3 h-3" />
                                    Relatório
                                </button>
                            )}
                            <button
                                onClick={onEditProgram}
                                data-testid="toolbar-edit"
                                className="px-3.5 py-1.5 text-xs font-semibold text-primary-foreground bg-primary hover:opacity-90 rounded-control transition-opacity"
                            >
                                Editar programa
                            </button>
                            <div className="relative" ref={overflowMenuRef}>
                                <button
                                    onClick={() => setShowOverflowMenu((v) => !v)}
                                    className="h-7 w-7 flex items-center justify-center text-k-text-tertiary hover:text-k-text-primary hover:bg-surface-inset rounded-control transition-colors border border-k-border-primary"
                                    title="Mais ações"
                                    aria-haspopup="menu"
                                    aria-expanded={showOverflowMenu}
                                    aria-label="Mais ações"
                                >
                                    <MoreHorizontal className="w-3.5 h-3.5" />
                                </button>

                                {showOverflowMenu && (
                                    <div
                                        role="menu"
                                        className="absolute right-0 top-full mt-1 w-56 rounded-panel border border-k-border-primary bg-surface-card shadow-lg z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                                    >
                                        {(program.status === 'active' || program.status === 'expired') && onCompleteProgram && (
                                            <button
                                                role="menuitem"
                                                onClick={() => {
                                                    setShowOverflowMenu(false)
                                                    onCompleteProgram()
                                                }}
                                                className={menuItem}
                                            >
                                                <CheckCircle className="w-3.5 h-3.5 text-k-text-tertiary" />
                                                Concluir programa
                                            </button>
                                        )}
                                        {onAssignProgram && (
                                            <button
                                                role="menuitem"
                                                onClick={() => {
                                                    setShowOverflowMenu(false)
                                                    onAssignProgram()
                                                }}
                                                className={menuItem}
                                            >
                                                <ArrowLeftRight className="w-3.5 h-3.5 text-k-text-tertiary" />
                                                Trocar programa
                                            </button>
                                        )}
                                        {(onCreateScheduled || onAssignScheduled) && (
                                            <div className="h-px bg-k-border-subtle mx-2" />
                                        )}
                                        {onCreateScheduled && (
                                            <button
                                                role="menuitem"
                                                onClick={() => {
                                                    setShowOverflowMenu(false)
                                                    onCreateScheduled()
                                                }}
                                                className={menuItem}
                                            >
                                                <Plus className="w-3.5 h-3.5 text-k-text-tertiary" />
                                                Criar próximo programa
                                            </button>
                                        )}
                                        {onAssignScheduled && (
                                            <button
                                                role="menuitem"
                                                onClick={() => {
                                                    setShowOverflowMenu(false)
                                                    onAssignScheduled()
                                                }}
                                                className={menuItem}
                                            >
                                                <CalendarPlus className="w-3.5 h-3.5 text-k-text-tertiary" />
                                                Atribuir próximo programa
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="px-6 pt-4 pb-5">
                    {/* Progress — barra fina em tinta, datas mono nas pontas */}
                    {program.duration_weeks && (
                        <div className="mb-6">
                            <p className="text-[12.5px] font-medium text-k-text-secondary mb-2 tabular-nums">
                                {isExpired ? (
                                    <>
                                        Programa encerrado
                                        {program.expires_at && (
                                            <span className="text-amber-600 dark:text-amber-400 ml-1">
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
                                                ? <span className="text-emerald-600 dark:text-emerald-400 ml-1">— última semana</span>
                                                : <span className="text-k-text-quaternary ml-1">— faltam {remainingWeeks} semana{remainingWeeks > 1 ? 's' : ''}</span>
                                        })()}
                                    </>
                                )}
                            </p>
                            <div className="h-1 bg-surface-inset rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-k-text-secondary rounded-full transition-all duration-700 ease-out"
                                    style={{ width: `${progressPercent}%` }}
                                />
                            </div>
                            {program.started_at && (
                                <div className="mt-1.5 flex items-center justify-between font-mono text-[10px] text-k-text-quaternary tabular-nums">
                                    <span>{new Date(program.started_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: TIMEZONE })}</span>
                                    <span>{getProgramEndDate(program.started_at, program.duration_weeks!).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: TIMEZONE })}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Os hero-stats (treinos totais / esta semana / último treino)
                        saíram daqui — viviam duplicados com o header e agora moram
                        na StudentKpiRuler, no topo da página. */}

                    {/* Treinos da semana — a prescrição inteira (força + aeróbio)
                        visível sem abrir o builder. */}
                    {weekGridWorkouts.length > 0 && (
                        <div className="mb-6">
                            <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-k-text-tertiary">
                                Treinos da semana
                            </span>
                            <div className="mt-2 rounded-control border border-k-border-subtle divide-y divide-k-border-subtle overflow-hidden">
                                {weekGridWorkouts.map((w) => (
                                    <div key={w.id} className="flex items-center gap-2.5 bg-surface-card px-3 py-2">
                                        {w.workout_type === 'cardio' ? (
                                            <Zap className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--accent-cardio)' }} aria-label="Treino aeróbio" />
                                        ) : (
                                            <Dumbbell className="w-3.5 h-3.5 shrink-0 text-k-text-tertiary" aria-label="Treino de força" />
                                        )}
                                        <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-k-text-secondary">
                                            {w.name}
                                        </span>
                                        <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] tabular-nums text-k-text-quaternary">
                                            {formatScheduledDays(w.scheduled_days) || 'Sem agenda'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Onda 2 — Faixa de tendência de adesão (12 semanas). */}
                    {program.started_at && weeklyAdherence.length >= 2 && (
                        <AdherenceTrendStrip
                            weeklyAdherence={weeklyAdherence}
                            onWeekClick={(w) => setCalendarStartWeek(w)}
                        />
                    )}

                    {/* Navigable Calendar */}
                    {program.assigned_workouts && program.started_at && (() => {
                        // Conversão da semana clicada no sparkline pra Date que o
                        // calendário usa de anchor. weeklyAdherence vem com `week`
                        // 1-indexed, então subtraímos 1 ao calcular o offset.
                        const startedAt = program.started_at
                        const weekNum =
                            typeof calendarStartWeek === 'number'
                                ? calendarStartWeek
                                : typeof calendarStartWeek === 'string'
                                    ? Number.parseInt(calendarStartWeek, 10)
                                    : NaN
                        const initialWeekStart = Number.isFinite(weekNum) && weekNum > 0
                            ? addWeeks(new Date(startedAt), weekNum - 1)
                            : undefined
                        return (
                            <div data-onboarding="student-calendar">
                                <ProgramCalendar
                                    programId={program.id}
                                    programStartedAt={startedAt}
                                    programDurationWeeks={program.duration_weeks}
                                    scheduledWorkouts={program.assigned_workouts}
                                    initialSessions={calendarInitialSessions}
                                    studentId={studentId}
                                    initialWeekStart={initialWeekStart}
                                    onDayClick={(day) => {
                                        if ((day.status === 'done' || day.status === 'partial') && day.completedSessions.length > 0) {
                                            handleSessionClick(day.completedSessions[0].id)
                                        }
                                    }}
                                />
                            </div>
                        )
                    })()}

                    {/* Recent Sessions — linhas flat com divisores hairline */}
                    <div className="mt-6">
                        <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-k-text-tertiary">
                            Últimas sessões
                        </span>

                        {recentSessions.length === 0 ? (
                            <p className="text-center py-8 text-k-text-quaternary text-xs">
                                Nenhuma sessão registrada neste programa ainda.
                            </p>
                        ) : (
                            <div className="mt-2">
                                {recentSessions.map((session) => {
                                    const isExpanded = expandedSessionId === session.id
                                    const details = sessionDetails[session.id]
                                    const isLoading = loadingSession[session.id]
                                    const change = tonnageMap[session.id]?.percentChange
                                    return (
                                        <div key={session.id} className="border-b border-k-border-subtle last:border-b-0">
                                            <button
                                                onClick={() => handleSessionExpand(session.id)}
                                                className="w-full py-2.5 flex items-center justify-between gap-4 text-left group"
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[13px] font-semibold text-k-text-secondary group-hover:text-k-text-primary transition-colors truncate">
                                                        {session.assigned_workouts?.name}
                                                    </p>
                                                    {!isExpanded && session.feedback && (
                                                        <p className="text-[11.5px] text-k-text-tertiary italic truncate mt-0.5">
                                                            &ldquo;{session.feedback}&rdquo;
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 flex-shrink-0 font-mono text-[10.5px] text-k-text-tertiary tabular-nums">
                                                    <span>
                                                        {new Date(session.completed_at).toLocaleDateString('pt-BR', {
                                                            weekday: 'short',
                                                            day: 'numeric',
                                                            month: 'short',
                                                            timeZone: TIMEZONE,
                                                        }).replace(/\./g, '')}
                                                    </span>
                                                    {session.duration_seconds > 0 && (
                                                        <span>{formatDuration(session.duration_seconds)}</span>
                                                    )}
                                                    {session.rpe != null && (
                                                        <span className={rpeClass(session.rpe)}>PSE {session.rpe}</span>
                                                    )}
                                                    {change != null && (
                                                        <span className={
                                                            change > 0 ? 'text-emerald-600 dark:text-emerald-400' :
                                                            change < 0 ? 'text-red-600 dark:text-red-400' : 'text-k-text-quaternary'
                                                        }>
                                                            {change > 0 ? '+' : ''}{change.toFixed(1)}%
                                                        </span>
                                                    )}
                                                    <ChevronDown className={`w-3.5 h-3.5 text-k-text-quaternary group-hover:text-k-text-tertiary transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                                </div>
                                            </button>

                                            {/* Expanded Exercise Details */}
                                            {isExpanded && (
                                                <div className="mb-3 rounded-control border border-k-border-subtle bg-surface-primary px-4 py-3 space-y-2">
                                                    {isLoading ? (
                                                        <div className="text-center py-4 text-k-text-quaternary text-xs font-medium animate-pulse">
                                                            Carregando detalhes...
                                                        </div>
                                                    ) : details?.items?.length > 0 ? (
                                                        <>
                                                            {/* Summary stats */}
                                                            <div className="flex items-center gap-4 font-mono text-[10px] text-k-text-quaternary pb-2 border-b border-k-border-subtle tabular-nums">
                                                                {details.stats?.durationSeconds > 0 && (
                                                                    <span>{formatDuration(details.stats.durationSeconds)}</span>
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
                                                                <div className="flex items-start gap-2 pt-2 border-t border-k-border-subtle">
                                                                    <MessageSquare className="w-3.5 h-3.5 shrink-0 text-k-text-quaternary mt-0.5" />
                                                                    <span className="text-xs text-k-text-secondary italic">&ldquo;{session.feedback}&rdquo;</span>
                                                                </div>
                                                            )}

                                                            {/* Open full detail modal */}
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleSessionClick(session.id) }}
                                                                className="w-full pt-2 border-t border-k-border-subtle flex items-center justify-center gap-1.5 text-[11px] font-semibold text-k-text-tertiary hover:text-k-text-primary transition-colors"
                                                            >
                                                                Ver detalhes
                                                                <ArrowUpRight size={12} />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <p className="text-xs text-k-text-quaternary py-2">Nenhum item registrado.</p>
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
            </div>

            <SessionDetailSheet
                isOpen={isSheetOpen}
                onClose={handleSheetClose}
                sessionId={selectedSessionId}
            />
        </div>
    )
}
