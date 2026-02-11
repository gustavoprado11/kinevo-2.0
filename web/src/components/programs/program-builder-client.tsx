'use client'

import { useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout'
import { createClient } from '@/lib/supabase/client'
import { WorkoutPanel } from './workout-panel'
import { arrayMove } from '@dnd-kit/sortable'
import { ExerciseLibraryPanel } from './exercise-library-panel'
import { VolumeSummary } from './volume-summary'
import { Button } from '@/components/ui/button'
import { ChevronLeft, Check, Loader2, Calendar, ArrowRight, Edit3 } from 'lucide-react'

import type { Exercise } from '@/types/exercise'
import { assignProgram } from '@/app/students/[id]/actions/assign-program'

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

interface ProgramData {
    id: string
    name: string
    description: string | null
    duration_weeks: number | null
    workout_templates?: Array<{
        id: string
        name: string
        order_index: number
        frequency?: string[]
        workout_item_templates?: Array<{
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

interface StudentContext {
    id: string
    name: string
}

interface ProgramBuilderClientProps {
    trainer: Trainer
    program: ProgramData | null
    exercises: Exercise[]
    studentContext?: StudentContext
    initialAssignmentType?: 'immediate' | 'scheduled'
}

// Generate temp ID for new items
const tempId = () => `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

export function ProgramBuilderClient({ trainer, program, exercises, studentContext, initialAssignmentType = 'immediate' }: ProgramBuilderClientProps) {
    const router = useRouter()
    const isEditing = !!program
    const isStudentContext = !!studentContext

    // Local exercises state to support inline creation
    const [localExercises, setLocalExercises] = useState<Exercise[]>(exercises)

    // Program state
    const [name, setName] = useState(program?.name || '')
    const [description, setDescription] = useState(program?.description || '')
    const [durationWeeks, setDurationWeeks] = useState(program?.duration_weeks?.toString() || '0')
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
    const [isEndDateFixed, setIsEndDateFixed] = useState(false)
    const [assignmentType, setAssignmentType] = useState<'immediate' | 'scheduled'>(initialAssignmentType)
    const [saveAsTemplate, setSaveAsTemplate] = useState(false)

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
        calculateEndDate(new Date().toISOString().split('T')[0], program?.duration_weeks?.toString() || '0')
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
            // Reset to start date + 0 weeks
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

    // Initialize workouts helper
    const initializeWorkouts = (): Workout[] => {
        console.log('Initializing workouts with program:', program?.workout_templates)
        if (!program?.workout_templates || program.workout_templates.length === 0) {
            return [{
                id: tempId(),
                name: 'Treino A',
                order_index: 0,
                items: [],
                frequency: []
            }]
        }

        return program.workout_templates
            .sort((a, b) => a.order_index - b.order_index)
            .map(wt => {
                const rawItems = wt.workout_item_templates || []
                const parents = rawItems.filter(i => !i.parent_item_id)
                const children = rawItems.filter(i => i.parent_item_id)

                const items: WorkoutItem[] = parents
                    .sort((a, b) => a.order_index - b.order_index)
                    .map(p => {
                        const itemChildren = children
                            .filter(c => c.parent_item_id === p.id)
                            .sort((a, b) => a.order_index - b.order_index)
                            .map(c => ({
                                id: c.id,
                                item_type: c.item_type as 'exercise' | 'superset' | 'note',
                                order_index: c.order_index,
                                parent_item_id: c.parent_item_id,
                                exercise_id: c.exercise_id,
                                substitute_exercise_ids: c.substitute_exercise_ids || [],
                                exercise: c.exercise_id ? exercises.find(e => e.id === c.exercise_id) : undefined,
                                sets: c.sets,
                                reps: c.reps,
                                rest_seconds: c.rest_seconds,
                                notes: c.notes,
                            }))

                        return {
                            id: p.id,
                            item_type: p.item_type as 'exercise' | 'superset' | 'note',
                            order_index: p.order_index,
                            parent_item_id: p.parent_item_id,
                            exercise_id: p.exercise_id,
                            substitute_exercise_ids: p.substitute_exercise_ids || [],
                            exercise: p.exercise_id ? exercises.find(e => e.id === p.exercise_id) : undefined,
                            sets: p.sets,
                            reps: p.reps,
                            rest_seconds: p.rest_seconds,
                            notes: p.notes,
                            children: itemChildren
                        }
                    })

                return {
                    id: wt.id,
                    name: wt.name,
                    order_index: wt.order_index,
                    frequency: wt.frequency || [],
                    items
                }
            })
    }

    const [workouts, setWorkouts] = useState<Workout[]>(initializeWorkouts)
    const [activeWorkoutId, setActiveWorkoutId] = useState<string | null>(
        workouts.length > 0 ? workouts[0].id : null
    )
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Derived state
    const activeWorkout = useMemo(() =>
        workouts.find(w => w.id === activeWorkoutId) || null
        , [workouts, activeWorkoutId])

    const occupiedDays = useMemo(() => {
        const days = new Set<string>()
        workouts.forEach(w => {
            if (activeWorkoutId !== w.id && w.frequency) {
                w.frequency.forEach(d => days.add(d))
            }
        })
        return Array.from(days)
    }, [workouts, activeWorkoutId])

    // Actions
    const addWorkout = useCallback(() => {
        const newWorkout: Workout = {
            id: tempId(),
            name: `Treino ${String.fromCharCode(65 + workouts.length)}`,
            order_index: workouts.length,
            items: [],
            frequency: []
        }
        setWorkouts(prev => [...prev, newWorkout])
        setActiveWorkoutId(newWorkout.id)
    }, [workouts.length])

    const updateWorkoutName = useCallback((workoutId: string, name: string) => {
        setWorkouts(prev => prev.map(w =>
            w.id === workoutId ? { ...w, name } : w
        ))
    }, [])

    const deleteWorkout = useCallback((workoutId: string) => {
        setWorkouts(prev => prev.filter(w => w.id !== workoutId))
        if (activeWorkoutId === workoutId) {
            setActiveWorkoutId(null)
        }
    }, [activeWorkoutId])

    const moveWorkout = useCallback((workoutId: string, direction: 'up' | 'down') => {
        setWorkouts(prev => {
            const index = prev.findIndex(w => w.id === workoutId)
            if (index === -1) return prev
            const targetIndex = direction === 'up' ? index - 1 : index + 1
            if (targetIndex < 0 || targetIndex >= prev.length) return prev

            const newWorkouts = [...prev]
            const temp = newWorkouts[index]
            newWorkouts[index] = newWorkouts[targetIndex]
            newWorkouts[targetIndex] = temp

            return newWorkouts.map((w, i) => ({ ...w, order_index: i }))
        })
    }, [])

    const updateWorkoutFrequency = useCallback((workoutId: string, days: string[]) => {
        console.log('updateWorkoutFrequency', workoutId, days)
        setWorkouts(prev => prev.map(w =>
            w.id === workoutId ? { ...w, frequency: days } : w
        ))
    }, [])

    const addExerciseFromLibrary = useCallback((exercise: Exercise) => {
        if (!activeWorkoutId) return

        setWorkouts(prev => prev.map(w => {
            if (w.id !== activeWorkoutId) return w

            const newItem: WorkoutItem = {
                id: tempId(),
                item_type: 'exercise',
                order_index: 0, // Will be recalculated
                parent_item_id: null,
                exercise_id: exercise.id,
                substitute_exercise_ids: [],
                exercise: exercise,
                sets: 3,
                reps: '10',
                rest_seconds: 60,
                notes: null,
                children: []
            }

            // Normal add to root
            return {
                ...w,
                items: [...w.items, { ...newItem, order_index: w.items.length }]
            }
        }))
    }, [activeWorkoutId])

    const handleExerciseCreated = useCallback((newExercise: Exercise) => {
        setLocalExercises(prev => [newExercise, ...prev])
    }, [])

    const addNote = useCallback((workoutId: string) => {
        setWorkouts(prev => prev.map(w => {
            if (w.id !== workoutId) return w
            const newItem: WorkoutItem = {
                id: tempId(),
                item_type: 'note',
                order_index: w.items.length,
                parent_item_id: null,
                exercise_id: null,
                substitute_exercise_ids: [],
                sets: null,
                reps: null,
                rest_seconds: null,
                notes: '',
                children: []
            }
            return { ...w, items: [...w.items, newItem] }
        }))
    }, [])

    const updateItem = useCallback((workoutId: string, itemId: string, updates: Partial<WorkoutItem>) => {
        setWorkouts(prev => prev.map(w => {
            if (w.id !== workoutId) return w

            const newItems = w.items.map(item => {
                if (item.id === itemId) return { ...item, ...updates }
                if (item.children) {
                    const newChildren = item.children.map(c =>
                        c.id === itemId ? { ...c, ...updates } : c
                    )
                    return { ...item, children: newChildren }
                }
                return item
            })

            return { ...w, items: newItems }
        }))
    }, [])

    const deleteItem = useCallback((workoutId: string, itemId: string) => {
        setWorkouts(prev => prev.map(w => {
            if (w.id !== workoutId) return w

            const newItems = w.items.filter(item => item.id !== itemId).map(item => ({
                ...item,
                children: item.children ? item.children.filter(c => c.id !== itemId) : []
            }))

            return { ...w, items: newItems }
        }))
    }, [])

    const moveItem = useCallback((workoutId: string, itemId: string, direction: 'up' | 'down') => {
        setWorkouts(prev => prev.map(w => {
            if (w.id !== workoutId) return w

            const index = w.items.findIndex(i => i.id === itemId)
            if (index !== -1) {
                const targetIndex = direction === 'up' ? index - 1 : index + 1
                if (targetIndex >= 0 && targetIndex < w.items.length) {
                    const newItems = [...w.items]
                    const temp = newItems[index]
                    newItems[index] = newItems[targetIndex]
                    newItems[targetIndex] = temp
                    return { ...w, items: newItems.map((item, i) => ({ ...item, order_index: i })) }
                }
            }
            return w
        }))
    }, [])

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

    const createSupersetWithNext = useCallback((workoutId: string, itemId: string) => {
        setWorkouts(prev => prev.map(w => {
            if (w.id !== workoutId) return w

            const index = w.items.findIndex(i => i.id === itemId)
            if (index === -1 || index === w.items.length - 1) return w

            const currentItem = w.items[index]
            const nextItem = w.items[index + 1]
            if (currentItem.item_type !== 'exercise' || nextItem.item_type !== 'exercise') return w

            const supersetId = tempId()
            const superset: WorkoutItem = {
                id: supersetId,
                item_type: 'superset',
                order_index: index,
                parent_item_id: null,
                exercise_id: null,
                substitute_exercise_ids: [],
                sets: null,
                reps: null,
                rest_seconds: null,
                notes: null,
                children: [
                    { ...currentItem, parent_item_id: supersetId, order_index: 0 },
                    { ...nextItem, parent_item_id: supersetId, order_index: 1 }
                ]
            }

            const newItems = [...w.items]
            newItems.splice(index, 2, superset)

            return { ...w, items: newItems.map((i, idx) => ({ ...i, order_index: idx })) }
        }))
    }, [])

    const dissolveSuperset = useCallback((workoutId: string, supersetId: string) => {
        setWorkouts(prev => prev.map(w => {
            if (w.id !== workoutId) return w

            const index = w.items.findIndex(i => i.id === supersetId)
            if (index === -1) return w

            const superset = w.items[index]
            if (!superset.children) return w

            const children = superset.children.map(c => ({
                ...c,
                parent_item_id: null
            }))

            const newItems = [...w.items]
            newItems.splice(index, 1, ...children)
            return { ...w, items: newItems.map((i, idx) => ({ ...i, order_index: idx })) }
        }))
    }, [])

    const addToExistingSuperset = useCallback((workoutId: string, itemId: string, supersetId: string) => {
        setWorkouts(prev => prev.map(w => {
            if (w.id !== workoutId) return w

            const itemIndex = w.items.findIndex(i => i.id === itemId)
            const supersetIndex = w.items.findIndex(i => i.id === supersetId)

            if (itemIndex === -1 || supersetIndex === -1) return w

            const item = w.items[itemIndex]
            const superset = w.items[supersetIndex]

            // Create new child with parent reference
            const newChild = {
                ...item,
                parent_item_id: supersetId,
                order_index: (superset.children?.length || 0)
            }

            // Update superset children
            const newChildren = [...(superset.children || []), newChild]
                .map((c, i) => ({ ...c, order_index: i }))

            const updatedSuperset = {
                ...superset,
                children: newChildren
            }

            // Remove original item and update superset
            const newItems = [...w.items]
            // If item is before superset, remove first then update superset index
            if (itemIndex < supersetIndex) {
                newItems.splice(supersetIndex, 1, updatedSuperset)
                newItems.splice(itemIndex, 1)
            } else {
                newItems.splice(itemIndex, 1)
                newItems.splice(supersetIndex, 1, updatedSuperset)
            }

            return { ...w, items: newItems.map((i, idx) => ({ ...i, order_index: idx })) }
        }))
    }, [])

    const removeFromSuperset = useCallback((workoutId: string, supersetId: string, itemId: string) => {
        setWorkouts(prev => prev.map(w => {
            if (w.id !== workoutId) return w

            const supersetIndex = w.items.findIndex(i => i.id === supersetId)
            if (supersetIndex === -1) return w

            const superset = w.items[supersetIndex]
            if (!superset.children) return w

            const childIndex = superset.children.findIndex(c => c.id === itemId)
            if (childIndex === -1) return w

            const child = superset.children[childIndex]

            // Remove from children
            const newChildren = superset.children.filter(c => c.id !== itemId)

            // If superset becomes empty or has only 1 child, handle dissolution logic if needed
            // For now just keep it or let user dissolve manually if empty

            const updatedSuperset = {
                ...superset,
                children: newChildren.map((c, i) => ({ ...c, order_index: i }))
            }

            // Add child back to root items after superset
            const newItem = {
                ...child,
                parent_item_id: null,
            }

            const newItems = [...w.items]
            newItems.splice(supersetIndex, 1, updatedSuperset)
            newItems.splice(supersetIndex + 1, 0, newItem)

            return { ...w, items: newItems.map((i, idx) => ({ ...i, order_index: idx })) }
        }))
    }, [])


    // Save program
    const saveProgram = async () => {
        if (!name.trim()) {
            setError('Nome do programa é obrigatório')
            return
        }

        setSaving(true)
        setError(null)

        const supabase = createClient()

        try {
            // ... existing save logic ...
            let programId = program?.id

            if (isEditing) {
                // Update existing program
                const { error: updateError } = await supabase
                    .from('program_templates')
                    .update({
                        name: name.trim(),
                        description: description.trim() || null,
                        duration_weeks: durationWeeks ? parseInt(durationWeeks) : null,
                    })
                    .eq('id', programId)

                if (updateError) throw updateError

                // Delete existing workouts (cascade will delete items)
                await supabase
                    .from('workout_templates')
                    .delete()
                    .eq('program_template_id', programId)
            } else {
                // Create new program
                // is_template: true if saving as template OR not in student context
                const isTemplate = isStudentContext ? saveAsTemplate : true

                const { data: newProgram, error: createError } = await supabase
                    .from('program_templates')
                    .insert({
                        name: name.trim(),
                        description: description.trim() || null,
                        duration_weeks: durationWeeks ? parseInt(durationWeeks) : null,
                        is_template: isTemplate,
                    })
                    .select('id')
                    .single()

                if (createError) throw createError
                programId = newProgram.id
            }

            // Save workouts and items
            for (const workout of workouts) {
                console.log('Saving workout:', workout.name, 'Frequency:', workout.frequency)
                const { data: savedWorkout, error: workoutError } = await supabase
                    .from('workout_templates')
                    .insert({
                        program_template_id: programId,
                        name: workout.name,
                        order_index: workout.order_index,
                        frequency: workout.frequency
                    })
                    .select('id')
                    .single()

                if (workoutError) throw workoutError

                // Save items
                for (const item of workout.items) {
                    const { data: savedItem, error: itemError } = await supabase
                        .from('workout_item_templates')
                        .insert({
                            workout_template_id: savedWorkout.id,
                            item_type: item.item_type,
                            order_index: item.order_index,
                            parent_item_id: null,
                            exercise_id: item.exercise_id,
                            substitute_exercise_ids: item.substitute_exercise_ids || [],
                            sets: item.sets,
                            reps: item.reps,
                            rest_seconds: item.rest_seconds,
                            notes: item.notes,
                        })
                        .select('id')
                        .single()

                    if (itemError) throw itemError

                    // Save children (for supersets)
                    if (item.children) {
                        for (const child of item.children) {
                            const { error: childError } = await supabase
                                .from('workout_item_templates')
                                .insert({
                                    workout_template_id: savedWorkout.id,
                                    item_type: child.item_type,
                                    order_index: child.order_index,
                                    parent_item_id: savedItem.id,
                                    exercise_id: child.exercise_id,
                                    substitute_exercise_ids: child.substitute_exercise_ids || [],
                                    sets: child.sets,
                                    reps: child.reps,
                                    rest_seconds: child.rest_seconds,
                                    notes: child.notes,
                                })

                            if (childError) throw childError
                        }
                    }
                }
            }

            // Auto-assign to student if in student context
            if (isStudentContext && studentContext && programId) {
                // Prepare schedule map
                const workoutSchedule: Record<number, number[]> = {}
                workouts.forEach(w => {
                    const days = w.frequency || []
                    if (days.length > 0) {
                        const dayMap: Record<string, number> = { 'sun': 0, 'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4, 'fri': 5, 'sat': 6 }
                        workoutSchedule[w.order_index] = days
                            .map(d => dayMap[d])
                            .filter(d => d !== undefined)
                    }
                })

                const result = await assignProgram({
                    studentId: studentContext.id,
                    templateId: programId,
                    startDate: new Date(startDate).toISOString(),
                    isScheduled: assignmentType === 'scheduled',
                    workoutSchedule
                })

                if (!result.success) {
                    console.error('Auto-assign error:', result.error)
                    // Don't throw - program was saved, just assignment failed
                    setError(`Programa salvo, mas erro ao atribuir: ${result.error}`)
                    return // Stop redirection to show error
                }

                router.push(`/students/${studentContext.id}`)
            } else {
                router.push('/programs')
            }
            router.refresh()
        } catch (err: unknown) {
            console.error('Save program error:', err)
            const errorMessage = err instanceof Error ? err.message : 'Erro ao salvar programa'
            setError(errorMessage)
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
                {/* Scheduling Bar (Fixed Header) */}
                <div className="flex-shrink-0 h-24 bg-surface-card backdrop-blur-md border-b border-k-border-primary flex items-center justify-between px-8 z-30">
                    {/* Left Section: Identity */}
                    <div className="flex items-center gap-6 flex-1 min-w-0">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => isStudentContext && studentContext
                                ? router.push(`/students/${studentContext.id}`)
                                : router.push('/programs')
                            }
                            className="w-10 h-10 rounded-full hover:bg-glass-bg-active text-k-text-tertiary hover:text-k-text-primary transition-all"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </Button>

                        <div className="flex flex-col min-w-0">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-k-text-quaternary mb-1">
                                Nome do Programa
                            </span>
                            <div className="flex items-center gap-3">
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Ex: Força e Hipertrofia"
                                    className="bg-transparent border-none text-lg font-bold text-k-text-primary placeholder:text-k-text-quaternary focus:ring-0 p-0 w-full max-w-[200px] truncate"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Center Section: Timeline & Scheduling */}
                    {isStudentContext && (
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
                    )}

                    {/* Right Section: Actions */}
                    <div className="flex items-center gap-4 ml-8">
                        {isStudentContext && !isEditing && (
                            <label className="flex items-center gap-2 cursor-pointer select-none group">
                                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${saveAsTemplate ? 'bg-violet-600 border-violet-600' : 'border-k-border-primary bg-glass-bg group-hover:border-k-text-tertiary'
                                    }`}>
                                    <input
                                        type="checkbox"
                                        checked={saveAsTemplate}
                                        onChange={(e) => setSaveAsTemplate(e.target.checked)}
                                        className="hidden"
                                    />
                                    {saveAsTemplate && <Check className="w-3 h-3 text-white" strokeWidth={4} />}
                                </div>
                                <span className="text-[11px] text-k-text-secondary font-medium group-hover:text-k-text-primary transition-colors">Salvar modelo</span>
                            </label>
                        )}

                        <div className="relative">
                            <Button
                                onClick={saveProgram}
                                disabled={saving}
                                className={`
                                    rounded-full px-8 py-2.5 h-10 text-sm font-bold transition-all shadow-lg min-w-[140px]
                                    ${isStudentContext
                                        ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-violet-500/20'
                                        : 'bg-white text-black hover:bg-white/90 shadow-white/10'
                                    }
                                `}
                            >
                                {saving ? (
                                    <Loader2 className="animate-spin w-4 h-4" />
                                ) : (
                                    <>
                                        {isStudentContext
                                            ? (assignmentType === 'immediate' ? 'Publicar Treino' : 'Agendar Programa')
                                            : 'Salvar Programa'
                                        }
                                    </>
                                )}
                            </Button>

                            {/* Alert Note */}
                            {isStudentContext && assignmentType === 'immediate' && (
                                <p className="absolute -bottom-5 right-0 text-[9px] text-amber-400/80 font-medium whitespace-nowrap animate-in fade-in slide-in-from-top-1">
                                    Substituirá o programa atual.
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                <VolumeSummary workouts={workouts} />

                {/* Workspace (Layout Columns) */}
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
                    <div className="flex-1 flex flex-col min-w-0 bg-surface-canvas">
                        {/* Workout Tabs (Segmented Control) */}
                        <div className="flex items-center gap-1 p-4 overflow-x-auto no-scrollbar border-b border-k-border-subtle bg-surface-canvas">
                            <div className="bg-surface-card p-1 rounded-xl flex gap-1 items-center border border-k-border-subtle">
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
                                        onUpdateName={(name) => updateWorkoutName(activeWorkout.id, name)}
                                        onAddExercise={() => { }} // Not used with drag/click
                                        onAddNote={() => addNote(activeWorkout.id)}
                                        onUpdateItem={(itemId, updates) => updateItem(activeWorkout.id, itemId, updates)}
                                        onDeleteItem={(itemId) => deleteItem(activeWorkout.id, itemId)}
                                        onMoveItem={(itemId, dir) => moveItem(activeWorkout.id, itemId, dir)}
                                        onReorderItem={handleReorderItem}
                                        onCreateSupersetWithNext={(itemId) => createSupersetWithNext(activeWorkout.id, itemId)}
                                        onAddToExistingSuperset={(itemId, supersetId) => addToExistingSuperset(activeWorkout.id, itemId, supersetId)}
                                        onRemoveFromSuperset={(supersetId, itemId) => removeFromSuperset(activeWorkout.id, supersetId, itemId)}
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
                                        onClick={() => isStudentContext && studentContext
                                            ? null // Removed delete fully for now
                                            : deleteWorkout(activeWorkoutId!)
                                        }
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

