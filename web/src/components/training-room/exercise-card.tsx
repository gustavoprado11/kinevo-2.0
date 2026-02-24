'use client'

import { Dumbbell, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import type { ExerciseData } from '@/stores/training-room-store'
import { SetRow } from './set-row'

interface ExerciseCardProps {
    exercise: ExerciseData
    exerciseIndex: number
    disabled: boolean
    onWeightChange: (setIdx: number, value: string) => void
    onRepsChange: (setIdx: number, value: string) => void
    onToggleComplete: (setIdx: number) => void
}

export function ExerciseCard({
    exercise,
    exerciseIndex,
    disabled,
    onWeightChange,
    onRepsChange,
    onToggleComplete,
}: ExerciseCardProps) {
    const [isCollapsed, setIsCollapsed] = useState(false)

    const completedSets = exercise.setsData.filter((s) => s.completed).length
    const totalSets = exercise.setsData.length
    const allCompleted = completedSets === totalSets && totalSets > 0

    return (
        <div
            className={`rounded-2xl border transition-colors ${
                allCompleted
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : 'border-k-border-subtle bg-surface-card'
            }`}
        >
            {/* Exercise header */}
            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="flex w-full items-center gap-3 p-4 text-left"
            >
                <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        allCompleted ? 'bg-emerald-500/20' : 'bg-violet-600/20'
                    }`}
                >
                    <Dumbbell
                        size={18}
                        className={allCompleted ? 'text-emerald-400' : 'text-violet-400'}
                    />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground truncate">
                            {exercise.name}
                        </p>
                        {exercise.swap_source !== 'none' && (
                            <span className="shrink-0 rounded-md bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">
                                TROCA
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-muted-foreground">
                            {exercise.sets}x{exercise.reps}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock size={10} />
                            {exercise.rest_seconds}s
                        </span>
                        {exercise.previousLoad && (
                            <span className="text-xs text-violet-400/80">
                                Ant: {exercise.previousLoad}
                            </span>
                        )}
                    </div>
                </div>

                {/* Progress */}
                <div className="flex items-center gap-2 shrink-0">
                    <span
                        className={`text-xs font-semibold ${
                            allCompleted ? 'text-emerald-400' : 'text-muted-foreground'
                        }`}
                    >
                        {completedSets}/{totalSets}
                    </span>
                    {isCollapsed ? (
                        <ChevronDown size={16} className="text-muted-foreground" />
                    ) : (
                        <ChevronUp size={16} className="text-muted-foreground" />
                    )}
                </div>
            </button>

            {/* Sets */}
            {!isCollapsed && (
                <div className="px-4 pb-4">
                    {/* Column headers */}
                    <div className="flex items-center gap-3 px-3 pb-1.5">
                        <span className="w-8 text-center text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/50">
                            Série
                        </span>
                        <span className="flex-1 text-center text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/50">
                            Peso (kg)
                        </span>
                        <span className="flex-1 text-center text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/50">
                            Reps
                        </span>
                        <span className="w-8" />
                    </div>

                    <div className="space-y-1">
                        {exercise.setsData.map((setData, si) => (
                            <SetRow
                                key={si}
                                setIndex={si}
                                weight={setData.weight}
                                reps={setData.reps}
                                completed={setData.completed}
                                targetReps={exercise.reps}
                                disabled={disabled}
                                onWeightChange={(v) => onWeightChange(si, v)}
                                onRepsChange={(v) => onRepsChange(si, v)}
                                onToggleComplete={() => onToggleComplete(si)}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
