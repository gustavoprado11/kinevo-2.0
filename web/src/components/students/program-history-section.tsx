'use client'

import { useState } from 'react'
import { Calendar, Clock, FileText, ChevronRight } from 'lucide-react'
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

// PSE como texto — cor só quando alerta (padrão do redesign).
function rpeTextClass(rpe: number): string {
    if (rpe >= 9) return 'text-red-600 dark:text-red-400'
    if (rpe >= 8) return 'text-amber-600 dark:text-amber-400'
    return 'text-k-text-tertiary'
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
        <div className="bg-surface-card rounded-panel border border-k-border-subtle p-5">
            <div className="mb-3">
                <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-k-text-tertiary">
                    Histórico de programas
                </span>
            </div>

            {programs.length === 0 ? (
                <p className="text-[11.5px] text-k-text-quaternary py-2">
                    Nenhum programa concluído ainda.
                </p>
            ) : visiblePrograms.length === 0 ? (
                <div className="py-2">
                    <p className="text-[11.5px] text-k-text-quaternary mb-2">
                        Nenhum programa concluído ainda.
                    </p>
                    {replacedCount > 0 && (
                        <button
                            type="button"
                            onClick={() => setShowReplaced(true)}
                            className="text-[11px] font-semibold text-primary hover:opacity-80 transition-opacity"
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
                                    className={`flex-shrink-0 w-[210px] text-left rounded-panel p-3.5 border transition-colors ${
                                        isSelected
                                            ? 'bg-surface-inset border-k-border-primary'
                                            : 'bg-surface-primary border-k-border-subtle hover:border-k-border-primary'
                                    }`}
                                >
                                    {/* Status — ponto + texto */}
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-k-text-tertiary">
                                            <span className={`w-1.5 h-1.5 rounded-full ${isReplaced ? 'bg-k-text-quaternary' : 'bg-emerald-500'}`} aria-hidden="true" />
                                            {isReplaced ? 'Substituído' : 'Concluído'}
                                        </span>
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
                                                className="p-1 -m-1 text-k-text-quaternary hover:text-k-text-primary transition-colors cursor-pointer"
                                                title="Ver relatório"
                                                aria-label="Ver relatório"
                                            >
                                                <FileText className="w-3.5 h-3.5" />
                                            </span>
                                        )}
                                    </div>

                                    {/* Título — uma linha truncada pra preservar largura */}
                                    <h4 className="font-semibold text-k-text-primary text-[13px] tracking-tight truncate mb-1.5">
                                        {program.name}
                                    </h4>

                                    {/* Datas resumidas */}
                                    <div className="flex items-center gap-1.5 font-mono text-[10px] text-k-text-quaternary mb-1.5 tabular-nums">
                                        <Calendar className="w-3 h-3 opacity-60" aria-hidden="true" />
                                        <span>
                                            {formatShortBr(program.started_at)} – {formatShortBr(program.completed_at)}
                                        </span>
                                    </div>

                                    {/* Adesão calculada — só aparece quando temos workouts e duration */}
                                    {adherence != null && !isReplaced && (
                                        <div className="flex items-center justify-between font-mono text-[10px] text-k-text-quaternary tabular-nums">
                                            <span>Adesão</span>
                                            <span
                                                className={
                                                    adherence >= 80
                                                        ? 'text-emerald-600 dark:text-emerald-400'
                                                        : adherence >= 50
                                                            ? 'text-amber-600 dark:text-amber-400'
                                                            : 'text-red-600 dark:text-red-400'
                                                }
                                            >
                                                {adherence}%
                                            </span>
                                        </div>
                                    )}

                                    {/* Sessions count fallback */}
                                    {adherence == null && (
                                        <div className="flex items-center gap-1.5 font-mono text-[10px] text-k-text-quaternary tabular-nums">
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
                        <div className="pt-2">
                            <button
                                type="button"
                                onClick={() => setShowReplaced((v) => !v)}
                                className="text-[11px] font-semibold text-primary hover:opacity-80 transition-opacity"
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
                            className="mt-5 pt-4 border-t border-k-border-subtle space-y-4"
                            data-testid="history-drilldown"
                        >
                            {/* Stats do programa */}
                            <div>
                                <div className="flex items-center justify-between mb-2.5">
                                    <h4 className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-k-text-tertiary truncate">
                                        {selectedProgram.name}
                                    </h4>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedProgramId(null)}
                                        className="text-[10px] font-medium text-k-text-quaternary hover:text-k-text-secondary transition-colors"
                                    >
                                        Fechar
                                    </button>
                                </div>
                                {/* Mini-régua: painel único com divisores hairline */}
                                <div className="grid grid-cols-3 gap-px rounded-control border border-k-border-subtle bg-k-border-subtle overflow-hidden">
                                    <div className="bg-surface-card px-3 py-2.5">
                                        <p className="text-lg font-bold text-k-text-primary tabular-nums leading-tight">
                                            {selectedProgram.workouts_count}
                                        </p>
                                        <p className="font-mono text-[9px] font-medium uppercase tracking-[0.08em] text-k-text-quaternary">Treinos</p>
                                    </div>
                                    <div className="bg-surface-card px-3 py-2.5">
                                        <p className="text-lg font-bold text-k-text-primary tabular-nums leading-tight">
                                            {selectedProgram.sessions_count}
                                        </p>
                                        <p className="font-mono text-[9px] font-medium uppercase tracking-[0.08em] text-k-text-quaternary">Sessões</p>
                                    </div>
                                    <div className="bg-surface-card px-3 py-2.5">
                                        <p className="text-lg font-bold text-k-text-primary tabular-nums leading-tight">
                                            {selectedProgram.duration_weeks || '-'}
                                        </p>
                                        <p className="font-mono text-[9px] font-medium uppercase tracking-[0.08em] text-k-text-quaternary">Semanas</p>
                                    </div>
                                </div>
                            </div>

                            {/* Sessions List */}
                            <div>
                                <h4 className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-k-text-tertiary mb-1">
                                    Sessões realizadas
                                </h4>
                                {loadingSessions[selectedProgram.id] ? (
                                    <div className="text-center py-6 text-k-text-quaternary text-xs font-medium animate-pulse">
                                        Carregando sessões...
                                    </div>
                                ) : (programSessions[selectedProgram.id]?.length ?? 0) > 0 ? (
                                    <div>
                                        {programSessions[selectedProgram.id]!.map((session: any) => (
                                            <button
                                                key={session.id}
                                                onClick={() => handleSessionClick(session.id)}
                                                className="w-full py-2 flex items-center justify-between gap-3 border-b border-k-border-subtle last:border-b-0 text-left group/session"
                                            >
                                                <span className="text-[12.5px] font-medium text-k-text-secondary group-hover/session:text-k-text-primary transition-colors truncate">
                                                    {session.assigned_workouts?.name || 'Treino'}
                                                </span>
                                                <span className="flex items-center gap-2.5 font-mono text-[10px] text-k-text-quaternary shrink-0 tabular-nums">
                                                    <span>
                                                        {new Date(session.completed_at).toLocaleDateString('pt-BR', {
                                                            day: '2-digit',
                                                            month: 'short',
                                                            timeZone: TIMEZONE,
                                                        }).replace(/\./g, '')}
                                                    </span>
                                                    {session.rpe != null && (
                                                        <span className={rpeTextClass(session.rpe)}>PSE {session.rpe}</span>
                                                    )}
                                                    <ChevronRight className="w-3.5 h-3.5 text-k-text-quaternary group-hover/session:text-k-text-tertiary transition-colors" />
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-k-text-quaternary py-2">
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
