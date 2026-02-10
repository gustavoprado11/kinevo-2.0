'use client'

import { useMemo } from 'react'
import type { Workout, WorkoutItem } from './program-builder-client'
import type { Exercise } from '@/types/exercise'

interface WeeklyVolumeCardProps {
    workouts: Workout[]
    exercises: Exercise[]
}

export function WeeklyVolumeCard({ workouts, exercises }: WeeklyVolumeCardProps) {
    const volumeData = useMemo(() => {
        const volumeByGroup: Record<string, number> = {}

        const processItem = (item: WorkoutItem, frequency: number) => {
            // Find exercise definition
            // Note: item.exercise might be populated, or we use exercise_id to look it up
            const exercise = item.exercise || exercises.find(e => e.id === item.exercise_id)

            if (!exercise) return

            // Get sets (default to 1 if not set but item exists? Or 0? 
            // Usually if created it has null sets. Let's treat null/0 as 0 for volume calculation)
            const sets = item.sets || 0
            if (sets === 0) return

            // Get muscle groups - handle new array field or legacy string field
            const groups: string[] = []
            if (exercise.muscle_groups && Array.isArray(exercise.muscle_groups)) {
                exercise.muscle_groups.forEach((mg: any) => {
                    if (typeof mg === 'object' && mg !== null && 'name' in mg) {
                        groups.push(mg.name)
                    } else if (typeof mg === 'string') {
                        groups.push(mg)
                    }
                })
            } else if ((exercise as any).muscle_group) {
                // Safeguard for legacy data
                const mg = (exercise as any).muscle_group
                if (typeof mg === 'object' && mg !== null && 'name' in mg) {
                    groups.push(mg.name)
                } else if (typeof mg === 'string') {
                    groups.push(mg)
                }
            }

            // Accumulate sets for each group
            groups.forEach(group => {
                volumeByGroup[group] = (volumeByGroup[group] || 0) + (sets * frequency)
            })
        }

        workouts.forEach(workout => {
            // Frequency logic: default to 1 if no days selected so volume doesn't disappear during draft
            const frequency = (workout.frequency && workout.frequency.length > 0) ? workout.frequency.length : 1

            workout.items.forEach(item => {
                if (item.item_type === 'exercise') {
                    processItem(item, frequency)
                } else if (item.item_type === 'superset') {
                    item.children?.forEach(child => processItem(child, frequency))
                }
            })
        })

        // Sort by volume descending
        return Object.entries(volumeByGroup)
            .sort(([, a], [, b]) => b - a)
            .map(([group, sets]) => ({ group, sets }))

    }, [workouts, exercises])

    if (volumeData.length === 0) {
        return null // Don't show if no volume
    }

    const maxSets = Math.max(...volumeData.map(d => d.sets))

    return (
        <div className="bg-card rounded-xl border border-border p-5 mb-6">
            <h3 className="text-sm font-semibold text-foreground/80 uppercase tracking-wider mb-4 border-b border-border pb-2">
                Volume Semanal (Séries por Grupamento)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3">
                {volumeData.map(({ group, sets }) => (
                    <div key={group} className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                            <div className="flex-between items-baseline mb-1 flex justify-between">
                                <span className="text-sm font-medium text-foreground/80 truncate">{group}</span>
                                <span className="text-sm font-bold text-violet-300">{sets}</span>
                            </div>
                            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-violet-500 rounded-full"
                                    style={{ width: `${(sets / maxSets) * 100}%` }}
                                />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
