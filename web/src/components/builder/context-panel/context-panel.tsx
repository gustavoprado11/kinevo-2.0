'use client'

import { useState, useEffect, useCallback } from 'react'
import { type ContextPanelMode } from './context-panel-header'
import { PastWorkoutSelector } from './past-workout-selector'
import { PastWorkoutView } from './past-workout-view'
import { WorkoutExecutionPreview } from '@/components/programs/workout-preview/workout-execution-preview'
import { getPastWorkoutsForStudent, getPastWorkoutDetail } from '@/app/students/[id]/actions/get-past-workouts'
import type { PastWorkoutSummary, PastWorkoutDetail } from '@/app/students/[id]/actions/get-past-workouts'

interface ContextPanelProps {
    /** Current workout name for preview */
    workoutName: string
    /** Current workout items for preview */
    workoutItems: any[]
    /** Student ID — enables compare mode when present */
    studentId?: string
    /** External mode control */
    mode: ContextPanelMode
    onModeChange: (mode: ContextPanelMode) => void
}

export function ContextPanel({ workoutName, workoutItems, studentId, mode, onModeChange }: ContextPanelProps) {
    // Past workout state (lazy loaded)
    const [pastWorkouts, setPastWorkouts] = useState<PastWorkoutSummary[]>([])
    const [pastWorkoutsLoading, setPastWorkoutsLoading] = useState(false)
    const [pastWorkoutsLoaded, setPastWorkoutsLoaded] = useState(false)

    const [selectedPastWorkoutId, setSelectedPastWorkoutId] = useState<string | null>(null)
    const [pastWorkoutDetail, setPastWorkoutDetail] = useState<PastWorkoutDetail | null>(null)
    const [detailLoading, setDetailLoading] = useState(false)

    // Lazy load past workouts when entering compare mode
    useEffect(() => {
        if (mode === 'past_workout' && studentId && !pastWorkoutsLoaded) {
            setPastWorkoutsLoading(true)
            getPastWorkoutsForStudent(studentId)
                .then((result) => {
                    setPastWorkouts(result.data || [])
                    setPastWorkoutsLoaded(true)
                })
                .catch(() => {
                    setPastWorkouts([])
                    setPastWorkoutsLoaded(true)
                })
                .finally(() => setPastWorkoutsLoading(false))
        }
    }, [mode, studentId, pastWorkoutsLoaded])

    // Load detail when a past workout is selected
    const handleSelectPastWorkout = useCallback((workoutId: string) => {
        setSelectedPastWorkoutId(workoutId)
        setDetailLoading(true)
        getPastWorkoutDetail(workoutId)
            .then((result) => setPastWorkoutDetail(result.data || null))
            .catch(() => setPastWorkoutDetail(null))
            .finally(() => setDetailLoading(false))
    }, [])

    if (mode === 'none') return null

    return (
        <div className="w-[420px] bg-[#F5F5F7] dark:bg-surface-canvas border-l border-[#E8E8ED] dark:border-k-border-subtle flex flex-col flex-shrink-0">
            {mode === 'preview' && (
                <div className="flex-1 overflow-y-auto flex flex-col items-center pt-4 pb-6">
                    <WorkoutExecutionPreview
                        workoutName={workoutName}
                        items={workoutItems}
                    />
                </div>
            )}

            {mode === 'past_workout' && (
                <div className="flex-1 flex flex-col overflow-hidden">
                    <PastWorkoutSelector
                        workouts={pastWorkouts}
                        selectedId={selectedPastWorkoutId}
                        onSelect={handleSelectPastWorkout}
                        isLoading={pastWorkoutsLoading}
                    />
                    <PastWorkoutView
                        detail={pastWorkoutDetail}
                        isLoading={detailLoading}
                    />
                </div>
            )}
        </div>
    )
}
