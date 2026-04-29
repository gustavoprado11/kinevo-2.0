'use client'

import { Activity, Clock, Repeat, Trash2, Zap } from 'lucide-react'
import { useState, type HTMLAttributes } from 'react'

import {
    CARDIO_EQUIPMENT_LABELS,
    CARDIO_EQUIPMENT_OPTIONS,
    CARDIO_OBJECTIVE_LABELS,
    type CardioConfig,
    type CardioEquipment,
    type CardioMode,
    type CardioObjective,
} from '@kinevo/shared/types/workout-items'

import type { WorkoutItem } from '../program-builder-client'
import { TechnicalNote } from './ExerciseMetadataSection'
import { WorkoutCardShell } from './WorkoutCardShell'

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

    parts.push(mode === 'interval' ? 'Intervalado' : 'Contínuo')

    if (config.equipment) {
        parts.push(CARDIO_EQUIPMENT_LABELS[config.equipment] || config.equipment)
    }

    if (mode === 'interval' && config.intervals) {
        parts.push(`${config.intervals.work_seconds}s ON`)
        parts.push(`${config.intervals.rest_seconds}s OFF`)
        parts.push(`${config.intervals.rounds} rounds`)
    } else {
        if (config.duration_minutes) parts.push(`${config.duration_minutes} min`)
        if (config.distance_km) parts.push(`${config.distance_km} km`)
        if (config.intensity) parts.push(config.intensity)
    }

    return parts.join(' · ')
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

    const [isExpanded, setIsExpanded] = useState(() => !isCardioFilled(config))

    const updateConfig = (patch: Partial<CardioConfig>) => {
        onUpdate({ item_config: { ...config, ...patch } })
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
                            updateConfig({ mode: 'continuous' })
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

                        <div className="flex items-center gap-1.5 flex-1 min-w-[180px]">
                            <Zap size={14} className="text-[#D2D2D7] dark:text-k-text-quaternary shrink-0" />
                            <input
                                type="text"
                                value={config.intensity || ''}
                                onChange={(e) =>
                                    updateConfig({ intensity: e.target.value || undefined })
                                }
                                onClick={(e) => e.stopPropagation()}
                                placeholder="Ex: Zona 2, RPE 6, 130bpm"
                                className="flex-1 h-7 bg-transparent text-k-text-primary text-sm font-medium focus:outline-none border-0 border-b border-[#D2D2D7] dark:border-slate-600 focus:border-cyan-500 dark:focus:border-cyan-400 transition-colors placeholder:text-[#D2D2D7]"
                            />
                        </div>
                    </div>
                </div>
            )}

            {mode === 'interval' && (
                <div className="space-y-2">
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

                    <div className="flex items-center gap-1.5 flex-1">
                        <Zap size={14} className="text-[#D2D2D7] dark:text-k-text-quaternary shrink-0" />
                        <input
                            type="text"
                            value={config.intensity || ''}
                            onChange={(e) =>
                                updateConfig({ intensity: e.target.value || undefined })
                            }
                            onClick={(e) => e.stopPropagation()}
                            placeholder="Intensidade (ex: Zona 2, RPE 6, 130bpm)"
                            className="flex-1 h-7 bg-transparent text-k-text-primary text-sm font-medium focus:outline-none border-0 border-b border-[#D2D2D7] dark:border-slate-600 focus:border-cyan-500 dark:focus:border-cyan-400 transition-colors placeholder:text-[#D2D2D7]"
                        />
                    </div>
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
