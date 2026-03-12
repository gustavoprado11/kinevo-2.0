'use client'

import { Dumbbell, Clock, ChevronDown, ChevronUp, ArrowRightLeft, PlayCircle, Check } from 'lucide-react'
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
    onSwapPress?: () => void
    onVideoPress?: (videoUrl: string | undefined) => void
    supersetBadge?: string
}

export function ExerciseCard({
    exercise,
    exerciseIndex,
    disabled,
    onWeightChange,
    onRepsChange,
    onToggleComplete,
    onSwapPress,
    onVideoPress,
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
                    ? 'border-emerald-500/30 dark:border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/5'
                    : 'border-[#D2D2D7] dark:border-k-border-subtle bg-white dark:bg-surface-card shadow-[0_1px_3px_rgba(0,0,0,0.08)] dark:shadow-none'
            }`}
        >
            {/* Exercise header */}
            <div className="flex w-full items-start gap-3 p-4">
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="flex flex-1 items-center gap-3 text-left"
                >
                    <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                            allCompleted ? 'bg-emerald-500/20 dark:bg-emerald-500/20' : 'bg-violet-600/10 dark:bg-violet-600/20'
                        }`}
                    >
                        <Dumbbell
                            size={18}
                            className={allCompleted ? 'text-emerald-500 dark:text-emerald-400' : 'text-violet-600 dark:text-violet-400'}
                        />
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-[#1D1D1F] dark:text-foreground truncate">
                                {exercise.name}
                            </p>
                            {exercise.exercise_function && (
                                <span className="shrink-0 rounded-md bg-violet-500/10 dark:bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-violet-600 dark:text-violet-400">
                                    {FUNCTION_LABELS[exercise.exercise_function] || exercise.exercise_function}
                                </span>
                            )}
                            {exercise.swap_source !== 'none' && (
                                <span className="shrink-0 rounded-md bg-amber-500/20 dark:bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                                    TROCA
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-xs text-slate-500 dark:text-muted-foreground">
                                {exercise.sets} séries • {exercise.reps} reps • {exercise.rest_seconds}s
                            </span>
                            {/* Fallback: show aggregate previous load only when per-set data is unavailable */}
                            {!exercise.previousSets?.length && exercise.previousLoad && (
                                <span className="text-xs text-violet-500/80 dark:text-violet-400/80 italic">
                                    Anterior: {exercise.previousLoad}
                                </span>
                            )}
                            {supersetBadge && (
                                <span className="text-xs text-violet-600 dark:text-violet-400 font-medium">
                                    {supersetBadge}
                                </span>
                            )}
                        </div>
                    </div>
                </button>

                {/* Action buttons: swap, video, progress, collapse */}
                <div className="flex items-center gap-1.5 shrink-0 pt-1">
                    {onSwapPress && (
                        <button
                            onClick={onSwapPress}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-500/10 dark:bg-violet-500/10 hover:bg-violet-500/20 transition-colors"
                            title="Substituir exercício"
                        >
                            <ArrowRightLeft size={14} className="text-violet-600 dark:text-violet-400" />
                        </button>
                    )}
                    {onVideoPress && (
                        <button
                            onClick={() => onVideoPress(exercise.video_url)}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-500/10 dark:bg-violet-500/10 hover:bg-violet-500/20 transition-colors"
                            title="Ver demonstração"
                        >
                            <PlayCircle size={14} className="text-violet-600 dark:text-violet-400" />
                        </button>
                    )}

                    <span
                        className={`text-xs font-semibold px-1 ${
                            allCompleted ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-400 dark:text-muted-foreground'
                        }`}
                    >
                        {completedSets}/{totalSets}
                    </span>

                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-glass-bg transition-colors"
                    >
                        {isCollapsed ? (
                            <ChevronDown size={16} className="text-slate-400 dark:text-muted-foreground" />
                        ) : (
                            <ChevronUp size={16} className="text-slate-400 dark:text-muted-foreground" />
                        )}
                    </button>
                </div>
            </div>

            {/* Trainer note */}
            {exercise.notes && (
                <div className="px-4 pb-2">
                    <TrainerNote note={exercise.notes} isTrainerView />
                </div>
            )}

            {/* Sets */}
            {!isCollapsed && (
                <div className="px-4 pb-4">
                    {/* Column headers — matches mobile layout */}
                    <div className="flex items-center gap-2 px-2 pb-1.5">
                        <span className="w-7 text-center text-[10px] font-semibold text-slate-400 dark:text-muted-foreground/50">
                            #
                        </span>
                        <span className="w-[58px] text-center text-[10px] font-semibold text-slate-400 dark:text-muted-foreground/50">
                            Anterior
                        </span>
                        <span className="flex-1 text-center text-[10px] font-semibold text-slate-400 dark:text-muted-foreground/50">
                            Peso
                        </span>
                        <span className="flex-1 text-center text-[10px] font-semibold text-slate-400 dark:text-muted-foreground/50">
                            Reps
                        </span>
                        <span className="w-9 flex justify-center">
                            <Check size={10} className="text-slate-400 dark:text-muted-foreground/50" />
                        </span>
                    </div>

                    <div className="space-y-0.5">
                        {exercise.setsData.map((setData, si) => (
                            <SetRow
                                key={si}
                                setIndex={si}
                                weight={setData.weight}
                                reps={setData.reps}
                                completed={setData.completed}
                                targetReps={exercise.reps}
                                disabled={disabled}
                                previousSet={exercise.previousSets?.[si]}
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
