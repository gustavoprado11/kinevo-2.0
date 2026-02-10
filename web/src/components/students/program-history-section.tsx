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

    if (programs.length === 0) {
        return (
            <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-lg font-semibold text-white">Histórico de Programas</h2>
                        <p className="text-sm text-gray-400 mt-0.5">Programas concluídos</p>
                    </div>
                </div>

                <div className="border border-dashed border-gray-700 rounded-xl p-8 text-center">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-500/10 to-blue-500/10 flex items-center justify-center mx-auto mb-4">
                        <svg className="w-7 h-7 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                    </div>
                    <p className="text-gray-400 mb-2">Nenhum programa concluído</p>
                    <p className="text-sm text-gray-500 max-w-sm mx-auto">
                        Os programas finalizados aparecerão aqui para consulta do histórico completo.
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-lg font-semibold text-white">Histórico de Programas</h2>
                    <p className="text-sm text-gray-400 mt-0.5">{programs.length} programa(s) concluído(s)</p>
                </div>
            </div>

            <div className="space-y-3">
                {programs.map((program) => (
                    <div
                        key={program.id}
                        className="bg-gray-900/50 rounded-xl border border-gray-700/30 overflow-hidden"
                    >
                        {/* Header */}
                        <button
                            onClick={() => handleExpand(program.id)}
                            className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-800/50 transition-colors"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <div className="text-left">
                                    <h3 className="text-white font-medium">{program.name}</h3>
                                    <div className="flex items-center gap-3 text-sm text-gray-400 mt-0.5">
                                        {program.completed_at && (
                                            <span>
                                                Concluído em {new Date(program.completed_at).toLocaleDateString('pt-BR')}
                                            </span>
                                        )}
                                        <span>•</span>
                                        <span>{program.sessions_count} sessões</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                    Concluído
                                </span>
                                <svg
                                    className={`w-5 h-5 text-gray-400 transition-transform ${expandedProgramId === program.id ? 'rotate-180' : ''
                                        }`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </button>

                        {/* Expanded Details */}
                        {expandedProgramId === program.id && (
                            <div className="px-5 pb-4 border-t border-gray-700/30">
                                <div className="pt-4 space-y-6">
                                    {/* Program Stats */}
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                                            <p className="text-2xl font-bold text-white">{program.workouts_count}</p>
                                            <p className="text-xs text-gray-400">Treinos</p>
                                        </div>
                                        <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                                            <p className="text-2xl font-bold text-white">{program.sessions_count}</p>
                                            <p className="text-xs text-gray-400">Sessões</p>
                                        </div>
                                        <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                                            <p className="text-2xl font-bold text-white">{program.duration_weeks || '-'}</p>
                                            <p className="text-xs text-gray-400">Semanas</p>
                                        </div>
                                    </div>

                                    {/* Sessions List with Feedback */}
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-300 mb-3">Sessões Realizadas</h4>
                                        {loadingSessions[program.id] ? (
                                            <div className="text-center py-4 text-gray-500 text-sm">Carregando sessões...</div>
                                        ) : programSessions[program.id]?.length > 0 ? (
                                            <div className="space-y-2">
                                                {programSessions[program.id]!.map((session: any) => (
                                                    <div key={session.id} className="bg-gray-800/30 rounded-lg p-3 flex items-start justify-between border border-gray-700/30">
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="text-white font-medium text-sm">
                                                                    {session.assigned_workouts?.name || 'Treino'}
                                                                </span>
                                                                <span className="text-gray-500 text-xs">
                                                                    {new Date(session.completed_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            </div>
                                                            {session.feedback && (
                                                                <div className="flex gap-2 mt-1">
                                                                    <svg className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                                                                    </svg>
                                                                    <p className="text-sm text-gray-400 italic">"{session.feedback}"</p>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* RPE Badge */}
                                                        {session.rpe && (
                                                            <div className={`flex flex-col items-center px-2 py-1 rounded-lg border ${session.rpe <= 4 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                                                                session.rpe <= 7 ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500' :
                                                                    'bg-red-500/10 border-red-500/20 text-red-400'
                                                                }`}>
                                                                <span className="text-xs font-bold uppercase tracking-wider">RPE</span>
                                                                <span className="text-lg font-bold leading-none">{session.rpe}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-gray-500 italic">Nenhuma sessão registrada.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <SessionDetailSheet
                isOpen={isSheetOpen}
                onClose={handleSheetClose}
                sessionId={selectedSessionId}
            />
        </div>
    )
}
