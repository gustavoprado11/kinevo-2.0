'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Clock, Flame, Trash2 } from 'lucide-react'
import { useState, type HTMLAttributes } from 'react'

import {
    WARMUP_TYPE_LABELS,
    WARMUP_TYPE_OPTIONS,
    type WarmupConfig,
} from '@kinevo/shared/types/workout-items'

import type { WorkoutItem } from '../program-builder-client'
import { TechnicalNote } from './ExerciseMetadataSection'
import { WorkoutCardShell } from './WorkoutCardShell'

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
            <div className="bg-white dark:bg-surface-card rounded-xl border border-[var(--border-subtle)] p-4">
                <div className="flex items-center gap-3">
                    <Flame className="w-[18px] h-[18px] text-amber-500 shrink-0" />
                    <div className="min-w-0">
                        <span className="block text-[15px] font-bold text-[var(--text-primary)]">
                            Aquecimento
                        </span>
                        <span className="text-xs text-[#8E8E93] dark:text-k-text-tertiary truncate">
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
            <div className="flex items-center gap-1.5 flex-wrap mb-3">
                {WARMUP_TYPE_OPTIONS.map((wt) => {
                    const isSelected = warmupType === wt
                    return (
                        <button
                            key={wt}
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation()
                                updateConfig({ warmup_type: wt })
                                if (wt === 'free') setShowDescription(true)
                            }}
                            className={`px-3 py-1 rounded-full text-xs transition-colors border cursor-pointer ${
                                isSelected
                                    ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 font-medium'
                                    : 'bg-transparent border-[#E8E8ED] dark:border-slate-700/50 text-[#8E8E93] dark:text-k-text-quaternary hover:bg-[#F5F5F7] dark:hover:bg-glass-bg'
                            }`}
                        >
                            {WARMUP_TYPE_LABELS[wt]}
                        </button>
                    )
                })}

                <div className="flex items-center gap-1 ml-2">
                    <Clock size={14} className="text-[#AEAEB2] dark:text-k-text-quaternary" />
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
                        className="w-14 h-7 bg-transparent text-[#1D1D1F] dark:text-k-text-primary text-sm font-medium text-center focus:outline-none border-0 border-b border-[#D2D2D7] dark:border-slate-600 focus:border-[#8E8E93] dark:focus:border-k-text-tertiary transition-colors placeholder:text-[#D2D2D7] dark:placeholder:text-k-text-quaternary"
                    />
                    <span className="text-xs text-[#AEAEB2] dark:text-k-text-quaternary">min</span>
                </div>
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
                        <textarea
                            value={config.description || ''}
                            onChange={(e) =>
                                updateConfig({ description: e.target.value || undefined })
                            }
                            onClick={(e) => e.stopPropagation()}
                            placeholder="Ex: 5 min esteira leve, mobilidade articular, 2x15 rotação externa"
                            rows={2}
                            className="w-full px-2.5 py-1.5 bg-[#F9F9FB] dark:bg-glass-bg border border-[#E8E8ED] dark:border-slate-700/50 rounded-lg text-k-text-primary placeholder:text-[#AEAEB2] dark:placeholder:text-k-text-quaternary focus:outline-none focus:border-[#D2D2D7] dark:focus:border-k-border-primary text-sm resize-none max-h-16"
                        />
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
                    className="text-xs text-[#AEAEB2] dark:text-k-text-quaternary hover:text-[#8E8E93] dark:hover:text-k-text-tertiary transition-colors mb-1.5"
                >
                    + Adicionar descrição...
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
