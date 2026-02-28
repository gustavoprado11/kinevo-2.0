'use client'

import { Workout, WorkoutItem } from './program-builder-client'
import { Dumbbell } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface VolumeSummaryProps {
    workouts: Workout[]
}

export function VolumeSummary({ workouts }: VolumeSummaryProps) {
    // Calculate volume per muscle group across all workouts.
    // Each exercise counts toward ALL its muscle groups (e.g. Levantamento Terra
    // adds sets to Quadríceps, Glúteo, Posterior de Coxa, etc.).
    const volumeByGroup = workouts.reduce((acc, workout) => {
        // Frequency is the number of days this workout is scheduled
        // Fallback to 1 so the user sees volume while building even before scheduling
        const frequency = Math.max(1, workout.frequency?.length || 0)

        workout.items.forEach(item => {
            const processSets = (sets: number | null, muscleGroups: any[] | undefined) => {
                if (!sets || !muscleGroups || muscleGroups.length === 0) return
                const weeklySets = sets * frequency

                muscleGroups.forEach(group => {
                    const groupName = typeof group === 'object' ? group.name : group
                    if (groupName) {
                        acc[groupName] = (acc[groupName] || 0) + weeklySets
                    }
                })
            }

            if (item.item_type === 'exercise') {
                processSets(item.sets, item.exercise?.muscle_groups)
            } else if (item.item_type === 'superset' && item.children) {
                item.children.forEach(child => {
                    processSets(child.sets, child.exercise?.muscle_groups)
                })
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
        <div className="w-full bg-surface-primary border-b border-k-border-subtle px-8 py-2.5 flex-shrink-0 z-20">
            <div className="flex items-start gap-6">
                {/* Master Label Group */}
                <div className="flex items-center gap-2 shrink-0 border-r border-k-border-primary pr-6 py-0.5">
                    <Dumbbell size={14} className="text-violet-400" strokeWidth={2.5} />
                    <span className="text-[10px] font-bold text-k-text-quaternary uppercase tracking-[0.2em] whitespace-nowrap">
                        Volume Semanal <span className="text-k-text-quaternary">(Séries)</span>
                    </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 flex-1">
                    <AnimatePresence mode="popLayout">
                        {sortedGroups.length === 0 ? (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="text-[10px] font-bold text-k-text-quaternary uppercase tracking-widest"
                            >
                                Aguardando exercícios...
                            </motion.div>
                        ) : (
                            sortedGroups.map(([group, volume]) => (
                                <motion.div
                                    key={group}
                                    layout
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    transition={{ duration: 0.3, ease: "easeOut" }}
                                    className="flex items-center whitespace-nowrap"
                                >
                                    <span className="text-[11px] font-semibold text-k-text-tertiary uppercase tracking-wider">
                                        {group}
                                    </span>
                                    <span className={`text-sm font-black ml-2 ${getVolumeColor(volume)}`} title={getVolumeHint(volume)}>
                                        {volume}
                                    </span>
                                </motion.div>
                            ))
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    )
}

