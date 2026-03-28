'use client'

import { useMemo } from 'react'
import { AlertTriangle, TrendingDown, Flame, BatteryLow, CalendarClock, ArrowDown } from 'lucide-react'

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
                    icon: <Flame className="w-4 h-4 text-red-500" />,
                    message: `PSE média muito alta (${avgRpe.toFixed(1)})`,
                    detail: 'Considere reduzir intensidade ou volume para evitar overtraining.',
                    severity: 'danger',
                })
            } else if (avgRpe >= 8) {
                result.push({
                    id: 'elevated-rpe',
                    icon: <Flame className="w-4 h-4 text-amber-500" />,
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
                    icon: <TrendingDown className="w-4 h-4 text-red-500" />,
                    message: `Carga caiu ${Math.abs(avgChange).toFixed(0)}% nos últimos treinos`,
                    detail: 'Possível fadiga, dor ou desmotivação. Converse com o aluno.',
                    severity: 'danger',
                })
            } else if (avgChange <= -5) {
                result.push({
                    id: 'load-slight-decrease',
                    icon: <ArrowDown className="w-4 h-4 text-amber-500" />,
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
                    icon: <BatteryLow className="w-4 h-4 text-red-500" />,
                    message: 'Adesão abaixo de 50% nas últimas 2 semanas',
                    detail: 'O aluno pode precisar de ajuste na frequência ou motivação extra.',
                    severity: 'danger',
                })
            } else if (avgAdherence < 70) {
                result.push({
                    id: 'adherence-warning',
                    icon: <BatteryLow className="w-4 h-4 text-amber-500" />,
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
                    icon: <CalendarClock className="w-4 h-4 text-amber-500" />,
                    message: `Programa termina em ${daysLeft} dia${daysLeft > 1 ? 's' : ''}`,
                    detail: 'Planeje a transição para o próximo programa.',
                    severity: 'warning',
                })
            }
        }

        return result
    }, [historySummary, recentSessions, tonnageMap, weeklyAdherence, activeProgram])

    if (alerts.length === 0) return null

    return (
        <div className="space-y-2">
            {alerts.map(alert => (
                <div
                    key={alert.id}
                    className={`flex items-start gap-3 px-4 py-3 rounded-xl border transition-all ${
                        alert.severity === 'danger'
                            ? 'bg-red-50 dark:bg-red-500/5 border-red-200 dark:border-red-500/20'
                            : alert.severity === 'warning'
                                ? 'bg-amber-50 dark:bg-amber-500/5 border-amber-200 dark:border-amber-500/20'
                                : 'bg-blue-50 dark:bg-blue-500/5 border-blue-200 dark:border-blue-500/20'
                    }`}
                >
                    <div className="mt-0.5 shrink-0">{alert.icon}</div>
                    <div className="min-w-0">
                        <p className={`text-sm font-semibold ${
                            alert.severity === 'danger'
                                ? 'text-red-700 dark:text-red-400'
                                : alert.severity === 'warning'
                                    ? 'text-amber-700 dark:text-amber-400'
                                    : 'text-blue-700 dark:text-blue-400'
                        }`}>
                            {alert.message}
                        </p>
                        {alert.detail && (
                            <p className={`text-xs mt-0.5 ${
                                alert.severity === 'danger'
                                    ? 'text-red-600/70 dark:text-red-400/60'
                                    : alert.severity === 'warning'
                                        ? 'text-amber-600/70 dark:text-amber-400/60'
                                        : 'text-blue-600/70 dark:text-blue-400/60'
                            }`}>
                                {alert.detail}
                            </p>
                        )}
                    </div>
                </div>
            ))}
        </div>
    )
}
