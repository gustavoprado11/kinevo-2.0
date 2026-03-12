'use client'

import { Check } from 'lucide-react'
import type { PreviousSetData } from '@/stores/training-room-store'

interface SetRowProps {
    setIndex: number
    weight: string
    reps: string
    completed: boolean
    targetReps: string
    disabled: boolean
    previousSet?: PreviousSetData
    onWeightChange: (value: string) => void
    onRepsChange: (value: string) => void
    onToggleComplete: () => void
}

export function SetRow({
    setIndex,
    weight,
    reps,
    completed,
    targetReps,
    disabled,
    previousSet,
    onWeightChange,
    onRepsChange,
    onToggleComplete,
}: SetRowProps) {
    const hasPrevious = previousSet && previousSet.weight !== undefined && previousSet.reps !== undefined

    const formatPrevWeight = (w: number) =>
        Number.isInteger(w) ? String(w) : w.toFixed(1)

    return (
        <div
            className={`flex items-center gap-2 rounded-xl px-2 py-1.5 transition-colors ${
                completed
                    ? 'bg-violet-500/[0.06] dark:bg-violet-500/10'
                    : 'hover:bg-slate-50 dark:hover:bg-glass-bg'
            }`}
        >
            {/* Set number — circular badge */}
            <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    completed
                        ? 'bg-violet-500/15 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400'
                        : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-muted-foreground'
                }`}
            >
                {setIndex + 1}
            </div>

            {/* Previous set data */}
            <div className="w-[58px] shrink-0 text-center">
                <span className="text-xs font-medium text-slate-400 dark:text-muted-foreground/60 tabular-nums">
                    {hasPrevious
                        ? `${formatPrevWeight(previousSet.weight)}×${previousSet.reps}`
                        : '—'}
                </span>
            </div>

            {/* Weight input */}
            <div className="flex-1">
                <input
                    type="text"
                    inputMode="decimal"
                    placeholder={hasPrevious ? String(previousSet.weight) : 'kg'}
                    value={weight}
                    onChange={(e) => onWeightChange(e.target.value)}
                    disabled={disabled || completed}
                    className={`w-full rounded-xl border-0 px-2 py-2 text-center text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/30 ${
                        completed
                            ? 'bg-violet-500/[0.08] dark:bg-violet-500/[0.12] text-violet-600 dark:text-violet-400'
                            : 'bg-slate-100 dark:bg-transparent dark:border dark:border-k-border-subtle text-slate-900 dark:text-foreground placeholder:text-slate-300 dark:placeholder:text-muted-foreground/40'
                    } disabled:opacity-50`}
                />
            </div>

            {/* Reps input */}
            <div className="flex-1">
                <input
                    type="text"
                    inputMode="numeric"
                    placeholder={hasPrevious ? String(previousSet.reps) : targetReps}
                    value={reps}
                    onChange={(e) => onRepsChange(e.target.value)}
                    disabled={disabled || completed}
                    className={`w-full rounded-xl border-0 px-2 py-2 text-center text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/30 ${
                        completed
                            ? 'bg-violet-500/[0.08] dark:bg-violet-500/[0.12] text-violet-600 dark:text-violet-400'
                            : 'bg-slate-100 dark:bg-transparent dark:border dark:border-k-border-subtle text-slate-900 dark:text-foreground placeholder:text-slate-300 dark:placeholder:text-muted-foreground/40'
                    } disabled:opacity-50`}
                />
            </div>

            {/* Complete button — circular, gray → violet */}
            <button
                onClick={onToggleComplete}
                disabled={disabled}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all ${
                    completed
                        ? 'bg-violet-600 dark:bg-violet-600 text-white'
                        : 'bg-slate-200 dark:bg-zinc-800 text-transparent hover:bg-slate-300 dark:hover:bg-zinc-700'
                } disabled:opacity-50`}
            >
                {completed ? (
                    <Check size={16} strokeWidth={3} />
                ) : (
                    <div className="h-4 w-4 rounded-full border-2 border-slate-300 dark:border-zinc-600" />
                )}
            </button>
        </div>
    )
}
