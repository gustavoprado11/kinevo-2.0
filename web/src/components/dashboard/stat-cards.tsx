'use client'

import { useState, useEffect, memo, useCallback } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { motion } from 'framer-motion'
import type { DashboardStats } from '@/lib/dashboard/get-dashboard-data'
import { formatCurrency } from '@/lib/utils/financial'
import { useStudioState } from '@/hooks/use-studio-state'

interface StatCardsProps {
    stats: DashboardStats
}

// Monday-first to match sessionsPerDay ([Mon..Sun])
const DAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

// ── Trend (texto, sem pílula: cor só no delta) ──

function TrendText({ current, previous, suffix = '', invertColors = false }: {
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
        <span className="text-[11.5px] text-k-text-tertiary tabular-nums" title={`Semana anterior: ${previous}${suffix}`}>
            <span className={isGood ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                {isPositive ? '+' : ''}{percent}%
            </span>
            {' '}vs anterior
        </span>
    )
}

// ── Sparkline (neutra: tinta sobre inset — cor não é decoração) ──

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
                    className={`flex-1 rounded-[2px] cursor-default ${
                        v > 0 ? 'bg-k-text-tertiary' : 'bg-surface-inset'
                    }`}
                    title={`${DAY_LABELS[i]}: ${v} treino${v !== 1 ? 's' : ''}`}
                />
            ))}
        </div>
    )
}

// ── Session progress bar (neutra; âmbar só quando está atrás) ──

function SessionProgressBar({ current, total }: { current: number; total: number }) {
    if (total <= 0) return null
    const percent = Math.min(100, Math.round((current / total) * 100))

    return (
        <div className="mt-2">
            <div className="h-1 w-full rounded-full bg-surface-inset overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percent}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
                    className={`h-full rounded-full ${percent >= 40 ? 'bg-k-text-secondary' : 'bg-amber-500'}`}
                />
            </div>
        </div>
    )
}

// ── Célula da régua ──

function KpiCell({ label, children, action }: {
    label: string
    children: React.ReactNode
    action?: React.ReactNode
}) {
    return (
        <div className="bg-surface-card px-5 py-4 flex flex-col gap-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-k-text-tertiary">
                    {label}
                </span>
                {action}
            </div>
            {children}
        </div>
    )
}

// ── Main Component ──
//
// Fase 3 do redesign ("ferramenta profissional"): os 4 cards soltos com ícone
// colorido viraram UMA régua de métricas — painel único, divisores hairline
// (gap-px sobre o tom da borda), rótulos em mono e números tabulares.

export const StatCards = memo(function StatCards({ stats }: StatCardsProps) {
    const showAdherence = stats.hasActivePrograms
    // Estúdio não cobra alunos por aqui — a célula de receita some.
    const { isStudioAccount } = useStudioState()
    const showRevenue = !isStudioAccount
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

    const cellCount = 2 + (showRevenue ? 1 : 0) + (showAdherence ? 1 : 0)
    const gridClass = cellCount >= 4
        ? 'grid-cols-2 md:grid-cols-4'
        : cellCount === 3
            ? 'grid-cols-1 sm:grid-cols-3'
            : 'grid-cols-1 sm:grid-cols-2'

    const valueClass = 'text-[26px] leading-tight font-bold tracking-tight text-k-text-primary tabular-nums'

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className={`mb-6 grid ${gridClass} gap-px rounded-panel border border-k-border-subtle bg-k-border-subtle overflow-hidden`}
            role="region"
            aria-label="Indicadores-chave de performance"
        >
            {/* Alunos ativos */}
            <KpiCell label="Alunos ativos">
                <div className="flex items-baseline gap-2" role="group" aria-label={`Alunos ativos: ${stats.activeStudentsCount}`}>
                    <p className={valueClass}>{stats.activeStudentsCount}</p>
                    <TrendText current={stats.activeStudentsCount} previous={stats.activeStudentsLastWeek} />
                </div>
            </KpiCell>

            {/* Treinos esta semana */}
            <KpiCell label="Treinos esta semana">
                <div className="flex items-baseline gap-1.5">
                    <p className={valueClass}>
                        {stats.sessionsThisWeek}
                        {stats.expectedSessionsThisWeek > 0 && (
                            <span className="text-[15px] font-medium text-k-text-tertiary"> / {stats.expectedSessionsThisWeek}</span>
                        )}
                    </p>
                    <TrendText current={stats.sessionsThisWeek} previous={stats.sessionsLastWeek} />
                </div>
                <SessionProgressBar current={stats.sessionsThisWeek} total={stats.expectedSessionsThisWeek} />
                <Sparkline data={stats.sessionsPerDay} />
                {stats.sessionsThisWeek === 0 && stats.expectedSessionsThisWeek === 0 && (
                    <p className="mt-1 text-[11.5px] text-k-text-quaternary">Sem treinos registrados ainda</p>
                )}
            </KpiCell>

            {/* Receita mensal — oculta para contas de estúdio */}
            {showRevenue && (
                <KpiCell
                    label="Receita mensal"
                    action={
                        <button
                            onClick={toggleMrr}
                            title={mrrVisible ? 'Ocultar receita mensal' : 'Mostrar receita mensal'}
                            aria-label={mrrVisible ? 'Ocultar receita mensal' : 'Mostrar receita mensal'}
                            aria-pressed={mrrVisible}
                            className="text-k-text-quaternary hover:text-k-text-secondary transition-colors"
                        >
                            {mrrVisible ? <Eye size={13} aria-hidden="true" /> : <EyeOff size={13} aria-hidden="true" />}
                        </button>
                    }
                >
                    <div className="flex items-baseline gap-2">
                        <p className={valueClass}>
                            {mrrVisible ? formatCurrency(stats.mrr) : 'R$ •••••'}
                        </p>
                        {mrrVisible && <TrendText current={stats.mrr} previous={stats.mrrLastMonth} />}
                    </div>
                    {mrrVisible && stats.mrr === 0 && (
                        <p className="mt-1 text-[11.5px] text-k-text-quaternary">Nenhuma assinatura ativa ainda</p>
                    )}
                </KpiCell>
            )}

            {/* Aderência */}
            {showAdherence && (
                <KpiCell label="Aderência geral">
                    <div className="flex items-baseline gap-2">
                        <p className={`${valueClass} ${stats.adherencePercent < 40 ? 'text-amber-600 dark:text-amber-400' : ''}`}>
                            {stats.adherencePercent}%
                        </p>
                        <TrendText current={stats.adherencePercent} previous={stats.adherenceLastWeek} suffix="%" />
                    </div>
                    <SessionProgressBar current={stats.adherencePercent} total={100} />
                </KpiCell>
            )}
        </motion.div>
    )
})
