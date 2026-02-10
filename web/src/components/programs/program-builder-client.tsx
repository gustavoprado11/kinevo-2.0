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
import { assignProgram } from '@/app/students/[id]/actions/assign-program'

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
    const [durationWeeks, setDurationWeeks] = useState(program?.duration_weeks?.toString() || '')
    // Date state for assigned programs
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
    const [assignmentType, setAssignmentType] = useState<'immediate' | 'scheduled'>(initialAssignmentType)
    const [saveAsTemplate, setSaveAsTemplate] = useState(false)

    // Calculate end date based on start date and duration
    const endDate = useMemo(() => {
        if (!startDate || !durationWeeks) return null

        const start = new Date(startDate)
        const weeks = parseInt(durationWeeks)

        if (isNaN(start.getTime()) || isNaN(weeks) || weeks <= 0) return null

        // End date = Start + (Weeks * 7) - 1 day
        const end = new Date(start)
        end.setDate(end.getDate() + (weeks * 7) - 1)

        return end.toLocaleDateString('pt-BR')
    }, [startDate, durationWeeks])

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
                order_index: w.items.length,
                parent_item_id: null,
                exercise_id: exercise.id,
                exercise: exercise,
                sets: 3,
                reps: '10',
                rest_seconds: 60,
                notes: null,
                children: []
            }

            return { ...w, items: [...w.items, newItem] }
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

    const addToExistingSuperset = useCallback((workoutId: string, itemId: string, supersetId: string) => { }, [])
    const removeFromSuperset = useCallback((workoutId: string, supersetId: string, itemId: string) => { }, [])

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
        <AppLayout trainerName={trainer.name} trainerEmail={trainer.email} trainerAvatarUrl={trainer.avatar_url}>
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => isStudentContext && studentContext
                                ? router.push(`/students/${studentContext.id}`)
                                : router.push('/programs')
                            }
                            className="w-10 h-10 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-2xl font-bold text-white">
                                    {isEditing ? 'Editar Programa' : 'Novo Programa'}
                                </h1>
                                {isStudentContext && studentContext && (
                                    <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
                                        Para {studentContext.name}
                                    </span>
                                )}
                            </div>
                            <p className="text-gray-400 mt-0.5 text-sm">
                                {isStudentContext
                                    ? 'Este programa será atribuído automaticamente ao aluno'
                                    : isEditing ? 'Modifique os treinos do programa' : 'Crie um novo programa de treino'
                                }
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        {isStudentContext && !isEditing && (
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={saveAsTemplate}
                                    onChange={(e) => setSaveAsTemplate(e.target.checked)}
                                    className="w-4 h-4 rounded border-gray-600 bg-gray-900 text-violet-500 focus:ring-violet-500/50"
                                />
                                <span className="text-sm text-gray-400">Salvar como modelo reutilizável</span>
                            </label>
                        )}
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
                                    {isStudentContext ? 'Salvar e Atribuir' : 'Salvar Programa'}
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="mb-6 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm flex items-start gap-3">
                        <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {error}
                    </div>
                )}

                {/* Program Info */}
                <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-5 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Nome do Programa <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Ex: Hipertrofia 12 Semanas"
                                className="w-full px-4 py-2.5 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Duração (semanas)
                            </label>
                            <input
                                type="number"
                                value={durationWeeks}
                                onChange={(e) => setDurationWeeks(e.target.value)}
                                placeholder="12"
                                min="1"
                                className="w-full px-4 py-2.5 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all"
                            />
                        </div>

                        {/* Date Selection for Student Assignment */}
                        {isStudentContext && (
                            <>
                                {/* Row: Start Date | End Date */}
                                <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Data de Início <span className="text-red-400">*</span>
                                        </label>
                                        <input
                                            type="date"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                            className="w-full px-4 py-2.5 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all [color-scheme:dark]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Previsão de Término
                                        </label>
                                        <div className="w-full px-4 py-2.5 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-400 flex items-center gap-2">
                                            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            {endDate ? (
                                                <span>Termina em <span className="text-white font-medium">{endDate}</span></span>
                                            ) : (
                                                <span className="text-gray-600">Defina o início e duração</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Row: Assignment Type */}
                                <div className="md:col-span-3 bg-gray-900/30 p-4 rounded-lg border border-gray-700/50">
                                    <label className="block text-sm font-medium text-gray-300 mb-3">
                                        Tipo de Atribuição
                                    </label>
                                    <div className="flex flex-col sm:flex-row gap-4">
                                        <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all flex-1 ${assignmentType === 'immediate' ? 'bg-violet-500/10 border-violet-500/50' : 'bg-transparent border-gray-700 hover:bg-gray-800'}`}>
                                            <input
                                                type="radio"
                                                name="assignmentType"
                                                value="immediate"
                                                checked={assignmentType === 'immediate'}
                                                onChange={() => setAssignmentType('immediate')}
                                                className="mt-1 w-4 h-4 text-violet-600 bg-gray-900 border-gray-600 focus:ring-violet-500"
                                            />
                                            <div>
                                                <span className={`block font-medium ${assignmentType === 'immediate' ? 'text-violet-300' : 'text-gray-300'}`}>
                                                    Imediata (Substituir Atual)
                                                </span>
                                                <span className="text-xs text-gray-500 mt-1 block">
                                                    O programa atual será concluído e este entrará como ATIVO imediatamente.
                                                </span>
                                            </div>
                                        </label>

                                        <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all flex-1 ${assignmentType === 'scheduled' ? 'bg-purple-500/10 border-purple-500/50' : 'bg-transparent border-gray-700 hover:bg-gray-800'}`}>
                                            <input
                                                type="radio"
                                                name="assignmentType"
                                                value="scheduled"
                                                checked={assignmentType === 'scheduled'}
                                                onChange={() => setAssignmentType('scheduled')}
                                                className="mt-1 w-4 h-4 text-purple-600 bg-gray-900 border-gray-600 focus:ring-purple-500"
                                            />
                                            <div>
                                                <span className={`block font-medium ${assignmentType === 'scheduled' ? 'text-purple-300' : 'text-gray-300'}`}>
                                                    Agendar (Fila)
                                                </span>
                                                <span className="text-xs text-gray-500 mt-1 block">
                                                    Este programa ficará na fila como AGENDADO e iniciará na data acima ({new Date(startDate).toLocaleDateString()}).
                                                </span>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            </>
                        )}

                        <div className="md:col-span-3">
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Descrição
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Descreva o objetivo do programa..."
                                rows={2}
                                className="w-full px-4 py-2.5 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all resize-none"
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

                                        {/* Workout actions on hover */}
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

                            {/* Add Workout Button */}
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
