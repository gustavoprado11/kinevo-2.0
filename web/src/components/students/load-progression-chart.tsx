'use client'

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import type { WorkoutTonnageHistory } from '@/app/students/[id]/actions/get-workout-tonnage-history'

interface LoadProgressionChartProps {
    programId: string
}

function formatTonnage(t: number): string {
    if (t >= 1000) return `${(t / 1000).toFixed(1)}t`
    return `${Math.round(t)}kg`
}

// Delta como texto (sem pílula, sem seta unicode): emerald quando sobe,
// âmbar quando cai — cor no número, não em volta dele.
function TrendText({ change }: { change: number | null }) {
    if (change == null) return null
    const isUp = change > 1
    const isDown = change < -1
    return (
        <span className={`font-mono text-[11px] font-medium tabular-nums ${
            isUp
                ? 'text-emerald-600 dark:text-emerald-400'
                : isDown
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-k-text-quaternary'
        }`}>
            {isUp ? '+' : ''}{change.toFixed(1)}%
        </span>
    )
}

function WorkoutChart({ workout }: { workout: WorkoutTonnageHistory }) {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

    const { points } = workout

    if (points.length < 2) {
        return (
            <div className="text-center py-4 text-xs text-k-text-quaternary">
                Apenas 1 sessão registrada — necessário no mínimo 2 para gráfico.
            </div>
        )
    }

    const maxT = Math.max(...points.map(p => p.tonnage))
    const minT = Math.min(...points.map(p => p.tonnage))
    const range = maxT - minT || 1

    // SVG
    const w = 200
    const h = 60
    const pad = { top: 6, bottom: 6, left: 4, right: 4 }
    const chartW = w - pad.left - pad.right
    const chartH = h - pad.top - pad.bottom

    const svgPoints = points.map((p, i) => ({
        x: pad.left + (i / (points.length - 1)) * chartW,
        y: pad.top + chartH - ((p.tonnage - minT) / range) * chartH,
        ...p,
    }))

    const pathD = svgPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
    const areaD = `${pathD} L ${svgPoints[svgPoints.length - 1].x.toFixed(1)} ${h - pad.bottom} L ${svgPoints[0].x.toFixed(1)} ${h - pad.bottom} Z`

    const hovered = hoveredIndex != null ? points[hoveredIndex] : null
    const lastIndex = svgPoints.length - 1

    return (
        <div>
            {/* Chart — linha em tinta, área com preenchimento sutil,
                ponto final enfatizado (sem gradiente, sem cor por tendência) */}
            <div className="relative text-k-text-secondary">
                <svg
                    viewBox={`0 0 ${w} ${h}`}
                    className="w-full h-20"
                    preserveAspectRatio="none"
                    onMouseLeave={() => setHoveredIndex(null)}
                >
                    <path d={areaD} className="fill-current opacity-[0.07]" />
                    <path d={pathD} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    {svgPoints.map((p, i) => (
                        <g key={p.sessionId}>
                            {/* Invisible hit area */}
                            <rect
                                x={p.x - chartW / (points.length - 1) / 2}
                                y={0}
                                width={chartW / (points.length - 1)}
                                height={h}
                                fill="transparent"
                                onMouseEnter={() => setHoveredIndex(i)}
                            />
                            {/* Dot — só o último ponto e o hover ganham destaque */}
                            {(i === lastIndex || hoveredIndex === i) && (
                                <circle
                                    cx={p.x}
                                    cy={p.y}
                                    r={hoveredIndex === i ? 4 : 3}
                                    className="fill-current"
                                    style={{ transition: 'r 150ms ease' }}
                                />
                            )}
                            {/* Vertical hover line */}
                            {hoveredIndex === i && (
                                <line x1={p.x} y1={pad.top} x2={p.x} y2={h - pad.bottom} stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 2" opacity="0.4" />
                            )}
                        </g>
                    ))}
                </svg>
            </div>

            {/* Date labels */}
            <div className="flex items-center justify-between mt-1 px-0.5">
                {points.map((p, i) => {
                    const show = i === 0 || i === points.length - 1 || points.length <= 5
                    return show ? (
                        <div key={p.sessionId} className="text-center" style={{ flex: 1 }}>
                            <p className={`font-mono text-[9px] tabular-nums ${hoveredIndex === i ? 'text-k-text-primary' : 'text-k-text-quaternary'}`}>
                                {new Date(p.completedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })}
                            </p>
                        </div>
                    ) : (
                        <div key={p.sessionId} style={{ flex: 1 }} />
                    )
                })}
            </div>

            {/* Hover tooltip — exercise breakdown */}
            {hovered && (
                <div className="mt-3 rounded-control border border-k-border-subtle bg-surface-primary p-3 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between mb-2">
                        <p className="font-mono text-[11px] font-medium text-k-text-primary tabular-nums">
                            {new Date(hovered.completedAt).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'America/Sao_Paulo' }).replace(/\./g, '')}
                        </p>
                        <p className="font-mono text-[11px] font-medium text-k-text-primary tabular-nums">
                            {formatTonnage(hovered.tonnage)} total
                        </p>
                    </div>
                    {hovered.exerciseBreakdown.length > 0 && (
                        <div className="space-y-1">
                            {hovered.exerciseBreakdown.slice(0, 5).map((ex, i) => {
                                const pct = hovered.tonnage > 0 ? (ex.tonnage / hovered.tonnage) * 100 : 0
                                return (
                                    <div key={i} className="flex items-center gap-2">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] text-k-text-tertiary truncate">{ex.name}</span>
                                                <span className="font-mono text-[10px] text-k-text-secondary ml-2 shrink-0 tabular-nums">{formatTonnage(ex.tonnage)}</span>
                                            </div>
                                            <div className="h-1 bg-surface-inset rounded-full mt-0.5 overflow-hidden">
                                                <div
                                                    className="h-full rounded-full bg-k-text-tertiary"
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                            {hovered.exerciseBreakdown.length > 5 && (
                                <p className="text-[9px] text-k-text-quaternary">+{hovered.exerciseBreakdown.length - 5} exercícios</p>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

export function LoadProgressionChart({ programId }: LoadProgressionChartProps) {
    const [data, setData] = useState<WorkoutTonnageHistory[] | null>(null)
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState(0)

    useEffect(() => {
        let cancelled = false
        async function load() {
            setLoading(true)
            const { getWorkoutTonnageHistory } = await import('@/app/students/[id]/actions/get-workout-tonnage-history')
            const result = await getWorkoutTonnageHistory(programId)
            if (!cancelled && result.success && result.data) {
                // Only keep workouts with 2+ data points
                const valid = result.data.filter(w => w.points.length >= 2)
                setData(valid)
            }
            if (!cancelled) setLoading(false)
        }
        load()
        return () => { cancelled = true }
    }, [programId])

    if (loading) {
        return (
            <div className="bg-surface-card rounded-panel border border-k-border-subtle p-5">
                <div className="flex items-center gap-2 text-k-text-quaternary">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-xs font-medium">Carregando progressão...</span>
                </div>
            </div>
        )
    }

    if (!data || data.length === 0) return null

    const active = data[activeTab] || data[0]

    return (
        <div className="bg-surface-card rounded-panel border border-k-border-subtle p-5">
            {/* Header */}
            <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-k-text-tertiary">
                    Progressão de carga
                </span>
                <TrendText change={active.overallChange} />
            </div>

            {/* Subtitle */}
            <p className="text-[10.5px] text-k-text-quaternary mb-3">
                Volume total por sessão do mesmo treino · {active.points.length} sessões
            </p>

            {/* Workout selector — segmentos (padrão dos filtros), não abas violeta */}
            {data.length > 1 && (
                <div className="inline-flex rounded-control border border-k-border-primary bg-surface-card overflow-hidden mb-4 max-w-full overflow-x-auto">
                    {data.map((w, i) => (
                        <button
                            key={w.workoutId}
                            onClick={() => setActiveTab(i)}
                            className={`px-3 py-1.5 text-[11px] font-medium whitespace-nowrap transition-colors ${i > 0 ? 'border-l border-k-border-subtle' : ''} ${
                                i === activeTab
                                    ? 'bg-surface-inset text-k-text-primary'
                                    : 'text-k-text-tertiary hover:text-k-text-primary'
                            }`}
                        >
                            <span>{w.workoutName}</span>
                            {w.lastChange != null && (
                                <span className={`ml-1.5 font-mono tabular-nums ${
                                    w.lastChange > 1
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : w.lastChange < -1
                                            ? 'text-amber-600 dark:text-amber-400'
                                            : 'text-k-text-quaternary'
                                }`}>
                                    {w.lastChange > 0 ? '+' : ''}{w.lastChange.toFixed(0)}%
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            )}

            {/* Active workout chart */}
            <WorkoutChart workout={active} />

            {/* Summary row */}
            <div className="flex items-center gap-6 mt-3 pt-3 border-t border-k-border-subtle">
                <div>
                    <p className="font-mono text-[9px] font-medium uppercase tracking-[0.08em] text-k-text-quaternary">Primeira sessão</p>
                    <p className="font-mono text-sm font-semibold text-k-text-primary tabular-nums">{formatTonnage(active.points[0].tonnage)}</p>
                </div>
                <div>
                    <p className="font-mono text-[9px] font-medium uppercase tracking-[0.08em] text-k-text-quaternary">Última sessão</p>
                    <p className="font-mono text-sm font-semibold text-k-text-primary tabular-nums">{formatTonnage(active.points[active.points.length - 1].tonnage)}</p>
                </div>
                {active.overallChange != null && (
                    <div className="ml-auto text-right">
                        <p className="font-mono text-[9px] font-medium uppercase tracking-[0.08em] text-k-text-quaternary">Evolução</p>
                        <TrendText change={active.overallChange} />
                    </div>
                )}
            </div>
        </div>
    )
}
