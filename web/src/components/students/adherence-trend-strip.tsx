'use client'

import { TrendingUp, TrendingDown } from 'lucide-react'

interface WeeklyAdherencePoint {
    week: number | string
    rate: number
}

interface AdherenceTrendStripProps {
    /**
     * Últimas N entradas, cronológicas. Aceita rates 0–1 ou 0–100; o componente
     * normaliza pra 0–100 internamente. Quando há mais de 12 entradas, só as
     * 12 últimas são usadas.
     */
    weeklyAdherence: WeeklyAdherencePoint[]
    onWeekClick?: (weekIdentifier: number | string) => void
}

const VIEWBOX_W = 380
const VIEWBOX_H = 28
const PAD_X = 6
const PAD_Y = 4
const LINE_COLOR = '#6B46FF'
const LOW_COLOR = '#EF4444'
const LOW_THRESHOLD = 50

function normalize(rate: number): number {
    return rate <= 1 ? rate * 100 : rate
}

function avgOf(values: number[]): number {
    if (values.length === 0) return 0
    return values.reduce((a, b) => a + b, 0) / values.length
}

export function AdherenceTrendStrip({ weeklyAdherence, onWeekClick }: AdherenceTrendStripProps) {
    if (!Array.isArray(weeklyAdherence) || weeklyAdherence.length < 2) return null

    const last = weeklyAdherence.slice(-12)
    const values = last.map((w) => normalize(w.rate))

    const avg = Math.round(avgOf(values))
    const last2 = avgOf(values.slice(-2))
    const prev2 = avgOf(values.slice(-4, -2))
    // Quando há menos de 4 pontos, prev2 é zero — ignoramos o delta nesse caso.
    const hasDelta = values.length >= 4
    const delta = hasDelta ? Math.round(last2 - prev2) : 0

    // Pontos no SVG normalizados pra 0–100 → eixo Y invertido.
    const stepX = (VIEWBOX_W - PAD_X * 2) / Math.max(1, values.length - 1)
    const points = values.map((v, i) => {
        const x = PAD_X + i * stepX
        const y = VIEWBOX_H - PAD_Y - (v / 100) * (VIEWBOX_H - PAD_Y * 2)
        return { x, y, v, week: last[i].week }
    })

    const pathD = points
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
        .join(' ')

    const ariaLabel = `Adesão de ${last.length} semanas: ${avg}% em média`
    const periodLabel = `Adesão ${last.length} sem`

    return (
        <div
            role="img"
            aria-label={ariaLabel}
            className="flex items-center gap-4 rounded-xl border border-[#E8E8ED] dark:border-k-border-subtle bg-[#FAFAFB] dark:bg-white/3 px-4 py-2.5"
        >
            {/* Bloco esquerdo: label + número grande + delta */}
            <div className="flex flex-col items-start min-w-[112px]">
                <span className="text-[9px] font-bold uppercase tracking-wider text-[#86868B] dark:text-k-text-quaternary">
                    {periodLabel}
                </span>
                <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-xl font-black text-[#1C1C1E] dark:text-white tracking-tight leading-none">
                        {avg}%
                    </span>
                    <span className="text-[10px] font-medium text-[#86868B] dark:text-k-text-quaternary">
                        média
                    </span>
                </div>
                {hasDelta && delta !== 0 && (
                    <span
                        className={`mt-1 inline-flex items-center gap-0.5 text-[10px] font-bold ${
                            delta > 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-red-500 dark:text-red-400'
                        }`}
                    >
                        {delta > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {delta > 0 ? '+' : ''}
                        {delta}% últ. 2 sem
                    </span>
                )}
            </div>

            {/* Sparkline */}
            <svg
                viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
                className="flex-1 h-7"
                preserveAspectRatio="none"
                aria-hidden="true"
            >
                <path d={pathD} fill="none" stroke={LINE_COLOR} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                {points.map((p) => {
                    const isLow = p.v < LOW_THRESHOLD
                    const fill = isLow ? LOW_COLOR : LINE_COLOR
                    return (
                        <circle
                            key={`${p.week}`}
                            cx={p.x}
                            cy={p.y}
                            r={2.5}
                            fill={fill}
                            stroke="white"
                            strokeWidth={0.5}
                            className={onWeekClick ? 'cursor-pointer' : ''}
                            onClick={onWeekClick ? () => onWeekClick(p.week) : undefined}
                            data-testid={`trend-point-${p.week}`}
                        >
                            <title>{`Semana ${p.week}: ${Math.round(p.v)}%`}</title>
                        </circle>
                    )
                })}
            </svg>
        </div>
    )
}
