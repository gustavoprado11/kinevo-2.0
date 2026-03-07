'use client'

import { Dumbbell, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import type { ExerciseData } from '@/stores/training-room-store'
import { SetRow } from './set-row'
import { TrainerNote } from './trainer-note'

const FUNCTION_LABELS: Record<string, string> = {
    warmup: 'Aquecimento',
    activation: 'Ativação',
    main: 'Principal',
    accessory: 'Acessório',
    conditioning: 'Condicionamento',
}

interface ExerciseCardProps {
    exercise: ExerciseData
    exerciseIndex: number
    disabled: boolean
    onWeightChange: (setIdx: number, value: string) => void
    onRepsChange: (setIdx: number, value: string) => void
    onToggleComplete: (setIdx: number) => void
    supersetBadge?: string
}

export function ExerciseCard({
    exercise,
    exerciseIndex,
    disabled,
    onWeightChange,
    onRepsChange,
    onToggleComplete,
    supersetBadge,
}: ExerciseCardProps) {
    const [isCollapsed, setIsCollapsed] = useState(false)

    const completedSets = exercise.setsData.filter((s) => s.completed).length
    const totalSets = exercise.setsData.length
    const allCompleted = completedSets === totalSets && totalSets > 0

    return (
        <div
            className={`rounded-2xl border transition-colors ${
                allCompleted
                    ? 'border-[#34C759]/30 dark:border-emerald-500/30 bg-[#34C759]/5 dark:bg-emerald-500/5'
                    : 'border-[#D2D2D7] dark:border-k-border-subtle bg-white dark:bg-surface-card shadow-[0_1px_3px_rgba(0,0,0,0.08)] dark:shadow-none'
            }`}
        >
            {/* Exercise header */}
            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="flex w-full items-center gap-3 p-4 text-left"
            >
                <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        allCompleted ? 'bg-[#34C759]/20 dark:bg-emerald-500/20' : 'bg-[#007AFF]/10 dark:bg-violet-600/20'
                    }`}
                >
                    <Dumbbell
                        size={18}
                        className={allCompleted ? 'text-[#34C759] dark:text-emerald-400' : 'text-[#007AFF] dark:text-violet-400'}
                    />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-[#1D1D1F] dark:text-foreground truncate">
                            {exercise.name}
                        </p>
                        {exercise.exercise_function && (
                            <span className="shrink-0 rounded-md bg-[#007AFF]/10 dark:bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#007AFF] dark:text-violet-400">
                                {FUNCTION_LABELS[exercise.exercise_function] || exercise.exercise_function}
                            </span>
                        )}
                        {exercise.swap_source !== 'none' && (
                            <span className="shrink-0 rounded-md bg-[#FF9500]/20 dark:bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-[#FF9500] dark:text-amber-400">
                                TROCA
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-[#86868B] dark:text-muted-foreground">
                            {exercise.sets}x{exercise.reps}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-[#86868B] dark:text-muted-foreground">
                            <Clock size={10} />
                            {exercise.rest_seconds}s
                        </span>
                        {exercise.previousLoad && (
                            <span className="text-xs text-[#007AFF]/80 dark:text-violet-400/80">
                                Ant: {exercise.previousLoad}
                            </span>
                        )}
                        {supersetBadge && (
                            <span className="text-xs text-[#007AFF] dark:text-violet-400 font-medium">
                                {supersetBadge}
                            </span>
                        )}
                    </div>
                </div>

                {/* Progress */}
                <div className="flex items-center gap-2 shrink-0">
                    <span
                        className={`text-xs font-semibold ${
                            allCompleted ? 'text-[#34C759] dark:text-emerald-400' : 'text-[#86868B] dark:text-muted-foreground'
                        }`}
                    >
                        {completedSets}/{totalSets}
                    </span>
                    {isCollapsed ? (
                        <ChevronDown size={16} className="text-[#AEAEB2] dark:text-muted-foreground" />
                    ) : (
                        <ChevronUp size={16} className="text-[#AEAEB2] dark:text-muted-foreground" />
                    )}
                </div>
            </button>

            {/* Trainer note */}
            {exercise.notes && (
                <div className="px-4 pb-2">
                    <TrainerNote note={exercise.notes} isTrainerView />
                </div>
            )}

            {/* Sets */}
            {!isCollapsed && (
                <div className="px-4 pb-4">
                    {/* Column headers */}
                    <div className="flex items-center gap-3 px-3 pb-1.5">
                        <span className="w-8 text-center text-[10px] font-semibold text-[#86868B] dark:text-muted-foreground/50 uppercase">
                            Série
                        </span>
                        <span className="flex-1 text-center text-[10px] font-semibold text-[#86868B] dark:text-muted-foreground/50 uppercase">
                            Peso (kg)
                        </span>
                        <span className="flex-1 text-center text-[10px] font-semibold text-[#86868B] dark:text-muted-foreground/50 uppercase">
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
