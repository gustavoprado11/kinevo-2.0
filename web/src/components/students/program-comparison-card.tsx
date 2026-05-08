'use client'

import { useEffect, useMemo, useState } from 'react'
import { GitCompareArrows, ArrowRight, ChevronDown, ChevronUp, X, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { ProgramMuscleVolume } from '@/app/students/[id]/actions/get-program-muscle-volume'

interface ProgramComparisonCardProps {
    currentProgramId: string
    currentProgramName: string
    previousProgramId: string
    previousProgramName: string
    /**
     * Onda 2 — Quando true, renderiza um strip compacto com 1 card de Volume
     * (com %change real) + link "Ver comparação detalhada por grupo muscular →"
     * que abre a versão completa em modal. Padrão: false (versão completa
     * inline, comportamento original).
     *
     * Carga média e PSE média ficaram fora de escopo nesta onda — viram
     * follow-up até existirem actions/dados que sustentem (ver log).
     */
    compact?: boolean
}

/** Abbreviate long muscle group names for compact display */
function shortName(name: string): string {
    const map: Record<string, string> = {
        'Posterior de Coxa': 'Post. Coxa',
        'Panturrilha': 'Panturrilha',
        'Abdominais': 'Abdominais',
        'Quadríceps': 'Quadríceps',
    }
    return map[name] || name
}

/** Color for each muscle group bar based on the group name */
function barColor(name: string): string {
    const colors: Record<string, string> = {
        'Peito': 'bg-blue-500',
        'Costas': 'bg-emerald-500',
        'Quadríceps': 'bg-violet-500',
        'Posterior de Coxa': 'bg-purple-500',
        'Ombros': 'bg-amber-500',
        'Bíceps': 'bg-rose-500',
        'Tríceps': 'bg-orange-500',
        'Glúteo': 'bg-pink-500',
        'Panturrilha': 'bg-teal-500',
        'Abdominais': 'bg-indigo-500',
        'Adutores': 'bg-cyan-500',
    }
    return colors[name] || 'bg-gray-400'
}

function barColorPrev(name: string): string {
    const colors: Record<string, string> = {
        'Peito': 'bg-blue-300 dark:bg-blue-500/30',
        'Costas': 'bg-emerald-300 dark:bg-emerald-500/30',
        'Quadríceps': 'bg-violet-300 dark:bg-violet-500/30',
        'Posterior de Coxa': 'bg-purple-300 dark:bg-purple-500/30',
        'Ombros': 'bg-amber-300 dark:bg-amber-500/30',
        'Bíceps': 'bg-rose-300 dark:bg-rose-500/30',
        'Tríceps': 'bg-orange-300 dark:bg-orange-500/30',
        'Glúteo': 'bg-pink-300 dark:bg-pink-500/30',
        'Panturrilha': 'bg-teal-300 dark:bg-teal-500/30',
        'Abdominais': 'bg-indigo-300 dark:bg-indigo-500/30',
        'Adutores': 'bg-cyan-300 dark:bg-cyan-500/30',
    }
    return colors[name] || 'bg-gray-300 dark:bg-gray-500/30'
}

export function ProgramComparisonCard({
    currentProgramId,
    currentProgramName,
    previousProgramId,
    previousProgramName,
    compact = false,
}: ProgramComparisonCardProps) {
    const [currentVolume, setCurrentVolume] = useState<ProgramMuscleVolume | null>(null)
    const [previousVolume, setPreviousVolume] = useState<ProgramMuscleVolume | null>(null)
    const [loading, setLoading] = useState(true)
    const [expanded, setExpanded] = useState(false)
    // Modal aberto pelo strip compact com a versão completa do mesmo componente.
    const [detailsOpen, setDetailsOpen] = useState(false)

    useEffect(() => {
        let cancelled = false
        async function load() {
            const { getProgramMuscleVolume } = await import(
                '@/app/students/[id]/actions/get-program-muscle-volume'
            )
            const [curr, prev] = await Promise.all([
                getProgramMuscleVolume(currentProgramId),
                getProgramMuscleVolume(previousProgramId),
            ])
            if (cancelled) return
            if (curr.success && curr.data) setCurrentVolume(curr.data)
            if (prev.success && prev.data) setPreviousVolume(prev.data)
            setLoading(false)
        }
        load()
        return () => { cancelled = true }
    }, [currentProgramId, previousProgramId])

    // Merge all muscle groups from both programs
    const rows = useMemo(() => {
        if (!currentVolume || !previousVolume) return []

        const allGroups = new Set<string>()
        currentVolume.groups.forEach(g => allGroups.add(g.muscleGroup))
        previousVolume.groups.forEach(g => allGroups.add(g.muscleGroup))

        const prevMap = new Map(previousVolume.groups.map(g => [g.muscleGroup, g.sets]))
        const currMap = new Map(currentVolume.groups.map(g => [g.muscleGroup, g.sets]))

        const result = Array.from(allGroups).map(group => {
            const prev = prevMap.get(group) || 0
            const curr = currMap.get(group) || 0
            const diff = curr - prev
            return { group, prev, curr, diff }
        })

        // Sort by current volume descending, then by name
        result.sort((a, b) => b.curr - a.curr || a.group.localeCompare(b.group))

        return result
    }, [currentVolume, previousVolume])

    const maxSets = useMemo(() => {
        if (rows.length === 0) return 1
        return Math.max(...rows.map(r => Math.max(r.curr, r.prev)), 1)
    }, [rows])

    // ── Onda 2 — Strip compact com 1 card de Volume + link pra modal ────────
    if (compact) {
        const totalDiff = (currentVolume?.totalSets || 0) - (previousVolume?.totalSets || 0)
        const prevTotal = previousVolume?.totalSets || 0
        const currTotal = currentVolume?.totalSets || 0
        const pctChange = prevTotal > 0 ? Math.round(((currTotal - prevTotal) / prevTotal) * 100) : null

        return (
            <>
                <div className="bg-white dark:bg-glass-bg backdrop-blur-md rounded-2xl border border-transparent dark:border-k-border-primary shadow-sm dark:shadow-none p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <GitCompareArrows className="w-4 h-4 text-violet-500" />
                        <h4 className="text-sm font-semibold text-[#1C1C1E] dark:text-white">Comparativo de volume</h4>
                    </div>

                    {loading ? (
                        <div className="h-16 bg-[#F5F5F7] dark:bg-white/5 rounded-xl animate-pulse" />
                    ) : rows.length === 0 ? (
                        <p className="text-xs text-k-text-quaternary italic">Sem dados de volume comparáveis.</p>
                    ) : (
                        <>
                            <div className="rounded-xl bg-[#F5F5F7] dark:bg-white/5 p-3">
                                <p className="text-[10px] font-bold text-[#86868B] dark:text-k-text-quaternary uppercase tracking-wider">
                                    Volume total · séries
                                </p>
                                <div className="flex items-baseline gap-2 mt-1">
                                    <span className="text-2xl font-black text-[#1C1C1E] dark:text-white tracking-tighter">
                                        {currTotal}
                                    </span>
                                    <span className="text-[11px] text-[#86868B] dark:text-k-text-quaternary">
                                        vs {prevTotal} anterior
                                    </span>
                                </div>
                                {pctChange != null && totalDiff !== 0 && (
                                    <span
                                        className={`mt-1 inline-flex items-center gap-0.5 text-[11px] font-bold ${
                                            totalDiff > 0
                                                ? 'text-emerald-600 dark:text-emerald-400'
                                                : 'text-amber-600 dark:text-amber-400'
                                        }`}
                                    >
                                        {totalDiff > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                        {pctChange > 0 ? '+' : ''}
                                        {pctChange}% ({totalDiff > 0 ? '+' : ''}
                                        {totalDiff} séries)
                                    </span>
                                )}
                                {pctChange == null && totalDiff === 0 && (
                                    <span className="mt-1 inline-flex items-center gap-0.5 text-[11px] font-bold text-k-text-quaternary">
                                        <Minus className="w-3 h-3" />
                                        sem variação
                                    </span>
                                )}
                            </div>

                            <button
                                type="button"
                                onClick={() => setDetailsOpen(true)}
                                className="mt-3 text-[11px] font-bold text-violet-500 hover:text-violet-400 transition-colors"
                            >
                                Ver comparação detalhada por grupo muscular →
                            </button>
                        </>
                    )}
                </div>

                {detailsOpen && (
                    <div
                        className="fixed inset-0 z-modal flex items-center justify-center p-4"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Comparativo de volume detalhado"
                    >
                        <div
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={() => setDetailsOpen(false)}
                            aria-hidden="true"
                        />
                        <div className="relative bg-white dark:bg-surface-card border border-[#D2D2D7] dark:border-k-border-primary rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto">
                            <button
                                type="button"
                                onClick={() => setDetailsOpen(false)}
                                aria-label="Fechar"
                                className="absolute top-3 right-3 z-sticky p-1.5 text-k-text-quaternary hover:text-k-text-primary hover:bg-glass-bg rounded-lg transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                            {/* Reusa a versão completa do mesmo componente; ela faz o
                                próprio fetch (custo aceitável — ver follow-up
                                useProgramVolumeComparison no log da Onda 2). */}
                            <ProgramComparisonCard
                                currentProgramId={currentProgramId}
                                currentProgramName={currentProgramName}
                                previousProgramId={previousProgramId}
                                previousProgramName={previousProgramName}
                            />
                        </div>
                    </div>
                )}
            </>
        )
    }

    // ── Versão completa (default) ─────────────────────────────────────────────
    if (loading) {
        return (
            <div className="bg-white dark:bg-glass-bg backdrop-blur-md rounded-2xl border border-transparent dark:border-k-border-primary shadow-sm dark:shadow-none p-5">
                <div className="flex items-center gap-2 mb-3">
                    <GitCompareArrows className="w-4 h-4 text-violet-500" />
                    <h4 className="text-sm font-semibold text-[#1C1C1E] dark:text-white">Comparativo</h4>
                </div>
                <div className="space-y-2">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-6 bg-[#F5F5F7] dark:bg-white/5 rounded animate-pulse" />
                    ))}
                </div>
            </div>
        )
    }

    if (rows.length === 0) return null

    const visibleRows = expanded ? rows : rows.slice(0, 6)
    const hasMore = rows.length > 6

    const totalDiff = (currentVolume?.totalSets || 0) - (previousVolume?.totalSets || 0)

    return (
        <div className="bg-white dark:bg-glass-bg backdrop-blur-md rounded-2xl border border-transparent dark:border-k-border-primary shadow-sm dark:shadow-none p-5">
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
                <GitCompareArrows className="w-4 h-4 text-violet-500" />
                <h4 className="text-sm font-semibold text-[#1C1C1E] dark:text-white">
                    Volume por Grupo Muscular
                </h4>
            </div>

            {/* Program names */}
            <div className="flex items-center gap-2 mb-4 text-[11px]">
                <span className="px-2 py-1 rounded-lg bg-[#F5F5F7] dark:bg-white/5 text-[#6E6E73] dark:text-k-text-tertiary font-medium truncate max-w-[42%]">
                    {previousProgramName}
                </span>
                <ArrowRight className="w-3 h-3 text-[#D2D2D7] dark:text-k-text-quaternary shrink-0" />
                <span className="px-2 py-1 rounded-lg bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 font-semibold truncate max-w-[42%]">
                    {currentProgramName}
                </span>
            </div>

            {/* Muscle group rows */}
            <div className="space-y-2.5">
                {visibleRows.map(row => (
                    <div key={row.group}>
                        {/* Label + values */}
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-medium text-[#6E6E73] dark:text-k-text-tertiary">
                                {shortName(row.group)}
                            </span>
                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-[#AEAEB2] dark:text-k-text-quaternary">
                                    {row.prev}
                                </span>
                                <ArrowRight className="w-2 h-2 text-[#D2D2D7] dark:text-k-text-quaternary" />
                                <span className="text-[10px] font-bold text-[#1C1C1E] dark:text-white">
                                    {row.curr}
                                </span>
                                {row.diff !== 0 && (
                                    <span className={`text-[9px] font-bold ${
                                        row.diff > 0 ? 'text-emerald-500' : 'text-amber-500'
                                    }`}>
                                        {row.diff > 0 ? '+' : ''}{row.diff}
                                    </span>
                                )}
                            </div>
                        </div>
                        {/* Stacked bar */}
                        <div className="relative h-2 bg-[#F5F5F7] dark:bg-white/5 rounded-full overflow-hidden">
                            {/* Previous (faded, behind) */}
                            <div
                                className={`absolute inset-y-0 left-0 rounded-full ${barColorPrev(row.group)} transition-all duration-500`}
                                style={{ width: `${(row.prev / maxSets) * 100}%` }}
                            />
                            {/* Current (solid, on top) */}
                            <div
                                className={`absolute inset-y-0 left-0 rounded-full ${barColor(row.group)} transition-all duration-500`}
                                style={{ width: `${(row.curr / maxSets) * 100}%`, opacity: 0.85 }}
                            />
                        </div>
                    </div>
                ))}
            </div>

            {/* Show more / less */}
            {hasMore && (
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="flex items-center gap-1 mt-3 text-[10px] font-bold text-violet-500 hover:text-violet-400 transition-colors"
                >
                    {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {expanded ? 'Menos' : `+${rows.length - 6} grupos`}
                </button>
            )}

            {/* Total summary */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#F0F0F0] dark:border-k-border-subtle">
                <span className="text-[10px] font-bold text-[#86868B] dark:text-k-text-quaternary uppercase tracking-wide">
                    Total séries
                </span>
                <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[#AEAEB2] dark:text-k-text-quaternary">
                        {previousVolume?.totalSets || 0}
                    </span>
                    <ArrowRight className="w-2.5 h-2.5 text-[#D2D2D7] dark:text-k-text-quaternary" />
                    <span className="text-[11px] font-bold text-[#1C1C1E] dark:text-white">
                        {currentVolume?.totalSets || 0}
                    </span>
                    {totalDiff !== 0 && (
                        <span className={`text-[10px] font-bold ${
                            totalDiff > 0 ? 'text-emerald-500' : 'text-amber-500'
                        }`}>
                            {totalDiff > 0 ? '+' : ''}{totalDiff}
                        </span>
                    )}
                </div>
            </div>
        </div>
    )
}
