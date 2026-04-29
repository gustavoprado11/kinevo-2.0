'use client'

import { memo } from 'react'

import type { WorkoutItem } from '../program-builder-client'

interface ExerciseQuickFieldsProps {
    item: WorkoutItem
    readonly?: boolean
    compact?: boolean
    onUpdate: (updates: Partial<WorkoutItem>) => void
}

export const ExerciseQuickFields = memo(function ExerciseQuickFields({
    item,
    readonly,
    compact,
    onUpdate,
}: ExerciseQuickFieldsProps) {
    const shellClass = compact
        ? 'rounded-md border border-[#E8E8ED] dark:border-k-border-subtle bg-[#F9F9FB] dark:bg-surface-inset px-2.5 py-1.5'
        : 'rounded-lg border border-[#E8E8ED] dark:border-k-border-subtle bg-[#F9F9FB] dark:bg-surface-inset px-3 py-2'
    const labelClass = compact
        ? 'block text-[9px] font-bold text-[#8E8E93] dark:text-k-text-tertiary mb-0.5'
        : 'block text-[10px] font-bold text-[#8E8E93] dark:text-k-text-tertiary mb-1'
    const inputClass = compact
        ? 'w-full bg-transparent text-[#1C1C1E] dark:text-k-text-primary text-xs font-semibold focus:outline-none focus:text-[#007AFF] dark:focus:text-violet-400 transition-colors placeholder:text-k-border-subtle p-0'
        : 'w-full bg-transparent text-[#1C1C1E] dark:text-k-text-primary text-sm font-semibold focus:outline-none focus:text-[#007AFF] dark:focus:text-violet-400 transition-colors placeholder:text-k-border-subtle p-0'

    return (
        <div className={compact ? 'grid grid-cols-3 gap-1.5' : 'grid grid-cols-1 sm:grid-cols-3 gap-2.5'}>
            <div className={shellClass}>
                <span className={labelClass}>Séries</span>
                {readonly ? (
                    <span className="text-[#1C1C1E] dark:text-k-text-primary text-sm font-medium">{item.sets || 0}</span>
                ) : (
                    <input
                        type="number"
                        min={1}
                        step={1}
                        value={item.sets || ''}
                        onChange={(e) => onUpdate({ sets: parseInt(e.target.value) || null })}
                        onFocus={(e) => e.target.select()}
                        placeholder="0"
                        className={inputClass}
                    />
                )}
            </div>

            <div className={shellClass}>
                <span className={labelClass}>Reps</span>
                {readonly ? (
                    <span className="text-[#1C1C1E] dark:text-k-text-primary text-sm font-medium">{item.reps || '—'}</span>
                ) : (
                    <input
                        type="text"
                        value={item.reps || ''}
                        onChange={(e) => onUpdate({ reps: e.target.value || null })}
                        onFocus={(e) => e.target.select()}
                        placeholder="0"
                        className={inputClass}
                    />
                )}
            </div>

            <div className={shellClass}>
                <span className={labelClass}>Descanso</span>
                {readonly ? (
                    <span className="text-[#1C1C1E] dark:text-k-text-primary text-sm font-medium">{item.rest_seconds || 0}s</span>
                ) : (
                    <div className="relative">
                        <input
                            type="number"
                            min={0}
                            step={15}
                            value={item.rest_seconds || ''}
                            onChange={(e) => onUpdate({ rest_seconds: parseInt(e.target.value) || null })}
                            onFocus={(e) => e.target.select()}
                            placeholder="0"
                            className={`${inputClass} pr-4`}
                        />
                        <span className="absolute right-0 top-0 text-[10px] text-[#8E8E93] dark:text-k-text-tertiary pointer-events-none">s</span>
                    </div>
                )}
            </div>
        </div>
    )
})
