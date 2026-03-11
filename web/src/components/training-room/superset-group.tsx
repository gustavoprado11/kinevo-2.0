'use client'

import { Link2, Clock } from 'lucide-react'
import type { ExerciseData } from '@/stores/training-room-store'
import { ExerciseCard } from './exercise-card'

interface SupersetGroupProps {
    exercises: ExerciseData[]
    supersetRestSeconds: number
    disabled: boolean
    onWeightChange: (globalIdx: number, setIdx: number, value: string) => void
    onRepsChange: (globalIdx: number, setIdx: number, value: string) => void
    onToggleComplete: (globalIdx: number, setIdx: number) => void
    onSwapPress?: (globalIdx: number) => void
    onVideoPress?: (videoUrl: string | undefined) => void
    globalIndexOffset: number
}

function computeRoundInfo(exercises: ExerciseData[]) {
    const totalRounds = Math.max(...exercises.map((e) => e.setsData.length), 0)
    let currentRound = totalRounds
    for (let round = 0; round < totalRounds; round++) {
        const roundIncomplete = exercises.some(
            (e) => round < e.setsData.length && !e.setsData[round].completed
        )
        if (roundIncomplete) {
            currentRound = round
            break
        }
    }
    return { currentRound, totalRounds }
}

export function SupersetGroup({
    exercises,
    supersetRestSeconds,
    disabled,
    onWeightChange,
    onRepsChange,
    onToggleComplete,
    onSwapPress,
    onVideoPress,
    globalIndexOffset,
}: SupersetGroupProps) {
    const { currentRound, totalRounds } = computeRoundInfo(exercises)
    const allDone = currentRound >= totalRounds

    return (
        <div
            className={`border-l-2 rounded-2xl pl-3 pr-1 pt-3 pb-2 ${
                allDone
                    ? 'border-emerald-500/40 dark:border-emerald-500/40 bg-emerald-500/[0.03] dark:bg-emerald-500/[0.03]'
                    : 'border-violet-500/40 dark:border-violet-500/40 bg-violet-500/[0.03] dark:bg-violet-500/[0.03]'
            }`}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-3 pr-2">
                <div className="flex items-center gap-2">
                    <Link2 size={14} className="text-violet-600 dark:text-violet-400" />
                    <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400">
                        Superset
                    </span>
                </div>
                <span className="text-[11px] font-semibold text-violet-600 dark:text-violet-400 bg-violet-500/10 dark:bg-violet-500/10 px-2.5 py-1 rounded-lg">
                    {allDone ? 'Concluído' : `Rodada ${currentRound + 1} de ${totalRounds}`}
                </span>
            </div>

            {/* Exercise cards */}
            <div className="space-y-3">
                {exercises.map((exercise, localIdx) => {
                    const globalIdx = globalIndexOffset + localIdx
                    return (
                        <ExerciseCard
                            key={exercise.id}
                            exercise={exercise}
                            exerciseIndex={globalIdx}
                            disabled={disabled}
                            onWeightChange={(si, v) => onWeightChange(globalIdx, si, v)}
                            onRepsChange={(si, v) => onRepsChange(globalIdx, si, v)}
                            onToggleComplete={(si) => onToggleComplete(globalIdx, si)}
                            onSwapPress={onSwapPress ? () => onSwapPress(globalIdx) : undefined}
                            onVideoPress={onVideoPress}
                            supersetBadge={`Exercício ${localIdx + 1} de ${exercises.length}`}
                        />
                    )
                })}
            </div>

            {/* Rest info */}
            <div className="flex items-center gap-1.5 mt-2 ml-1 mb-1">
                <Clock size={12} className="text-violet-600 dark:text-violet-400" />
                <span className="text-xs text-violet-500/80 dark:text-violet-400/80">
                    Descanso entre rodadas: {supersetRestSeconds}s
                </span>
            </div>
        </div>
    )
}
