'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, ChevronDown, ChevronUp, X } from 'lucide-react'
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

// Redesign "ferramenta profissional": a paleta arco-íris por grupo muscular
// saiu — o grupo já está escrito na linha, a cor não carregava informação.
// Barra atual em tinta + marcador fino na posição do programa anterior;
// o delta numérico faz o resto.

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
                <div className="bg-surface-card rounded-panel border border-k-border-subtle p-5">
                    <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-k-text-tertiary">
                        Comparativo de volume
                    </span>

                    {loading ? (
                        <div className="h-16 bg-surface-inset rounded-control animate-pulse mt-3" />
                    ) : rows.length === 0 ? (
                        <p className="text-xs text-k-text-quaternary mt-3">Sem dados de volume comparáveis.</p>
                    ) : (
                        <>
                            <div className="mt-2">
                                <div className="flex items-baseline gap-2">
                                    <span className="text-[26px] leading-tight font-bold tracking-tight text-k-text-primary tabular-nums">
                                        {currTotal}
                                    </span>
                                    <span className="text-[11.5px] text-k-text-tertiary tabular-nums">
                                        séries · vs {prevTotal} no anterior
                                    </span>
                                </div>
                                {pctChange != null && totalDiff !== 0 && (
                                    <span
                                        className={`font-mono text-[11px] font-medium tabular-nums ${
                                            totalDiff > 0
                                                ? 'text-emerald-600 dark:text-emerald-400'
                                                : 'text-amber-600 dark:text-amber-400'
                                        }`}
                                    >
                                        {pctChange > 0 ? '+' : ''}
                                        {pctChange}% ({totalDiff > 0 ? '+' : ''}
                                        {totalDiff} séries)
                                    </span>
                                )}
                                {pctChange == null && totalDiff === 0 && (
                                    <span className="font-mono text-[11px] text-k-text-quaternary">
                                        sem variação
                                    </span>
                                )}
                            </div>

                            <button
                                type="button"
                                onClick={() => setDetailsOpen(true)}
                                className="mt-3 text-[11px] font-semibold text-primary hover:opacity-80 transition-opacity"
                            >
                                Ver comparação detalhada por grupo muscular
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
                        <div className="relative bg-surface-card border border-k-border-primary rounded-panel shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto">
                            <button
                                type="button"
                                onClick={() => setDetailsOpen(false)}
                                aria-label="Fechar"
                                className="absolute top-3 right-3 z-sticky p-1.5 text-k-text-quaternary hover:text-k-text-primary hover:bg-surface-inset rounded-control transition-colors"
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
            <div className="bg-surface-card rounded-panel border border-k-border-subtle p-5">
                <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-k-text-tertiary">
                    Comparativo
                </span>
                <div className="space-y-2 mt-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-6 bg-surface-inset rounded-control animate-pulse" />
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
        <div className="bg-surface-card rounded-panel border border-k-border-subtle p-5">
            {/* Header */}
            <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-k-text-tertiary">
                Volume por grupo muscular
            </span>

            {/* Program names */}
            <div className="flex items-center gap-2 mt-2 mb-4 text-[11px]">
                <span className="text-k-text-tertiary truncate max-w-[42%]">
                    {previousProgramName}
                </span>
                <ArrowRight className="w-3 h-3 text-k-text-quaternary shrink-0" />
                <span className="font-semibold text-k-text-primary truncate max-w-[42%]">
                    {currentProgramName}
                </span>
            </div>

            {/* Muscle group rows — barra em tinta + marcador do programa anterior */}
            <div className="space-y-2.5">
                {visibleRows.map(row => (
                    <div key={row.group}>
                        {/* Label + values */}
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-medium text-k-text-secondary">
                                {shortName(row.group)}
                            </span>
                            <div className="flex items-center gap-1.5 font-mono text-[10px] tabular-nums">
                                <span className="text-k-text-quaternary">
                                    {row.prev}
                                </span>
                                <ArrowRight className="w-2 h-2 text-k-text-quaternary" />
                                <span className="font-semibold text-k-text-primary">
                                    {row.curr}
                                </span>
                                {row.diff !== 0 && (
                                    <span className={`font-medium ${
                                        row.diff > 0
                                            ? 'text-emerald-600 dark:text-emerald-400'
                                            : 'text-amber-600 dark:text-amber-400'
                                    }`}>
                                        {row.diff > 0 ? '+' : ''}{row.diff}
                                    </span>
                                )}
                            </div>
                        </div>
                        {/* Barra atual em tinta; marcador fino = programa anterior */}
                        <div className="relative h-1.5 bg-surface-inset rounded-full">
                            <div
                                className="absolute inset-y-0 left-0 rounded-full bg-k-text-secondary transition-all duration-500"
                                style={{ width: `${(row.curr / maxSets) * 100}%` }}
                            />
                            {row.prev > 0 && (
                                <div
                                    className="absolute -top-0.5 -bottom-0.5 w-px bg-k-text-quaternary transition-all duration-500"
                                    style={{ left: `${(row.prev / maxSets) * 100}%` }}
                                />
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Show more / less */}
            {hasMore && (
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="flex items-center gap-1 mt-3 text-[10.5px] font-semibold text-primary hover:opacity-80 transition-opacity"
                >
                    {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {expanded ? 'Menos' : `+${rows.length - 6} grupos`}
                </button>
            )}

            {/* Total summary */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-k-border-subtle">
                <span className="font-mono text-[9px] font-medium uppercase tracking-[0.08em] text-k-text-quaternary">
                    Total séries
                </span>
                <div className="flex items-center gap-2 font-mono text-[11px] tabular-nums">
                    <span className="text-k-text-quaternary">
                        {previousVolume?.totalSets || 0}
                    </span>
                    <ArrowRight className="w-2.5 h-2.5 text-k-text-quaternary" />
                    <span className="font-semibold text-k-text-primary">
                        {currentVolume?.totalSets || 0}
                    </span>
                    {totalDiff !== 0 && (
                        <span className={`font-medium ${
                            totalDiff > 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-amber-600 dark:text-amber-400'
                        }`}>
                            {totalDiff > 0 ? '+' : ''}{totalDiff}
                        </span>
                    )}
                </div>
            </div>
        </div>
    )
}
