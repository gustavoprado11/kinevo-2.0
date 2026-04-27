'use client'

import { Workout, WorkoutItem } from './program-builder-client'
import { Dumbbell } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { effectiveSetsForVolume } from '@kinevo/shared/lib/prescription/volume'

interface VolumeSummaryProps {
    workouts: Workout[]
}

export function VolumeSummary({ workouts }: VolumeSummaryProps) {
    // Calculate volume per muscle group across all workouts.
    // Compound methods (drop-set, cluster) count rounds as effective sets;
    // linear methods count `sets` directly (Fase 4.5a).
    const volumeByGroup = workouts.reduce((acc, workout) => {
        const frequency = Math.max(1, workout.frequency?.length || 0)

        const processItem = (it: WorkoutItem) => {
            const muscleGroups = it.exercise?.muscle_groups
            if (!muscleGroups || muscleGroups.length === 0) return
            const effective = effectiveSetsForVolume({ sets: it.sets, rounds: it.rounds })
            if (effective <= 0) return
            const weeklySets = effective * frequency

            muscleGroups.forEach(group => {
                const groupName = typeof group === 'object' ? group.name : group
                if (groupName) {
                    acc[groupName] = (acc[groupName] || 0) + weeklySets
                }
            })
        }

        workout.items.forEach(item => {
            if (item.item_type === 'exercise') {
                processItem(item)
            } else if (item.item_type === 'superset' && item.children) {
                item.children.forEach(processItem)
            }
        })

        return acc
    }, {} as Record<string, number>)

    const sortedGroups = Object.entries(volumeByGroup)
        .sort(([, a], [, b]) => b - a)
        .filter(([, volume]) => volume > 0)

    const getVolumeColor = (sets: number) => {
        if (sets < 10) return 'text-blue-400'
        if (sets <= 20) return 'text-emerald-400'
        return 'text-yellow-400'
    }

    const getVolumeHint = (sets: number) => {
        if (sets < 10) return 'Volume baixo — pode ser insuficiente'
        if (sets <= 20) return 'Faixa produtiva — volume adequado'
        return 'Volume alto — monitorar recuperação'
    }

    return (
        <div className="flex items-center gap-2 min-w-0">
            <Dumbbell size={12} className="text-violet-400 shrink-0" strokeWidth={2.5} />
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 min-w-0">
                <AnimatePresence mode="popLayout">
                    {sortedGroups.length === 0 ? (
                        <motion.span
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="text-[10px] font-bold text-k-text-quaternary whitespace-nowrap"
                        >
                            0 séries
                        </motion.span>
                    ) : (
                        sortedGroups.map(([group, volume]) => (
                            <motion.span
                                key={group}
                                layout
                                initial={{ opacity: 0, x: -6 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                transition={{ duration: 0.2, ease: "easeOut" }}
                                className="flex items-center whitespace-nowrap"
                            >
                                <span className="text-[10px] font-medium text-k-text-quaternary">
                                    {group}
                                </span>
                                <span className={`text-[11px] font-bold ml-1 ${getVolumeColor(volume)}`} title={getVolumeHint(volume)}>
                                    {volume}
                                </span>
                            </motion.span>
                        ))
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}
