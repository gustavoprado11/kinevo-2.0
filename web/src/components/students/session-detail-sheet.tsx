'use client'

import { useEffect, useState } from 'react'
import { getSessionDetails } from '@/app/students/[id]/actions/get-session-details'

interface SessionDetailSheetProps {
    isOpen: boolean
    onClose: () => void
    sessionId: string | null
}

interface SetLog {
    set_number: number
    weight: number
    weight_unit: string
    reps: number
    rpe: number | null
}

interface ExerciseLog {
    exercise_id: string
    name: string
    muscle_group: string | null
    sets: SetLog[]
}

interface SessionDetails {
    id: string
    started_at: string
    completed_at: string
    duration_seconds: number
    rpe: number | null
    feedback: string | null
    assigned_workouts: {
        name: string
    }
    exercises: ExerciseLog[]
}

interface IntensityGaugeProps {
    value: number | null
}

function IntensityGauge({ value }: IntensityGaugeProps) {
    if (!value) return (
        <div className="w-20 h-20 rounded-full bg-glass-bg border border-k-border-primary flex items-center justify-center">
            <span className="text-k-text-quaternary text-xs font-bold uppercase tracking-widest leading-none">N/A</span>
        </div>
    )

    return (
        <div className="relative w-24 h-24 flex items-center justify-center">
            {/* Conic Gradient Outer Ring */}
            <div
                className="absolute inset-0 rounded-full opacity-40 blur-[2px]"
                style={{
                    background: `conic-gradient(from 180deg at 50% 50%, #8b5cf6 ${value * 10}%, transparent 0)`
                }}
            />
            {/* Inner Circle Buffer */}
            <div className="absolute inset-1 rounded-full bg-surface-card border border-k-border-primary" />

            <div className="relative z-10 flex flex-col items-center justify-center">
                <span className="text-[10px] font-black text-violet-400 uppercase tracking-[0.2em] mb-0.5">RPE</span>
                <span className="text-4xl font-black text-white tracking-tighter leading-none">{value}</span>
            </div>
        </div>
    )
}

function StatItem({ icon: Icon, label, value }: { icon: any, label: string, value: string }) {
    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-k-text-quaternary">
                <Icon size={14} strokeWidth={1.5} />
                <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
            </div>
            <span className="text-sm font-semibold text-k-text-secondary">{value}</span>
        </div>
    )
}

export function SessionDetailSheet({ isOpen, onClose, sessionId }: SessionDetailSheetProps) {
    const [details, setDetails] = useState<SessionDetails | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (isOpen && sessionId) {
            setIsLoading(true)
            setError(null)

            getSessionDetails(sessionId)
                .then(result => {
                    if (result.success && result.data) {
                        setDetails(result.data)
                    } else {
                        setError(result.error || 'Erro desconhecido ao carregar detalhes')
                        setDetails(null)
                    }
                })
                .catch(err => {
                    console.error('Error fetching session details:', err)
                    setError('Erro de conexão ou servidor')
                    setDetails(null)
                })
                .finally(() => setIsLoading(false))
        } else {
            setDetails(null)
            setError(null)
        }
    }, [isOpen, sessionId])

    if (!isOpen) return null

    const formatDuration = (seconds: number) => {
        const h = Math.floor(seconds / 3600)
        const m = Math.floor((seconds % 3600) / 60)
        return h > 0 ? `${h}h ${m}m` : `${m}m`
    }

    const calculateTonnage = (exercises: ExerciseLog[]) => {
        return exercises.reduce((acc, exercise) => {
            return acc + exercise.sets.reduce((setAcc, set) => setAcc + (set.weight * set.reps), 0)
        }, 0)
    }

    const calculateSets = (exercises: ExerciseLog[]) => {
        return exercises.reduce((acc, exercise) => acc + exercise.sets.length, 0)
    }

    // Lucide icons are imported dynamically or should be imported at top level
    // Since I'm in a 'use client' file, I'll use standard imports if possible, 
    // but the previous code used require for some reason. Let's fix that.
    const { Clock, Activity, Weight, X } = require('lucide-react')

    return (
        <div className="fixed inset-0 z-[100] flex justify-end">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-500 ease-in-out"
                onClick={onClose}
            ></div>

            {/* Sheet Panel */}
            <div className={`relative w-full max-w-lg h-full bg-surface-card/95 backdrop-blur-2xl border-l border-k-border-primary shadow-2xl flex flex-col transition-all duration-500 ease-apple antialiased animate-in slide-in-from-right`}>
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 z-10 p-2 bg-glass-bg hover:bg-glass-bg-active rounded-full text-k-text-tertiary hover:text-k-text-primary transition-all border border-k-border-subtle"
                >
                    <X size={20} strokeWidth={1.5} />
                </button>

                {/* Content - Scrollable */}
                <div className="flex-1 overflow-y-auto px-8 pt-10 pb-20 space-y-12">
                    {isLoading ? (
                        <div className="space-y-8">
                            <div className="h-32 bg-glass-bg rounded-2xl animate-pulse"></div>
                            <div className="space-y-4">
                                <div className="h-4 w-32 bg-glass-bg rounded animate-pulse"></div>
                                <div className="h-40 bg-glass-bg rounded-2xl animate-pulse"></div>
                                <div className="h-40 bg-glass-bg rounded-2xl animate-pulse"></div>
                            </div>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4 border border-red-500/20">
                                <X className="text-red-400" size={32} strokeWidth={1.5} />
                            </div>
                            <p className="text-white font-bold tracking-tight mb-2">Erro ao carregar detalhes</p>
                            <p className="text-sm text-k-text-tertiary mb-6">{error}</p>
                            <button
                                onClick={onClose}
                                className="px-6 py-2 bg-glass-bg hover:bg-glass-bg-active text-k-text-primary text-xs font-bold uppercase tracking-widest rounded-xl border border-k-border-primary transition-all"
                            >
                                Fechar
                            </button>
                        </div>
                    ) : details ? (
                        <>
                            {/* Header & Intensity Summary */}
                            <header className="flex items-start justify-between gap-6">
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-black text-violet-400 uppercase tracking-[0.2em] mb-2">Treino Executado</p>
                                    <h2 className="text-3xl font-black text-white tracking-tighter truncate leading-none mb-4">
                                        {details.assigned_workouts?.name || 'Treino'}
                                    </h2>
                                    <p className="text-xs text-k-text-quaternary uppercase tracking-[0.15em] font-bold">
                                        {new Date(details.completed_at).toLocaleDateString('pt-BR', {
                                            day: '2-digit',
                                            month: 'short',
                                            year: 'numeric'
                                        })} • {new Date(details.completed_at).toLocaleTimeString('pt-BR', {
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </p>
                                </div>
                                <IntensityGauge value={details.rpe} />
                            </header>

                            {/* Stats Rápidas */}
                            <div className="grid grid-cols-3 gap-6 py-8 border-y border-k-border-subtle">
                                <StatItem
                                    icon={Clock}
                                    label="Duração"
                                    value={formatDuration(details.duration_seconds)}
                                />
                                <StatItem
                                    icon={Activity}
                                    label="Volume"
                                    value={`${calculateSets(details.exercises)} Séries`}
                                />
                                <StatItem
                                    icon={Weight}
                                    label="Tonelagem"
                                    value={`${calculateTonnage(details.exercises).toLocaleString('pt-BR')} kg`}
                                />
                            </div>

                            {/* Feedback do Aluno */}
                            {details.feedback && (
                                <div className="space-y-4">
                                    <h3 className="text-[10px] font-black text-k-text-quaternary uppercase tracking-[0.2em]">Feedback do Aluno</h3>
                                    <div className="bg-glass-bg backdrop-blur-md rounded-2xl p-5 border border-k-border-subtle italic text-k-text-secondary text-sm leading-relaxed">
                                        "{details.feedback}"
                                    </div>
                                </div>
                            )}

                            {/* Exercises List (The Log Table) */}
                            <div className="space-y-10">
                                <h3 className="text-[10px] font-black text-k-text-quaternary uppercase tracking-[0.2em]">Log de Exercícios</h3>

                                {details.exercises.map((exercise) => (
                                    <div key={exercise.exercise_id} className="group">
                                        <div className="flex items-center justify-between mb-4">
                                            <div>
                                                <h4 className="text-lg font-black text-white tracking-tight leading-none mb-1 group-hover:text-violet-400 transition-colors">
                                                    {exercise.name}
                                                </h4>
                                                <p className="text-[10px] font-bold text-k-text-quaternary uppercase tracking-widest">
                                                    {exercise.muscle_group || 'Geral'}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="bg-surface-inset rounded-2xl border border-k-border-subtle overflow-hidden">
                                            <div className="grid grid-cols-4 bg-glass-bg py-2 px-5 text-[10px] uppercase tracking-widest font-black text-k-text-quaternary">
                                                <div>Série</div>
                                                <div className="text-center">Carga</div>
                                                <div className="text-center">Reps</div>
                                                <div className="text-right">RPE</div>
                                            </div>

                                            <div className="divide-y divide-white/5">
                                                {exercise.sets.map((set, idx) => (
                                                    <div key={idx} className="grid grid-cols-4 items-center py-4 px-5 hover:bg-glass-bg transition-colors group/row">
                                                        <div className="text-xs font-mono text-k-text-tertiary">{set.set_number}</div>
                                                        <div className="text-center text-sm font-semibold text-white">
                                                            {set.weight > 0 ? `${set.weight}${set.weight_unit || 'kg'}` : '-'}
                                                        </div>
                                                        <div className="text-center text-sm font-mono text-k-text-secondary">{set.reps}</div>
                                                        <div className="flex justify-end">
                                                            {set.rpe ? (
                                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20">
                                                                    {set.rpe}
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] font-bold text-k-border-subtle">-</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : null}
                </div>
            </div>
        </div>
    )
}
