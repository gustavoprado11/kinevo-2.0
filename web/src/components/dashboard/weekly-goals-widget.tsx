'use client'

import { memo } from 'react'
import { Target, TrendingUp, Users, DollarSign } from 'lucide-react'
import { motion } from 'framer-motion'

interface WeeklyGoal {
    id: string
    label: string
    current: number
    target: number
    icon: React.ReactNode
    color: string
    bgColor: string
}

interface WeeklyGoalsWidgetProps {
    sessionsThisWeek: number
    activeStudentsCount: number
    mrr: number
}

export const WeeklyGoalsWidget = memo(function WeeklyGoalsWidget({ sessionsThisWeek, activeStudentsCount, mrr }: WeeklyGoalsWidgetProps) {
    // Default goals — in production these would come from trainer settings
    const goals: WeeklyGoal[] = [
        {
            id: 'sessions',
            label: 'Treinos na semana',
            current: sessionsThisWeek,
            target: 30,
            icon: <TrendingUp className="w-3.5 h-3.5" />,
            color: 'text-[#007AFF] dark:text-blue-400',
            bgColor: 'bg-blue-50 dark:bg-blue-500/10',
        },
        {
            id: 'students',
            label: 'Alunos ativos',
            current: activeStudentsCount,
            target: 10,
            icon: <Users className="w-3.5 h-3.5" />,
            color: 'text-violet-600 dark:text-violet-400',
            bgColor: 'bg-violet-50 dark:bg-violet-500/10',
        },
        {
            id: 'revenue',
            label: 'Receita mensal (R$)',
            current: mrr,
            target: 5000,
            icon: <DollarSign className="w-3.5 h-3.5" />,
            color: 'text-emerald-600 dark:text-emerald-400',
            bgColor: 'bg-emerald-50 dark:bg-emerald-500/10',
        },
    ]

    return (
        <div className="flex flex-col rounded-xl border border-[#D2D2D7] dark:border-k-border-primary bg-white dark:bg-surface-card shadow-apple-card dark:shadow-xl">
            <div className="flex items-center justify-between border-b border-[#E8E8ED] dark:border-k-border-subtle px-6 py-4">
                <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-amber-500" />
                    <h2 className="text-sm font-semibold text-[#1D1D1F] dark:text-k-text-primary">Metas semanais</h2>
                </div>
            </div>

            <div className="p-5 space-y-4">
                {goals.map((goal, index) => {
                    const percent = Math.min(100, Math.round((goal.current / goal.target) * 100))
                    const isComplete = percent >= 100

                    return (
                        <motion.div
                            key={goal.id}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.08, duration: 0.3 }}
                        >
                            <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-2">
                                    <div className={`w-6 h-6 rounded-md ${goal.bgColor} flex items-center justify-center`}>
                                        <span className={goal.color}>{goal.icon}</span>
                                    </div>
                                    <span className="text-xs font-medium text-[#6E6E73] dark:text-k-text-secondary">{goal.label}</span>
                                </div>
                                <span className="text-xs font-semibold text-[#1D1D1F] dark:text-k-text-primary">
                                    {goal.current} <span className="text-[#AEAEB2] dark:text-k-text-quaternary font-normal">/ {goal.target}</span>
                                </span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-[#F0F0F5] dark:bg-white/5 overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${percent}%` }}
                                    transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 + index * 0.08 }}
                                    className={`h-full rounded-full ${
                                        isComplete ? 'bg-emerald-500' : 'bg-[#007AFF] dark:bg-blue-500'
                                    }`}
                                />
                            </div>
                        </motion.div>
                    )
                })}
            </div>
        </div>
    )
})
