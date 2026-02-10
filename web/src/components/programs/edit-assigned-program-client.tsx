'use client'

import { useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout'
import { createClient } from '@/lib/supabase/client'
import { WorkoutPanel } from './workout-panel'
import { arrayMove } from '@dnd-kit/sortable'
import { ExerciseLibraryPanel } from './exercise-library-panel'
import { WeeklyVolumeCard } from './weekly-volume-card'

import type { Exercise } from '@/types/exercise'

export interface WorkoutItem {
    id: string
    item_type: 'exercise' | 'superset' | 'note'
    order_index: number
    parent_item_id: string | null
    exercise_id: string | null
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
    const [durationWeeks, setDurationWeeks] = useState(program.duration_weeks?.toString() || '')

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
            setError('Nome do programa é obrigatório')
            return
        }

        setSaving(true)
        setError(null)

        const supabase = createClient()

        try {
            // 1. Update Program Details
            const { error: updateError } = await supabase
                .from('assigned_programs')
                .update({
                    name: name.trim(),
                    description: description.trim() || null,
                    duration_weeks: durationWeeks ? parseInt(durationWeeks) : null,
                })
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
        <AppLayout trainerName={trainer.name} trainerEmail={trainer.email}>
            <div className="max-w-5xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push(`/students/${studentId}`)}
                            className="w-10 h-10 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-bold text-white">Editar Programa do Aluno</h1>
                                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 text-xs font-medium border border-amber-500/20">
                                    Edição direta
                                </span>
                            </div>
                            <p className="text-gray-400 mt-0.5 text-sm">
                                As alterações afetarão imediatamente o treino do aluno. Histórico existente não será resetado.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={saveProgram}
                        disabled={saving}
                        className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 disabled:from-gray-600 disabled:to-gray-600 text-white text-sm font-medium rounded-lg transition-all shadow-lg shadow-violet-500/20 flex items-center gap-2"
                    >
                        {saving ? (
                            <>
                                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                Salvando...
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Salvar Alterações
                            </>
                        )}
                    </button>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm flex items-start gap-3">
                        <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {error}
                    </div>
                )}

                {/* Program Info (ReadOnly for tracking, or Partial Edit) */}
                {/* Requirement says: update structure, NO reset progress. */}
                {/* Basic Info */}
                <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-5">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Nome do Programa
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full px-4 py-2.5 bg-gray-900/50 border border-gray-700 rounded-lg text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Duração (Semanas)
                            </label>
                            <input
                                type="number"
                                value={durationWeeks}
                                onChange={(e) => setDurationWeeks(e.target.value)}
                                className="w-full px-4 py-2.5 bg-gray-900/50 border border-gray-700 rounded-lg text-white"
                            />
                        </div>
                        <div className="md:col-span-3">
                            <label className="block text-sm font-medium text-gray-300 mb-2">Descrição</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={2}
                                className="w-full px-4 py-2.5 bg-gray-900/50 border border-gray-700 rounded-lg text-white resize-none"
                            />
                        </div>
                    </div>
                </div>


                {/* Weekly Volume Summary */}
                <WeeklyVolumeCard workouts={workouts} exercises={localExercises} />

                {/* 2-Panel Layout: Biblioteca | Treinos */}
                <div
                    className="grid grid-cols-[2fr_3fr] gap-6 overflow-hidden"
                    style={{ height: 'calc(100vh - 300px)', minHeight: '400px' }}
                >
                    {/* Panel 1: Biblioteca de Exercícios */}
                    <ExerciseLibraryPanel
                        exercises={localExercises}
                        trainerId={trainer.id}
                        onAddExercise={addExerciseFromLibrary}
                        onExerciseCreated={handleExerciseCreated}
                        activeWorkoutId={activeWorkoutId}
                    />

                    {/* Panel 2: Treinos */}
                    <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 overflow-hidden flex flex-col">
                        {/* Workout Tabs Header */}
                        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-700/50 bg-gray-800/30">
                            <div className="flex items-center gap-1 flex-1 overflow-x-auto">
                                {workouts.map((workout, index) => (
                                    <div
                                        key={workout.id}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => setActiveWorkoutId(workout.id)}
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveWorkoutId(workout.id) }}
                                        className={`group relative flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap cursor-pointer ${activeWorkoutId === workout.id
                                            ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                                            : 'text-gray-400 hover:bg-gray-700/50 border border-transparent'
                                            }`}
                                    >
                                        {workout.name}
                                        <span className="text-xs text-gray-500">({workout.items.length})</span>

                                        {activeWorkoutId === workout.id && (
                                            <div className="flex items-center gap-0.5 ml-1">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); moveWorkout(workout.id, 'up') }}
                                                    disabled={index === 0}
                                                    className="w-5 h-5 flex items-center justify-center text-gray-500 hover:text-white disabled:opacity-30"
                                                >
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7 7" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); moveWorkout(workout.id, 'down') }}
                                                    disabled={index === workouts.length - 1}
                                                    className="w-5 h-5 flex items-center justify-center text-gray-500 hover:text-white disabled:opacity-30"
                                                >
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); deleteWorkout(workout.id) }}
                                                    className="w-5 h-5 flex items-center justify-center text-gray-500 hover:text-red-400"
                                                >
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={addWorkout}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-violet-400 hover:bg-violet-500/10 rounded-lg transition-colors whitespace-nowrap"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Treino
                            </button>
                        </div>

                        {/* Workout Content */}
                        <div className="flex-1 overflow-auto">
                            {activeWorkout ? (
                                <WorkoutPanel
                                    workout={activeWorkout}
                                    exercises={exercises}
                                    onUpdateName={(name) => updateWorkoutName(activeWorkout.id, name)}
                                    onAddExercise={() => {/* Handled by library panel */ }}
                                    onAddNote={() => addNote(activeWorkout.id)}
                                    onAddExerciseToSuperset={(parentId) => {
                                        // The exercise library panel handles adding exercises to supersets
                                    }}
                                    onUpdateItem={(itemId, updates) => updateItem(activeWorkout.id, itemId, updates)}
                                    onDeleteItem={(itemId) => deleteItem(activeWorkout.id, itemId)}
                                    onMoveItem={(itemId, direction) => moveItem(activeWorkout.id, itemId, direction)}
                                    onReorderItem={handleReorderItem}
                                    // Superset handlers
                                    onCreateSupersetWithNext={(exerciseItemId) => createSupersetWithNext(activeWorkout.id, exerciseItemId)}
                                    onAddToExistingSuperset={(exerciseItemId, supersetId) => addToExistingSuperset(activeWorkout.id, exerciseItemId, supersetId)}
                                    onRemoveFromSuperset={(supersetId, exerciseItemId) => removeFromSuperset(activeWorkout.id, supersetId, exerciseItemId)}
                                    onDissolveSuperset={(supersetId) => dissolveSuperset(activeWorkout.id, supersetId)}
                                    onUpdateFrequency={(days) => updateWorkoutFrequency(activeWorkout.id, days)}
                                    occupiedDays={occupiedDays}
                                />
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full py-16">
                                    <div className="w-16 h-16 rounded-full bg-gray-700/50 flex items-center justify-center mb-4">
                                        <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                        </svg>
                                    </div>
                                    <p className="text-gray-400 mb-4">Crie seu primeiro treino</p>
                                    <button
                                        onClick={addWorkout}
                                        className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                        </svg>
                                        Adicionar Treino
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    )
}

