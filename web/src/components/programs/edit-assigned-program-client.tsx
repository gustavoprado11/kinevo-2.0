'use client'

import { useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Check, Loader2, Calendar, ArrowRight, Edit3, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AppLayout } from '@/components/layout'
import { createClient } from '@/lib/supabase/client'
import { WorkoutPanel } from './workout-panel'
import { arrayMove } from '@dnd-kit/sortable'
import { ExerciseLibraryPanel } from './exercise-library-panel'
import { VolumeSummary } from './volume-summary'

import type { Exercise } from '@/types/exercise'

export interface WorkoutItem {
    id: string
    item_type: 'exercise' | 'superset' | 'note'
    order_index: number
    parent_item_id: string | null
    exercise_id: string | null
    substitute_exercise_ids: string[]
    exercise?: Exercise
    sets: number | null
    reps: string | null
    rest_seconds: number | null
    notes: string | null
    children?: WorkoutItem[]
}

export interface Workout {
    id: string
    name: string
    order_index: number
    items: WorkoutItem[]
    frequency?: string[] // ['mon', 'tue', etc]
}

interface AssignedProgramData {
    id: string
    name: string
    description: string | null
    duration_weeks: number | null
    started_at?: string | null
    scheduled_start_date?: string | null
    assigned_workouts: Array<{
        id: string
        name: string
        order_index: number
        scheduled_days?: number[]
        assigned_workout_items: Array<{
            id: string
            item_type: string
            order_index: number
            parent_item_id: string | null
            exercise_id: string | null
            substitute_exercise_ids?: string[] | null
            sets: number | null
            reps: string | null
            rest_seconds: number | null
            notes: string | null
        }>
    }>
}

interface Trainer {
    id: string
    name: string
    email: string
    avatar_url?: string | null
    theme?: 'light' | 'dark' | 'system'
}

interface EditAssignedProgramClientProps {
    trainer: Trainer
    program: AssignedProgramData
    exercises: Exercise[]
    studentId: string
}

// Generate temp ID for new items
const tempId = () => `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

export function EditAssignedProgramClient({ trainer, program, exercises, studentId }: EditAssignedProgramClientProps) {
    const router = useRouter()

    // Program state
    const [name, setName] = useState(program.name)
    const [description, setDescription] = useState(program.description || '')
    const [durationWeeks, setDurationWeeks] = useState(program.duration_weeks?.toString() || '0')
    const [startDate, setStartDate] = useState(() => {
        const date = program.started_at || program.scheduled_start_date || new Date().toISOString()
        return date.split('T')[0]
    })
    const [isEndDateFixed, setIsEndDateFixed] = useState(false)
    const [isDescriptionOpen, setIsDescriptionOpen] = useState(false)
    const [assignmentType, setAssignmentType] = useState<'immediate' | 'scheduled'>(
        program.scheduled_start_date ? 'scheduled' : 'immediate'
    )

    // Helper to calculate end date from weeks
    const calculateEndDate = useCallback((start: string, weeksStr: string) => {
        const startObj = new Date(start)
        const weeks = parseInt(weeksStr) || 0
        if (isNaN(startObj.getTime())) return ''
        const endObj = new Date(startObj)
        endObj.setDate(endObj.getDate() + (weeks * 7) - 1)
        return endObj.toISOString().split('T')[0]
    }, [])

    // Helper to calculate weeks from end date
    const calculateWeeks = useCallback((start: string, end: string) => {
        const startObj = new Date(start)
        const endObj = new Date(end)
        if (isNaN(startObj.getTime()) || isNaN(endObj.getTime())) return '0'
        const diffTime = endObj.getTime() - startObj.getTime()
        const diffDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1)
        return Math.round(diffDays / 7).toString()
    }, [])

    const [endDate, setEndDate] = useState(() =>
        calculateEndDate(startDate, program.duration_weeks?.toString() || '0')
    )

    // Handlers for bidirectional sync
    const handleWeeksChange = (weeks: string) => {
        const weeksNum = Math.max(0, parseInt(weeks) || 0)
        const weeksStr = weeksNum.toString()

        setDurationWeeks(weeksStr)
        const newEnd = calculateEndDate(startDate, weeksStr)
        setEndDate(newEnd)
    }

    const handleEndDateChange = (end: string) => {
        // Prevent end date being before start date
        if (new Date(end) < new Date(startDate)) {
            const resetEnd = calculateEndDate(startDate, '0')
            setEndDate(resetEnd)
            setDurationWeeks('0')
            return
        }

        setEndDate(end)
        setIsEndDateFixed(true)
        const newWeeks = calculateWeeks(startDate, end)
        setDurationWeeks(newWeeks)
    }

    const handleStartDateChange = (start: string) => {
        setStartDate(start)
        const newEnd = calculateEndDate(start, durationWeeks)
        setEndDate(newEnd)
    }

    const [localExercises, setLocalExercises] = useState<Exercise[]>(exercises)

    // Handler for new inline exercises
    const handleExerciseCreated = (newExercise: Exercise) => {
        setLocalExercises(prev => [...prev, newExercise])
    }

    // Initialize workouts from program data
    const initializeWorkouts = (): Workout[] => {
        if (!program?.assigned_workouts) return []

        return program.assigned_workouts
            .sort((a, b) => a.order_index - b.order_index)
            .map(wt => {
                const items = wt.assigned_workout_items || []
                const parentItems = items
                    .filter(i => !i.parent_item_id)
                    .sort((a, b) => a.order_index - b.order_index)
                    .map(item => ({
                        id: item.id,
                        item_type: item.item_type as 'exercise' | 'superset' | 'note',
                        order_index: item.order_index,
                        parent_item_id: null,
                        exercise_id: item.exercise_id,
                        substitute_exercise_ids: item.substitute_exercise_ids || [],
                        exercise: localExercises.find(e => e.id === item.exercise_id), // Use localExercises
                        sets: item.sets,
                        reps: item.reps,
                        rest_seconds: item.rest_seconds,
                        notes: item.notes,
                        children: items
                            .filter(child => child.parent_item_id === item.id)
                            .sort((a, b) => a.order_index - b.order_index)
                            .map(child => ({
                                id: child.id,
                                item_type: child.item_type as 'exercise' | 'superset' | 'note',
                                order_index: child.order_index,
                                parent_item_id: item.id,
                                exercise_id: child.exercise_id,
                                substitute_exercise_ids: child.substitute_exercise_ids || [],
                                exercise: localExercises.find(e => e.id === child.exercise_id), // Use localExercises
                                sets: child.sets,
                                reps: child.reps,
                                rest_seconds: child.rest_seconds,
                                notes: child.notes,
                            }))
                    }))

                const dayMap: Record<number, string> = { 0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat' }
                const frequency = (wt.scheduled_days || []).map(d => dayMap[d])

                return {
                    id: wt.id,
                    name: wt.name,
                    order_index: wt.order_index,
                    frequency,
                    items: parentItems,
                }
            })
    }

    const [workouts, setWorkouts] = useState<Workout[]>(initializeWorkouts)
    const [activeWorkoutId, setActiveWorkoutId] = useState<string | null>(
        workouts.length > 0 ? workouts[0].id : null
    )
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [nameShake, setNameShake] = useState(false)

    const activeWorkout = workouts.find(w => w.id === activeWorkoutId)

    // Calculate days occupied by other workouts
    const occupiedDays = useMemo(() => {
        const days = new Set<string>()
        workouts.forEach(w => {
            if (activeWorkoutId && w.id !== activeWorkoutId) {
                w.frequency?.forEach(day => days.add(day))
            }
        })
        return Array.from(days)
    }, [workouts, activeWorkoutId])

    // Workout management
    const addWorkout = () => {
        const newWorkout: Workout = {
            id: tempId(),
            name: `Treino ${String.fromCharCode(65 + workouts.length)}`,
            order_index: workouts.length,
            items: [],
        }
        setWorkouts([...workouts, newWorkout])
        setActiveWorkoutId(newWorkout.id)
    }

    const updateWorkoutName = (id: string, newName: string) => {
        setWorkouts(workouts.map(w =>
            w.id === id ? { ...w, name: newName } : w
        ))
    }

    const updateWorkoutFrequency = (id: string, days: string[]) => {
        setWorkouts(workouts.map(w =>
            w.id === id ? { ...w, frequency: days } : w
        ))
    }

    const deleteWorkout = (id: string) => {
        if (!confirm('Tem certeza que deseja remover este treino? Se ele já foi realizado pelo aluno, o histórico associado pode ser perdido.')) {
            return
        }
        const filtered = workouts.filter(w => w.id !== id)
        setWorkouts(filtered.map((w, i) => ({ ...w, order_index: i })))
        if (activeWorkoutId === id) {
            setActiveWorkoutId(filtered.length > 0 ? filtered[0].id : null)
        }
    }

    const moveWorkout = (id: string, direction: 'up' | 'down') => {
        const index = workouts.findIndex(w => w.id === id)
        if (direction === 'up' && index > 0) {
            const newWorkouts = [...workouts]
                ;[newWorkouts[index - 1], newWorkouts[index]] = [newWorkouts[index], newWorkouts[index - 1]]
            setWorkouts(newWorkouts.map((w, i) => ({ ...w, order_index: i })))
        }
        if (direction === 'down' && index < workouts.length - 1) {
            const newWorkouts = [...workouts]
                ;[newWorkouts[index], newWorkouts[index + 1]] = [newWorkouts[index + 1], newWorkouts[index]]
            setWorkouts(newWorkouts.map((w, i) => ({ ...w, order_index: i })))
        }
    }

    const handleReorderItem = useCallback((activeId: string, overId: string) => {
        if (!activeWorkoutId) return

        setWorkouts(prev => prev.map(w => {
            if (w.id !== activeWorkoutId) return w

            const oldIndex = w.items.findIndex(i => i.id === activeId)
            const newIndex = w.items.findIndex(i => i.id === overId)

            if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
                const newItems = arrayMove(w.items, oldIndex, newIndex)
                return { ...w, items: newItems.map((item, i) => ({ ...item, order_index: i })) }
            }
            return w
        }))
    }, [activeWorkoutId])

    // Item management - Add exercise from inline library
    const addExerciseFromLibrary = useCallback((exercise: Exercise) => {
        if (!activeWorkoutId) return

        setWorkouts(prev => prev.map(w => {
            if (w.id !== activeWorkoutId) return w

            return {
                ...w,
                items: [...w.items, {
                    id: tempId(),
                    item_type: 'exercise' as const,
                    order_index: w.items.length,
                    parent_item_id: null,
                    exercise_id: exercise.id,
                    substitute_exercise_ids: [],
                    exercise,
                    sets: 3,
                    reps: '10-12',
                    rest_seconds: 60,
                    notes: null,
                }]
            }
        }))
    }, [activeWorkoutId])

    // Create superset by combining exercise with the next one
    const createSupersetWithNext = (workoutId: string, exerciseItemId: string) => {
        setWorkouts(prev => prev.map(w => {
            if (w.id !== workoutId) return w

            const itemIndex = w.items.findIndex(i => i.id === exerciseItemId)
            if (itemIndex === -1 || itemIndex >= w.items.length - 1) return w

            const currentItem = w.items[itemIndex]
            const nextItem = w.items[itemIndex + 1]

            // Only combine exercises (not supersets or notes)
            if (currentItem.item_type !== 'exercise' || nextItem.item_type !== 'exercise') return w

            // Create new superset containing both exercises
            const superset: WorkoutItem = {
                id: tempId(),
                item_type: 'superset',
                order_index: itemIndex,
                parent_item_id: null,
                exercise_id: null,
                substitute_exercise_ids: [],
                sets: null,
                reps: null,
                rest_seconds: currentItem.rest_seconds || 60,
                notes: null,
                children: [
                    { ...currentItem, order_index: 0, parent_item_id: null },
                    { ...nextItem, order_index: 1, parent_item_id: null }
                ]
            }

            // Remove both items and insert superset
            const newItems = w.items.filter((_, i) => i !== itemIndex && i !== itemIndex + 1)
            newItems.splice(itemIndex, 0, superset)

            return {
                ...w,
                items: newItems.map((item, i) => ({ ...item, order_index: i }))
            }
        }))
    }

    // Add exercise to an existing superset
    const addToExistingSuperset = (workoutId: string, exerciseItemId: string, supersetId: string) => {
        setWorkouts(prev => prev.map(w => {
            if (w.id !== workoutId) return w

            const exerciseItem = w.items.find(i => i.id === exerciseItemId)
            const supersetItem = w.items.find(i => i.id === supersetId)

            if (!exerciseItem || !supersetItem || supersetItem.item_type !== 'superset') return w
            if (exerciseItem.item_type !== 'exercise') return w

            // Add exercise to superset's children
            const newChildren = [
                ...(supersetItem.children || []),
                { ...exerciseItem, order_index: (supersetItem.children?.length || 0), parent_item_id: supersetId }
            ]

            // Remove exercise from root and update superset
            return {
                ...w,
                items: w.items
                    .filter(i => i.id !== exerciseItemId)
                    .map(item => {
                        if (item.id === supersetId) {
                            return { ...item, children: newChildren }
                        }
                        return item
                    })
                    .map((item, i) => ({ ...item, order_index: i }))
            }
        }))
    }

    // Remove exercise from superset (with auto-dissolution if only 1 remains)
    const removeFromSuperset = (workoutId: string, supersetId: string, exerciseItemId: string) => {
        setWorkouts(prev => prev.map(w => {
            if (w.id !== workoutId) return w

            const supersetIndex = w.items.findIndex(i => i.id === supersetId)
            const supersetItem = w.items[supersetIndex]

            if (!supersetItem || supersetItem.item_type !== 'superset') return w

            const exerciseToRemove = supersetItem.children?.find(c => c.id === exerciseItemId)
            if (!exerciseToRemove) return w

            const remainingChildren = supersetItem.children?.filter(c => c.id !== exerciseItemId) || []

            // Auto-dissolution: if only 1 child remains, dissolve the superset
            if (remainingChildren.length <= 1) {
                const newItems = [...w.items]
                // Remove superset
                newItems.splice(supersetIndex, 1)

                // Insert the removed exercise and the remaining one (if any) at the superset's position
                const itemsToInsert: WorkoutItem[] = [
                    { ...exerciseToRemove, parent_item_id: null, order_index: supersetIndex }
                ]
                if (remainingChildren.length === 1) {
                    itemsToInsert.push({ ...remainingChildren[0], parent_item_id: null, order_index: supersetIndex + 1 })
                }

                newItems.splice(supersetIndex, 0, ...itemsToInsert)

                return {
                    ...w,
                    items: newItems.map((item, i) => ({ ...item, order_index: i }))
                }
            }

            // Otherwise just remove the exercise from superset and insert it after
            const newItems = [...w.items]
            newItems.splice(supersetIndex + 1, 0, { ...exerciseToRemove, parent_item_id: null, order_index: supersetIndex + 1 })

            return {
                ...w,
                items: newItems.map(item => {
                    if (item.id === supersetId) {
                        return {
                            ...item,
                            children: remainingChildren.map((c, i) => ({ ...c, order_index: i }))
                        }
                    }
                    return item
                }).map((item, i) => ({ ...item, order_index: i }))
            }
        }))
    }

    // Dissolve superset - extract all exercises as standalone items
    const dissolveSuperset = (workoutId: string, supersetId: string) => {
        setWorkouts(prev => prev.map(w => {
            if (w.id !== workoutId) return w

            const supersetIndex = w.items.findIndex(i => i.id === supersetId)
            const supersetItem = w.items[supersetIndex]

            if (!supersetItem || supersetItem.item_type !== 'superset') return w

            const children = supersetItem.children || []
            if (children.length === 0) return w

            // Remove superset and insert all children at its position
            const newItems = [...w.items]
            newItems.splice(supersetIndex, 1)

            // Insert all children as standalone exercises
            const childrenToInsert = children.map((child, i) => ({
                ...child,
                parent_item_id: null,
                order_index: supersetIndex + i
            }))
            newItems.splice(supersetIndex, 0, ...childrenToInsert)

            return {
                ...w,
                items: newItems.map((item, i) => ({ ...item, order_index: i }))
            }
        }))
    }

    // Legacy: Add empty superset (keeping for compatibility but not exposing in UI)
    const addSuperset = (workoutId: string) => {
        setWorkouts(prev => prev.map(w => {
            if (w.id !== workoutId) return w
            return {
                ...w,
                items: [...w.items, {
                    id: tempId(),
                    item_type: 'superset' as const,
                    order_index: w.items.length,
                    parent_item_id: null,
                    exercise_id: null,
                    substitute_exercise_ids: [],
                    sets: null,
                    reps: null,
                    rest_seconds: 60,
                    notes: null,
                    children: [],
                }]
            }
        }))
    }

    const addNote = (workoutId: string) => {
        setWorkouts(prev => prev.map(w => {
            if (w.id !== workoutId) return w
            return {
                ...w,
                items: [...w.items, {
                    id: tempId(),
                    item_type: 'note' as const,
                    order_index: w.items.length,
                    parent_item_id: null,
                    exercise_id: null,
                    substitute_exercise_ids: [],
                    sets: null,
                    reps: null,
                    rest_seconds: null,
                    notes: '',
                }]
            }
        }))
    }

    const updateItem = (workoutId: string, itemId: string, updates: Partial<WorkoutItem>) => {
        setWorkouts(prev => prev.map(w => {
            if (w.id !== workoutId) return w
            return {
                ...w,
                items: w.items.map(item => {
                    if (item.id === itemId) {
                        return { ...item, ...updates }
                    }
                    if (item.children) {
                        return {
                            ...item,
                            children: item.children.map(child =>
                                child.id === itemId ? { ...child, ...updates } : child
                            )
                        }
                    }
                    return item
                })
            }
        }))
    }

    const deleteItem = (workoutId: string, itemId: string) => {
        setWorkouts(prev => prev.map(w => {
            if (w.id !== workoutId) return w

            const rootItem = w.items.find(i => i.id === itemId)
            if (rootItem) {
                return {
                    ...w,
                    items: w.items
                        .filter(i => i.id !== itemId)
                        .map((item, i) => ({ ...item, order_index: i }))
                }
            }

            return {
                ...w,
                items: w.items.map(item => ({
                    ...item,
                    children: item.children
                        ?.filter(c => c.id !== itemId)
                        .map((child, i) => ({ ...child, order_index: i }))
                }))
            }
        }))
    }

    const moveItem = (workoutId: string, itemId: string, direction: 'up' | 'down') => {
        setWorkouts(prev => prev.map(w => {
            if (w.id !== workoutId) return w

            const itemIndex = w.items.findIndex(i => i.id === itemId)
            if (itemIndex !== -1) {
                const newItems = [...w.items]
                if (direction === 'up' && itemIndex > 0) {
                    ;[newItems[itemIndex - 1], newItems[itemIndex]] = [newItems[itemIndex], newItems[itemIndex - 1]]
                } else if (direction === 'down' && itemIndex < newItems.length - 1) {
                    ;[newItems[itemIndex], newItems[itemIndex + 1]] = [newItems[itemIndex + 1], newItems[itemIndex]]
                }
                return { ...w, items: newItems.map((item, i) => ({ ...item, order_index: i })) }
            }

            return {
                ...w,
                items: w.items.map(item => {
                    if (!item.children) return item
                    const childIndex = item.children.findIndex(c => c.id === itemId)
                    if (childIndex === -1) return item

                    const newChildren = [...item.children]
                    if (direction === 'up' && childIndex > 0) {
                        ;[newChildren[childIndex - 1], newChildren[childIndex]] = [newChildren[childIndex], newChildren[childIndex - 1]]
                    } else if (direction === 'down' && childIndex < newChildren.length - 1) {
                        ;[newChildren[childIndex], newChildren[childIndex + 1]] = [newChildren[childIndex + 1], newChildren[childIndex]]
                    }
                    return { ...item, children: newChildren.map((c, i) => ({ ...c, order_index: i })) }
                })
            }
        }))
    }

    const saveProgram = async () => {
        if (!name.trim()) {
            setError('Por favor, preencha o nome do programa.')
            setNameShake(true)
            setTimeout(() => setNameShake(false), 600)
            return
        }

        setSaving(true)
        setError(null)

        const supabase = createClient()

        try {
            // 1. Update Program Details
            const updatePayload: any = {
                name: name.trim(),
                description: description.trim() || null,
                duration_weeks: durationWeeks ? parseInt(durationWeeks) : null,
            }

            // Update the correct date field and status
            if (assignmentType === 'immediate') {
                updatePayload.started_at = startDate
                updatePayload.scheduled_start_date = null
                updatePayload.status = 'active'
            } else {
                updatePayload.scheduled_start_date = startDate
                updatePayload.started_at = null
                updatePayload.status = 'scheduled'
            }

            const { error: updateError } = await supabase
                .from('assigned_programs')
                .update(updatePayload)
                .eq('id', program.id)

            if (updateError) throw updateError

            // 2. Identify Deleted Workouts
            const currentWorkoutIds = workouts
                .filter(w => !w.id.startsWith('temp_'))
                .map(w => w.id)

            // Delete workouts that are no longer in the list
            // WARNING: This cascades to deletion of session history if configured in DB
            // We warned the user in deleteWorkout()
            if (currentWorkoutIds.length > 0) {
                const { error: deleteError } = await supabase
                    .from('assigned_workouts')
                    .delete()
                    .eq('assigned_program_id', program.id)
                    .not('id', 'in', `(${currentWorkoutIds.join(',')})`)

                if (deleteError) throw deleteError
            } else {
                // If currentWorkoutIds is empty, it means ALL original workouts were removed
                // But we still have temp workouts potentially
                // So delete everything from DB for this program
                const { error: deleteError } = await supabase
                    .from('assigned_workouts')
                    .delete()
                    .eq('assigned_program_id', program.id)

                if (deleteError) throw deleteError
            }

            // 3. Upsert Workouts
            for (const workout of workouts) {
                let workoutId = workout.id
                const isNewWorkout = workoutId.startsWith('temp_')

                if (isNewWorkout) {
                    const { data, error: insertError } = await supabase
                        .from('assigned_workouts')
                        .insert({
                            assigned_program_id: program.id,
                            name: workout.name,
                            order_index: workout.order_index,
                            scheduled_days: (workout.frequency || []).map(d => {
                                const map: Record<string, number> = { 'sun': 0, 'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4, 'fri': 5, 'sat': 6 }
                                return map[d]
                            }).filter(x => x !== undefined),
                        })
                        .select('id')
                        .single()

                    if (insertError) throw insertError
                    workoutId = data.id
                    // Note: we update local var, but not state, because we're refreshing page anyway
                } else {
                    const { error: updateError } = await supabase
                        .from('assigned_workouts')
                        .update({
                            name: workout.name,
                            order_index: workout.order_index,
                            scheduled_days: (workout.frequency || []).map(d => {
                                const map: Record<string, number> = { 'sun': 0, 'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4, 'fri': 5, 'sat': 6 }
                                return map[d]
                            }).filter(x => x !== undefined),
                        })
                        .eq('id', workoutId)

                    if (updateError) throw updateError
                }

                // 4. Handle Items
                const currentItemIds = workout.items
                    .flatMap(i => [i.id, ...(i.children?.map(c => c.id) || [])])
                    .filter(id => !id.startsWith('temp_'))

                // Delete missing items
                if (currentItemIds.length > 0) {
                    await supabase
                        .from('assigned_workout_items')
                        .delete()
                        .eq('assigned_workout_id', workoutId)
                        .not('id', 'in', `(${currentItemIds.join(',')})`)
                } else if (!isNewWorkout) {
                    // Only delete items if workout existed, otherwise it's empty anyway
                    await supabase
                        .from('assigned_workout_items')
                        .delete()
                        .eq('assigned_workout_id', workoutId)
                }

                // Upsert items (Root first, then children)
                for (const item of workout.items) {
                    let itemId = item.id

                    const payload: any = {
                        assigned_workout_id: workoutId,
                        item_type: item.item_type,
                        order_index: item.order_index,
                        exercise_id: item.exercise_id,
                        substitute_exercise_ids: item.substitute_exercise_ids || [],
                        sets: item.sets,
                        reps: item.reps,
                        rest_seconds: item.rest_seconds,
                        notes: item.notes,
                        parent_item_id: null,
                        // Snapshot data
                        exercise_name: item.exercise?.name,
                        exercise_muscle_group: (() => {
                            const mg = item.exercise?.muscle_groups?.[0] || (item.exercise as any)?.muscle_group
                            return typeof mg === 'object' ? mg?.name : mg
                        })(),
                        exercise_equipment: item.exercise?.equipment
                    }

                    if (itemId.startsWith('temp_')) {
                        const { data, error: itemError } = await supabase
                            .from('assigned_workout_items')
                            .insert(payload)
                            .select('id')
                            .single()

                        if (itemError) throw itemError
                        itemId = data.id
                    } else {
                        await supabase
                            .from('assigned_workout_items')
                            .update(payload)
                            .eq('id', itemId)
                    }

                    // Children (Supersets)
                    if (item.children) {
                        for (const child of item.children) {
                            let childId = child.id
                            const childPayload: any = {
                                assigned_workout_id: workoutId,
                                item_type: child.item_type,
                                order_index: child.order_index,
                                exercise_id: child.exercise_id,
                                substitute_exercise_ids: child.substitute_exercise_ids || [],
                                sets: child.sets,
                                reps: child.reps,
                                rest_seconds: child.rest_seconds,
                                notes: child.notes,
                                parent_item_id: itemId,
                                // Snapshot
                                exercise_name: child.exercise?.name,
                                exercise_muscle_group: (() => {
                                    const mg = child.exercise?.muscle_groups?.[0] || (child.exercise as any)?.muscle_group
                                    return typeof mg === 'object' ? mg?.name : mg
                                })(),
                                exercise_equipment: child.exercise?.equipment
                            }

                            if (childId.startsWith('temp_')) {
                                await supabase
                                    .from('assigned_workout_items')
                                    .insert(childPayload)
                            } else {
                                await supabase
                                    .from('assigned_workout_items')
                                    .update(childPayload)
                                    .eq('id', childId)
                            }
                        }
                    }
                }
            }

            // Success feedback
            alert('Programa atualizado com sucesso!')
            router.push(`/students/${studentId}`)
            router.refresh()

        } catch (err: any) {
            console.error('Error saving program:', err)
            setError(err.message || 'Erro ao salvar programa')
        } finally {
            setSaving(false)
        }
    }

    return (
        <AppLayout
            trainerName={trainer.name}
            trainerEmail={trainer.email}
            trainerAvatarUrl={trainer.avatar_url}
            trainerTheme={trainer.theme}
        >
            <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-surface-canvas">
                {/* Scheduling Bar (Responsive Header) */}
                <div className="flex-shrink-0 min-h-[72px] bg-surface-primary backdrop-blur-md border-b border-k-border-primary flex flex-wrap items-center gap-4 px-6 py-3 z-30">
                    {/* Left Section: Identity */}
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => router.push(`/students/${studentId}`)}
                            className="w-10 h-10 rounded-full hover:bg-glass-bg-active text-k-text-tertiary hover:text-k-text-primary transition-all flex-shrink-0"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </Button>

                        <div className="flex flex-col min-w-[200px] flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-k-text-quaternary">Editando Programa</span>
                                <div className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-full">
                                    <span className="text-[9px] font-bold text-amber-500 tracking-wider">EDIÇÃO DIRETA</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => {
                                        setName(e.target.value)
                                        if (error) setError(null)
                                    }}
                                    placeholder="Ex: Força e Hipertrofia"
                                    className={`bg-transparent border-none text-lg font-bold text-k-text-primary placeholder:text-k-text-quaternary focus:ring-0 p-0 w-full min-w-[180px] truncate transition-all ${nameShake ? 'animate-[shake_0.5s_ease-in-out]' : ''
                                        } ${error && !name.trim() ? 'placeholder:text-red-400/60' : ''}`}
                                />
                                <button
                                    onClick={() => setIsDescriptionOpen(!isDescriptionOpen)}
                                    className={`p-1.5 rounded-lg transition-all ${isDescriptionOpen ? 'bg-violet-500/20 text-violet-400' : 'text-k-text-quaternary hover:text-k-text-tertiary hover:bg-glass-bg'
                                        }`}
                                    title="Editar descrição"
                                >
                                    <Edit3 className="w-3.5 h-3.5" strokeWidth={2.5} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Center Section: Timeline & Scheduling */}
                    <div className="flex items-center gap-8 px-8 border-x border-k-border-subtle">
                        {/* Timeline Row */}
                        <div className="flex flex-col gap-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-k-text-quaternary">
                                Cronograma do Programa
                            </span>
                            <div className="flex items-center gap-2">
                                {/* Start Date */}
                                <div className="flex items-center gap-3 bg-glass-bg border border-k-border-subtle rounded-xl px-4 py-2 group hover:border-k-border-primary transition-all">
                                    <Calendar className="w-4 h-4 text-k-text-tertiary group-hover:text-violet-400 transition-colors" strokeWidth={1.5} />
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-bold text-k-text-quaternary uppercase tracking-tight -mb-0.5">Início</span>
                                        <input
                                            type="date"
                                            value={startDate}
                                            onChange={(e) => handleStartDateChange(e.target.value)}
                                            className="bg-transparent border-none text-xs font-bold text-k-text-primary focus:ring-0 p-0 [color-scheme:dark]"
                                        />
                                    </div>
                                </div>

                                <ArrowRight className="w-3.5 h-3.5 text-k-border-subtle shrink-0" />

                                {/* Weeks Input (Platter Style) */}
                                <div className="flex flex-col items-center bg-glass-bg border border-k-border-subtle rounded-xl px-3 py-2 min-w-[70px]">
                                    <span className="text-[9px] font-bold text-k-text-quaternary uppercase tracking-tight -mb-1">Semanas</span>
                                    <input
                                        type="number"
                                        value={durationWeeks}
                                        onChange={(e) => handleWeeksChange(e.target.value)}
                                        min="0"
                                        className="bg-transparent border-none text-sm font-black text-violet-400 focus:ring-0 p-0 w-full text-center"
                                    />
                                </div>

                                <ArrowRight className="w-3.5 h-3.5 text-k-border-subtle shrink-0" />

                                {/* End Date (Manual vs Auto Visuals) */}
                                <div
                                    className="relative flex items-center gap-3 bg-glass-bg border border-k-border-subtle rounded-xl px-4 py-2 group hover:border-k-border-primary transition-all cursor-help"
                                    title="A duração em semanas será ajustada automaticamente ao alterar a data fim."
                                >
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-bold text-k-text-quaternary uppercase tracking-tight -mb-0.5">Fim Previsto</span>
                                        <div className="flex items-center gap-1.5">
                                            <input
                                                type="date"
                                                value={endDate}
                                                onChange={(e) => handleEndDateChange(e.target.value)}
                                                className={`bg-transparent border-none text-xs font-bold focus:ring-0 p-0 [color-scheme:dark] transition-colors ${isEndDateFixed ? 'text-violet-400' : 'text-k-text-tertiary'
                                                    }`}
                                            />
                                            {isEndDateFixed && <Edit3 className="w-3 h-3 text-violet-400 animate-in fade-in zoom-in duration-300" />}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Activation Control */}
                        <div className="flex flex-col gap-1.5 min-w-[200px]">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-k-text-quaternary">
                                Ativação
                            </span>
                            <div className="bg-surface-inset p-1 rounded-xl flex items-center gap-1 border border-k-border-subtle">
                                <button
                                    onClick={() => setAssignmentType('immediate')}
                                    className={`flex-1 px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all ${assignmentType === 'immediate'
                                        ? 'bg-glass-bg-active text-k-text-primary shadow-sm ring-1 ring-k-border-subtle'
                                        : 'text-k-text-tertiary hover:text-k-text-primary'
                                        }`}
                                >
                                    Imediata
                                </button>
                                <button
                                    onClick={() => setAssignmentType('scheduled')}
                                    className={`flex-1 px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all ${assignmentType === 'scheduled'
                                        ? 'bg-glass-bg-active text-k-text-primary shadow-sm ring-1 ring-k-border-subtle'
                                        : 'text-k-text-tertiary hover:text-k-text-primary'
                                        }`}
                                >
                                    Agendar Fila
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Right Section: Actions */}
                    <div className="flex items-center gap-4 ml-auto flex-shrink-0">
                        <div className="relative">
                            <Button
                                onClick={saveProgram}
                                disabled={saving}
                                className="bg-violet-600 hover:bg-violet-500 text-white rounded-full px-8 py-2.5 h-11 text-sm font-bold transition-all shadow-lg shadow-violet-500/20 min-w-[160px]"
                            >
                                {saving ? (
                                    <div className="flex items-center gap-2">
                                        <Loader2 className="animate-spin w-4 h-4" />
                                        <span>Salvando...</span>
                                    </div>
                                ) : (
                                    assignmentType === 'immediate' ? 'Salvar Alterações' : 'Agendar Programa'
                                )}
                            </Button>

                            {/* Alert Note */}
                            {assignmentType === 'immediate' && (
                                <p className="absolute -bottom-5 right-0 text-[10px] text-amber-500 font-medium whitespace-nowrap animate-in fade-in slide-in-from-top-1">
                                    Alterações em tempo real.
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Header-based Description Area */}
                {isDescriptionOpen && (
                    <div className="flex-shrink-0 bg-surface-primary border-b border-k-border-subtle px-8 py-4 animate-in slide-in-from-top-4 duration-300">
                        <div className="max-w-3xl">
                            <label className="block text-[10px] font-bold text-k-text-quaternary uppercase tracking-widest mb-2">Descrição do Programa</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Adicione detalhes sobre o objetivo, metodologia ou observações gerais..."
                                className="w-full bg-glass-bg border border-k-border-subtle rounded-xl px-4 py-3 text-sm text-k-text-primary placeholder:text-k-border-subtle focus:ring-1 focus:ring-violet-500/50 focus:border-violet-500/30 transition-all min-h-[80px] resize-none"
                            />
                        </div>
                    </div>
                )}

                {error && (
                    <div className="flex-shrink-0 mx-6 mt-3 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span className="font-medium">{error}</span>
                        <button
                            onClick={() => setError(null)}
                            className="ml-auto text-red-400/60 hover:text-red-400 transition-colors text-xs font-bold"
                        >
                            ✕
                        </button>
                    </div>
                )}



                {/* Weekly Volume Summary */}
                <VolumeSummary workouts={workouts} />

                {/* Workspace (Layout Columns) — identical to program-builder-client */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Left Panel: Exercise Library */}
                    <div className="w-[320px] bg-surface-primary border-r border-k-border-subtle flex flex-col flex-shrink-0">
                        <ExerciseLibraryPanel
                            exercises={localExercises}
                            trainerId={trainer.id}
                            onAddExercise={addExerciseFromLibrary}
                            onExerciseCreated={handleExerciseCreated}
                            activeWorkoutId={activeWorkoutId}
                        />
                    </div>

                    {/* Right Panel: Canvas */}
                    <div className="flex-1 flex flex-col min-w-0 bg-[#09090B]">
                        {/* Workout Tabs (Segmented Control) */}
                        <div className="flex items-center gap-1 p-4 overflow-x-auto no-scrollbar border-b border-white/5 bg-[#09090B]">
                            <div className="bg-[#1C1C1E] p-1 rounded-xl flex gap-1 items-center border border-white/5">
                                {workouts.map((workout) => (
                                    <button
                                        key={workout.id}
                                        onClick={() => setActiveWorkoutId(workout.id)}
                                        className={`
                                            px-4 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap
                                            ${activeWorkoutId === workout.id
                                                ? 'bg-glass-bg-active text-k-text-primary shadow-sm ring-1 ring-k-border-subtle'
                                                : 'text-k-text-tertiary hover:text-k-text-primary hover:bg-glass-bg'
                                            }
                                        `}
                                    >
                                        {workout.name}
                                    </button>
                                ))}
                            </div>

                            <button
                                onClick={addWorkout}
                                className="w-8 h-8 flex items-center justify-center rounded-lg text-k-text-quaternary hover:text-k-text-primary hover:bg-glass-bg transition-all ml-2"
                                title="Adicionar Treino"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                                </svg>
                            </button>
                        </div>

                        {/* Workout Canvas */}
                        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                            <div className="max-w-3xl mx-auto pb-20">
                                {activeWorkout ? (
                                    <WorkoutPanel
                                        workout={activeWorkout}
                                        exercises={localExercises}
                                        onUpdateName={(newName) => updateWorkoutName(activeWorkout.id, newName)}
                                        onAddExercise={() => { }}
                                        onAddNote={() => addNote(activeWorkout.id)}
                                        onUpdateItem={(itemId, updates) => updateItem(activeWorkout.id, itemId, updates)}
                                        onDeleteItem={(itemId) => deleteItem(activeWorkout.id, itemId)}
                                        onMoveItem={(itemId, dir) => moveItem(activeWorkout.id, itemId, dir)}
                                        onReorderItem={handleReorderItem}
                                        onCreateSupersetWithNext={(itemId) => createSupersetWithNext(activeWorkout.id, itemId)}
                                        onAddToExistingSuperset={(itemId, supersetId) => addToExistingSuperset(activeWorkout.id, itemId, supersetId)}
                                        onRemoveFromSuperset={(supersetId, exerciseItemId) => removeFromSuperset(activeWorkout.id, supersetId, exerciseItemId)}
                                        onDissolveSuperset={(supersetId) => dissolveSuperset(activeWorkout.id, supersetId)}
                                        onUpdateFrequency={(days) => updateWorkoutFrequency(activeWorkout.id, days)}
                                        occupiedDays={occupiedDays}
                                    />
                                ) : (
                                    <div className="text-center py-20">
                                        <p className="text-k-text-quaternary text-sm">Selecione ou crie um treino para começar</p>
                                    </div>
                                )}

                                <div className="mt-8 flex justify-center">
                                    <button
                                        onClick={() => deleteWorkout(activeWorkoutId!)}
                                        className="text-k-text-quaternary hover:text-red-400 text-xs font-semibold py-2 px-4 rounded-lg hover:bg-red-500/10 transition-all flex items-center gap-2"
                                        disabled={workouts.length <= 1}
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                        Excluir Treino Atual
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    )
}
