'use client'

import { useState } from 'react'
import { SessionDetailSheet } from '@/components/students/session-detail-sheet'

interface DailyActivityItem {
    id: string
    sessionId: string
    studentName: string
    studentId: string
    workoutName: string
    completedAt: string
    duration: string
    rpe: number | null
}

interface DailyActivityFeedProps {
    activities: DailyActivityItem[]
}

export function DailyActivityFeed({ activities }: DailyActivityFeedProps) {
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
    const [isSheetOpen, setIsSheetOpen] = useState(false)

    const handleSessionClick = (sessionId: string) => {
        setSelectedSessionId(sessionId)
        setIsSheetOpen(true)
    }

    const handleSheetClose = () => {
        setIsSheetOpen(false)
        setTimeout(() => setSelectedSessionId(null), 300)
    }

    const getRpeColor = (rpe: number | null) => {
        if (!rpe) return 'bg-gray-700/30 text-gray-400'
        if (rpe <= 4) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
        if (rpe <= 7) return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
        return 'bg-red-500/10 text-red-400 border-red-500/20'
    }

    return (
        <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 flex flex-col h-full">
            <div className="p-5 border-b border-gray-700/50 flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        Treinos de Hoje
                        <span className="px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 text-xs border border-violet-500/20 font-medium">
                            {new Date().toLocaleDateString('pt-BR')}
                        </span>
                    </h2>
                    <p className="text-sm text-gray-400 mt-0.5">Atividades recentes dos seus alunos</p>
                </div>
            </div>

            {activities.length === 0 ? (
                <div className="flex-1 p-12 text-center flex flex-col items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-gray-700/30 flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <p className="text-gray-400 mb-1 font-medium">Nenhum treino concluído hoje</p>
                    <p className="text-gray-500 text-sm">Incentive seus alunos a manterem a constância!</p>
                </div>
            ) : (
                <div className="divide-y divide-gray-700/30">
                    {activities.map((activity) => (
                        <button
                            key={activity.id}
                            onClick={() => handleSessionClick(activity.sessionId)}
                            className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-700/30 transition-all group text-left"
                        >
                            <div className="flex items-center gap-4">
                                {/* Avatar */}
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500/20 to-blue-500/20 flex items-center justify-center border border-gray-700/50 shrink-0">
                                    <span className="text-sm font-bold text-violet-300">
                                        {activity.studentName.charAt(0).toUpperCase()}
                                    </span>
                                </div>

                                <div>
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className="font-semibold text-white text-sm">
                                            {activity.studentName}
                                        </span>
                                        <span className="text-gray-500 text-xs">•</span>
                                        <span className="text-gray-400 text-sm">
                                            Concluiu <span className="text-white font-medium group-hover:text-violet-300 transition-colors">{activity.workoutName}</span>
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {activity.rpe && (
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getRpeColor(activity.rpe)}`}>
                                                RPE {activity.rpe}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="text-right">
                                <p className="text-sm font-medium text-white">
                                    {new Date(activity.completedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    {activity.duration}
                                </p>
                            </div>
                        </button>
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
