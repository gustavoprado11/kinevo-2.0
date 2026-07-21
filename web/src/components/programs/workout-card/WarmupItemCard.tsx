'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeftRight, Clock, Flame, Trash2 } from 'lucide-react'
import { useState, type HTMLAttributes } from 'react'

import {
    WARMUP_TYPE_LABELS,
    WARMUP_TYPE_OPTIONS,
    type WarmupConfig,
    type WarmupType,
} from '@kinevo/shared/types/workout-items'

import type { WorkoutItem } from '../program-builder-client'
import { TechnicalNote } from './ExerciseMetadataSection'
import { WorkoutCardShell } from './WorkoutCardShell'
import {
    FieldCard,
    UnitSuffix,
    fieldInputClass,
    fieldSelectChevronStyle,
    fieldSelectClass,
} from './field-primitives'

interface WarmupItemCardProps {
    item: WorkoutItem
    onUpdate: (updates: Partial<WorkoutItem>) => void
    onDelete: () => void
    dragHandleProps?: HTMLAttributes<HTMLDivElement>
    readonly?: boolean
}

function isWarmupFilled(config: WarmupConfig): boolean {
    return !!(config.duration_minutes || config.description)
}

function warmupSummary(config: WarmupConfig): string {
    const parts: string[] = []
    if (config.duration_minutes) parts.push(`${config.duration_minutes} min`)
    const typeLabel = WARMUP_TYPE_LABELS[config.warmup_type] || 'Livre'
    parts.push(typeLabel)
    return parts.join(' · ')
}

export function WarmupItemCard({
    item,
    onUpdate,
    onDelete,
    dragHandleProps,
    readonly,
}: WarmupItemCardProps) {
    const config = (item.item_config || { warmup_type: 'free' }) as WarmupConfig
    const warmupType = config.warmup_type || 'free'

    const [isExpanded, setIsExpanded] = useState(() => !isWarmupFilled(config))
    const [showDescription, setShowDescription] = useState(
        () => warmupType === 'free' || !!config.description,
    )

    const updateConfig = (patch: Partial<WarmupConfig>) => {
        onUpdate({ item_config: { ...config, ...patch } })
    }

    if (readonly) {
        return (
            <div className="bg-[var(--surface-card)] rounded-xl border border-[var(--border-subtle)] p-4">
                <div className="flex items-center gap-3">
                    <Flame
                        className="w-[18px] h-[18px] shrink-0"
                        style={{ color: 'var(--accent-warmup)' }}
                    />
                    <div className="min-w-0">
                        <span className="block text-[15px] font-bold text-[var(--text-primary)]">
                            Aquecimento
                        </span>
                        <span className="text-xs text-[var(--text-tertiary)] truncate">
                            {warmupSummary(config)}
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
            type="warmup"
            title="Aquecimento"
            subtitle={warmupSummary(config)}
            isExpanded={isExpanded}
            onToggle={() => setIsExpanded((v) => !v)}
            dragHandleProps={dragHandleProps}
            kebab={deleteButton}
        >
            {/* Trilho de campos — mesmo padrão do trilho de métricas do exercício */}
            <div className="grid grid-cols-2 gap-1.5 mb-2">
                <FieldCard label="Tipo" icon={<ArrowLeftRight className="size-4" />}>
                    <select
                        value={warmupType}
                        onChange={(e) => {
                            const wt = e.target.value as WarmupType
                            updateConfig({ warmup_type: wt })
                            if (wt === 'free') setShowDescription(true)
                        }}
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Tipo de aquecimento"
                        className={fieldSelectClass}
                        style={fieldSelectChevronStyle}
                    >
                        {WARMUP_TYPE_OPTIONS.map((wt) => (
                            <option key={wt} value={wt}>
                                {WARMUP_TYPE_LABELS[wt]}
                            </option>
                        ))}
                    </select>
                </FieldCard>

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
                            placeholder="10"
                            aria-label="Duração (minutos)"
                            className={`${fieldInputClass} max-w-[3rem]`}
                        />
                        <UnitSuffix>min</UnitSuffix>
                    </div>
                </FieldCard>
            </div>

            <AnimatePresence>
                {(warmupType === 'free' || showDescription) && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        className="overflow-hidden mb-1.5"
                    >
                        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-2.5 py-2">
                            <div className="font-mono text-[9px] font-medium uppercase tracking-[0.1em] text-[var(--text-tertiary)] leading-tight mb-1">
                                Roteiro
                            </div>
                            <textarea
                                value={config.description || ''}
                                onChange={(e) =>
                                    updateConfig({ description: e.target.value || undefined })
                                }
                                onClick={(e) => e.stopPropagation()}
                                placeholder="Ex: 5 min esteira leve, mobilidade articular, 2x15 rotação externa"
                                rows={2}
                                className="w-full bg-transparent text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] focus:outline-none resize-none max-h-16 p-0"
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {warmupType !== 'free' && !showDescription && (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation()
                        setShowDescription(true)
                    }}
                    className="text-xs text-[var(--text-quaternary)] hover:text-[var(--text-secondary)] transition-colors mb-1.5"
                >
                    + Adicionar roteiro...
                </button>
            )}

            <TechnicalNote
                value={item.notes || ''}
                onChange={(v) => onUpdate({ notes: v })}
                readonly={false}
            />
        </WorkoutCardShell>
    )
}
