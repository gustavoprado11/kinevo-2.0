'use client'

import { Check } from 'lucide-react'

interface SetRowProps {
    setIndex: number
    weight: string
    reps: string
    completed: boolean
    targetReps: string
    disabled: boolean
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
    onWeightChange,
    onRepsChange,
    onToggleComplete,
}: SetRowProps) {
    return (
        <div
            className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                completed ? 'bg-emerald-500/10' : 'hover:bg-glass-bg'
            }`}
        >
            {/* Set number */}
            <span className="w-8 text-center text-xs font-semibold text-muted-foreground">
                {setIndex + 1}
            </span>

            {/* Weight input */}
            <div className="flex-1">
                <input
                    type="text"
                    inputMode="decimal"
                    placeholder="kg"
                    value={weight}
                    onChange={(e) => onWeightChange(e.target.value)}
                    disabled={disabled || completed}
                    className={`w-full rounded-lg border bg-transparent px-3 py-2 text-center text-sm font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-violet-500/50 ${
                        completed
                            ? 'border-emerald-500/30 text-emerald-400'
                            : 'border-k-border-subtle text-foreground placeholder:text-muted-foreground/40'
                    } disabled:opacity-50`}
                />
            </div>

            {/* Reps input */}
            <div className="flex-1">
                <input
                    type="text"
                    inputMode="numeric"
                    placeholder={targetReps}
                    value={reps}
                    onChange={(e) => onRepsChange(e.target.value)}
                    disabled={disabled || completed}
                    className={`w-full rounded-lg border bg-transparent px-3 py-2 text-center text-sm font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-violet-500/50 ${
                        completed
                            ? 'border-emerald-500/30 text-emerald-400'
                            : 'border-k-border-subtle text-foreground placeholder:text-muted-foreground/40'
                    } disabled:opacity-50`}
                />
            </div>

            {/* Complete checkbox */}
            <button
                onClick={onToggleComplete}
                disabled={disabled}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-all ${
                    completed
                        ? 'border-emerald-500 bg-emerald-500 text-white'
                        : 'border-k-border-subtle text-transparent hover:border-muted-foreground/40'
                } disabled:opacity-50`}
            >
                <Check size={14} strokeWidth={3} />
            </button>
        </div>
    )
}
