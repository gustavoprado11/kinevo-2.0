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
                completed ? 'bg-[#34C759]/5 dark:bg-emerald-500/10' : 'hover:bg-[#F5F5F7] dark:hover:bg-glass-bg'
            }`}
        >
            {/* Set number */}
            <span className="w-8 text-center text-xs font-semibold text-[#007AFF] dark:text-muted-foreground">
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
                    className={`w-full rounded-lg border px-3 py-2 text-center text-sm font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-[#007AFF]/20 dark:focus:ring-violet-500/50 ${
                        completed
                            ? 'border-[#34C759]/30 dark:border-emerald-500/30 text-[#34C759] dark:text-emerald-400 bg-transparent'
                            : 'border-[#E8E8ED] dark:border-k-border-subtle bg-[#F5F5F7] dark:bg-transparent text-[#1D1D1F] dark:text-foreground placeholder:text-[#AEAEB2] dark:placeholder:text-muted-foreground/40 focus:border-[#007AFF] dark:focus:border-violet-500 focus:bg-white dark:focus:bg-transparent'
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
                    className={`w-full rounded-lg border px-3 py-2 text-center text-sm font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-[#007AFF]/20 dark:focus:ring-violet-500/50 ${
                        completed
                            ? 'border-[#34C759]/30 dark:border-emerald-500/30 text-[#34C759] dark:text-emerald-400 bg-transparent'
                            : 'border-[#E8E8ED] dark:border-k-border-subtle bg-[#F5F5F7] dark:bg-transparent text-[#1D1D1F] dark:text-foreground placeholder:text-[#AEAEB2] dark:placeholder:text-muted-foreground/40 focus:border-[#007AFF] dark:focus:border-violet-500 focus:bg-white dark:focus:bg-transparent'
                    } disabled:opacity-50`}
                />
            </div>

            {/* Complete checkbox */}
            <button
                onClick={onToggleComplete}
                disabled={disabled}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-all ${
                    completed
                        ? 'border-[#34C759] dark:border-emerald-500 bg-[#34C759] dark:bg-emerald-500 text-white'
                        : 'border-[#D2D2D7] dark:border-k-border-subtle text-transparent hover:border-[#86868B] dark:hover:border-muted-foreground/40'
                } disabled:opacity-50`}
            >
                <Check size={14} strokeWidth={3} />
            </button>
        </div>
    )
}
