'use client'

// Estado + handlers do modelo de workouts compartilhado pelos dois builders
// (ProgramBuilderClient e EditAssignedProgramClient). Toda a lógica de mutação
// vive nas funções puras de ../builder-model — aqui é só o cabo React.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DragEndEvent } from '@dnd-kit/core'
import { registerCanvasApi, unregisterCanvasApi } from './builder-canvas-bridge'
import {
    type Workout,
    type WorkoutItem,
    addToExistingSupersetIn,
    appendItemsIn,
    cleanupEmptyPlaceholdersIn,
    createSupersetWithNextIn,
    deleteItemIn,
    deleteWorkoutIn,
    dissolveSupersetIn,
    duplicateItemIn,
    duplicateWorkoutIn,
    duplicateWorkoutName,
    generateWorkoutName,
    makeWorkout,
    moveItemIn,
    removeFromSupersetIn,
    reorderItemIn,
    reorderWorkoutsIn,
    updateItemIn,
    updateWorkoutFrequencyIn,
    updateWorkoutNameIn,
    updateWorkoutTypeIn,
} from '../builder-model'
import type { WorkoutType } from '@kinevo/shared/types/workout-items'

export interface UseWorkoutModelOptions {
    /** Lazy initializer do estado (mesma semântica do useState). */
    initialWorkouts: () => Workout[]
    /** Convenção de nome pra workouts novos/duplicados. Default: letra
     *  ("Treino A"). O builder injeta a convenção das prefs do treinador. */
    workoutName?: (index: number) => string
}

export function useWorkoutModel({ initialWorkouts, workoutName }: UseWorkoutModelOptions) {
    const [workouts, setWorkouts] = useState<Workout[]>(initialWorkouts)
    const [activeWorkoutId, setActiveWorkoutId] = useState<string | null>(
        () => workouts.length > 0 ? workouts[0].id : null,
    )

    const nameFor = useCallback(
        (index: number) => workoutName ? workoutName(index) : generateWorkoutName(index, 'letter'),
        [workoutName],
    )

    // Derived state
    const activeWorkout = useMemo(
        () => workouts.find(w => w.id === activeWorkoutId) || null,
        [workouts, activeWorkoutId],
    )

    const workoutsWithoutDays = useMemo(
        () => workouts.filter(w => !w.frequency || w.frequency.length === 0),
        [workouts],
    )

    const occupiedDays = useMemo(() => {
        const days = new Set<string>()
        workouts.forEach(w => {
            if (activeWorkoutId !== w.id && w.frequency) {
                w.frequency.forEach(d => days.add(d))
            }
        })
        return Array.from(days)
    }, [workouts, activeWorkoutId])

    // — Workout-level —

    const addWorkout = useCallback((workoutType: WorkoutType = 'strength') => {
        const newWorkout = makeWorkout(nameFor(workouts.length), workouts.length, [], workoutType)
        setWorkouts(prev => [...prev, newWorkout])
        setActiveWorkoutId(newWorkout.id)
    }, [workouts.length, nameFor])

    const createWorkoutWithName = useCallback((name: string, frequency?: string[]): string => {
        const newWorkout = makeWorkout(name, workouts.length, frequency ?? [])
        setWorkouts(prev => [...prev, newWorkout])
        setActiveWorkoutId(newWorkout.id)
        return newWorkout.id
    }, [workouts.length])

    const updateWorkoutName = useCallback((workoutId: string, name: string) => {
        setWorkouts(prev => updateWorkoutNameIn(prev, workoutId, name))
    }, [])

    const updateWorkoutFrequency = useCallback((workoutId: string, days: string[]) => {
        setWorkouts(prev => updateWorkoutFrequencyIn(prev, workoutId, days))
    }, [])

    const updateWorkoutType = useCallback((workoutId: string, type: WorkoutType) => {
        setWorkouts(prev => updateWorkoutTypeIn(prev, workoutId, type))
    }, [])

    const deleteWorkout = useCallback((workoutId: string) => {
        const remaining = workouts.filter(w => w.id !== workoutId)
        setWorkouts(prev => deleteWorkoutIn(prev, workoutId))
        if (activeWorkoutId === workoutId) {
            setActiveWorkoutId(remaining[0]?.id || null)
        }
    }, [activeWorkoutId, workouts])

    const duplicateWorkout = useCallback((workoutId: string) => {
        setWorkouts(prev => {
            const source = prev.find(w => w.id === workoutId)
            if (!source) return prev
            return duplicateWorkoutIn(prev, workoutId, duplicateWorkoutName(source.name, nameFor(prev.length)))
        })
    }, [nameFor])

    const handleWorkoutDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event
        if (!over || active.id === over.id) return
        setWorkouts(prev => reorderWorkoutsIn(prev, String(active.id), String(over.id)))
    }, [])

    const cleanupEmptyPlaceholders = useCallback((workoutIds: string[]) => {
        if (workoutIds.length === 0) return
        const idSet = new Set(workoutIds)
        setWorkouts(prev => cleanupEmptyPlaceholdersIn(prev, workoutIds))
        setActiveWorkoutId(prev => (prev && idSet.has(prev) ? null : prev))
    }, [])

    // — Item-level —

    /** Acrescenta itens construídos pela factory (que enxerga o workout atual —
     *  necessário pra heurística auto-warmup do builder). */
    const appendItemsWith = useCallback((workoutId: string, makeItems: (w: Workout) => WorkoutItem[]) => {
        setWorkouts(prev => appendItemsIn(prev, workoutId, makeItems))
    }, [])

    const updateItem = useCallback((workoutId: string, itemId: string, updates: Partial<WorkoutItem>) => {
        setWorkouts(prev => updateItemIn(prev, workoutId, itemId, updates))
    }, [])

    const deleteItem = useCallback((workoutId: string, itemId: string) => {
        setWorkouts(prev => deleteItemIn(prev, workoutId, itemId))
    }, [])

    const duplicateItem = useCallback((workoutId: string, itemId: string) => {
        setWorkouts(prev => duplicateItemIn(prev, workoutId, itemId))
    }, [])

    const moveItem = useCallback((workoutId: string, itemId: string, direction: 'up' | 'down') => {
        setWorkouts(prev => moveItemIn(prev, workoutId, itemId, direction))
    }, [])

    const handleReorderItem = useCallback((activeId: string, overId: string) => {
        if (!activeWorkoutId) return
        setWorkouts(prev => reorderItemIn(prev, activeWorkoutId, activeId, overId))
    }, [activeWorkoutId])

    // — Supersets —

    const createSupersetWithNext = useCallback((workoutId: string, itemId: string) => {
        setWorkouts(prev => createSupersetWithNextIn(prev, workoutId, itemId))
    }, [])

    const addToExistingSuperset = useCallback((workoutId: string, itemId: string, supersetId: string) => {
        setWorkouts(prev => addToExistingSupersetIn(prev, workoutId, itemId, supersetId))
    }, [])

    const removeFromSuperset = useCallback((workoutId: string, supersetId: string, itemId: string) => {
        setWorkouts(prev => removeFromSupersetIn(prev, workoutId, supersetId, itemId))
    }, [])

    const dissolveSuperset = useCallback((workoutId: string, supersetId: string) => {
        setWorkouts(prev => dissolveSupersetIn(prev, workoutId, supersetId))
    }, [])

    // ── Ponte do canvas (Fase 1) ──────────────────────────────────────────
    // Publica a API de mutação pra superfícies irmãs (o chat "Gerar com IA" ao
    // vivo). Wrappers estáveis delegam pras implementações mais recentes via
    // ref, então registramos UMA vez no mount e nunca servimos closures velhas.
    const workoutsRef = useRef(workouts)
    workoutsRef.current = workouts
    const activeWorkoutIdRef = useRef(activeWorkoutId)
    activeWorkoutIdRef.current = activeWorkoutId
    const implRef = useRef({
        setWorkouts, setActiveWorkoutId, createWorkoutWithName, updateWorkoutName,
        updateWorkoutFrequency, deleteWorkout, appendItemsWith, updateItem, deleteItem,
    })
    implRef.current = {
        setWorkouts, setActiveWorkoutId, createWorkoutWithName, updateWorkoutName,
        updateWorkoutFrequency, deleteWorkout, appendItemsWith, updateItem, deleteItem,
    }
    useEffect(() => {
        registerCanvasApi({
            getWorkouts: () => workoutsRef.current,
            getActiveWorkoutId: () => activeWorkoutIdRef.current,
            setActiveWorkout: (id) => implRef.current.setActiveWorkoutId(id),
            apply: (mutator) => implRef.current.setWorkouts(prev => mutator(prev)),
            createWorkoutWithName: (name, frequency) => implRef.current.createWorkoutWithName(name, frequency),
            updateWorkoutName: (workoutId, name) => implRef.current.updateWorkoutName(workoutId, name),
            updateWorkoutFrequency: (workoutId, days) => implRef.current.updateWorkoutFrequency(workoutId, days),
            deleteWorkout: (workoutId) => implRef.current.deleteWorkout(workoutId),
            appendItemsWith: (workoutId, makeItems) => implRef.current.appendItemsWith(workoutId, makeItems),
            updateItem: (workoutId, itemId, updates) => implRef.current.updateItem(workoutId, itemId, updates),
            deleteItem: (workoutId, itemId) => implRef.current.deleteItem(workoutId, itemId),
        })
        return () => unregisterCanvasApi()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return {
        workouts,
        setWorkouts,
        activeWorkoutId,
        setActiveWorkoutId,
        activeWorkout,
        workoutsWithoutDays,
        occupiedDays,
        addWorkout,
        createWorkoutWithName,
        updateWorkoutName,
        updateWorkoutFrequency,
        updateWorkoutType,
        deleteWorkout,
        duplicateWorkout,
        handleWorkoutDragEnd,
        cleanupEmptyPlaceholders,
        appendItemsWith,
        updateItem,
        deleteItem,
        duplicateItem,
        moveItem,
        handleReorderItem,
        createSupersetWithNext,
        addToExistingSuperset,
        removeFromSuperset,
        dissolveSuperset,
    }
}
