'use client'

// Régua da PROGRESSÃO SEMANAL do bloco aeróbio — a "lente" que troca a semana
// que o editor abaixo mostra/edita. S1 = base do bloco; semanas personalizadas
// ganham marcador de tinta; um override vale A PARTIR da sua semana (resolução
// canônica em shared/lib/cardio/progression.ts). Mesma linguagem do redesign:
// mono micro-caps, tinta só como estado, violeta só na ação.

import { CalendarRange, Trash2 } from 'lucide-react'

import type { CardioConfig, CardioWeekOverride } from '@kinevo/shared/types/workout-items'
import { maxProgressionWeek, resolveCardioForWeek } from '@kinevo/shared/lib/cardio/progression'

interface CardioWeeklyProgressionProps {
    config: CardioConfig
    durationWeeks: number | null
    selectedWeek: number | null
    onSelectWeek: (week: number | null) => void
    /** Upsert de metadados do override da semana (rótulo). */
    onPatchOverride: (week: number, patch: Partial<Pick<CardioWeekOverride, 'label'>>) => void
    /** Remove a personalização de UMA semana (volta a herdar). */
    onRemoveOverride: (week: number) => void
    /** Remove a progressão inteira. */
    onClearProgression: () => void
}

export function CardioWeeklyProgression({
    config,
    durationWeeks,
    selectedWeek,
    onSelectWeek,
    onPatchOverride,
    onRemoveOverride,
    onClearProgression,
}: CardioWeeklyProgressionProps) {
    const progression = config.progression ?? []
    const overrideWeeks = new Set(progression.map((o) => o.week))
    const maxWeek = maxProgressionWeek(config) ?? 1
    // Régua: duração do programa quando definida; senão o suficiente para ver
    // as semanas já personalizadas + espaço para a próxima.
    const totalWeeks = Math.min(52, Math.max(durationWeeks ?? 0, maxWeek + 1, 8))

    const selectedOverride = selectedWeek != null
        ? progression.find((o) => o.week === selectedWeek) ?? null
        : null
    const resolved = selectedWeek != null ? resolveCardioForWeek(config, selectedWeek) : null

    return (
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-2.5 py-2">
            <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                    <CalendarRange className="size-4 shrink-0 text-[var(--text-tertiary)]" aria-hidden />
                    <span className="font-mono text-[9px] font-medium uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
                        Progressão semanal
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {durationWeeks == null && (
                        <span className="text-[10px] text-amber-600 dark:text-amber-400">
                            Defina a duração do programa para dimensionar as semanas
                        </span>
                    )}
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation()
                            onClearProgression()
                        }}
                        className="text-[10.5px] font-medium text-[var(--text-tertiary)] hover:text-[var(--destructive)] transition-colors"
                        title="Remove todas as personalizações de semana — o bloco volta a ser igual toda semana"
                    >
                        Remover progressão
                    </button>
                </div>
            </div>

            {/* Régua de semanas */}
            <div className="flex items-center gap-1 flex-wrap" role="group" aria-label="Semana da progressão">
                {Array.from({ length: totalWeeks }, (_, i) => i + 1).map((week) => {
                    const isBase = week === 1
                    const hasOverride = overrideWeeks.has(week)
                    const isSelected = isBase ? selectedWeek == null : selectedWeek === week
                    return (
                        <button
                            key={week}
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation()
                                onSelectWeek(isBase ? null : week)
                            }}
                            title={
                                isBase
                                    ? 'Semana 1 — a base do bloco'
                                    : hasOverride
                                        ? `Semana ${week} — personalizada`
                                        : `Semana ${week} — herda da anterior`
                            }
                            aria-label={`Semana ${week}${hasOverride || isBase ? ' (definida)' : ''}`}
                            aria-pressed={isSelected}
                            className={`relative w-8 h-7 rounded-[6px] font-mono text-[11px] font-semibold tabular-nums transition-colors border ${
                                isSelected
                                    ? 'bg-[var(--text-primary)] border-[var(--text-primary)] text-[var(--surface-card)]'
                                    : hasOverride || isBase
                                        ? 'bg-[var(--surface-card)] border-[var(--border-primary)] text-[var(--text-primary)]'
                                        : 'bg-transparent border-[var(--border-subtle)] text-[var(--text-quaternary)] hover:text-[var(--text-primary)] hover:border-[var(--border-primary)]'
                            }`}
                        >
                            {week}
                            {(hasOverride || isBase) && !isSelected && (
                                <span
                                    className="absolute left-1/2 -translate-x-1/2 bottom-0.5 size-[3px] rounded-full bg-[var(--text-primary)]"
                                    aria-hidden
                                />
                            )}
                        </button>
                    )
                })}
            </div>

            {/* Linha de contexto da semana selecionada */}
            <div className="mt-1.5 flex items-center gap-2 flex-wrap min-h-6">
                {selectedWeek == null ? (
                    <span className="text-[11px] text-[var(--text-tertiary)]">
                        Editando a <span className="font-medium text-[var(--text-primary)]">base (semana 1)</span> — semanas sem personalização herdam dela.
                    </span>
                ) : selectedOverride ? (
                    <>
                        <span className="text-[11px] text-[var(--text-tertiary)]">
                            Semana <span className="font-medium text-[var(--text-primary)]">{selectedWeek}</span> personalizada
                            {selectedOverride.mode ? ' (estrutura própria)' : ''} · vale até a próxima personalizada
                        </span>
                        <input
                            type="text"
                            value={selectedOverride.label ?? ''}
                            onChange={(e) => onPatchOverride(selectedWeek, { label: e.target.value || undefined })}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="Rótulo (ex.: Regenerativa)"
                            aria-label={`Rótulo da semana ${selectedWeek}`}
                            className="bg-transparent text-[11px] font-medium text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] border-b border-[var(--border-subtle)] focus:border-[#7C3AED]/50 dark:focus:border-violet-500/50 focus:outline-none px-0.5 py-0.5 max-w-[11rem]"
                        />
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation()
                                onRemoveOverride(selectedWeek)
                            }}
                            className="inline-flex items-center gap-1 text-[10.5px] font-medium text-[var(--text-tertiary)] hover:text-[var(--destructive)] transition-colors"
                            title="Remove a personalização — a semana volta a herdar da anterior"
                        >
                            <Trash2 className="size-3" />
                            Voltar a herdar
                        </button>
                    </>
                ) : (
                    <span className="text-[11px] text-[var(--text-tertiary)]">
                        Semana <span className="font-medium text-[var(--text-primary)]">{selectedWeek}</span> herda da{' '}
                        {resolved?.overrideWeek ? `semana ${resolved.overrideWeek}` : 'base'}
                        {resolved?.label ? ` (${resolved.label})` : ''} — editar os campos abaixo personaliza esta semana.
                    </span>
                )}
            </div>
        </div>
    )
}
