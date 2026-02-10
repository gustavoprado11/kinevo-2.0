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

    const getRpeColor = (rpe: number | null) => {
        if (!rpe) return 'bg-gray-700/50 text-gray-400'
        if (rpe <= 4) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
        if (rpe <= 7) return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
        return 'bg-red-500/10 text-red-500 border-red-500/20'
    }

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            ></div>

            {/* Sheet Panel */}
            <div className="relative w-full max-w-md h-full bg-gray-900 border-l border-gray-800 shadow-2xl flex flex-col transform transition-transform duration-300 ease-out">
                {/* Header */}
                <div className="p-6 border-b border-gray-800 flex items-start justify-between bg-gray-900/50">
                    <div>
                        {isLoading ? (
                            <div className="h-6 w-32 bg-gray-800 rounded animate-pulse mb-2"></div>
                        ) : details ? (
                            <>
                                <h2 className="text-xl font-bold text-white mb-1">
                                    {details.assigned_workouts?.name || 'Treino Realizado'}
                                </h2>
                                <p className="text-sm text-gray-400 flex items-center gap-2">
                                    <span>
                                        {new Date(details.completed_at).toLocaleDateString('pt-BR', {
                                            day: 'numeric',
                                            month: 'short',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </span>
                                    <span>•</span>
                                    <span>{formatDuration(details.duration_seconds)}</span>
                                </p>
                            </>
                        ) : (
                            <div className="flex flex-col gap-1">
                                <p className="text-red-400 font-medium">Erro ao carregar</p>
                                {error && <p className="text-xs text-red-500/70">{error}</p>}
                            </div>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content - Scrollable */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    {isLoading ? (
                        <div className="space-y-4">
                            <div className="h-24 bg-gray-800/50 rounded-xl animate-pulse"></div>
                            <div className="h-40 bg-gray-800/50 rounded-xl animate-pulse"></div>
                            <div className="h-40 bg-gray-800/50 rounded-xl animate-pulse"></div>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
                            <svg className="w-12 h-12 text-red-500/50 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <p className="text-red-400 font-medium mb-1">Erro ao carregar os detalhes</p>
                            <p className="text-sm text-gray-500">{error}</p>
                        </div>
                    ) : details ? (
                        <>
                            {/* Feedback Section */}
                            <div className="bg-gray-800/30 rounded-xl p-5 border border-gray-700/30">
                                <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">Feedback do Aluno</h3>
                                <div className="flex gap-4">
                                    {/* RPE Badge */}
                                    <div className={`flex flex-col items-center justify-center w-20 h-20 rounded-xl border ${getRpeColor(details.rpe)}`}>
                                        <span className="text-xs font-bold uppercase tracking-wider mb-1">RPE</span>
                                        <span className="text-3xl font-bold leading-none">{details.rpe || '-'}</span>
                                    </div>

                                    {/* Comments */}
                                    <div className="flex-1">
                                        {details.feedback ? (
                                            <div className="bg-gray-900/50 rounded-lg p-3 h-full border border-gray-700/30 italic text-gray-300 text-sm relative">
                                                <svg className="w-4 h-4 text-gray-600 absolute top-2 left-2 opacity-50" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M14.017 21L14.017 18C14.017 16.8954 13.1216 16 12.017 16H9C9.00001 16.5523 8.55229 17 8.00001 17C7.44773 17 7.00001 16.5523 7.00001 16H4.00001C4.00001 16.5523 3.5523 17 3.00001 17C2.44773 17 2.00001 16.5523 2.00001 16V6C2.00001 5.44772 2.44773 5 3.00001 5H21C21.5523 5 22 5.44772 22 6V15C22 15.5523 21.5523 16 21 16H18.8284L14.4142 20.4142C14.1643 20.6641 14.017 20.8259 14.017 21Z" />
                                                </svg>
                                                <span className="pl-2">{details.feedback}</span>
                                            </div>
                                        ) : (
                                            <div className="h-full flex items-center text-gray-500 text-sm italic pl-2">
                                                Sem comentários adicionais.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Exercises List */}
                            <div className="space-y-6">
                                <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Exercícios Realizados</h3>

                                {details.exercises.map((exercise) => (
                                    <div key={exercise.exercise_id} className="bg-gray-800/20 rounded-xl overflow-hidden border border-gray-700/30">
                                        <div className="px-4 py-3 bg-gray-800/40 border-b border-gray-700/30">
                                            <h4 className="font-medium text-white">{exercise.name}</h4>
                                            {exercise.muscle_group && (
                                                <span className="text-xs text-gray-500 capitalize">{exercise.muscle_group}</span>
                                            )}
                                        </div>

                                        <div className="p-2">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="text-gray-500 border-b border-gray-700/30">
                                                        <th className="pb-2 pl-2 text-left font-medium w-12">Série</th>
                                                        <th className="pb-2 text-center font-medium">Carga</th>
                                                        <th className="pb-2 text-center font-medium">Reps</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-700/30">
                                                    {exercise.sets.map((set, idx) => (
                                                        <tr key={idx} className="text-gray-300">
                                                            <td className="py-2 pl-2 text-gray-500 font-mono text-xs">{set.set_number}</td>
                                                            <td className="py-2 text-center font-medium">
                                                                {set.weight > 0 ? `${set.weight}${set.weight_unit || 'kg'}` : '-'}
                                                            </td>
                                                            <td className="py-2 text-center">
                                                                {set.reps}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
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
