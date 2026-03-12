'use client'

import { useState } from 'react'
import { Flame, Activity, Clock, Timer, Check } from 'lucide-react'
import type { ExerciseData } from '@/stores/training-room-store'
import type { WarmupConfig, CardioConfig } from '@kinevo/shared/types/workout-items'
import { CARDIO_EQUIPMENT_LABELS, WARMUP_TYPE_LABELS } from '@kinevo/shared/types/workout-items'

/** Build a one-line summary for the trainer card */
function cardioSummary(config: CardioConfig): string {
    const mode = config.mode || 'continuous'
    const parts: string[] = []

    if (mode === 'interval' && config.intervals) {
        parts.push(`${config.intervals.rounds}x (${config.intervals.work_seconds}s/${config.intervals.rest_seconds}s)`)
    } else {
        if (config.duration_minutes) parts.push(`${config.duration_minutes} min`)
        if (config.distance_km) parts.push(`${config.distance_km} km`)
    }

    if (config.equipment) {
        parts.push(CARDIO_EQUIPMENT_LABELS[config.equipment] || config.equipment)
    }
    if (config.intensity) parts.push(config.intensity)

    return parts.join(' · ') || 'Aeróbio'
}

interface WarmupCardioCardProps {
    exercise: ExerciseData
    disabled: boolean
    onCardioToggle?: (exerciseId: string, completed: boolean) => void
}

export function WarmupCardioCard({ exercise, disabled, onCardioToggle }: WarmupCardioCardProps) {
    const [completed, setCompleted] = useState(
        exercise.setsData.length > 0 && exercise.setsData[0].completed
    )
    const isWarmup = exercise.item_type === 'warmup'
    const config = (exercise.item_config || {}) as (WarmupConfig & CardioConfig)

    return (
        <div
            className={`rounded-2xl border p-4 transition-all ${
                completed
                    ? 'border-emerald-500/30 bg-emerald-500/[0.03]'
                    : isWarmup
                        ? 'border-orange-500/20 bg-orange-500/[0.03]'
                        : 'border-cyan-500/20 bg-cyan-500/[0.03]'
            }`}
        >
            <div className="flex items-start gap-3">
                {/* Icon */}
                <div className={`mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    completed
                        ? 'bg-emerald-500/10'
                        : isWarmup
                            ? 'bg-orange-500/10'
                            : 'bg-cyan-500/10'
                }`}>
                    {completed ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                    ) : isWarmup ? (
                        <Flame className="w-4 h-4 text-orange-400" />
                    ) : (
                        <Activity className="w-4 h-4 text-cyan-400" />
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-bold ${
                            completed ? 'text-emerald-400' : isWarmup ? 'text-orange-400' : 'text-cyan-400'
                        }`}>
                            {isWarmup ? 'Aquecimento' : 'Aeróbio'}
                        </span>

                        {/* Complete toggle */}
                        <button
                            onClick={() => {
                                if (disabled) return
                                const next = !completed
                                setCompleted(next)
                                if (!isWarmup && onCardioToggle) {
                                    onCardioToggle(exercise.id, next)
                                }
                            }}
                            disabled={disabled}
                            className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${
                                completed
                                    ? 'bg-emerald-500 border-emerald-500'
                                    : 'border-slate-600 hover:border-slate-400'
                            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                            {completed && <Check className="w-3.5 h-3.5 text-white" />}
                        </button>
                    </div>

                    {/* Warmup summary */}
                    {isWarmup && (
                        <div className="mb-1">
                            <span className="text-xs text-slate-400">
                                {config.duration_minutes ? `${config.duration_minutes} min` : ''}
                                {config.duration_minutes && (config as WarmupConfig).warmup_type ? ' · ' : ''}
                                {(config as WarmupConfig).warmup_type ? (WARMUP_TYPE_LABELS[(config as WarmupConfig).warmup_type] || '') : ''}
                            </span>
                        </div>
                    )}

                    {/* Description (warmup) */}
                    {isWarmup && config.description && (
                        <p className="text-sm text-slate-300 mb-1">{config.description}</p>
                    )}

                    {/* Cardio summary line */}
                    {!isWarmup && (
                        <p className="text-xs text-slate-400">{cardioSummary(config)}</p>
                    )}

                    {/* Cardio notes */}
                    {!isWarmup && config.notes && (
                        <p className="text-xs text-slate-500 mt-1">{config.notes}</p>
                    )}
                </div>
            </div>
        </div>
    )
}
