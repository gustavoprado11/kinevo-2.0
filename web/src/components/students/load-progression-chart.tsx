'use client'

import { useState, useEffect, useMemo } from 'react'
import { TrendingUp, TrendingDown, Minus, Loader2, Dumbbell, ChevronRight } from 'lucide-react'
import type { WorkoutTonnageHistory } from '@/app/students/[id]/actions/get-workout-tonnage-history'

interface LoadProgressionChartProps {
    programId: string
}

function formatTonnage(t: number): string {
    if (t >= 1000) return `${(t / 1000).toFixed(1)}t`
    return `${Math.round(t)}kg`
}

function TrendBadge({ change }: { change: number | null }) {
    if (change == null) return null
    const isUp = change > 1
    const isDown = change < -1
    return (
        <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${
            isUp ? 'text-emerald-500' : isDown ? 'text-red-500' : 'text-[#86868B] dark:text-k-text-quaternary'
        }`}>
            {isUp ? <TrendingUp className="w-3 h-3" /> : isDown ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
            {isUp ? '+' : ''}{change.toFixed(1)}%
        </span>
    )
}

function WorkoutChart({ workout }: { workout: WorkoutTonnageHistory }) {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

    const { points } = workout

    if (points.length < 2) {
        return (
            <div className="text-center py-4 text-xs text-[#86868B] dark:text-k-text-quaternary">
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

    const isPositive = (workout.overallChange ?? 0) > 1
    const isNegative = (workout.overallChange ?? 0) < -1
    const lineColor = isNegative ? '#ef4444' : '#8b5cf6'
    const gradId = `grad-${workout.workoutId.slice(0, 8)}`

    const pathD = svgPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
    const areaD = `${pathD} L ${svgPoints[svgPoints.length - 1].x.toFixed(1)} ${h - pad.bottom} L ${svgPoints[0].x.toFixed(1)} ${h - pad.bottom} Z`

    const hovered = hoveredIndex != null ? points[hoveredIndex] : null

    return (
        <div>
            {/* Chart */}
            <div className="relative">
                <svg
                    viewBox={`0 0 ${w} ${h}`}
                    className="w-full h-20"
                    preserveAspectRatio="none"
                    onMouseLeave={() => setHoveredIndex(null)}
                >
                    <defs>
                        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={lineColor} stopOpacity="0.2" />
                            <stop offset="100%" stopColor={lineColor} stopOpacity="0.02" />
                        </linearGradient>
                    </defs>
                    <path d={areaD} fill={`url(#${gradId})`} />
                    <path d={pathD} fill="none" stroke={lineColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
                            {/* Dot */}
                            <circle
                                cx={p.x}
                                cy={p.y}
                                r={hoveredIndex === i ? 4 : 2.5}
                                fill={lineColor}
                                stroke="white"
                                strokeWidth="1"
                                style={{ transition: 'r 150ms ease' }}
                            />
                            {/* Vertical hover line */}
                            {hoveredIndex === i && (
                                <line x1={p.x} y1={pad.top} x2={p.x} y2={h - pad.bottom} stroke={lineColor} strokeWidth="0.5" strokeDasharray="2 2" opacity="0.4" />
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
                            <p className={`text-[9px] font-bold ${hoveredIndex === i ? 'text-[#1C1C1E] dark:text-white' : 'text-[#AEAEB2] dark:text-k-text-quaternary'}`}>
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
                <div className="mt-3 rounded-lg bg-[#F5F5F7] dark:bg-white/5 p-3 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-[11px] font-bold text-[#1C1C1E] dark:text-k-text-primary">
                            {new Date(hovered.completedAt).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'America/Sao_Paulo' })}
                        </p>
                        <p className="text-[11px] font-bold text-[#1C1C1E] dark:text-k-text-primary">
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
                                                <span className="text-[10px] text-[#6E6E73] dark:text-k-text-tertiary truncate">{ex.name}</span>
                                                <span className="text-[10px] font-semibold text-[#1C1C1E] dark:text-k-text-secondary ml-2 shrink-0">{formatTonnage(ex.tonnage)}</span>
                                            </div>
                                            <div className="h-1 bg-[#E5E5EA] dark:bg-white/10 rounded-full mt-0.5 overflow-hidden">
                                                <div
                                                    className="h-full rounded-full"
                                                    style={{ width: `${pct}%`, backgroundColor: lineColor }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                            {hovered.exerciseBreakdown.length > 5 && (
                                <p className="text-[9px] text-[#AEAEB2] dark:text-k-text-quaternary">+{hovered.exerciseBreakdown.length - 5} exercícios</p>
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
            <div className="bg-white dark:bg-glass-bg backdrop-blur-md rounded-2xl border border-transparent dark:border-k-border-primary shadow-sm dark:shadow-none p-5">
                <div className="flex items-center gap-2 text-[#86868B] dark:text-k-text-quaternary">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-xs font-medium">Carregando progressão...</span>
                </div>
            </div>
        )
    }

    if (!data || data.length === 0) return null

    const active = data[activeTab] || data[0]

    return (
        <div className="bg-white dark:bg-glass-bg backdrop-blur-md rounded-2xl border border-transparent dark:border-k-border-primary shadow-sm dark:shadow-none p-5">
            {/* Header */}
            <div className="flex items-center justify-between mb-1">
                <h4 className="text-sm font-semibold text-[#1C1C1E] dark:text-white flex items-center gap-1.5">
                    <Dumbbell className="w-4 h-4 text-violet-500" />
                    Progressão de Carga
                </h4>
                <TrendBadge change={active.overallChange} />
            </div>

            {/* Subtitle */}
            <p className="text-[10px] text-[#86868B] dark:text-k-text-quaternary mb-3">
                Volume total por sessão do mesmo treino · {active.points.length} sessões
            </p>

            {/* Workout Tabs */}
            {data.length > 1 && (
                <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1">
                    {data.map((w, i) => (
                        <button
                            key={w.workoutId}
                            onClick={() => setActiveTab(i)}
                            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all ${
                                i === activeTab
                                    ? 'bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300'
                                    : 'bg-[#F5F5F7] dark:bg-white/5 text-[#6E6E73] dark:text-k-text-tertiary hover:bg-[#E8E8ED] dark:hover:bg-white/10'
                            }`}
                        >
                            <span>{w.workoutName}</span>
                            {w.lastChange != null && (
                                <span className={`ml-1.5 ${
                                    w.lastChange > 1 ? 'text-emerald-500' : w.lastChange < -1 ? 'text-red-500' : 'text-[#AEAEB2] dark:text-k-text-quaternary'
                                }`}>
                                    {w.lastChange > 0 ? '↑' : w.lastChange < -1 ? '↓' : '='}{Math.abs(w.lastChange).toFixed(0)}%
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            )}

            {/* Active workout chart */}
            <WorkoutChart workout={active} />

            {/* Summary row */}
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[#F0F0F0] dark:border-k-border-subtle">
                <div>
                    <p className="text-[9px] font-bold text-[#AEAEB2] dark:text-k-text-quaternary">Primeira sessão</p>
                    <p className="text-sm font-bold text-[#1C1C1E] dark:text-white">{formatTonnage(active.points[0].tonnage)}</p>
                </div>
                <ChevronRight className="w-3 h-3 text-[#D2D2D7] dark:text-k-text-quaternary" />
                <div>
                    <p className="text-[9px] font-bold text-[#AEAEB2] dark:text-k-text-quaternary">Última sessão</p>
                    <p className="text-sm font-bold text-[#1C1C1E] dark:text-white">{formatTonnage(active.points[active.points.length - 1].tonnage)}</p>
                </div>
                {active.overallChange != null && (
                    <div className="ml-auto text-right">
                        <p className="text-[9px] font-bold text-[#AEAEB2] dark:text-k-text-quaternary">Evolução</p>
                        <TrendBadge change={active.overallChange} />
                    </div>
                )}
            </div>
        </div>
    )
}
