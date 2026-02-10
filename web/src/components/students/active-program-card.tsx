interface AssignedProgram {
    id: string
    name: string
    description: string | null
    status: 'active' | 'completed' | 'paused'
    duration_weeks: number | null
    current_week: number | null
    started_at: string | null
    created_at: string
}

interface ActiveProgramCardProps {
    program: AssignedProgram | null
    onAssignProgram?: () => void
    onEditProgram?: () => void
    onCompleteProgram?: () => void
    onCreateProgram?: () => void
}

export function ActiveProgramCard({ program, onAssignProgram, onEditProgram, onCompleteProgram, onCreateProgram }: ActiveProgramCardProps) {
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
        }
        return config[status]
    }

    // No program assigned
    if (!program) {
        return (
            <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-lg font-semibold text-white">Programa Atual</h2>
                        <p className="text-sm text-gray-400 mt-0.5">Programa de treino atribuído</p>
                    </div>
                </div>

                <div className="text-center py-8">
                    <div className="w-16 h-16 rounded-full bg-gray-700/50 flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                    </div>
                    <p className="text-gray-400 mb-1">Nenhum programa atribuído</p>
                    <p className="text-gray-500 text-sm mb-6">Crie um programa personalizado ou atribua um existente</p>
                    <div className="flex items-center justify-center gap-3">
                        <button
                            onClick={onCreateProgram}
                            className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white text-sm font-medium rounded-lg transition-all shadow-lg shadow-violet-500/20 inline-flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Criar Programa
                        </button>
                        <button
                            onClick={onAssignProgram}
                            className="px-5 py-2.5 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-all inline-flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                            </svg>
                            Atribuir Existente
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
        <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-lg font-semibold text-white">Programa Atual</h2>
                    <p className="text-sm text-gray-400 mt-0.5">Programa de treino atribuído</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onEditProgram}
                        className="px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg transition-colors flex items-center gap-1.5"
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

            {/* Program Info */}
            <div className="bg-gray-900/50 rounded-xl border border-gray-700/30 p-5">
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-semibold text-white mb-1">{program.name}</h3>
                        {program.description && (
                            <p className="text-sm text-gray-400">{program.description}</p>
                        )}
                    </div>
                    <span className={`px-2.5 py-1 text-xs font-medium rounded-full border flex items-center gap-1.5 ${statusConfig.classes}`}>
                        {statusConfig.icon}
                        {statusConfig.label}
                    </span>
                </div>

                {/* Progress */}
                {program.duration_weeks && (
                    <div className="mb-4">
                        <div className="flex items-center justify-between text-sm mb-2">
                            <span className="text-gray-400">Progresso</span>
                            <span className="text-white font-medium">
                                Semana {program.current_week || 1} de {program.duration_weeks}
                            </span>
                        </div>
                        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-violet-500 to-blue-500 rounded-full transition-all"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Meta info */}
                <div className="flex items-center gap-6 text-sm">
                    {program.started_at && (
                        <div className="flex items-center gap-2 text-gray-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span>Início: {new Date(program.started_at).toLocaleDateString('pt-BR')}</span>
                        </div>
                    )}
                    {program.duration_weeks && (
                        <div className="flex items-center gap-2 text-gray-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>{program.duration_weeks} semanas</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
