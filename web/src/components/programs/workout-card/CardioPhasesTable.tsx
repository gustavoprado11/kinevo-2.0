'use client'

import { Copy, Plus, Trash2 } from 'lucide-react'

import {
    HR_ZONES,
    formatIntensityTarget,
    resolveZoneBpm,
    zonePctLabel,
} from '@kinevo/shared/lib/cardio/zones'
import {
    cardioTotalSeconds,
    formatShortDuration,
} from '@kinevo/shared/lib/cardio/segments'
import type {
    CardioIntensityTarget,
    CardioIntensityType,
    CardioSegment,
} from '@kinevo/shared/types/workout-items'

interface CardioPhasesTableProps {
    segments: CardioSegment[]
    maxHr: number | null
    onChange: (next: CardioSegment[]) => void
}

// Mesma linguagem do SetSchemeTable da força: headers mono micro-caps,
// inputs sem borda com underline violeta no focus, Copy/Trash2 por linha e
// adicionar em violeta. Ordem por inserir/duplicar/remover (sem drag — V1,
// igual às séries).

const headerClass =
    'font-mono text-[9.5px] font-medium uppercase tracking-[0.08em] text-[var(--text-tertiary)] pb-1.5 pr-2'

const cellInputClass =
    'w-full bg-transparent text-xs text-[var(--text-primary)] px-1.5 py-1 border-b border-transparent focus:border-[#7C3AED]/50 dark:focus:border-violet-500/50 focus:outline-none transition-colors placeholder:text-[var(--text-quaternary)]'

const cellSelectClass =
    'bg-transparent text-xs text-[var(--text-primary)] py-1 border-b border-transparent focus:border-[#7C3AED]/50 dark:focus:border-violet-500/50 focus:outline-none cursor-pointer transition-colors'

const monoCellClass = `${cellInputClass} font-mono font-semibold tabular-nums text-center`

function newSteady(): CardioSegment {
    return { kind: 'steady', duration_minutes: 10 }
}

function newIntervalBlock(): CardioSegment {
    return { kind: 'interval', intervals: { work_seconds: 30, rest_seconds: 30, rounds: 8 } }
}

export function CardioPhasesTable({ segments, maxHr, onChange }: CardioPhasesTableProps) {
    const patchSegment = (index: number, patch: Partial<CardioSegment>) => {
        const next = segments.map((s, i) => {
            if (i !== index) return s
            const merged = { ...s, ...patch }
            // String derivada POR segmento acompanha o alvo (mesmo padrão do bloco).
            merged.intensity = merged.intensity_target
                ? (formatIntensityTarget(merged.intensity_target, maxHr) ?? undefined)
                : undefined
            return merged
        })
        onChange(next)
    }

    const addSegment = (segment: CardioSegment) => onChange([...segments, segment])

    const duplicateSegment = (index: number) => {
        const next = [...segments]
        next.splice(index + 1, 0, JSON.parse(JSON.stringify(segments[index])) as CardioSegment)
        onChange(next)
    }

    const removeSegment = (index: number) => {
        if (segments.length <= 1) return
        onChange(segments.filter((_, i) => i !== index))
    }

    const totalSeconds = cardioTotalSeconds({ mode: 'phased', segments })

    return (
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-2.5 py-2">
            <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono text-[9px] font-medium uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
                    Fases
                </span>
                <span className="font-mono text-[11px] font-semibold tabular-nums text-[var(--text-primary)]">
                    ≈ {formatShortDuration(totalSeconds)}
                </span>
            </div>

            <table className="w-full text-xs text-left">
                <thead>
                    <tr>
                        <th className={`${headerClass} w-6`}>#</th>
                        <th className={`${headerClass} w-[18%]`}>Rótulo</th>
                        <th className={`${headerClass} w-[16%]`}>Tipo</th>
                        <th className={headerClass}>Estrutura</th>
                        <th className={headerClass}>Intensidade</th>
                        <th className={`${headerClass} w-14`} aria-label="Ações" />
                    </tr>
                </thead>
                <tbody>
                    {segments.map((segment, index) => (
                        <PhaseRow
                            key={index}
                            index={index}
                            segment={segment}
                            maxHr={maxHr}
                            canRemove={segments.length > 1}
                            onPatch={(patch) => patchSegment(index, patch)}
                            onDuplicate={() => duplicateSegment(index)}
                            onRemove={() => removeSegment(index)}
                        />
                    ))}
                </tbody>
            </table>

            <div className="flex items-center gap-3 mt-1.5">
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation()
                        addSegment(newSteady())
                    }}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#7C3AED] dark:text-violet-400 hover:text-[#6D28D9] dark:hover:text-violet-300 transition-colors"
                >
                    <Plus className="size-3.5" />
                    Fase contínua
                </button>
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation()
                        addSegment(newIntervalBlock())
                    }}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#7C3AED] dark:text-violet-400 hover:text-[#6D28D9] dark:hover:text-violet-300 transition-colors"
                >
                    <Plus className="size-3.5" />
                    Bloco intervalado
                </button>
            </div>
        </div>
    )
}

function PhaseRow({
    index,
    segment,
    maxHr,
    canRemove,
    onPatch,
    onDuplicate,
    onRemove,
}: {
    index: number
    segment: CardioSegment
    maxHr: number | null
    canRemove: boolean
    onPatch: (patch: Partial<CardioSegment>) => void
    onDuplicate: () => void
    onRemove: () => void
}) {
    const target = segment.intensity_target ?? null
    const targetType: CardioIntensityType | '' = target?.type ?? ''

    const setTargetType = (type: CardioIntensityType | '') => {
        onPatch({ intensity_target: type ? ({ type } as CardioIntensityTarget) : undefined })
    }

    return (
        <tr className="border-t border-[var(--border-subtle)]/60 align-middle">
            <td className="font-mono text-[11px] font-semibold tabular-nums text-[var(--text-tertiary)] pr-2">
                {index + 1}
            </td>

            {/* Rótulo opcional */}
            <td className="pr-2">
                <input
                    type="text"
                    value={segment.label ?? ''}
                    onChange={(e) => onPatch({ label: e.target.value || undefined })}
                    onClick={(e) => e.stopPropagation()}
                    placeholder={segment.kind === 'interval' ? 'Tiros' : 'Aquecimento'}
                    aria-label={`Rótulo da fase ${index + 1}`}
                    className={cellInputClass}
                />
            </td>

            {/* Tipo */}
            <td className="pr-2">
                <select
                    value={segment.kind}
                    onChange={(e) => {
                        const kind = e.target.value as CardioSegment['kind']
                        onPatch(
                            kind === 'interval'
                                ? { kind, intervals: segment.intervals ?? { work_seconds: 30, rest_seconds: 30, rounds: 8 } }
                                : { kind, duration_minutes: segment.duration_minutes ?? 10 },
                        )
                    }}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Tipo da fase ${index + 1}`}
                    className={cellSelectClass}
                >
                    <option value="steady">Contínua</option>
                    <option value="interval">Intervalo</option>
                </select>
            </td>

            {/* Estrutura */}
            <td className="pr-2">
                {segment.kind === 'steady' ? (
                    <div className="flex items-baseline gap-1">
                        <input
                            type="number"
                            min={1}
                            value={segment.duration_minutes ?? ''}
                            onChange={(e) => onPatch({ duration_minutes: parseInt(e.target.value) || undefined })}
                            onFocus={(e) => e.target.select()}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="10"
                            aria-label={`Duração da fase ${index + 1} (min)`}
                            className={`${monoCellClass} max-w-[3rem]`}
                        />
                        <span className="text-[10px] text-[var(--text-tertiary)]">min</span>
                    </div>
                ) : (
                    <div className="flex items-baseline gap-1">
                        <input
                            type="number"
                            min={5}
                            value={segment.intervals?.work_seconds ?? ''}
                            onChange={(e) => onPatch({
                                intervals: {
                                    work_seconds: parseInt(e.target.value) || 30,
                                    rest_seconds: segment.intervals?.rest_seconds ?? 30,
                                    rounds: segment.intervals?.rounds ?? 8,
                                },
                            })}
                            onFocus={(e) => e.target.select()}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="30"
                            aria-label={`Trabalho da fase ${index + 1} (s)`}
                            className={`${monoCellClass} max-w-[2.6rem]`}
                        />
                        <span className="text-[10px] text-[var(--text-tertiary)]">/</span>
                        <input
                            type="number"
                            min={0}
                            value={segment.intervals?.rest_seconds ?? ''}
                            onChange={(e) => onPatch({
                                intervals: {
                                    work_seconds: segment.intervals?.work_seconds ?? 30,
                                    rest_seconds: parseInt(e.target.value) || 0,
                                    rounds: segment.intervals?.rounds ?? 8,
                                },
                            })}
                            onFocus={(e) => e.target.select()}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="30"
                            aria-label={`Descanso da fase ${index + 1} (s)`}
                            className={`${monoCellClass} max-w-[2.6rem]`}
                        />
                        <span className="text-[10px] text-[var(--text-tertiary)]">s ×</span>
                        <input
                            type="number"
                            min={1}
                            value={segment.intervals?.rounds ?? ''}
                            onChange={(e) => onPatch({
                                intervals: {
                                    work_seconds: segment.intervals?.work_seconds ?? 30,
                                    rest_seconds: segment.intervals?.rest_seconds ?? 30,
                                    rounds: parseInt(e.target.value) || 1,
                                },
                            })}
                            onFocus={(e) => e.target.select()}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="8"
                            aria-label={`Rounds da fase ${index + 1}`}
                            className={`${monoCellClass} max-w-[2.4rem]`}
                        />
                    </div>
                )}
            </td>

            {/* Intensidade: tipo + valor inline; a string derivada acompanha */}
            <td className="pr-2">
                <div className="flex items-center gap-1 flex-wrap">
                    <select
                        value={targetType}
                        onChange={(e) => setTargetType(e.target.value as CardioIntensityType | '')}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Tipo de intensidade da fase ${index + 1}`}
                        className={cellSelectClass}
                    >
                        <option value="">—</option>
                        <option value="zone">Zona</option>
                        <option value="hr">FC</option>
                        <option value="rpe">RPE</option>
                        <option value="pace">Pace</option>
                    </select>

                    {targetType === 'zone' && (
                        <>
                            <select
                                value={target?.zone ?? ''}
                                onChange={(e) => onPatch({
                                    intensity_target: {
                                        type: 'zone',
                                        zone: (parseInt(e.target.value) || undefined) as CardioIntensityTarget['zone'],
                                    },
                                })}
                                onClick={(e) => e.stopPropagation()}
                                aria-label={`Zona da fase ${index + 1}`}
                                className={`${cellSelectClass} font-mono font-semibold`}
                            >
                                <option value="">—</option>
                                {HR_ZONES.map((z) => (
                                    <option key={z.zone} value={z.zone} title={`${z.label} · ${zonePctLabel(z.zone)}`}>
                                        Z{z.zone}
                                    </option>
                                ))}
                            </select>
                            {target?.zone ? (
                                <span className="font-mono text-[10px] tabular-nums text-[var(--text-tertiary)] whitespace-nowrap">
                                    {(() => {
                                        const bpm = resolveZoneBpm(target.zone, maxHr)
                                        return bpm ? `${bpm.min}–${bpm.max}` : zonePctLabel(target.zone)
                                    })()}
                                </span>
                            ) : null}
                        </>
                    )}

                    {targetType === 'rpe' && (
                        <input
                            type="number"
                            min={1}
                            max={10}
                            value={target?.rpe ?? ''}
                            onChange={(e) => onPatch({
                                intensity_target: { type: 'rpe', rpe: parseInt(e.target.value) || undefined },
                            })}
                            onFocus={(e) => e.target.select()}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="7"
                            aria-label={`RPE da fase ${index + 1}`}
                            className={`${monoCellClass} max-w-[2.4rem]`}
                        />
                    )}

                    {targetType === 'hr' && (
                        <div className="flex items-baseline gap-0.5">
                            <input
                                type="number"
                                min={60}
                                max={230}
                                value={target?.hr_min_bpm ?? ''}
                                onChange={(e) => onPatch({
                                    intensity_target: {
                                        type: 'hr',
                                        hr_min_bpm: parseInt(e.target.value) || undefined,
                                        hr_max_bpm: target?.hr_max_bpm,
                                    },
                                })}
                                onFocus={(e) => e.target.select()}
                                onClick={(e) => e.stopPropagation()}
                                placeholder="130"
                                aria-label={`FC mínima da fase ${index + 1}`}
                                className={`${monoCellClass} max-w-[2.8rem]`}
                            />
                            <span className="text-[10px] text-[var(--text-tertiary)]">–</span>
                            <input
                                type="number"
                                min={60}
                                max={230}
                                value={target?.hr_max_bpm ?? ''}
                                onChange={(e) => onPatch({
                                    intensity_target: {
                                        type: 'hr',
                                        hr_min_bpm: target?.hr_min_bpm,
                                        hr_max_bpm: parseInt(e.target.value) || undefined,
                                    },
                                })}
                                onFocus={(e) => e.target.select()}
                                onClick={(e) => e.stopPropagation()}
                                placeholder="150"
                                aria-label={`FC máxima da fase ${index + 1}`}
                                className={`${monoCellClass} max-w-[2.8rem]`}
                            />
                        </div>
                    )}

                    {targetType === 'pace' && (
                        <input
                            type="text"
                            value={target?.pace_min_per_km ?? ''}
                            onChange={(e) => onPatch({
                                intensity_target: { type: 'pace', pace_min_per_km: e.target.value || undefined },
                            })}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="5:30"
                            aria-label={`Pace da fase ${index + 1}`}
                            className={`${monoCellClass} max-w-[4rem] text-left`}
                        />
                    )}
                </div>
            </td>

            {/* Ações */}
            <td>
                <div className="flex items-center justify-end gap-0.5">
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation()
                            onDuplicate()
                        }}
                        className="h-6 w-6 inline-flex items-center justify-center rounded-md text-[var(--text-quaternary)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg)] transition-colors"
                        aria-label={`Duplicar fase ${index + 1}`}
                        title="Duplicar fase"
                    >
                        <Copy className="size-3.5" />
                    </button>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation()
                            onRemove()
                        }}
                        disabled={!canRemove}
                        className="h-6 w-6 inline-flex items-center justify-center rounded-md text-[var(--text-quaternary)] hover:text-[var(--destructive)] hover:bg-[var(--glass-bg)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label={`Remover fase ${index + 1}`}
                        title={canRemove ? 'Remover fase' : 'O bloco precisa de ao menos 1 fase'}
                    >
                        <Trash2 className="size-3.5" />
                    </button>
                </div>
            </td>
        </tr>
    )
}
