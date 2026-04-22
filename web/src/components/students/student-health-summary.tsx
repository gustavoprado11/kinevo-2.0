'use client'

import { useMemo } from 'react'
import { CheckCircle2, AlertTriangle, XCircle, Circle } from 'lucide-react'

interface StudentHealthSummaryProps {
    historySummary: {
        totalSessions: number
        lastSessionDate: string | null
        completedThisWeek: number
        expectedPerWeek: number
        streak: number
    }
    recentSessions: any[]
    weeklyAdherence: { week: number; rate: number }[]
    hasActiveProgram: boolean
    financialStatus: string // 'active' | 'expired' | 'past_due' | 'none' etc.
    hasPendingForms: boolean
}

type HealthLevel = 'good' | 'attention' | 'critical'

interface HealthDimension {
    label: string
    level: HealthLevel
    detail: string
}

const LEVEL_CONFIG = {
    good: { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
    attention: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/10' },
    critical: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-500/10' },
}

export function StudentHealthSummary({
    historySummary,
    recentSessions,
    weeklyAdherence,
    hasActiveProgram,
    financialStatus,
    hasPendingForms,
}: StudentHealthSummaryProps) {
    const dimensions = useMemo(() => {
        const dims: HealthDimension[] = []

        // 1. Training frequency
        if (!hasActiveProgram) {
            dims.push({ label: 'Programa', level: 'critical', detail: 'Sem programa ativo' })
        } else {
            const daysSinceLast = historySummary.lastSessionDate
                ? Math.floor((Date.now() - new Date(historySummary.lastSessionDate).getTime()) / (1000 * 60 * 60 * 24))
                : null

            if (daysSinceLast === null && historySummary.totalSessions === 0) {
                dims.push({ label: 'Frequência', level: 'attention', detail: 'Não iniciou' })
            } else if (daysSinceLast != null && daysSinceLast >= 6) {
                dims.push({ label: 'Frequência', level: 'critical', detail: `${daysSinceLast}d sem treinar` })
            } else if (daysSinceLast != null && daysSinceLast >= 3) {
                dims.push({ label: 'Frequência', level: 'attention', detail: `${daysSinceLast}d sem treinar` })
            } else {
                dims.push({ label: 'Frequência', level: 'good', detail: 'Em dia' })
            }
        }

        // 2. Weekly adherence
        if (weeklyAdherence.length >= 2) {
            const lastTwo = weeklyAdherence.slice(-2)
            const avg = lastTwo.reduce((s, w) => s + w.rate, 0) / lastTwo.length
            if (avg >= 80) {
                dims.push({ label: 'Adesão', level: 'good', detail: `${Math.round(avg)}%` })
            } else if (avg >= 50) {
                dims.push({ label: 'Adesão', level: 'attention', detail: `${Math.round(avg)}%` })
            } else {
                dims.push({ label: 'Adesão', level: 'critical', detail: `${Math.round(avg)}%` })
            }
        }

        // Intensidade (PSE) foi removida daqui para evitar duplicação.
        // A análise de PSE elevada é exibida pelo `ContextualAlerts`
        // como um banner expandido com recomendação. Manter somente ali.

        // 4. Financial
        if (financialStatus === 'expired' || financialStatus === 'overdue' || financialStatus === 'past_due') {
            dims.push({ label: 'Financeiro', level: 'critical', detail: financialStatus === 'expired' ? 'Expirado' : 'Atrasado' })
        } else if (financialStatus === 'canceling' || financialStatus === 'canceled') {
            dims.push({ label: 'Financeiro', level: 'attention', detail: 'Cancelando' })
        } else if (financialStatus === 'active') {
            dims.push({ label: 'Financeiro', level: 'good', detail: 'Ativo' })
        }

        // 5. Pending forms
        if (hasPendingForms) {
            dims.push({ label: 'Avaliações', level: 'attention', detail: 'Pendente' })
        }

        return dims
    }, [historySummary, recentSessions, weeklyAdherence, hasActiveProgram, financialStatus, hasPendingForms])

    // Don't render if no meaningful data
    if (dimensions.length === 0) return null

    const criticalCount = dimensions.filter(d => d.level === 'critical').length
    const attentionCount = dimensions.filter(d => d.level === 'attention').length

    // Overall health
    const overallLevel: HealthLevel = criticalCount > 0 ? 'critical' : attentionCount > 0 ? 'attention' : 'good'
    const overallConfig = LEVEL_CONFIG[overallLevel]

    return (
        <div className={`rounded-xl px-4 py-2.5 flex items-center gap-3 ${overallConfig.bg} border ${
            overallLevel === 'critical' ? 'border-red-200 dark:border-red-500/20' :
            overallLevel === 'attention' ? 'border-amber-200 dark:border-amber-500/20' :
            'border-emerald-200 dark:border-emerald-500/20'
        }`}>
            {/* Health dots */}
            <div className="flex items-center gap-1.5">
                {dimensions.map((dim, i) => {
                    const cfg = LEVEL_CONFIG[dim.level]
                    const Icon = cfg.icon
                    return (
                        <div key={i} className="group relative">
                            <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                            {/* Tooltip */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1.5 bg-[#1D1D1F] dark:bg-white text-white dark:text-[#1D1D1F] text-[10px] font-medium rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
                                <span className="font-bold">{dim.label}:</span> {dim.detail}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Summary text */}
            <span className={`text-[11px] font-semibold ${
                overallLevel === 'critical' ? 'text-red-700 dark:text-red-400' :
                overallLevel === 'attention' ? 'text-amber-700 dark:text-amber-400' :
                'text-emerald-700 dark:text-emerald-400'
            }`}>
                {overallLevel === 'critical' && `${criticalCount} ponto${criticalCount > 1 ? 's' : ''} crítico${criticalCount > 1 ? 's' : ''}`}
                {overallLevel === 'attention' && `${attentionCount} ponto${attentionCount > 1 ? 's' : ''} de atenção`}
                {overallLevel === 'good' && 'Tudo em dia'}
            </span>

            {/* Compact dimensions on hover is handled by individual tooltips above */}
            <div className="ml-auto flex items-center gap-2 text-[10px] font-medium text-[#86868B] dark:text-k-text-quaternary">
                {dimensions.map((dim, i) => (
                    <span key={i} className="hidden sm:inline-flex items-center gap-1">
                        <Circle className={`w-1.5 h-1.5 fill-current ${LEVEL_CONFIG[dim.level].color}`} />
                        {dim.label}
                    </span>
                ))}
            </div>
        </div>
    )
}
