'use client'

import { useState } from 'react'
import type { Workout, WorkoutItem } from './program-builder-client'
import type { Exercise } from '@/types/exercise'
import { SortableWorkoutItem } from './sortable-workout-item'
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    TouchSensor,
} from '@dnd-kit/core'
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable'

interface WorkoutPanelProps {
    workout: Workout
    exercises: Exercise[]
    onUpdateName: (name: string) => void
    onAddExercise: () => void
    onAddNote: () => void
    onUpdateItem: (itemId: string, updates: Partial<WorkoutItem>) => void
    onDeleteItem: (itemId: string) => void
    onMoveItem: (itemId: string, direction: 'up' | 'down') => void
    onReorderItem: (activeId: string, overId: string) => void
    // Superset actions
    onCreateSupersetWithNext: (exerciseItemId: string) => void
    onAddToExistingSuperset: (exerciseItemId: string, supersetId: string) => void
    onRemoveFromSuperset: (supersetId: string, exerciseItemId: string) => void
    onDissolveSuperset: (supersetId: string) => void
    onUpdateFrequency?: (days: string[]) => void
    occupiedDays?: string[]
}

// Connector button between workout items
function SupersetConnector({
    currentItem,
    nextItem,
    onConnect
}: {
    currentItem: WorkoutItem
    nextItem: WorkoutItem
    onConnect: () => void
}) {
    // Determine connector type based on item types
    const currentIsExercise = currentItem.item_type === 'exercise'
    const nextIsExercise = nextItem.item_type === 'exercise'
    const currentIsSuperset = currentItem.item_type === 'superset'
    const nextIsSuperset = nextItem.item_type === 'superset'

    // Show connector only for valid superset combinations
    const canConnect = (currentIsExercise && nextIsExercise) || // Two exercises → create superset
        (currentIsSuperset && nextIsExercise) || // Superset + exercise → add to superset
        (currentIsExercise && nextIsSuperset)    // Exercise + superset → add to superset

    if (!canConnect) return null

    // Determine label based on connection type
    let label = 'Criar superset'
    if (currentIsSuperset || nextIsSuperset) {
        label = 'Adicionar ao superset'
    }

    return (
        <div className="relative flex items-center justify-center py-1 group">
            {/* Connector line */}
            <div className="absolute inset-x-4 h-px bg-muted/50 group-hover:bg-violet-500/30 transition-colors" />

            {/* Connect button */}
            <button
                onClick={onConnect}
                className="relative z-10 flex items-center gap-1.5 px-2 py-1 rounded-full 
                           bg-muted dark:bg-slate-900 border border-border dark:border-slate-800
                           hover:bg-violet-600 hover:border-violet-500 
                           text-muted-foreground dark:text-slate-400 hover:text-foreground
                           transition-all duration-200 
                           opacity-0 group-hover:opacity-100
                           text-xs font-medium"
            >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                {label}
            </button>
        </div>
    )
}

export function WorkoutPanel({
    workout,
    exercises,
    onUpdateName,
    onAddExercise,
    onAddNote,
    onUpdateItem,
    onDeleteItem,
    onMoveItem,
    onReorderItem,
    onCreateSupersetWithNext,
    onAddToExistingSuperset,
    onRemoveFromSuperset,
    onDissolveSuperset,
    onUpdateFrequency,
    occupiedDays = [],
}: WorkoutPanelProps) {
    const [isEditingName, setIsEditingName] = useState(false)
    const [tempName, setTempName] = useState(workout.name)

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
        useSensor(TouchSensor)
    )

    const handleNameSave = () => {
        if (tempName.trim()) {
            onUpdateName(tempName.trim())
        } else {
            setTempName(workout.name)
        }
        setIsEditingName(false)
    }

    // Handle connector click based on item types
    const handleConnect = (currentIndex: number) => {
        const currentItem = workout.items[currentIndex]
        const nextItem = workout.items[currentIndex + 1]

        if (!currentItem || !nextItem) return

        // Case 1: Two exercises → create superset
        if (currentItem.item_type === 'exercise' && nextItem.item_type === 'exercise') {
            onCreateSupersetWithNext(currentItem.id)
        }
        // Case 2: Superset + exercise → add exercise to superset
        else if (currentItem.item_type === 'superset' && nextItem.item_type === 'exercise') {
            onAddToExistingSuperset(nextItem.id, currentItem.id)
        }
        // Case 3: Exercise + superset → add exercise to superset
        else if (currentItem.item_type === 'exercise' && nextItem.item_type === 'superset') {
            onAddToExistingSuperset(currentItem.id, nextItem.id)
        }
    }

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event

        if (active.id !== over?.id) {
            onReorderItem(active.id as string, over?.id as string)
        }
    }

    return (
        <div className="space-y-6">
            {/* Workout Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {isEditingName ? (
                        <input
                            type="text"
                            value={tempName}
                            onChange={(e) => setTempName(e.target.value)}
                            onBlur={handleNameSave}
                            onKeyDown={(e) => e.key === 'Enter' && handleNameSave()}
                            autoFocus
                            className="px-0 py-1 bg-transparent border-0 border-b border-violet-500 rounded-none text-k-text-primary text-xl font-bold focus:outline-none focus:ring-0 placeholder:text-k-text-quaternary w-auto min-w-[200px]"
                        />
                    ) : (
                        <button
                            onClick={() => { setTempName(workout.name); setIsEditingName(true) }}
                            className="text-xl font-bold text-k-text-primary hover:text-violet-400 transition-colors flex items-center gap-2 group"
                        >
                            {workout.name}
                            <svg className="w-4 h-4 text-k-text-quaternary group-hover:text-violet-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-4">
                    {/* Day Selector */}
                    <div className="flex items-center gap-1 bg-surface-card p-1 rounded-lg border border-k-border-subtle">
                        {[
                            { key: 'sun', label: 'D' },
                            { key: 'mon', label: 'S' },
                            { key: 'tue', label: 'T' },
                            { key: 'wed', label: 'Q' },
                            { key: 'thu', label: 'Q' },
                            { key: 'fri', label: 'S' },
                            { key: 'sat', label: 'S' },
                        ].map((day) => {
                            const isSelected = (workout.frequency || []).includes(day.key)
                            const isOccupied = occupiedDays.includes(day.key)

                            // Determine button styling based on state
                            let buttonClass = "w-7 h-7 flex items-center justify-center rounded-md text-xs font-bold transition-all border "

                            if (isSelected) {
                                // Active (selected for this workout)
                                buttonClass += "bg-violet-600 text-white border-violet-500 shadow-sm"
                            } else if (isOccupied) {
                                // Occupied (by another workout)
                                buttonClass += "bg-glass-bg text-k-text-quaternary border-transparent cursor-not-allowed"
                            } else {
                                // Free
                                buttonClass += "text-k-text-tertiary border-transparent hover:bg-glass-bg-active hover:text-k-text-primary"
                            }

                            return (
                                <button
                                    key={day.key}
                                    onClick={() => {
                                        const currentDays = workout.frequency || []
                                        const newDays = currentDays.includes(day.key)
                                            ? currentDays.filter(d => d !== day.key)
                                            : [...currentDays, day.key]
                                        onUpdateFrequency?.(newDays)
                                    }}
                                    className={buttonClass}
                                    title={isOccupied && !isSelected ? "Outro treino já está agendado para este dia" : day.label}
                                >
                                    {day.label}
                                </button>
                            )
                        })}
                    </div>

                    <div className="flex items-center gap-2 text-sm text-k-text-quaternary border-l border-k-border-primary pl-4 h-8">
                        <span>{workout.items.length} itens</span>
                    </div>
                </div>
            </div>

            {/* Items with connectors */}
            <div className="">
                {workout.items.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-k-border-primary rounded-2xl bg-glass-bg">
                        <p className="text-k-text-tertiary mb-4">Arraste exercícios da biblioteca ou adicione uma nota</p>
                        <div className="flex items-center justify-center gap-2">
                            <button
                                onClick={onAddNote}
                                className="px-4 py-2 bg-glass-bg hover:bg-glass-bg-active border border-k-border-subtle text-k-text-primary text-sm font-medium rounded-lg transition-colors"
                            >
                                + Adicionar Nota
                            </button>
                        </div>
                    </div>
                ) : (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={workout.items.map(i => i.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            <div className="space-y-4">
                                {workout.items.map((item, index) => (
                                    <div key={item.id} className="relative">
                                        {/* Sortable Workout Item */}
                                        <SortableWorkoutItem
                                            item={item}
                                            exercises={exercises}
                                            index={index}
                                            totalItems={workout.items.length}
                                            allItems={workout.items}
                                            onUpdate={(updates) => onUpdateItem(item.id, updates)}
                                            onDelete={() => onDeleteItem(item.id)}
                                            onMoveUp={() => onMoveItem(item.id, 'up')}
                                            onMoveDown={() => onMoveItem(item.id, 'down')}
                                            onUpdateChild={(childId, updates) => onUpdateItem(childId, updates)}
                                            onDeleteChild={(childId) => onDeleteItem(childId)}
                                            onMoveChild={(childId, direction) => onMoveItem(childId, direction)}
                                            onCreateSupersetWithNext={() => onCreateSupersetWithNext(item.id)}
                                            onAddToSuperset={(supersetId) => onAddToExistingSuperset(item.id, supersetId)}
                                            onRemoveFromSuperset={(childId) => onRemoveFromSuperset(item.id, childId)}
                                            onDissolveSuperset={() => onDissolveSuperset(item.id)}
                                        />

                                        {/* Connector between items (if there's a next item) */}
                                        {index < workout.items.length - 1 && (
                                            <div className="absolute left-0 right-0 -bottom-4 z-10 flex justify-center">
                                                <SupersetConnector
                                                    currentItem={item}
                                                    nextItem={workout.items[index + 1]}
                                                    onConnect={() => handleConnect(index)}
                                                />
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {/* Add buttons footer */}
                                <div className="flex justify-center pt-6">
                                    <button
                                        onClick={onAddNote}
                                        className="px-4 py-2 text-sm text-k-text-tertiary hover:text-k-text-primary hover:bg-glass-bg rounded-full transition-colors flex items-center gap-2 border border-transparent hover:border-k-border-primary"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                        Adicionar Nota
                                    </button>
                                </div>
                            </div>
                        </SortableContext>
                    </DndContext>
                )}
            </div>
        </div>
    )
}
