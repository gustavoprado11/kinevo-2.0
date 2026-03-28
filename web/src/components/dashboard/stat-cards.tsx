'use client'

import { useState, useEffect, memo, useCallback } from 'react'
import { Users, Activity, TrendingUp, TrendingDown, Target, Eye, EyeOff, DollarSign } from 'lucide-react'
import { motion } from 'framer-motion'
import type { DashboardStats } from '@/lib/dashboard/get-dashboard-data'

interface StatCardsProps {
    stats: DashboardStats
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value)
}

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

// ── Trend Badge ──

function TrendBadge({ current, previous, suffix = '', invertColors = false }: {
    current: number
    previous: number | null
    suffix?: string
    invertColors?: boolean
}) {
    if (previous === null || previous === 0) return null

    const delta = current - previous
    const percent = Math.round((delta / previous) * 100)

    if (percent === 0) return null

    const isPositive = percent > 0
    const isGood = invertColors ? !isPositive : isPositive

    return (
        <span
            className={`inline-flex items-center gap-0.5 text-[11px] font-medium px-1.5 py-0.5 rounded-md ${
                isGood
                    ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10'
                    : 'text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-500/10'
            }`}
            title={`Semana anterior: ${previous}${suffix}`}
        >
            {isPositive ? (
                <TrendingUp className="w-3 h-3" />
            ) : (
                <TrendingDown className="w-3 h-3" />
            )}
            {isPositive ? '+' : ''}{percent}%
        </span>
    )
}

// ── Sparkline ──

function Sparkline({ data }: { data: number[] }) {
    const max = Math.max(...data, 1)
    const hasData = data.some(v => v > 0)
    if (!hasData) return null

    return (
        <div className="flex items-end gap-[3px] mt-3 h-5" title="Treinos concluídos por dia esta semana">
            {data.map((v, i) => (
                <motion.div
                    key={i}
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(12, (v / max) * 100)}%` }}
                    transition={{ delay: i * 0.05, duration: 0.4, ease: 'easeOut' }}
                    className={`flex-1 rounded-sm cursor-default ${
                        v > 0
                            ? 'bg-[#007AFF] dark:bg-blue-500 hover:bg-[#0056B3] dark:hover:bg-blue-400'
                            : 'bg-[#E8E8ED] dark:bg-white/5'
                    }`}
                    title={`${DAY_LABELS[i]}: ${v} treino${v !== 1 ? 's' : ''}`}
                />
            ))}
        </div>
    )
}

// ── Progress Ring (for adherence) ──

function ProgressRing({ percent, size = 44, strokeWidth = 3.5 }: {
    percent: number
    size?: number
    strokeWidth?: number
}) {
    const radius = (size - strokeWidth) / 2
    const circumference = 2 * Math.PI * radius
    const offset = circumference - (percent / 100) * circumference

    // Green ≥70%, blue 40-69%, amber <40%
    const color = percent >= 70 ? '#34C759' : percent >= 40 ? '#007AFF' : '#FF9500'

    return (
        <svg width={size} height={size} className="shrink-0 -rotate-90" role="img" aria-label={`Aderência: ${percent}%`}>
            <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                className="text-[#F0F0F5] dark:text-white/5"
            />
            <motion.circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: offset }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
            />
        </svg>
    )
}

// ── Session progress bar ──

function SessionProgressBar({ current, total }: { current: number; total: number }) {
    if (total <= 0) return null
    const percent = Math.min(100, Math.round((current / total) * 100))

    return (
        <div className="mt-2">
            <div className="h-1.5 w-full rounded-full bg-[#F0F0F5] dark:bg-white/5 overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percent}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
                    className={`h-full rounded-full ${
                        percent >= 70 ? 'bg-emerald-500' : percent >= 40 ? 'bg-[#007AFF]' : 'bg-amber-500'
                    }`}
                />
            </div>
            <p className="text-[10px] text-[#AEAEB2] dark:text-k-text-quaternary mt-1">
                {percent}% concluído
            </p>
        </div>
    )
}

// ── Card animation wrapper ──

const cardVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: (i: number) => ({
        opacity: 1,
        y: 0,
        transition: { delay: i * 0.08, duration: 0.4, ease: 'easeOut' as const },
    }),
}

// ── Main Component ──

export const StatCards = memo(function StatCards({ stats }: StatCardsProps) {
    const showAdherence = stats.hasActivePrograms
    const [mrrVisible, setMrrVisible] = useState(true)

    useEffect(() => {
        const stored = localStorage.getItem('kinevo:mrr-visible')
        if (stored === 'false') setMrrVisible(false)
    }, [])

    const toggleMrr = useCallback(() => {
        setMrrVisible(prev => {
            localStorage.setItem('kinevo:mrr-visible', String(!prev))
            return !prev
        })
    }, [])

    const cardClass = "rounded-xl border border-[#D2D2D7] dark:border-k-border-primary bg-white dark:bg-surface-card p-5 shadow-apple-card dark:shadow-none hover:shadow-md dark:hover:shadow-lg transition-shadow duration-200"

    return (
        <div className={`grid gap-4 mb-6 ${showAdherence ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-1 sm:grid-cols-3'}`} role="region" aria-label="Indicadores-chave de performance">
            {/* Active students */}
            <motion.div
                className={cardClass}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                custom={0}
                role="group"
                aria-label={`Alunos ativos: ${stats.activeStudentsCount}`}
            >
                <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-[#86868B] dark:text-k-text-tertiary uppercase tracking-wide">Alunos ativos</span>
                    <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                        <Users size={14} className="text-[#007AFF] dark:text-blue-400" aria-hidden="true" />
                    </div>
                </div>
                <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-bold tracking-tight text-[#1D1D1F] dark:text-k-text-primary">{stats.activeStudentsCount}</p>
                    <TrendBadge current={stats.activeStudentsCount} previous={stats.activeStudentsLastWeek} />
                </div>
            </motion.div>

            {/* Sessions this week */}
            <motion.div
                className={cardClass}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                custom={1}
            >
                <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-[#86868B] dark:text-k-text-tertiary uppercase tracking-wide">Treinos esta semana</span>
                    <div className="w-7 h-7 rounded-lg bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center">
                        <Activity size={14} className="text-violet-600 dark:text-violet-400" />
                    </div>
                </div>
                <div className="flex items-baseline gap-1.5">
                    <p className="text-3xl font-bold tracking-tight text-[#1D1D1F] dark:text-k-text-primary">{stats.sessionsThisWeek}</p>
                    {stats.expectedSessionsThisWeek > 0 && (
                        <span className="text-base text-[#AEAEB2] dark:text-k-text-quaternary font-medium">/{stats.expectedSessionsThisWeek}</span>
                    )}
                    <TrendBadge current={stats.sessionsThisWeek} previous={stats.sessionsLastWeek} />
                </div>
                <SessionProgressBar current={stats.sessionsThisWeek} total={stats.expectedSessionsThisWeek} />
                <Sparkline data={stats.sessionsPerDay} />
            </motion.div>

            {/* MRR */}
            <motion.div
                className={cardClass}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                custom={2}
            >
                <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-[#86868B] dark:text-k-text-tertiary uppercase tracking-wide">Receita mensal</span>
                    <button
                        onClick={toggleMrr}
                        aria-label={mrrVisible ? 'Ocultar receita mensal' : 'Mostrar receita mensal'}
                        aria-pressed={mrrVisible}
                        className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors"
                    >
                        {mrrVisible ? <Eye size={14} className="text-emerald-600 dark:text-emerald-400" aria-hidden="true" /> : <EyeOff size={14} className="text-emerald-600 dark:text-emerald-400" aria-hidden="true" />}
                    </button>
                </div>
                <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-bold tracking-tight text-[#1D1D1F] dark:text-k-text-primary">
                        {mrrVisible ? formatCurrency(stats.mrr) : 'R$ •••••'}
                    </p>
                    {mrrVisible && <TrendBadge current={stats.mrr} previous={stats.mrrLastMonth} />}
                </div>
            </motion.div>

            {/* Adherence */}
            {showAdherence && (
                <motion.div
                    className={cardClass}
                    variants={cardVariants}
                    initial="hidden"
                    animate="visible"
                    custom={3}
                >
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-medium text-[#86868B] dark:text-k-text-tertiary uppercase tracking-wide">Aderência geral</span>
                        <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center">
                            <Target size={14} className="text-amber-600 dark:text-amber-400" />
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <ProgressRing percent={stats.adherencePercent} />
                        <div>
                            <p className="text-3xl font-bold tracking-tight text-[#1D1D1F] dark:text-k-text-primary">{stats.adherencePercent}%</p>
                            <TrendBadge current={stats.adherencePercent} previous={stats.adherenceLastWeek} suffix="%" />
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    )
})
