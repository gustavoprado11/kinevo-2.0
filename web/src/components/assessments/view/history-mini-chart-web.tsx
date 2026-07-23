'use client'

import { useMemo, useState } from 'react'
import type { AssessmentSessionListItem, ComputedMetrics } from '@kinevo/shared/types/assessments'

type MetricKey = keyof Pick<ComputedMetrics, 'body_fat_percent' | 'bmi' | 'lean_mass_kg' | 'fat_mass_kg' | 'rcq'>

interface HistoryMiniChartWebProps {
    sessions: AssessmentSessionListItem[]
    metric: MetricKey
    label: string
    suffix?: string
    digits?: number
    /** Lower-is-better changes default colour from green to red on uptrend. */
    betterDirection?: 'down' | 'up'
}

interface Point {
    sessionId: string
    completedAt: string
    value: number
}

const TIMEZONE = 'America/Sao_Paulo'

function formatDate(value: string): string {
    return new Date(value).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        timeZone: TIMEZONE,
    })
}

function fmt(n: number, digits: number, suffix: string): string {
    return `${n.toFixed(digits).replace('.', ',')}${suffix}`
}

/**
 * Sparkline of one computed metric across completed sessions. Pure SVG —
 * mirrors the project pattern in load-progression-chart.tsx (no recharts).
 */
export function HistoryMiniChartWeb({
    sessions,
    metric,
    label,
    suffix = '',
    digits = 1,
    betterDirection = 'down',
}: HistoryMiniChartWebProps) {
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

    const points = useMemo<Point[]>(() => {
        return sessions
            .filter(s => s.status === 'completed' && s.completed_at && s.computed_metrics?.[metric] != null)
            .map(s => ({
                sessionId: s.id,
                completedAt: s.completed_at!,
                value: Number(s.computed_metrics![metric]!),
            }))
            .sort((a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime())
    }, [sessions, metric])

    if (points.length === 0) {
        return (
            <div className="rounded-panel border border-k-border-subtle bg-surface-card p-5">
                <h4 className="text-sm font-semibold text-k-text-primary">{label}</h4>
                <p className="mt-2 text-xs text-k-text-tertiary">Sem dados.</p>
            </div>
        )
    }

    const first = points[0]!.value
    const last = points[points.length - 1]!.value
    const overallDelta = last - first
    const isImprovement =
        (betterDirection === 'down' && overallDelta < 0) || (betterDirection === 'up' && overallDelta > 0)
    const isWorse =
        (betterDirection === 'down' && overallDelta > 0) || (betterDirection === 'up' && overallDelta < 0)
    const lineColor = isImprovement ? '#10b981' : isWorse ? '#ef4444' : '#78716c'
    const gradId = `assess-grad-${metric}`

    if (points.length < 2) {
        return (
            <div className="rounded-panel border border-k-border-subtle bg-surface-card p-5">
                <header className="flex items-baseline justify-between">
                    <h4 className="text-sm font-semibold text-k-text-primary">{label}</h4>
                    <span className="text-base font-bold font-mono tabular-nums text-k-text-primary">{fmt(last, digits, suffix)}</span>
                </header>
                <p className="mt-2 text-xs text-k-text-tertiary">
                    Apenas 1 avaliação — sparkline aparece a partir da segunda.
                </p>
            </div>
        )
    }

    const W = 320
    const H = 80
    const PAD = { top: 8, bottom: 8, left: 4, right: 4 }
    const chartW = W - PAD.left - PAD.right
    const chartH = H - PAD.top - PAD.bottom

    const values = points.map(p => p.value)
    const max = Math.max(...values)
    const min = Math.min(...values)
    const range = max - min || 1

    const svgPoints = points.map((p, i) => ({
        ...p,
        x: PAD.left + (i / (points.length - 1)) * chartW,
        y: PAD.top + chartH - ((p.value - min) / range) * chartH,
    }))

    const pathD = svgPoints
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
        .join(' ')
    const areaD = `${pathD} L ${svgPoints[svgPoints.length - 1].x.toFixed(1)} ${
        H - PAD.bottom
    } L ${svgPoints[0].x.toFixed(1)} ${H - PAD.bottom} Z`

    const hovered = hoveredIdx != null ? svgPoints[hoveredIdx] : null

    return (
        <div className="rounded-panel border border-k-border-subtle bg-surface-card p-5">
            <header className="flex items-baseline justify-between">
                <h4 className="text-sm font-semibold text-k-text-primary">{label}</h4>
                <span className="text-base font-bold font-mono tabular-nums text-k-text-primary">
                    {fmt(hovered?.value ?? last, digits, suffix)}
                </span>
            </header>

            <div className="relative mt-3">
                <svg
                    viewBox={`0 0 ${W} ${H}`}
                    className="h-20 w-full"
                    preserveAspectRatio="none"
                    onMouseLeave={() => setHoveredIdx(null)}
                >
                    <defs>
                        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={lineColor} stopOpacity="0.22" />
                            <stop offset="100%" stopColor={lineColor} stopOpacity="0.02" />
                        </linearGradient>
                    </defs>
                    <path d={areaD} fill={`url(#${gradId})`} />
                    <path
                        d={pathD}
                        fill="none"
                        stroke={lineColor}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    {svgPoints.map((p, i) => (
                        <g key={p.sessionId}>
                            <rect
                                x={p.x - chartW / Math.max(points.length - 1, 1) / 2}
                                y={0}
                                width={chartW / Math.max(points.length - 1, 1)}
                                height={H}
                                fill="transparent"
                                onMouseEnter={() => setHoveredIdx(i)}
                            />
                            <circle
                                cx={p.x}
                                cy={p.y}
                                r={hoveredIdx === i ? 3.5 : 2}
                                fill={lineColor}
                            />
                        </g>
                    ))}
                </svg>
            </div>

            <div className="mt-2 flex justify-between font-mono tabular-nums text-[11px] text-k-text-quaternary">
                <span>{formatDate(points[0]!.completedAt)}</span>
                <span>{hovered ? formatDate(hovered.completedAt) : formatDate(points[points.length - 1]!.completedAt)}</span>
            </div>
        </div>
    )
}
