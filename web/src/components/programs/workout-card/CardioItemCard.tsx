'use client'

import { Activity, Clock, Gauge, ListChecks, Repeat, Trash2, Zap } from 'lucide-react'
import { useState, type HTMLAttributes } from 'react'

import {
    CARDIO_EQUIPMENT_LABELS,
    CARDIO_EQUIPMENT_OPTIONS,
    type CardioConfig,
    type CardioEquipment,
    type CardioIntensityTarget,
    type CardioIntensityType,
    type CardioMode,
    type CardioObjective,
} from '@kinevo/shared/types/workout-items'
import { HR_ZONES, formatIntensityTarget, resolveZoneBpm, zonePctLabel } from '@kinevo/shared/lib/cardio/zones'
import { CARDIO_PROTOCOLS, protocolMatchesIntervals } from '@kinevo/shared/lib/cardio/interval-protocols'
import {
    cardioTotalSeconds,
    formatShortDuration,
    summarizeSegments,
} from '@kinevo/shared/lib/cardio/segments'
import type { CardioSegment } from '@kinevo/shared/types/workout-items'

import type { WorkoutItem } from '../program-builder-client'
import { CardioPhasesTable } from './CardioPhasesTable'
import { TechnicalNote } from './ExerciseMetadataSection'
import { WorkoutCardShell } from './WorkoutCardShell'
import { useCardioStudentMaxHr } from './cardio-student-context'
import {
    FieldCard,
    KeyChip,
    SegmentGroup,
    UnitSuffix,
    fieldInputClass,
    fieldSelectChevronStyle,
    fieldSelectClass,
} from './field-primitives'

interface CardioItemCardProps {
    item: WorkoutItem
    onUpdate: (updates: Partial<WorkoutItem>) => void
    onDelete: () => void
    dragHandleProps?: HTMLAttributes<HTMLDivElement>
    readonly?: boolean
}

function isCardioFilled(config: CardioConfig): boolean {
    if (config.mode === 'phased') return (config.segments?.length ?? 0) > 0
    if (config.mode === 'interval' && config.intervals) return true
    return !!(config.duration_minutes || config.distance_km || config.equipment || config.intensity)
}

function cardioCompactSummary(config: CardioConfig): string {
    const mode = config.mode || 'continuous'
    const parts: string[] = []

    if (mode === 'phased') {
        const segments = config.segments ?? []
        parts.push(`Por fases (${segments.length})`)
        if (config.equipment) parts.push(CARDIO_EQUIPMENT_LABELS[config.equipment] || config.equipment)
        const total = cardioTotalSeconds(config)
        if (total > 0) parts.push(`≈ ${formatShortDuration(total)}`)
        const summary = summarizeSegments(segments)
        if (summary) parts.push(summary)
        return parts.join(' · ')
    }

    if (mode === 'interval') {
        // Protocolo nomeado vira o "título" do resumo quando os números ainda batem.
        const protocol = protocolMatchesIntervals(config.protocol_key, config.intervals ?? null)
            ? CARDIO_PROTOCOLS.find(p => p.key === config.protocol_key)
            : null
        parts.push(protocol?.label ?? 'Intervalado')
    } else {
        parts.push('Contínuo')
    }

    if (config.equipment) {
        parts.push(CARDIO_EQUIPMENT_LABELS[config.equipment] || config.equipment)
    }

    if (mode === 'interval' && config.intervals) {
        parts.push(`${config.intervals.work_seconds}s ON`)
        parts.push(`${config.intervals.rest_seconds}s OFF`)
        parts.push(`${config.intervals.rounds} rounds`)
        if (config.intensity) parts.push(config.intensity)
    } else {
        if (config.duration_minutes) parts.push(`${config.duration_minutes} min`)
        if (config.distance_km) parts.push(`${config.distance_km} km`)
        if (config.intensity) parts.push(config.intensity)
    }

    return parts.join(' · ')
}

// Ordem fixa do seletor de tipo de alvo. 'free' = campo legado de texto livre.
const TARGET_TYPES: Array<{ key: CardioIntensityType | 'free'; label: string }> = [
    { key: 'free', label: 'Livre' },
    { key: 'zone', label: 'Zona' },
    { key: 'hr', label: 'FC' },
    { key: 'rpe', label: 'RPE' },
    { key: 'pace', label: 'Pace' },
]

/** Alvo de intensidade (Livre | Zona | FC | RPE | Pace) na linguagem do
 *  redesign: segmento neutro + teclas mono; a seleção é tinta, não cor de
 *  tipo. Grava o alvo estruturado E a string derivada em `intensity`. */
function IntensityTargetControl({
    config,
    maxHr,
    onPatch,
}: {
    config: CardioConfig
    maxHr: number | null
    onPatch: (patch: Partial<CardioConfig>) => void
}) {
    const target = config.intensity_target ?? null
    const activeType: CardioIntensityType | 'free' = target?.type ?? 'free'

    const setTarget = (t: CardioIntensityTarget | undefined) => {
        onPatch({
            intensity_target: t,
            intensity: t ? (formatIntensityTarget(t, maxHr) ?? undefined) : config.intensity,
        })
    }

    return (
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-2.5 py-2">
            <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                    <Gauge className="size-4 shrink-0 text-[var(--text-tertiary)]" aria-hidden />
                    <span className="font-mono text-[9px] font-medium uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
                        Intensidade
                    </span>
                </div>
                <SegmentGroup
                    ariaLabel="Tipo de alvo de intensidade"
                    size="xs"
                    options={TARGET_TYPES.map(({ key, label }) => ({ value: key, label }))}
                    value={activeType}
                    onChange={(key) => {
                        if (key === 'free') setTarget(undefined)
                        else if (key !== activeType) setTarget({ type: key })
                    }}
                />
            </div>

            {activeType === 'free' && (
                <input
                    type="text"
                    value={config.intensity || ''}
                    onChange={(e) => onPatch({ intensity: e.target.value || undefined })}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="Ex: Zona 2, RPE 6, 130bpm"
                    className="w-full bg-transparent text-[13px] font-medium text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] focus:outline-none p-0"
                />
            )}

            {activeType === 'zone' && (
                <div className="flex items-center gap-2.5 flex-wrap">
                    <div className="flex items-center gap-1" role="group" aria-label="Zona de FC">
                        {HR_ZONES.map((z) => (
                            <KeyChip
                                key={z.zone}
                                selected={target?.zone === z.zone}
                                onClick={() => setTarget({ type: 'zone', zone: z.zone })}
                                title={`${z.label} · ${zonePctLabel(z.zone)}`}
                            >
                                Z{z.zone}
                            </KeyChip>
                        ))}
                    </div>
                    {target?.zone ? (
                        <span className="font-mono text-[12px] font-semibold tabular-nums text-[var(--text-primary)]">
                            {(() => {
                                const bpm = resolveZoneBpm(target.zone, maxHr)
                                return bpm ? `${bpm.min}–${bpm.max} bpm` : zonePctLabel(target.zone)
                            })()}
                            <span className="ml-1.5 font-sans text-[11px] font-medium text-[var(--text-tertiary)]">
                                {HR_ZONES.find(z => z.zone === target.zone)?.label}
                            </span>
                        </span>
                    ) : null}
                    {target?.zone && !maxHr && (
                        <span className="text-[10px] text-amber-600 dark:text-amber-400">
                            Defina a FCmáx no perfil do aluno para ver a faixa em bpm
                        </span>
                    )}
                </div>
            )}

            {activeType === 'hr' && (
                <div className="flex items-baseline gap-1.5">
                    <input
                        type="number"
                        min={60}
                        max={230}
                        value={target?.hr_min_bpm ?? ''}
                        onChange={(e) => setTarget({
                            type: 'hr',
                            hr_min_bpm: parseInt(e.target.value) || undefined,
                            hr_max_bpm: target?.hr_max_bpm,
                        })}
                        onFocus={(e) => e.target.select()}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="130"
                        aria-label="FC mínima (bpm)"
                        className={`${fieldInputClass} max-w-[3rem] text-center`}
                    />
                    <span className="text-[11px] text-[var(--text-tertiary)]">a</span>
                    <input
                        type="number"
                        min={60}
                        max={230}
                        value={target?.hr_max_bpm ?? ''}
                        onChange={(e) => setTarget({
                            type: 'hr',
                            hr_min_bpm: target?.hr_min_bpm,
                            hr_max_bpm: parseInt(e.target.value) || undefined,
                        })}
                        onFocus={(e) => e.target.select()}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="150"
                        aria-label="FC máxima (bpm)"
                        className={`${fieldInputClass} max-w-[3rem] text-center`}
                    />
                    <UnitSuffix>bpm</UnitSuffix>
                </div>
            )}

            {activeType === 'rpe' && (
                <div className="flex items-center gap-1 flex-wrap" role="group" aria-label="RPE alvo">
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                        <KeyChip
                            key={n}
                            width="w-6"
                            selected={target?.rpe === n}
                            onClick={() => setTarget({ type: 'rpe', rpe: n })}
                        >
                            {n}
                        </KeyChip>
                    ))}
                </div>
            )}

            {activeType === 'pace' && (
                <div className="flex items-baseline gap-1.5">
                    <input
                        type="text"
                        value={target?.pace_min_per_km ?? ''}
                        onChange={(e) => setTarget({
                            type: 'pace',
                            pace_min_per_km: e.target.value || undefined,
                        })}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="5:30 ou 5:30-6:00"
                        aria-label="Pace (min/km)"
                        className={`${fieldInputClass} max-w-[8rem]`}
                    />
                    <UnitSuffix>min/km</UnitSuffix>
                </div>
            )}
        </div>
    )
}

export function CardioItemCard({
    item,
    onUpdate,
    onDelete,
    dragHandleProps,
    readonly,
}: CardioItemCardProps) {
    const config = (item.item_config || { mode: 'continuous' }) as CardioConfig
    const mode: CardioMode = config.mode || 'continuous'
    const objective: CardioObjective = config.objective || 'time'
    const maxHr = useCardioStudentMaxHr()

    const [isExpanded, setIsExpanded] = useState(() => !isCardioFilled(config))

    const updateConfig = (patch: Partial<CardioConfig>) => {
        onUpdate({ item_config: { ...config, ...patch } })
    }

    /** Aplica um protocolo nomeado: números + selo + alvo sugerido (+ string derivada). */
    const applyProtocol = (key: string) => {
        const p = CARDIO_PROTOCOLS.find(pr => pr.key === key)
        if (!p) return
        updateConfig({
            intervals: { ...p.intervals },
            protocol_key: p.key,
            intensity_target: p.suggested_target,
            intensity: formatIntensityTarget(p.suggested_target, maxHr) ?? undefined,
        })
    }

    /** Troca de modo. Entrar em 'phased' semeia as fases do estado atual (não
     *  perde trabalho); sair mantém `segments` no config (voltar restaura). */
    const changeMode = (nextMode: CardioMode) => {
        if (nextMode === 'phased') {
            let seed: CardioSegment[] = config.segments ?? []
            if (seed.length === 0) {
                seed = mode === 'interval' && config.intervals
                    ? [{ kind: 'interval', intervals: { ...config.intervals }, intensity_target: config.intensity_target, intensity: config.intensity }]
                    : [{ kind: 'steady', duration_minutes: config.duration_minutes ?? 10, intensity_target: config.intensity_target, intensity: config.intensity }]
            }
            updateSegments(seed, { mode: 'phased', protocol_key: undefined })
            return
        }
        updateConfig({ mode: nextMode, ...(nextMode === 'continuous' ? { protocol_key: undefined } : {}) })
    }

    /** Escreve as fases + DERIVADOS (total → duration_minutes; resumo →
     *  intensity) — retrocompat de todas as superfícies e apps antigos. */
    const updateSegments = (segments: CardioSegment[], extra: Partial<CardioConfig> = {}) => {
        const totalSeconds = cardioTotalSeconds({ mode: 'phased', segments })
        updateConfig({
            segments,
            duration_minutes: totalSeconds > 0 ? Math.max(1, Math.round(totalSeconds / 60)) : undefined,
            intensity: summarizeSegments(segments) || undefined,
            intensity_target: undefined,
            ...extra,
        })
    }

    /** Edição manual de um número do intervalado: números valem, selo cai. */
    const patchIntervals = (patch: Partial<NonNullable<CardioConfig['intervals']>>) => {
        updateConfig({
            intervals: {
                work_seconds: config.intervals?.work_seconds || 30,
                rest_seconds: config.intervals?.rest_seconds || 15,
                rounds: config.intervals?.rounds || 8,
                ...patch,
            },
            protocol_key: undefined,
        })
    }

    const estimatedIntervalDuration = config.intervals
        ? (config.intervals.work_seconds * config.intervals.rounds +
            config.intervals.rest_seconds * (config.intervals.rounds - 1))
        : 0
    const estMin = Math.floor(estimatedIntervalDuration / 60)
    const estSec = estimatedIntervalDuration % 60

    // Valor do select de protocolo: o key ativo enquanto os números batem;
    // qualquer edição manual volta pra "Personalizado".
    const activeProtocolKey = protocolMatchesIntervals(config.protocol_key, config.intervals ?? null)
        ? (config.protocol_key as string)
        : ''

    if (readonly) {
        return (
            <div className="bg-[var(--surface-card)] rounded-xl border border-[var(--border-subtle)] p-4">
                <div className="flex items-start gap-3">
                    <Activity
                        className="mt-0.5 w-4 h-4 shrink-0"
                        style={{ color: 'var(--accent-cardio)' }}
                    />
                    <div className="min-w-0">
                        <span className="block text-[15px] font-bold text-[var(--text-primary)]">
                            Aeróbio
                        </span>
                        <span className="text-xs text-[var(--text-tertiary)] truncate">
                            {cardioCompactSummary(config)}
                        </span>
                    </div>
                </div>
            </div>
        )
    }

    const deleteButton = (
        <button
            type="button"
            onClick={(e) => {
                e.stopPropagation()
                onDelete()
            }}
            className="h-7 w-7 inline-flex items-center justify-center rounded-md text-[var(--text-tertiary)] hover:text-[var(--destructive)] hover:bg-[var(--glass-bg)] transition-colors"
            aria-label="Excluir"
            title="Excluir"
        >
            <Trash2 className="size-4" />
        </button>
    )

    return (
        <WorkoutCardShell
            type="cardio"
            title="Aeróbio"
            subtitle={cardioCompactSummary(config)}
            isExpanded={isExpanded}
            onToggle={() => setIsExpanded((v) => !v)}
            dragHandleProps={dragHandleProps}
            kebab={deleteButton}
        >
            <div className="space-y-1.5">
                {/* Trilho 1: modo + equipamento (+ alvo/valor no contínuo, protocolo no intervalado) */}
                <div className={`grid grid-cols-2 gap-1.5 ${mode === 'continuous' ? 'sm:grid-cols-4' : mode === 'interval' ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
                    <FieldCard label="Modo" icon={<Activity className="size-4" />}>
                        <select
                            value={mode}
                            onChange={(e) => changeMode(e.target.value as CardioMode)}
                            onClick={(e) => e.stopPropagation()}
                            aria-label="Modo do aeróbio"
                            className={fieldSelectClass}
                            style={fieldSelectChevronStyle}
                        >
                            <option value="continuous">Contínuo</option>
                            <option value="interval">Intervalado</option>
                            <option value="phased">Por fases</option>
                        </select>
                    </FieldCard>

                    <FieldCard label="Equipamento" icon={<Zap className="size-4" />}>
                        <select
                            value={config.equipment || ''}
                            onChange={(e) =>
                                updateConfig({
                                    equipment: (e.target.value || undefined) as CardioEquipment | undefined,
                                })
                            }
                            onClick={(e) => e.stopPropagation()}
                            aria-label="Equipamento"
                            className={fieldSelectClass}
                            style={fieldSelectChevronStyle}
                        >
                            <option value="">—</option>
                            {CARDIO_EQUIPMENT_OPTIONS.map((eq) => (
                                <option key={eq} value={eq}>
                                    {CARDIO_EQUIPMENT_LABELS[eq]}
                                </option>
                            ))}
                        </select>
                    </FieldCard>

                    {mode === 'continuous' ? (
                        <>
                            <FieldCard label="Alvo" icon={<ListChecks className="size-4" />}>
                                <select
                                    value={objective}
                                    onChange={(e) =>
                                        updateConfig({ objective: e.target.value as CardioObjective })
                                    }
                                    onClick={(e) => e.stopPropagation()}
                                    aria-label="Tipo de alvo do contínuo"
                                    className={fieldSelectClass}
                                    style={fieldSelectChevronStyle}
                                >
                                    <option value="time">Tempo</option>
                                    <option value="distance">Distância</option>
                                </select>
                            </FieldCard>

                            {objective === 'time' ? (
                                <FieldCard label="Duração" icon={<Clock className="size-4" />}>
                                    <div className="flex items-baseline gap-1">
                                        <input
                                            type="number"
                                            min={1}
                                            value={config.duration_minutes || ''}
                                            onChange={(e) =>
                                                updateConfig({
                                                    duration_minutes: parseInt(e.target.value) || undefined,
                                                })
                                            }
                                            onFocus={(e) => e.target.select()}
                                            onClick={(e) => e.stopPropagation()}
                                            placeholder="30"
                                            aria-label="Duração (minutos)"
                                            className={`${fieldInputClass} max-w-[3rem]`}
                                        />
                                        <UnitSuffix>min</UnitSuffix>
                                    </div>
                                </FieldCard>
                            ) : (
                                <FieldCard label="Distância" icon={<Activity className="size-4" />}>
                                    <div className="flex items-baseline gap-1">
                                        <input
                                            type="number"
                                            min={0}
                                            step={0.1}
                                            value={config.distance_km || ''}
                                            onChange={(e) =>
                                                updateConfig({
                                                    distance_km: parseFloat(e.target.value) || undefined,
                                                })
                                            }
                                            onFocus={(e) => e.target.select()}
                                            onClick={(e) => e.stopPropagation()}
                                            placeholder="5"
                                            aria-label="Distância (km)"
                                            className={`${fieldInputClass} max-w-[3rem]`}
                                        />
                                        <UnitSuffix>km</UnitSuffix>
                                    </div>
                                </FieldCard>
                            )}
                        </>
                    ) : mode === 'interval' ? (
                        <FieldCard label="Protocolo" icon={<ListChecks className="size-4" />}>
                            <select
                                value={activeProtocolKey}
                                onChange={(e) => {
                                    if (e.target.value) applyProtocol(e.target.value)
                                }}
                                onClick={(e) => e.stopPropagation()}
                                aria-label="Protocolo intervalado"
                                className={fieldSelectClass}
                                style={fieldSelectChevronStyle}
                            >
                                <option value="">Personalizado</option>
                                {CARDIO_PROTOCOLS.map((p) => (
                                    <option key={p.key} value={p.key} title={p.description}>
                                        {p.label}
                                    </option>
                                ))}
                            </select>
                        </FieldCard>
                    ) : null}
                </div>

                {/* Trilho 2 (intervalado): trabalho / descanso / rounds / total */}
                {mode === 'interval' && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                        <FieldCard label="Trabalho" icon={<Zap className="size-4" />}>
                            <div className="flex items-baseline gap-1">
                                <input
                                    type="number"
                                    min={1}
                                    value={config.intervals?.work_seconds || ''}
                                    onChange={(e) => patchIntervals({ work_seconds: parseInt(e.target.value) || 30 })}
                                    onFocus={(e) => e.target.select()}
                                    onClick={(e) => e.stopPropagation()}
                                    placeholder="30"
                                    aria-label="Trabalho (segundos)"
                                    className={`${fieldInputClass} max-w-[3rem]`}
                                />
                                <UnitSuffix>s</UnitSuffix>
                            </div>
                        </FieldCard>

                        <FieldCard label="Descanso" icon={<Clock className="size-4" />}>
                            <div className="flex items-baseline gap-1">
                                <input
                                    type="number"
                                    min={0}
                                    value={config.intervals?.rest_seconds ?? ''}
                                    onChange={(e) => patchIntervals({ rest_seconds: parseInt(e.target.value) || 15 })}
                                    onFocus={(e) => e.target.select()}
                                    onClick={(e) => e.stopPropagation()}
                                    placeholder="15"
                                    aria-label="Descanso (segundos)"
                                    className={`${fieldInputClass} max-w-[3rem]`}
                                />
                                <UnitSuffix>s</UnitSuffix>
                            </div>
                        </FieldCard>

                        <FieldCard label="Rounds" icon={<Repeat className="size-4" />}>
                            <input
                                type="number"
                                min={1}
                                value={config.intervals?.rounds || ''}
                                onChange={(e) => patchIntervals({ rounds: parseInt(e.target.value) || 8 })}
                                onFocus={(e) => e.target.select()}
                                onClick={(e) => e.stopPropagation()}
                                placeholder="8"
                                aria-label="Rounds"
                                className={`${fieldInputClass} max-w-[3rem]`}
                            />
                        </FieldCard>

                        <FieldCard label="Total" icon={<Clock className="size-4" />}>
                            <span className="font-mono text-[12.5px] font-semibold tabular-nums text-[var(--text-primary)]">
                                {estimatedIntervalDuration > 0
                                    ? `≈ ${estMin > 0 ? `${estMin}min` : ''}${estMin > 0 && estSec > 0 ? ' ' : ''}${estSec > 0 ? `${estSec}s` : ''}`
                                    : '—'}
                            </span>
                        </FieldCard>
                    </div>
                )}

                {/* Por fases: tabela de segmentos (intensidade vive POR fase) */}
                {mode === 'phased' && (
                    <CardioPhasesTable
                        segments={config.segments ?? []}
                        maxHr={maxHr}
                        onChange={updateSegments}
                    />
                )}

                {/* Intensidade do bloco (modos simples; em fases é por segmento) */}
                {mode !== 'phased' && (
                    <IntensityTargetControl config={config} maxHr={maxHr} onPatch={updateConfig} />
                )}

                <TechnicalNote
                    value={config.notes || ''}
                    onChange={(v) => updateConfig({ notes: v || undefined })}
                    readonly={false}
                />
            </div>
        </WorkoutCardShell>
    )
}
