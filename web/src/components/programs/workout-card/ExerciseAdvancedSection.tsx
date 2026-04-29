'use client'

import { memo } from 'react'

import type { WorkoutItem } from '../program-builder-client'
import { SetSchemeTable } from '../SetSchemeTable'

interface ExerciseAdvancedSectionProps {
    item: WorkoutItem
    readonly?: boolean
    onUpdate: (updates: Partial<WorkoutItem>) => void
}

export const ExerciseAdvancedSection = memo(function ExerciseAdvancedSection({
    item,
    readonly,
    onUpdate,
}: ExerciseAdvancedSectionProps) {
    if (!item.set_scheme) return null

    return (
        <SetSchemeTable
            value={item.set_scheme}
            methodKey={item.method_key ?? null}
            rounds={item.rounds ?? 1}
            readonly={readonly}
            onChange={(scheme, nextKey, nextRounds) =>
                onUpdate({ set_scheme: scheme, method_key: nextKey, rounds: nextRounds })
            }
        />
    )
})
