'use client'

import { useMemo } from 'react'
import { TrendingUp, TrendingDown, Minus, Scale } from 'lucide-react'

interface BodyMetricsTrendProps {
    history: { weight: number | null; bodyFat: number | null; date: string }[]
    currentWeight: string | null
    currentBodyFat: string | null
}

function MiniSparkline({ values, color }: { values: number[]; color: string }) {
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
        <svg viewBox={`0 0 ${w} ${h}`} className="w-[60px] h-[20px]" preserveAspectRatio="none">
            <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="2" fill={color} />
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
        <div className="rounded-lg bg-[#F5F5F7] dark:bg-white/5 p-3">
            <div className="flex items-center gap-1.5 mb-2.5">
                <Scale className="w-3.5 h-3.5 text-[#86868B] dark:text-k-text-quaternary" />
                <p className="text-[10px] font-bold text-[#86868B] dark:text-k-text-quaternary">
                    Evolução corporal ({history.length} avaliações)
                </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
                {/* Weight */}
                {currentWeight && (
                    <div>
                        <p className="text-xs text-[#86868B] dark:text-k-text-quaternary">Peso</p>
                        <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-base font-semibold text-[#1C1C1E] dark:text-white">{currentWeight} kg</p>
                            {trend.weightChange != null && (
                                <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${
                                    trend.weightChange > 0.5 ? 'text-amber-500' :
                                    trend.weightChange < -0.5 ? 'text-emerald-500' :
                                    'text-[#86868B] dark:text-k-text-quaternary'
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
                                <MiniSparkline values={trend.weights} color="#8b5cf6" />
                            </div>
                        )}
                    </div>
                )}

                {/* Body Fat */}
                {currentBodyFat && (
                    <div>
                        <p className="text-xs text-[#86868B] dark:text-k-text-quaternary">Gordura corporal</p>
                        <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-base font-semibold text-[#1C1C1E] dark:text-white">{currentBodyFat}%</p>
                            {trend.fatChange != null && (
                                <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${
                                    trend.fatChange > 0.5 ? 'text-amber-500' :
                                    trend.fatChange < -0.5 ? 'text-emerald-500' :
                                    'text-[#86868B] dark:text-k-text-quaternary'
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
                                <MiniSparkline values={trend.fats} color="#f59e0b" />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
