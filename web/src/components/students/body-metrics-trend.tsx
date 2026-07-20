'use client'

import { useMemo } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface BodyMetricsTrendProps {
    history: { weight: number | null; bodyFat: number | null; date: string }[]
    currentWeight: string | null
    currentBodyFat: string | null
}

// Sparkline em tinta (currentColor) — a cor por métrica saiu no redesign;
// o rótulo já diz qual métrica é.
function MiniSparkline({ values }: { values: number[] }) {
    if (values.length < 2) return null

    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min || 1
    const w = 60
    const h = 20
    const pad = 2

    const points = values.map((v, i) => ({
        x: pad + (i / (values.length - 1)) * (w - pad * 2),
        y: h - pad - ((v - min) / range) * (h - pad * 2),
    }))

    const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

    return (
        <svg viewBox={`0 0 ${w} ${h}`} className="w-[60px] h-[20px] text-k-text-tertiary" preserveAspectRatio="none">
            <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="2" className="fill-current text-k-text-secondary" />
        </svg>
    )
}

export function BodyMetricsTrend({ history, currentWeight, currentBodyFat }: BodyMetricsTrendProps) {
    const trend = useMemo(() => {
        if (history.length < 2) return null

        const weights = history.map(h => h.weight).filter((w): w is number => w != null)
        const fats = history.map(h => h.bodyFat).filter((f): f is number => f != null)

        const weightChange = weights.length >= 2
            ? weights[weights.length - 1] - weights[0]
            : null

        const fatChange = fats.length >= 2
            ? fats[fats.length - 1] - fats[0]
            : null

        return { weights, fats, weightChange, fatChange }
    }, [history])

    if (!currentWeight && !currentBodyFat) return null
    if (!trend || history.length < 2) return null

    return (
        <div className="rounded-control border border-k-border-subtle bg-surface-primary p-3">
            <p className="font-mono text-[9.5px] font-medium uppercase tracking-[0.08em] text-k-text-tertiary mb-2.5 tabular-nums">
                Evolução corporal · {history.length} avaliações
            </p>

            <div className="grid grid-cols-2 gap-3">
                {/* Weight */}
                {currentWeight && (
                    <div>
                        <p className="text-xs text-k-text-tertiary">Peso</p>
                        <div className="flex items-center gap-2 mt-0.5">
                            <p className="font-mono text-[15px] font-semibold text-k-text-primary tabular-nums">{currentWeight} <span className="text-[10.5px] font-normal text-k-text-tertiary">kg</span></p>
                            {trend.weightChange != null && (
                                <span className={`inline-flex items-center gap-0.5 font-mono text-[10px] font-medium tabular-nums ${
                                    trend.weightChange > 0.5 ? 'text-amber-600 dark:text-amber-400' :
                                    trend.weightChange < -0.5 ? 'text-emerald-600 dark:text-emerald-400' :
                                    'text-k-text-quaternary'
                                }`}>
                                    {trend.weightChange > 0.5 ? <TrendingUp className="w-3 h-3" /> :
                                     trend.weightChange < -0.5 ? <TrendingDown className="w-3 h-3" /> :
                                     <Minus className="w-3 h-3" />}
                                    {trend.weightChange > 0 ? '+' : ''}{trend.weightChange.toFixed(1)}
                                </span>
                            )}
                        </div>
                        {trend.weights.length >= 2 && (
                            <div className="mt-1">
                                <MiniSparkline values={trend.weights} />
                            </div>
                        )}
                    </div>
                )}

                {/* Body Fat */}
                {currentBodyFat && (
                    <div>
                        <p className="text-xs text-k-text-tertiary">Gordura corporal</p>
                        <div className="flex items-center gap-2 mt-0.5">
                            <p className="font-mono text-[15px] font-semibold text-k-text-primary tabular-nums">{currentBodyFat} <span className="text-[10.5px] font-normal text-k-text-tertiary">%</span></p>
                            {trend.fatChange != null && (
                                <span className={`inline-flex items-center gap-0.5 font-mono text-[10px] font-medium tabular-nums ${
                                    trend.fatChange > 0.5 ? 'text-amber-600 dark:text-amber-400' :
                                    trend.fatChange < -0.5 ? 'text-emerald-600 dark:text-emerald-400' :
                                    'text-k-text-quaternary'
                                }`}>
                                    {trend.fatChange > 0.5 ? <TrendingUp className="w-3 h-3" /> :
                                     trend.fatChange < -0.5 ? <TrendingDown className="w-3 h-3" /> :
                                     <Minus className="w-3 h-3" />}
                                    {trend.fatChange > 0 ? '+' : ''}{trend.fatChange.toFixed(1)}
                                </span>
                            )}
                        </div>
                        {trend.fats.length >= 2 && (
                            <div className="mt-1">
                                <MiniSparkline values={trend.fats} />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
