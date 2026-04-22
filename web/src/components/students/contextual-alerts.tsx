'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, TrendingDown, Flame, BatteryLow, CalendarClock, ArrowDown, X } from 'lucide-react'

interface ContextualAlertsProps {
    historySummary: {
        totalSessions: number
        lastSessionDate: string | null
        completedThisWeek: number
        expectedPerWeek: number
        streak: number
    }
    recentSessions: any[]
    tonnageMap: Record<string, { tonnage: number; previousTonnage: number | null; percentChange: number | null }>
    weeklyAdherence: { week: number; rate: number }[]
    activeProgram: {
        status: string
        duration_weeks: number | null
        started_at: string | null
    } | null
}

interface Alert {
    id: string
    icon: React.ReactNode
    message: string
    detail?: string
    severity: 'warning' | 'danger' | 'info'
}

export function ContextualAlerts({
    historySummary,
    recentSessions,
    tonnageMap,
    weeklyAdherence,
    activeProgram,
}: ContextualAlertsProps) {
    const alerts = useMemo(() => {
        const result: Alert[] = []

        if (!activeProgram) return result

        // 1. High RPE alert — average RPE >= 9 across recent sessions
        const rpeValues = recentSessions
            .map(s => s.rpe)
            .filter((r): r is number => r != null && r > 0)
        if (rpeValues.length >= 2) {
            const avgRpe = rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length
            if (avgRpe >= 9) {
                result.push({
                    id: 'high-rpe',
                    icon: <Flame className="w-3.5 h-3.5" />,
                    message: `PSE média muito alta (${avgRpe.toFixed(1)})`,
                    detail: 'Considere reduzir intensidade ou volume para evitar overtraining.',
                    severity: 'danger',
                })
            } else if (avgRpe >= 8) {
                result.push({
                    id: 'elevated-rpe',
                    icon: <Flame className="w-3.5 h-3.5" />,
                    message: `PSE média elevada (${avgRpe.toFixed(1)})`,
                    detail: 'Monitore fadiga acumulada nas próximas sessões.',
                    severity: 'warning',
                })
            }
        }

        // 2. Load decrease alert — average load change negative
        const changes = Object.values(tonnageMap).filter(t => t.percentChange != null)
        if (changes.length >= 2) {
            const avgChange = changes.reduce((sum, t) => sum + t.percentChange!, 0) / changes.length
            if (avgChange <= -10) {
                result.push({
                    id: 'load-decrease',
                    icon: <TrendingDown className="w-3.5 h-3.5" />,
                    message: `Carga caiu ${Math.abs(avgChange).toFixed(0)}% nos últimos treinos`,
                    detail: 'Possível fadiga, dor ou desmotivação. Converse com o aluno.',
                    severity: 'danger',
                })
            } else if (avgChange <= -5) {
                result.push({
                    id: 'load-slight-decrease',
                    icon: <ArrowDown className="w-3.5 h-3.5" />,
                    message: `Carga reduzida (${avgChange.toFixed(1)}%)`,
                    detail: 'Queda leve — pode ser deload planejado ou fadiga pontual.',
                    severity: 'warning',
                })
            }
        }

        // 3. Adherence dropping — last 2 weeks below 60%
        if (weeklyAdherence.length >= 2) {
            const lastTwo = weeklyAdherence.slice(-2)
            const avgAdherence = lastTwo.reduce((sum, w) => sum + w.rate, 0) / lastTwo.length
            if (avgAdherence < 50) {
                result.push({
                    id: 'low-adherence',
                    icon: <BatteryLow className="w-3.5 h-3.5" />,
                    message: 'Adesão abaixo de 50% nas últimas 2 semanas',
                    detail: 'O aluno pode precisar de ajuste na frequência ou motivação extra.',
                    severity: 'danger',
                })
            } else if (avgAdherence < 70) {
                result.push({
                    id: 'adherence-warning',
                    icon: <BatteryLow className="w-3.5 h-3.5" />,
                    message: `Adesão em queda (${Math.round(avgAdherence)}%)`,
                    detail: 'Tendência de queda na frequência de treinos.',
                    severity: 'warning',
                })
            }
        }

        // 4. Program ending soon (within 1 week) — complementary to the queue empty state
        if (activeProgram.started_at && activeProgram.duration_weeks) {
            const start = new Date(activeProgram.started_at)
            const endDate = new Date(start.getTime() + activeProgram.duration_weeks * 7 * 24 * 60 * 60 * 1000)
            const daysLeft = Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            if (daysLeft <= 7 && daysLeft > 0 && activeProgram.status === 'active') {
                result.push({
                    id: 'program-ending',
                    icon: <CalendarClock className="w-3.5 h-3.5" />,
                    message: `Programa termina em ${daysLeft} dia${daysLeft > 1 ? 's' : ''}`,
                    detail: 'Planeje a transição para o próximo programa.',
                    severity: 'warning',
                })
            }
        }

        return result
    }, [historySummary, recentSessions, tonnageMap, weeklyAdherence, activeProgram])

    if (alerts.length === 0) return null

    return <ContextualAlertsView alerts={alerts} />
}

// ── Presentational ──
//
// Alerts used to render as stacked full-width banners — even collapsed, 2–3
// of them in a row cut the viewport into horizontal slices before the main
// dashboard could start. That's the "cortando a tela" problem.
//
// New layout: a single compact row of pill-shaped chips (one per alert).
// Severity is encoded via a colored dot + subtle tinted background; the text
// stays neutral so the row reads as a status bar instead of a warning banner.
// Clicking a chip reveals that alert's detail inline, below the row.

function ContextualAlertsView({ alerts }: { alerts: Alert[] }) {
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const expanded = alerts.find(a => a.id === expandedId) ?? null

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-k-text-tertiary pr-1">
                    <AlertTriangle className="w-3 h-3" />
                    Alertas
                </span>
                {alerts.map(alert => {
                    const isActive = expandedId === alert.id
                    const dotColor =
                        alert.severity === 'danger'
                            ? 'bg-red-500'
                            : alert.severity === 'warning'
                                ? 'bg-amber-500'
                                : 'bg-blue-500'
                    return (
                        <button
                            key={alert.id}
                            type="button"
                            onClick={() => setExpandedId(isActive ? null : alert.id)}
                            className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-[12px] font-medium transition-colors ${
                                isActive
                                    ? 'bg-k-surface-raised border-k-border-default text-k-text-primary shadow-sm'
                                    : 'bg-k-surface border-k-border-subtle text-k-text-secondary hover:bg-k-surface-raised hover:text-k-text-primary'
                            }`}
                            aria-expanded={isActive}
                        >
                            <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                            <span className="truncate max-w-[220px]">{alert.message}</span>
                        </button>
                    )
                })}
            </div>

            {expanded && (
                <div
                    className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-[12.5px] leading-relaxed ${
                        expanded.severity === 'danger'
                            ? 'bg-red-50/70 dark:bg-red-500/5 border-red-200/70 dark:border-red-500/20 text-red-700 dark:text-red-300'
                            : expanded.severity === 'warning'
                                ? 'bg-amber-50/70 dark:bg-amber-500/5 border-amber-200/70 dark:border-amber-500/20 text-amber-800 dark:text-amber-300'
                                : 'bg-blue-50/70 dark:bg-blue-500/5 border-blue-200/70 dark:border-blue-500/20 text-blue-700 dark:text-blue-300'
                    }`}
                >
                    <div className="shrink-0 mt-0.5 opacity-80">{expanded.icon}</div>
                    <div className="flex-1">
                        <p className="font-semibold">{expanded.message}</p>
                        {expanded.detail && (
                            <p className="mt-0.5 opacity-80">{expanded.detail}</p>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={() => setExpandedId(null)}
                        className="shrink-0 p-1 -m-1 rounded hover:bg-black/5 dark:hover:bg-white/5 opacity-60 hover:opacity-100"
                        aria-label="Fechar detalhe"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}
        </div>
    )
}
