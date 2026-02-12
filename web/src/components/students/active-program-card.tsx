import { Button } from '@/components/ui/button'
import { Play, CheckCircle2, PauseCircle, Plus, RefreshCw, Edit2, Calendar, Clock, Layout } from 'lucide-react'

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
                icon: <Play className="w-3.5 h-3.5" />,
            },
            completed: {
                label: 'Concluído',
                classes: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
                icon: <CheckCircle2 className="w-3.5 h-3.5" />,
            },
            paused: {
                label: 'Pausado',
                classes: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                icon: <PauseCircle className="w-3.5 h-3.5" />,
            },
        }
        return config[status]
    }

    // No program assigned
    if (!program) {
        return (
            <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            <Layout className="w-5 h-5 text-primary" />
                            Programa Atual
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Nenhum programa de treino atribuído no momento</p>
                    </div>
                </div>

                <div className="text-center py-10 bg-slate-50/50 dark:bg-slate-950/50 rounded-2xl border-2 border-dashed border-slate-100 dark:border-slate-800">
                    <div className="w-16 h-16 rounded-full bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800 flex items-center justify-center mx-auto mb-4">
                        <Plus className="w-8 h-8 text-slate-300 dark:text-slate-700" />
                    </div>
                    <p className="text-slate-900 dark:text-slate-100 font-bold mb-6">Comece agora</p>
                    <div className="flex items-center justify-center gap-3">
                        <Button
                            onClick={onCreateProgram}
                            className="gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            Criar Programa
                        </Button>
                        <Button
                            variant="outline"
                            onClick={onAssignProgram}
                            className="gap-2"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Atribuir Existente
                        </Button>
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
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-border dark:border-slate-800 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <Layout className="w-5 h-5 text-primary" />
                        Programa Atual
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Gestão do programa de treino do aluno</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onEditProgram}
                        className="text-slate-500 hover:text-slate-900 gap-1.5"
                    >
                        <Edit2 className="w-4 h-4" />
                        Editar
                    </Button>
                    {program.status === 'active' && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onCompleteProgram}
                            className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 gap-1.5"
                        >
                            <CheckCircle2 className="w-4 h-4" />
                            Concluir
                        </Button>
                    )}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onAssignProgram}
                        className="text-primary hover:text-primary hover:bg-primary/5 gap-1.5"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Trocar
                    </Button>
                </div>
            </div>

            {/* Program Info */}
            <div className="bg-slate-50/50 dark:bg-slate-950/50 rounded-2xl border border-slate-100 dark:border-slate-800 p-6">
                <div className="flex items-start justify-between mb-6">
                    <div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1.5">{program.name}</h3>
                        {program.description && (
                            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">{program.description}</p>
                        )}
                    </div>
                    <span className={`px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider rounded-full border flex items-center gap-1.5 ${statusConfig.classes}`}>
                        {statusConfig.icon}
                        {statusConfig.label}
                    </span>
                </div>

                {/* Progress */}
                {program.duration_weeks && (
                    <div className="mb-6">
                        <div className="flex items-center justify-between text-sm mb-2.5">
                            <span className="text-slate-500 dark:text-slate-400 font-medium">Progresso</span>
                            <span className="text-slate-900 dark:text-slate-100 font-bold">
                                Semana {program.current_week || 1} de {program.duration_weeks}
                            </span>
                        </div>
                        <div className="h-2.5 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary rounded-full transition-all shadow-sm shadow-primary/20"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Meta info */}
                <div className="flex items-center gap-6 text-sm border-t border-slate-200/60 pt-6">
                    {program.started_at && (
                        <div className="flex items-center gap-2 text-slate-500 font-medium">
                            <Calendar className="w-4 h-4 text-slate-400" />
                            <span>Iniciou em <span className="text-slate-900">{new Date(program.started_at).toLocaleDateString('pt-BR')}</span></span>
                        </div>
                    )}
                    {program.duration_weeks && (
                        <div className="flex items-center gap-2 text-slate-500 font-medium">
                            <Clock className="w-4 h-4 text-slate-400" />
                            <span><span className="text-slate-900">{program.duration_weeks}</span> semanas</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
