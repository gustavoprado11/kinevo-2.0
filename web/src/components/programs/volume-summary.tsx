'use client'

import { Workout, WorkoutItem } from './program-builder-client'
import { Dumbbell } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface VolumeSummaryProps {
    workouts: Workout[]
}

export function VolumeSummary({ workouts }: VolumeSummaryProps) {
    // Calculate volume per muscle group across all workouts.
    // Each exercise counts ONCE toward its PRIMARY muscle group (first in the list).
    // This matches the Kinevo methodology: volume = sets targeting a specific group,
    // not total stimulus including secondary activation from compounds.
    const volumeByGroup = workouts.reduce((acc, workout) => {
        // Frequency is the number of days this workout is scheduled
        // Fallback to 1 so the user sees volume while building even before scheduling
        const frequency = Math.max(1, workout.frequency?.length || 0)

        workout.items.forEach(item => {
            // Attributes sets to PRIMARY group only (first in the muscle_groups array)
            const processSets = (sets: number | null, muscleGroups: any[] | undefined) => {
                if (!sets || !muscleGroups || muscleGroups.length === 0) return
                const weeklySets = sets * frequency

                const primaryGroup = muscleGroups[0]
                const groupName = typeof primaryGroup === 'object' ? primaryGroup.name : primaryGroup
                if (groupName) {
                    acc[groupName] = (acc[groupName] || 0) + weeklySets
                }
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

    return (
        <div className="w-full bg-surface-primary border-b border-k-border-subtle px-8 py-2.5 flex-shrink-0 z-20">
            <div className="flex items-center gap-6 overflow-x-auto no-scrollbar">
                {/* Master Label Group */}
                <div className="flex items-center gap-2 shrink-0 border-r border-k-border-primary pr-6">
                    <Dumbbell size={14} className="text-violet-400" strokeWidth={2.5} />
                    <span className="text-[10px] font-bold text-k-text-quaternary uppercase tracking-[0.2em] whitespace-nowrap">
                        Volume Semanal <span className="text-k-border-subtle">(Séries)</span>
                    </span>
                </div>

                <div className="flex items-center gap-6">
                    <AnimatePresence mode="popLayout">
                        {sortedGroups.length === 0 ? (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="text-[10px] font-bold text-k-border-subtle uppercase tracking-widest"
                            >
                                Aguardando exercícios...
                            </motion.div>
                        ) : (
                            sortedGroups.map(([group, volume], index) => (
                                <div key={group} className="flex items-center gap-6">
                                    <motion.div
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
                                        <span className="text-sm font-black text-violet-400 ml-2">
                                            {volume}
                                        </span>
                                    </motion.div>

                                    {index < sortedGroups.length - 1 && (
                                        <div className="w-[1px] h-3 bg-k-border-subtle" />
                                    )}
                                </div>
                            ))
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    )
}

