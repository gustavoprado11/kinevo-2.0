'use client'

import { useState, useEffect } from 'react'
import { Users, Activity, TrendingUp, Target, Eye, EyeOff } from 'lucide-react'
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

function Sparkline({ data }: { data: number[] }) {
    const max = Math.max(...data, 1)
    const hasData = data.some(v => v > 0)
    if (!hasData) return null

    return (
        <div className="flex items-end gap-px mt-2 h-4" title="Treinos concluídos por dia esta semana">
            {data.map((v, i) => (
                <div
                    key={i}
                    className="flex-1 rounded-sm bg-violet-500/30 hover:bg-violet-500/50 transition-colors cursor-default"
                    style={{ height: `${Math.max(10, (v / max) * 100)}%` }}
                    title={`${DAY_LABELS[i]}: ${v} treino${v !== 1 ? 's' : ''}`}
                />
            ))}
        </div>
    )
}

export function StatCards({ stats }: StatCardsProps) {
    const showAdherence = stats.hasActivePrograms
    const [mrrVisible, setMrrVisible] = useState(true)

    useEffect(() => {
        const stored = localStorage.getItem('kinevo:mrr-visible')
        if (stored === 'false') setMrrVisible(false)
    }, [])

    const toggleMrr = () => {
        setMrrVisible(prev => {
            localStorage.setItem('kinevo:mrr-visible', String(!prev))
            return !prev
        })
    }

    return (
        <div className={`grid gap-4 mb-6 ${showAdherence ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-1 sm:grid-cols-3'}`}>
            {/* Active students */}
            <div className="rounded-2xl border border-k-border-primary bg-surface-card p-4">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-k-text-secondary">Alunos ativos</span>
                    <Users size={16} className="text-k-text-quaternary" />
                </div>
                <p className="text-2xl font-bold text-k-text-primary">{stats.activeStudentsCount}</p>
            </div>

            {/* Sessions this week */}
            <div className="rounded-2xl border border-k-border-primary bg-surface-card p-4">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-k-text-secondary">Treinos esta semana</span>
                    <Activity size={16} className="text-k-text-quaternary" />
                </div>
                <div className="flex items-baseline gap-1">
                    <p className="text-2xl font-bold text-k-text-primary">{stats.sessionsThisWeek}</p>
                    {stats.expectedSessionsThisWeek > 0 && (
                        <span className="text-sm text-k-text-quaternary">/{stats.expectedSessionsThisWeek}</span>
                    )}
                </div>
                {stats.expectedSessionsThisWeek > 0 && (
                    <p className="text-[10px] text-k-text-quaternary mt-0.5">
                        {Math.round((stats.sessionsThisWeek / stats.expectedSessionsThisWeek) * 100)}% concluído
                    </p>
                )}
                <Sparkline data={stats.sessionsPerDay} />
            </div>

            {/* MRR */}
            <div className="rounded-2xl border border-k-border-primary bg-surface-card p-4">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-k-text-secondary">Receita mensal</span>
                    <button onClick={toggleMrr} className="text-k-text-quaternary hover:text-k-text-secondary transition-colors">
                        {mrrVisible ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                </div>
                <p className="text-2xl font-bold text-k-text-primary">
                    {mrrVisible ? formatCurrency(stats.mrr) : 'R$ •••••'}
                </p>
            </div>

            {/* Adherence — hidden when no active programs */}
            {showAdherence && (
                <div className="rounded-2xl border border-k-border-primary bg-surface-card p-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-k-text-secondary">Aderência geral</span>
                        <Target size={16} className="text-k-text-quaternary" />
                    </div>
                    <p className="text-2xl font-bold text-k-text-primary">{stats.adherencePercent}%</p>
                </div>
            )}
        </div>
    )
}
