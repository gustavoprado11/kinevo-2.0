'use client'

import { Activity, Clock, Repeat, Trash2, Zap } from 'lucide-react'
import { useState, type HTMLAttributes } from 'react'

import {
    CARDIO_EQUIPMENT_LABELS,
    CARDIO_EQUIPMENT_OPTIONS,
    CARDIO_OBJECTIVE_LABELS,
    type CardioConfig,
    type CardioEquipment,
    type CardioIntensityTarget,
    type CardioIntensityType,
    type CardioMode,
    type CardioObjective,
} from '@kinevo/shared/types/workout-items'
import { HR_ZONES, formatIntensityTarget, resolveZoneBpm, zonePctLabel } from '@kinevo/shared/lib/cardio/zones'
import { CARDIO_PROTOCOLS, protocolMatchesIntervals } from '@kinevo/shared/lib/cardio/interval-protocols'

import type { WorkoutItem } from '../program-builder-client'
import { TechnicalNote } from './ExerciseMetadataSection'
import { WorkoutCardShell } from './WorkoutCardShell'
import { useCardioStudentMaxHr } from './cardio-student-context'

interface CardioItemCardProps {
    item: WorkoutItem
    onUpdate: (updates: Partial<WorkoutItem>) => void
    onDelete: () => void
    dragHandleProps?: HTMLAttributes<HTMLDivElement>
    readonly?: boolean
}

function isCardioFilled(config: CardioConfig): boolean {
    if (config.mode === 'interval' && config.intervals) return true
    return !!(config.duration_minutes || config.distance_km || config.equipment || config.intensity)
}

function cardioCompactSummary(config: CardioConfig): string {
    const mode = config.mode || 'continuous'
    const parts: string[] = []

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

/** Controle do alvo de intensidade (Livre | Zona | FC | RPE | Pace). Grava o
 *  alvo estruturado E a string derivada em `intensity` — as superfícies de
 *  exibição (app do aluno, sala, histórico) continuam lendo só a string. */
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
        <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 flex-wrap">
                <Zap size={14} className="text-[#D2D2D7] dark:text-k-text-quaternary shrink-0" />
                {TARGET_TYPES.map(({ key, label }) => {
                    const isActive = activeType === key
                    return (
                        <button
                            key={key}
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation()
                                if (key === 'free') setTarget(undefined)
                                else if (key !== activeType) setTarget({ type: key })
                            }}
                            className={`px-2 py-0.5 rounded-full text-[11px] transition-all border cursor-pointer ${
                                isActive
                                    ? 'bg-cyan-50 dark:bg-cyan-500/15 border-cyan-300 dark:border-cyan-500/40 text-cyan-700 dark:text-cyan-300 font-medium'
                                    : 'bg-transparent border-[#E8E8ED] dark:border-slate-700/50 text-[#8E8E93] dark:text-k-text-quaternary hover:border-cyan-300 dark:hover:border-cyan-500/30'
                            }`}
                        >
                            {label}
                        </button>
                    )
                })}
            </div>

            {activeType === 'free' && (
                <input
                    type="text"
                    value={config.intensity || ''}
                    onChange={(e) => onPatch({ intensity: e.target.value || undefined })}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="Ex: Zona 2, RPE 6, 130bpm"
                    className="w-full h-7 bg-transparent text-k-text-primary text-sm font-medium focus:outline-none border-0 border-b border-[#D2D2D7] dark:border-slate-600 focus:border-cyan-500 dark:focus:border-cyan-400 transition-colors placeholder:text-[#D2D2D7]"
                />
            )}

            {activeType === 'zone' && (
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1">
                        {HR_ZONES.map((z) => {
                            const isSelected = target?.zone === z.zone
                            return (
                                <button
                                    key={z.zone}
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        setTarget({ type: 'zone', zone: z.zone })
                                    }}
                                    title={`${z.label} · ${zonePctLabel(z.zone)}`}
                                    className={`w-8 h-7 rounded-md text-xs font-semibold transition-all border cursor-pointer ${
                                        isSelected
                                            ? 'bg-cyan-500 border-cyan-500 text-white'
                                            : 'bg-transparent border-[#E8E8ED] dark:border-slate-700/50 text-[#8E8E93] dark:text-k-text-quaternary hover:border-cyan-300 dark:hover:border-cyan-500/30'
                                    }`}
                                >
                                    Z{z.zone}
                                </button>
                            )
                        })}
                    </div>
                    {target?.zone ? (
                        <span className="text-xs text-[#8E8E93] dark:text-k-text-tertiary">
                            {(() => {
                                const bpm = resolveZoneBpm(target.zone, maxHr)
                                const def = HR_ZONES.find(z => z.zone === target.zone)
                                return bpm
                                    ? `${def?.label} · ${bpm.min}–${bpm.max} bpm`
                                    : `${def?.label} · ${zonePctLabel(target.zone)}`
                            })()}
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
                <div className="flex items-center gap-1.5">
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
                        className="w-14 h-7 bg-transparent text-k-text-primary text-sm font-medium text-center focus:outline-none border-0 border-b border-[#D2D2D7] dark:border-slate-600 focus:border-cyan-500 dark:focus:border-cyan-400 transition-colors placeholder:text-[#D2D2D7]"
                    />
                    <span className="text-xs text-[#8E8E93] dark:text-k-text-quaternary">a</span>
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
                        className="w-14 h-7 bg-transparent text-k-text-primary text-sm font-medium text-center focus:outline-none border-0 border-b border-[#D2D2D7] dark:border-slate-600 focus:border-cyan-500 dark:focus:border-cyan-400 transition-colors placeholder:text-[#D2D2D7]"
                    />
                    <span className="text-xs text-[#8E8E93] dark:text-k-text-quaternary">bpm</span>
                </div>
            )}

            {activeType === 'rpe' && (
                <div className="flex items-center gap-1">
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
                        const isSelected = target?.rpe === n
                        return (
                            <button
                                key={n}
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    setTarget({ type: 'rpe', rpe: n })
                                }}
                                className={`w-6 h-6 rounded-md text-[11px] font-semibold transition-all border cursor-pointer ${
                                    isSelected
                                        ? 'bg-cyan-500 border-cyan-500 text-white'
                                        : 'bg-transparent border-[#E8E8ED] dark:border-slate-700/50 text-[#8E8E93] dark:text-k-text-quaternary hover:border-cyan-300 dark:hover:border-cyan-500/30'
                                }`}
                            >
                                {n}
                            </button>
                        )
                    })}
                </div>
            )}

            {activeType === 'pace' && (
                <div className="flex items-center gap-1.5">
                    <input
                        type="text"
                        value={target?.pace_min_per_km ?? ''}
                        onChange={(e) => setTarget({
                            type: 'pace',
                            pace_min_per_km: e.target.value || undefined,
                        })}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="5:30 ou 5:30-6:00"
                        className="w-32 h-7 bg-transparent text-k-text-primary text-sm font-medium focus:outline-none border-0 border-b border-[#D2D2D7] dark:border-slate-600 focus:border-cyan-500 dark:focus:border-cyan-400 transition-colors placeholder:text-[#D2D2D7]"
                    />
                    <span className="text-xs text-[#8E8E93] dark:text-k-text-quaternary">min/km</span>
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

    const estimatedIntervalDuration = config.intervals
        ? (config.intervals.work_seconds * config.intervals.rounds +
            config.intervals.rest_seconds * (config.intervals.rounds - 1))
        : 0
    const estMin = Math.floor(estimatedIntervalDuration / 60)
    const estSec = estimatedIntervalDuration % 60

    if (readonly) {
        return (
            <div className="bg-white dark:bg-surface-card rounded-xl border border-[var(--border-subtle)] p-4">
                <div className="flex items-start gap-3">
                    <Activity className="mt-0.5 w-4 h-4 text-cyan-500 dark:text-cyan-400 shrink-0" />
                    <div className="min-w-0">
                        <span className="block text-[15px] font-bold text-[var(--text-primary)]">
                            Aeróbio
                        </span>
                        <span className="text-xs text-[#8E8E93] dark:text-k-text-tertiary truncate">
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
            {/* Row 1: Mode toggle + Equipment select */}
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                <div className="inline-flex rounded-full overflow-hidden h-7 gap-1">
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation()
                            updateConfig({ mode: 'continuous', protocol_key: undefined })
                        }}
                        className={`px-3 text-xs font-medium rounded-full transition-all ${
                            mode === 'continuous'
                                ? 'bg-cyan-50 dark:bg-cyan-500/15 text-cyan-700 dark:text-cyan-300'
                                : 'bg-transparent text-[#8E8E93] dark:text-k-text-quaternary hover:bg-gray-50 dark:hover:bg-glass-bg'
                        }`}
                    >
                        Contínuo
                    </button>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation()
                            updateConfig({ mode: 'interval' })
                        }}
                        className={`px-3 text-xs font-medium rounded-full transition-all ${
                            mode === 'interval'
                                ? 'bg-cyan-50 dark:bg-cyan-500/15 text-cyan-700 dark:text-cyan-300'
                                : 'bg-transparent text-[#8E8E93] dark:text-k-text-quaternary hover:bg-gray-50 dark:hover:bg-glass-bg'
                        }`}
                    >
                        Intervalado
                    </button>
                </div>

                <select
                    value={config.equipment || ''}
                    onChange={(e) =>
                        updateConfig({
                            equipment: (e.target.value || undefined) as CardioEquipment | undefined,
                        })
                    }
                    onClick={(e) => e.stopPropagation()}
                    className="h-7 bg-transparent border-0 border-b border-[#D2D2D7] dark:border-slate-600 text-sm text-k-text-primary focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400 cursor-pointer transition-colors"
                >
                    <option value="">Selecionar...</option>
                    {CARDIO_EQUIPMENT_OPTIONS.map((eq) => (
                        <option key={eq} value={eq}>
                            {CARDIO_EQUIPMENT_LABELS[eq]}
                        </option>
                    ))}
                </select>
            </div>

            {mode === 'continuous' && (
                <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                        {(['time', 'distance'] as const).map((obj) => {
                            const isSelected = objective === obj
                            return (
                                <button
                                    key={obj}
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        updateConfig({ objective: obj })
                                    }}
                                    className={`px-2.5 py-0.5 rounded-full text-xs transition-all border cursor-pointer ${
                                        isSelected
                                            ? 'bg-cyan-50 dark:bg-cyan-500/15 border-cyan-300 dark:border-cyan-500/40 text-cyan-700 dark:text-cyan-300 font-medium'
                                            : 'bg-transparent border-[#E8E8ED] dark:border-slate-700/50 text-[#8E8E93] dark:text-k-text-quaternary hover:border-cyan-300 dark:hover:border-cyan-500/30'
                                    }`}
                                >
                                    {CARDIO_OBJECTIVE_LABELS[obj]}
                                </button>
                            )
                        })}
                    </div>

                    <div className="flex items-center gap-4 flex-wrap">
                        {objective === 'time' ? (
                            <div className="flex items-center gap-1.5">
                                <Clock size={14} className="text-[#D2D2D7] dark:text-k-text-quaternary" />
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
                                    className="w-14 h-7 bg-transparent text-k-text-primary text-sm font-medium text-center focus:outline-none border-0 border-b border-[#D2D2D7] dark:border-slate-600 focus:border-cyan-500 dark:focus:border-cyan-400 transition-colors placeholder:text-[#D2D2D7]"
                                />
                                <span className="text-xs text-[#8E8E93] dark:text-k-text-quaternary">min</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5">
                                <Activity size={14} className="text-[#D2D2D7] dark:text-k-text-quaternary" />
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
                                    className="w-14 h-7 bg-transparent text-k-text-primary text-sm font-medium text-center focus:outline-none border-0 border-b border-[#D2D2D7] dark:border-slate-600 focus:border-cyan-500 dark:focus:border-cyan-400 transition-colors placeholder:text-[#D2D2D7]"
                                />
                                <span className="text-xs text-[#8E8E93] dark:text-k-text-quaternary">km</span>
                            </div>
                        )}

                    </div>

                    <IntensityTargetControl config={config} maxHr={maxHr} onPatch={updateConfig} />
                </div>
            )}

            {mode === 'interval' && (
                <div className="space-y-2">
                    {/* Protocolos nomeados: um clique preenche números + alvo sugerido.
                        Editar números manualmente limpa o selo (números valem). */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {CARDIO_PROTOCOLS.map((p) => {
                            const isSelected = protocolMatchesIntervals(config.protocol_key, config.intervals ?? null)
                                && config.protocol_key === p.key
                            return (
                                <button
                                    key={p.key}
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        applyProtocol(p.key)
                                    }}
                                    title={p.description}
                                    className={`px-2 py-0.5 rounded-full text-[11px] transition-all border cursor-pointer ${
                                        isSelected
                                            ? 'bg-cyan-50 dark:bg-cyan-500/15 border-cyan-300 dark:border-cyan-500/40 text-cyan-700 dark:text-cyan-300 font-medium'
                                            : 'bg-transparent border-[#E8E8ED] dark:border-slate-700/50 text-[#8E8E93] dark:text-k-text-quaternary hover:border-cyan-300 dark:hover:border-cyan-500/30'
                                    }`}
                                >
                                    {p.label}
                                </button>
                            )
                        })}
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                            <input
                                type="number"
                                min={1}
                                value={config.intervals?.work_seconds || ''}
                                onChange={(e) =>
                                    updateConfig({
                                        intervals: {
                                            work_seconds: parseInt(e.target.value) || 30,
                                            rest_seconds: config.intervals?.rest_seconds || 15,
                                            rounds: config.intervals?.rounds || 8,
                                        },
                                        protocol_key: undefined,
                                    })
                                }
                                onFocus={(e) => e.target.select()}
                                onClick={(e) => e.stopPropagation()}
                                placeholder="30"
                                className="w-14 h-7 bg-transparent text-k-text-primary text-sm font-medium text-center focus:outline-none border-0 border-b border-[#D2D2D7] dark:border-slate-600 focus:border-red-400 dark:focus:border-red-400 transition-colors placeholder:text-[#D2D2D7]"
                            />
                            <span className="text-xs text-[#8E8E93] dark:text-k-text-quaternary">s</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                            <input
                                type="number"
                                min={1}
                                value={config.intervals?.rest_seconds || ''}
                                onChange={(e) =>
                                    updateConfig({
                                        intervals: {
                                            work_seconds: config.intervals?.work_seconds || 30,
                                            rest_seconds: parseInt(e.target.value) || 15,
                                            rounds: config.intervals?.rounds || 8,
                                        },
                                        protocol_key: undefined,
                                    })
                                }
                                onFocus={(e) => e.target.select()}
                                onClick={(e) => e.stopPropagation()}
                                placeholder="15"
                                className="w-14 h-7 bg-transparent text-k-text-primary text-sm font-medium text-center focus:outline-none border-0 border-b border-[#D2D2D7] dark:border-slate-600 focus:border-emerald-400 dark:focus:border-emerald-400 transition-colors placeholder:text-[#D2D2D7]"
                            />
                            <span className="text-xs text-[#8E8E93] dark:text-k-text-quaternary">s</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                            <Repeat size={14} className="text-[#8E8E93] dark:text-k-text-tertiary" />
                            <input
                                type="number"
                                min={1}
                                value={config.intervals?.rounds || ''}
                                onChange={(e) =>
                                    updateConfig({
                                        intervals: {
                                            work_seconds: config.intervals?.work_seconds || 30,
                                            rest_seconds: config.intervals?.rest_seconds || 15,
                                            rounds: parseInt(e.target.value) || 8,
                                        },
                                        protocol_key: undefined,
                                    })
                                }
                                onFocus={(e) => e.target.select()}
                                onClick={(e) => e.stopPropagation()}
                                placeholder="8"
                                className="w-14 h-7 bg-transparent text-k-text-primary text-sm font-medium text-center focus:outline-none border-0 border-b border-[#D2D2D7] dark:border-slate-600 focus:border-cyan-500 dark:focus:border-cyan-400 transition-colors placeholder:text-[#D2D2D7]"
                            />
                            <span className="text-xs text-[#8E8E93] dark:text-k-text-quaternary">séries</span>
                        </div>

                        {config.intervals && estimatedIntervalDuration > 0 && (
                            <span className="text-xs text-[#D2D2D7] dark:text-k-text-quaternary italic">
                                ≈ {estMin > 0 ? `${estMin}min ` : ''}
                                {estSec > 0 ? `${estSec}s` : ''}
                            </span>
                        )}
                    </div>

                    <IntensityTargetControl config={config} maxHr={maxHr} onPatch={updateConfig} />
                </div>
            )}

            <div className="mt-2">
                <TechnicalNote
                    value={config.notes || ''}
                    onChange={(v) => updateConfig({ notes: v || undefined })}
                    readonly={false}
                />
            </div>
        </WorkoutCardShell>
    )
}
