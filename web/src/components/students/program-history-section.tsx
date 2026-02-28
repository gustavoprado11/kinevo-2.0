'use client'

import { useState } from 'react'
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
}

export function ProgramHistorySection({ programs }: ProgramHistorySectionProps) {
    const [expandedProgramId, setExpandedProgramId] = useState<string | null>(null)
    const [programSessions, setProgramSessions] = useState<Record<string, any[]>>({})
    const [loadingSessions, setLoadingSessions] = useState<Record<string, boolean>>({})

    // Sheet State
    const [isSheetOpen, setIsSheetOpen] = useState(false)
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)

    const handleSessionClick = (sessionId: string) => {
        setSelectedSessionId(sessionId)
        setIsSheetOpen(true)
    }

    const handleSheetClose = () => {
        setIsSheetOpen(false)
        setTimeout(() => setSelectedSessionId(null), 300) // Clear after animation
    }
    const handleExpand = async (programId: string) => {
        if (expandedProgramId === programId) {
            setExpandedProgramId(null)
            return
        }

        setExpandedProgramId(programId)

        if (!programSessions[programId]) {
            setLoadingSessions(prev => ({ ...prev, [programId]: true }))
            try {
                // Dynamic import to avoid server component issues if any, or just standard import
                const { getProgramSessions } = await import('@/app/students/[id]/actions/get-program-sessions')
                const result = await getProgramSessions(programId)
                if (result.success && result.data) {
                    const sessions = result.data;
                    setProgramSessions(prev => ({ ...prev, [programId]: sessions }))
                }
            } catch (error) {
                console.error('Failed to load sessions', error)
            } finally {
                setLoadingSessions(prev => ({ ...prev, [programId]: false }))
            }
        }
    }

    return (
        <div className="bg-glass-bg backdrop-blur-md rounded-2xl border border-k-border-primary p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    Histórico
                    <span className="px-2 py-0.5 rounded bg-glass-bg text-[10px] text-k-text-tertiary font-bold uppercase tracking-widest border border-k-border-subtle">
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
            ) : (
                <div className="relative space-y-6">
                    {/* Vertical Timeline Line */}
                    <div className="absolute left-6 top-6 bottom-6 w-px bg-k-border-subtle" />

                    {programs.map((program) => (
                        <div key={program.id} className="relative pl-12 group">
                            {/* Timeline Dot */}
                            <div className="absolute left-4 top-2 w-4 h-4 rounded-full border-2 border-surface-primary bg-glass-bg-active z-10 group-hover:bg-violet-500 transition-colors" />

                            <div className="bg-glass-bg rounded-2xl p-5 border border-k-border-subtle hover:border-violet-500/30 transition-all overflow-hidden relative">
                                <button
                                    onClick={() => handleExpand(program.id)}
                                    className="w-full text-left relative z-10"
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-black text-white text-lg tracking-tight group-hover:text-violet-300 transition-colors">
                                            {program.name}
                                        </h4>
                                        <div className="flex items-center gap-3">
                                            {program.sessions_count === 0 ? (
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-k-text-quaternary bg-glass-bg px-2 py-0.5 rounded border border-k-border-subtle" title={program.started_at && program.completed_at ? `Ativo por ${Math.max(1, Math.ceil((new Date(program.completed_at).getTime() - new Date(program.started_at).getTime()) / (1000 * 60 * 60 * 24)))} dia(s)` : undefined}>
                                                    Substituído{program.started_at && program.completed_at && (() => {
                                                        const days = Math.max(1, Math.ceil((new Date(program.completed_at).getTime() - new Date(program.started_at).getTime()) / (1000 * 60 * 60 * 24)))
                                                        return ` · ${days}d`
                                                    })()}
                                                </span>
                                            ) : (
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                                    Concluído
                                                </span>
                                            )}
                                            <svg
                                                className={`w-4 h-4 text-k-text-quaternary transition-transform ${expandedProgramId === program.id ? 'rotate-180' : ''}`}
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-k-text-quaternary">
                                        <div className="flex items-center gap-1.5">
                                            <svg className="w-3.5 h-3.5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            Finalizado em {program.completed_at ? new Date(program.completed_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '-'}
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <svg className="w-3.5 h-3.5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            {program.sessions_count} sessões
                                        </div>
                                    </div>
                                </button>

                                {/* Expanded Details */}
                                {expandedProgramId === program.id && (
                                    <div className="mt-6 pt-6 border-t border-k-border-subtle space-y-6 relative z-10">
                                        {/* Program Stats */}
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="bg-glass-bg rounded-xl p-4 text-center border border-k-border-subtle">
                                                <p className="text-2xl font-black text-white tracking-tighter">{program.workouts_count}</p>
                                                <p className="text-[10px] font-bold uppercase tracking-widest text-k-text-quaternary">Treinos</p>
                                            </div>
                                            <div className="bg-glass-bg rounded-xl p-4 text-center border border-k-border-subtle">
                                                <p className="text-2xl font-black text-white tracking-tighter">{program.sessions_count}</p>
                                                <p className="text-[10px] font-bold uppercase tracking-widest text-k-text-quaternary">Sessões</p>
                                            </div>
                                            <div className="bg-glass-bg rounded-xl p-4 text-center border border-k-border-subtle">
                                                <p className="text-2xl font-black text-white tracking-tighter">{program.duration_weeks || '-'}</p>
                                                <p className="text-[10px] font-bold uppercase tracking-widest text-k-text-quaternary">Semanas</p>
                                            </div>
                                        </div>

                                        {/* Sessions List */}
                                        <div>
                                            <h4 className="text-[10px] font-black text-k-text-tertiary uppercase tracking-[0.2em] mb-4">Sessões Realizadas</h4>
                                            {loadingSessions[program.id] ? (
                                                <div className="text-center py-6 text-k-text-quaternary text-xs font-medium animate-pulse">Carregando sessões...</div>
                                            ) : programSessions[program.id]?.length > 0 ? (
                                                <div className="space-y-2">
                                                    {programSessions[program.id]!.map((session: any) => (
                                                        <button
                                                            key={session.id}
                                                            onClick={() => handleSessionClick(session.id)}
                                                            className="w-full bg-glass-bg hover:bg-glass-bg-active rounded-xl p-4 flex items-center justify-between border border-k-border-subtle transition-all text-left group/session"
                                                        >
                                                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="flex items-center gap-2">
                                                                        <p className="text-sm font-bold text-k-text-secondary group-hover/session:text-k-text-primary transition-colors truncate">{session.assigned_workouts?.name || 'Treino'}</p>
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
                                                                    </div>
                                                                    <p className="text-[10px] font-medium text-k-text-quaternary mt-0.5">
                                                                        {new Date(session.completed_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <svg className="w-4 h-4 text-k-border-subtle group-hover/session:text-k-text-tertiary transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                            </svg>
                                                        </button>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-k-text-quaternary italic font-medium">Nenhuma sessão registrada.</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-br from-violet-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                            </div>
                        </div>
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
