'use client'

import { useState } from 'react'
import { Calendar, Clock, FileText } from 'lucide-react'
import { SessionDetailSheet } from './session-detail-sheet'

interface CompletedProgram {
    id: string
    name: string
    description: string | null
    started_at: string | null
    completed_at: string | null
    duration_weeks: number | null
    workouts_count: number
    sessions_count: number
}

interface ProgramHistorySectionProps {
    programs: CompletedProgram[]
    onViewReport?: (programId: string) => void
}

const TIMEZONE = 'America/Sao_Paulo'

function formatShortBr(value: string | null): string {
    if (!value) return '—'
    return new Date(value).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        timeZone: TIMEZONE,
    })
}

/**
 * Adesão = sessões realizadas / sessões previstas (workouts × duration_weeks).
 * Retorna null quando os números não permitem cálculo confiável.
 */
function computeAdherence(p: CompletedProgram): number | null {
    if (!p.workouts_count || !p.duration_weeks) return null
    const expected = p.workouts_count * p.duration_weeks
    if (expected <= 0) return null
    return Math.round((p.sessions_count / expected) * 100)
}

export function ProgramHistorySection({ programs, onViewReport }: ProgramHistorySectionProps) {
    // Onda 2 — clicar num card seleciona; o painel único abaixo da timeline
    // horizontal renderiza as sessões do programa selecionado. Substituiu o
    // accordion inline da Onda 1, que não cabia em scroll horizontal.
    const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null)
    const [programSessions, setProgramSessions] = useState<Record<string, any[]>>({})
    const [loadingSessions, setLoadingSessions] = useState<Record<string, boolean>>({})
    const [showReplaced, setShowReplaced] = useState(false)

    const replacedCount = programs.filter((p) => p.sessions_count === 0).length
    const visiblePrograms = showReplaced
        ? programs
        : programs.filter((p) => p.sessions_count !== 0)

    // Sheet State (sessão individual aberta a partir do painel de drill-down)
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

    const handleSelect = async (programId: string) => {
        // Toggle: clicar no card já selecionado fecha o painel.
        if (selectedProgramId === programId) {
            setSelectedProgramId(null)
            return
        }
        setSelectedProgramId(programId)

        if (!programSessions[programId]) {
            setLoadingSessions((prev) => ({ ...prev, [programId]: true }))
            try {
                const { getProgramSessions } = await import(
                    '@/app/students/[id]/actions/get-program-sessions'
                )
                const result = await getProgramSessions(programId)
                if (result.success && result.data) {
                    setProgramSessions((prev) => ({ ...prev, [programId]: result.data! }))
                }
            } catch (error) {
                console.error('Failed to load sessions', error)
            } finally {
                setLoadingSessions((prev) => ({ ...prev, [programId]: false }))
            }
        }
    }

    const selectedProgram =
        selectedProgramId != null
            ? visiblePrograms.find((p) => p.id === selectedProgramId) ?? null
            : null

    return (
        <div className="bg-white dark:bg-glass-bg backdrop-blur-md rounded-2xl border border-[#E5E5EA] dark:border-k-border-primary p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-[#1C1C1E] dark:text-white flex items-center gap-2">
                    Histórico
                    <span className="px-2 py-0.5 rounded bg-glass-bg text-[10px] text-k-text-tertiary font-bold border border-k-border-subtle">
                        Concluídos
                    </span>
                </h3>
            </div>

            {programs.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-k-border-primary rounded-2xl">
                    <p className="text-k-text-quaternary text-xs font-medium italic">
                        Nenhum programa concluído ainda.
                    </p>
                </div>
            ) : visiblePrograms.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-k-border-primary rounded-2xl">
                    <p className="text-k-text-quaternary text-xs font-medium italic mb-3">
                        Nenhum programa concluído ainda.
                    </p>
                    {replacedCount > 0 && (
                        <button
                            type="button"
                            onClick={() => setShowReplaced(true)}
                            className="text-[11px] font-semibold text-violet-500 hover:text-violet-400 transition-colors"
                        >
                            Mostrar {replacedCount} substituído{replacedCount === 1 ? '' : 's'}
                        </button>
                    )}
                </div>
            ) : (
                <>
                    {/* Onda 2 — Timeline horizontal com scroll. Cards têm largura fixa
                        e altura uniforme; ordem cronológica decrescente é definida pelo
                        parent (page.tsx). Sem destaque visual para "mais recente".
                        Mini bar chart de volume por semana virou follow-up
                        (getProgramVolumeByWeek action). */}
                    <div
                        className="flex flex-row gap-3 overflow-x-auto pb-2 scrollbar-thin"
                        data-testid="history-horizontal-scroll"
                    >
                        {visiblePrograms.map((program) => {
                            const isSelected = selectedProgramId === program.id
                            const adherence = computeAdherence(program)
                            const isReplaced = program.sessions_count === 0

                            return (
                                <button
                                    key={program.id}
                                    type="button"
                                    onClick={() => handleSelect(program.id)}
                                    aria-pressed={isSelected}
                                    className={`flex-shrink-0 w-[220px] text-left rounded-2xl p-4 border transition-all relative overflow-hidden ${
                                        isSelected
                                            ? 'bg-violet-50 dark:bg-violet-500/10 border-violet-300 dark:border-violet-500/40 shadow-sm'
                                            : 'bg-glass-bg border-k-border-subtle hover:border-violet-500/30'
                                    }`}
                                >
                                    {/* Status badge no topo */}
                                    <div className="flex items-center justify-between mb-2">
                                        {isReplaced ? (
                                            <span className="text-[10px] font-bold text-k-text-quaternary bg-glass-bg px-2 py-0.5 rounded border border-k-border-subtle">
                                                Substituído
                                            </span>
                                        ) : (
                                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                                Concluído
                                            </span>
                                        )}
                                        {program.sessions_count > 0 && onViewReport && (
                                            <span
                                                role="button"
                                                tabIndex={0}
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    onViewReport(program.id)
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.stopPropagation()
                                                        onViewReport(program.id)
                                                    }
                                                }}
                                                className="p-1 -m-1 text-k-text-quaternary hover:text-violet-400 transition-colors cursor-pointer"
                                                title="Ver relatório"
                                                aria-label="Ver relatório"
                                            >
                                                <FileText className="w-3.5 h-3.5" />
                                            </span>
                                        )}
                                    </div>

                                    {/* Título — uma linha truncada pra preservar largura */}
                                    <h4 className="font-bold text-[#1C1C1E] dark:text-white text-sm tracking-tight truncate mb-2">
                                        {program.name}
                                    </h4>

                                    {/* Datas resumidas */}
                                    <div className="flex items-center gap-1.5 text-[10px] font-medium text-k-text-quaternary mb-2">
                                        <Calendar className="w-3 h-3 opacity-60" aria-hidden="true" />
                                        <span>
                                            {formatShortBr(program.started_at)} – {formatShortBr(program.completed_at)}
                                        </span>
                                    </div>

                                    {/* Adesão calculada — só aparece quando temos workouts e duration */}
                                    {adherence != null && !isReplaced && (
                                        <div className="flex items-center justify-between text-[10px] font-bold text-k-text-quaternary">
                                            <span>Adesão</span>
                                            <span
                                                className={
                                                    adherence >= 80
                                                        ? 'text-emerald-500'
                                                        : adherence >= 50
                                                            ? 'text-amber-500'
                                                            : 'text-red-500'
                                                }
                                            >
                                                {adherence}%
                                            </span>
                                        </div>
                                    )}

                                    {/* Sessions count fallback */}
                                    {adherence == null && (
                                        <div className="flex items-center gap-1.5 text-[10px] font-medium text-k-text-quaternary">
                                            <Clock className="w-3 h-3 opacity-60" aria-hidden="true" />
                                            <span>{program.sessions_count} sessões</span>
                                        </div>
                                    )}
                                </button>
                            )
                        })}
                    </div>

                    {/* Toggle de substituídos */}
                    {replacedCount > 0 && (
                        <div className="pt-3">
                            <button
                                type="button"
                                onClick={() => setShowReplaced((v) => !v)}
                                className="text-[11px] font-semibold text-violet-500 hover:text-violet-400 transition-colors"
                            >
                                {showReplaced
                                    ? 'Ocultar substituídos'
                                    : `Mostrar ${replacedCount} substituído${replacedCount === 1 ? '' : 's'}`}
                            </button>
                        </div>
                    )}

                    {/* Painel único de drill-down — renderiza as sessões do programa
                        selecionado abaixo da timeline horizontal. */}
                    {selectedProgram && (
                        <div
                            className="mt-6 pt-6 border-t border-k-border-subtle space-y-6"
                            data-testid="history-drilldown"
                        >
                            {/* Stats do programa */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-[11px] font-black text-k-text-tertiary uppercase tracking-wider">
                                        {selectedProgram.name}
                                    </h4>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedProgramId(null)}
                                        className="text-[10px] font-semibold text-k-text-quaternary hover:text-k-text-tertiary transition-colors"
                                    >
                                        Fechar
                                    </button>
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="bg-glass-bg rounded-xl p-4 text-center border border-k-border-subtle">
                                        <p className="text-2xl font-black text-[#1C1C1E] dark:text-white tracking-tighter">
                                            {selectedProgram.workouts_count}
                                        </p>
                                        <p className="text-[10px] font-bold text-k-text-quaternary">Treinos</p>
                                    </div>
                                    <div className="bg-glass-bg rounded-xl p-4 text-center border border-k-border-subtle">
                                        <p className="text-2xl font-black text-[#1C1C1E] dark:text-white tracking-tighter">
                                            {selectedProgram.sessions_count}
                                        </p>
                                        <p className="text-[10px] font-bold text-k-text-quaternary">Sessões</p>
                                    </div>
                                    <div className="bg-glass-bg rounded-xl p-4 text-center border border-k-border-subtle">
                                        <p className="text-2xl font-black text-[#1C1C1E] dark:text-white tracking-tighter">
                                            {selectedProgram.duration_weeks || '-'}
                                        </p>
                                        <p className="text-[10px] font-bold text-k-text-quaternary">Semanas</p>
                                    </div>
                                </div>
                            </div>

                            {/* Sessions List */}
                            <div>
                                <h4 className="text-[10px] font-black text-k-text-tertiary mb-4">
                                    Sessões Realizadas
                                </h4>
                                {loadingSessions[selectedProgram.id] ? (
                                    <div className="text-center py-6 text-k-text-quaternary text-xs font-medium animate-pulse">
                                        Carregando sessões...
                                    </div>
                                ) : (programSessions[selectedProgram.id]?.length ?? 0) > 0 ? (
                                    <div className="space-y-2">
                                        {programSessions[selectedProgram.id]!.map((session: any) => (
                                            <button
                                                key={session.id}
                                                onClick={() => handleSessionClick(session.id)}
                                                className="w-full bg-glass-bg hover:bg-glass-bg-active rounded-xl p-4 flex items-center justify-between border border-k-border-subtle transition-all text-left group/session"
                                            >
                                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-sm font-bold text-k-text-secondary group-hover/session:text-k-text-primary transition-colors truncate">
                                                                {session.assigned_workouts?.name || 'Treino'}
                                                            </p>
                                                            {session.rpe != null && (
                                                                <span
                                                                    className={`px-1.5 py-0.5 text-[10px] font-bold rounded shrink-0 ${
                                                                        session.rpe >= 10
                                                                            ? 'bg-red-500/10 text-red-400'
                                                                            : session.rpe >= 8
                                                                                ? 'bg-amber-500/10 text-amber-400'
                                                                                : session.rpe >= 6
                                                                                    ? 'bg-emerald-500/10 text-emerald-400'
                                                                                    : 'bg-white/5 text-k-text-tertiary'
                                                                    }`}
                                                                >
                                                                    PSE {session.rpe}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-[10px] font-medium text-k-text-quaternary mt-0.5">
                                                            {new Date(session.completed_at).toLocaleDateString('pt-BR', {
                                                                day: '2-digit',
                                                                month: 'short',
                                                                hour: '2-digit',
                                                                minute: '2-digit',
                                                                timeZone: TIMEZONE,
                                                            })}
                                                        </p>
                                                    </div>
                                                </div>
                                                <svg
                                                    className="w-4 h-4 text-k-border-subtle group-hover/session:text-k-text-tertiary transition-all"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M9 5l7 7-7 7"
                                                    />
                                                </svg>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-k-text-quaternary italic font-medium">
                                        Nenhuma sessão registrada.
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}

            <SessionDetailSheet
                isOpen={isSheetOpen}
                onClose={handleSheetClose}
                sessionId={selectedSessionId}
            />
        </div>
    )
}
