'use client'

import { useState, useRef } from 'react'
import type { WorkoutItem } from './program-builder-client'
import type { Exercise } from '@/types/exercise'

interface WorkoutItemCardProps {
    item: WorkoutItem
    exercises: Exercise[]
    index: number
    totalItems: number
    allItems: WorkoutItem[]  // All items in the workout for context
    onUpdate: (updates: Partial<WorkoutItem>) => void
    onDelete: () => void
    onMoveUp: () => void
    onMoveDown: () => void
    onUpdateChild?: (childId: string, updates: Partial<WorkoutItem>) => void
    onDeleteChild?: (childId: string) => void
    onMoveChild?: (childId: string, direction: 'up' | 'down') => void
    onRemoveFromSuperset?: (childId: string) => void
    onDissolveSuperset?: () => void
    onCreateSupersetWithNext?: () => void
    onAddToSuperset?: (supersetId: string) => void
    dragHandleProps?: any // Passed from Sortable wrapper
    readonly?: boolean
}

import { GripVertical, Trash2, MessageSquare, Repeat, Check, PlayCircle, ArrowLeftRight, Search, X, Pencil, Flame, Activity, Clock, Timer, ChevronDown, ChevronUp, Zap } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import {
    CARDIO_EQUIPMENT_LABELS,
    CARDIO_EQUIPMENT_OPTIONS,
    WARMUP_TYPE_LABELS,
    WARMUP_TYPE_OPTIONS,
    CARDIO_OBJECTIVE_LABELS,
    type CardioEquipment,
    type CardioConfig,
    type CardioMode,
    type CardioObjective,
    type WarmupConfig,
    type WarmupType,
} from '@kinevo/shared/types/workout-items'
import { FloatingExercisePlayer } from '@/components/exercises/floating-exercise-player'

export function WorkoutItemCard({
    item,
    exercises,
    index,
    totalItems,
    allItems,
    onUpdate,
    onDelete,
    onMoveUp,
    onMoveDown,
    onUpdateChild,
    onDeleteChild,
    onMoveChild,
    onCreateSupersetWithNext,
    onAddToSuperset,
    onRemoveFromSuperset,
    onDissolveSuperset,
    dragHandleProps,
    readonly,
}: WorkoutItemCardProps) {
    if (item.item_type === 'note') {
        return (
            <div className="bg-white dark:bg-surface-card rounded-xl border border-[#E8E8ED] dark:border-k-border-subtle p-4 group flex items-start gap-3 relative">
                {/* Drag Handle */}
                {!readonly && (
                    <div
                        {...dragHandleProps}
                        className="mt-1 text-k-text-quaternary hover:text-k-text-secondary cursor-grab active:cursor-grabbing touch-none transition-colors"
                    >
                        <GripVertical className="w-4 h-4" />
                    </div>
                )}

                <div className="flex-1">
                    {readonly ? (
                        <p className="text-sm text-k-text-primary">{item.notes || ''}</p>
                    ) : (
                        <textarea
                            value={item.notes || ''}
                            onChange={(e) => onUpdate({ notes: e.target.value })}
                            placeholder="Escreva uma nota..."
                            rows={2}
                            className="w-full px-0 py-0 bg-transparent border-0 text-k-text-primary placeholder:text-k-text-quaternary focus:outline-none focus:ring-0 text-sm resize-none"
                        />
                    )}
                </div>

                {!readonly && (
                    <button
                        onClick={onDelete}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-k-text-quaternary hover:text-red-400 p-1"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                )}
            </div>
        )
    }

    if (item.item_type === 'superset') {
        return (
            <div className="bg-white dark:bg-surface-card rounded-xl border border-[#E8E8ED] dark:border-k-border-subtle p-4 relative group">
                {/* Vertical Accent */}
                <div className="absolute top-4 bottom-4 left-0 w-1 bg-[#007AFF]/20 dark:bg-violet-600/20 rounded-r-full" />

                {/* Header */}
                <div className="flex items-center justify-between mb-4 pl-3">
                    <div className="flex items-center gap-3">
                        {!readonly && (
                            <div {...dragHandleProps} className="text-k-text-quaternary hover:text-k-text-secondary cursor-grab active:cursor-grabbing touch-none">
                                <GripVertical className="w-4 h-4" />
                            </div>
                        )}
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#007AFF] dark:text-violet-400">Superset</span>
                            <span className="flex items-center justify-center bg-[#007AFF]/10 dark:bg-violet-500/10 text-[#007AFF] dark:text-violet-300 text-[10px] font-bold px-1.5 py-0.5 rounded border border-[#007AFF]/20 dark:border-violet-500/20">
                                {item.children?.length || 0}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-[#8E8E93] dark:text-k-text-tertiary">Descanso</span>
                            {readonly ? (
                                <span className="text-[#1C1C1E] dark:text-k-text-primary text-xs font-medium">{item.rest_seconds || 0}s</span>
                            ) : (
                                <>
                                    <input
                                        type="number"
                                        value={item.rest_seconds || ''}
                                        onChange={(e) => onUpdate({ rest_seconds: parseInt(e.target.value) || null })}
                                        placeholder="0"
                                        className="w-8 bg-transparent text-[#1C1C1E] dark:text-k-text-primary text-xs font-medium text-center focus:outline-none focus:text-[#007AFF] dark:focus:text-violet-400 transition-colors placeholder:text-k-border-subtle"
                                    />
                                    <span className="text-[10px] text-[#8E8E93] dark:text-k-text-tertiary">s</span>
                                </>
                            )}
                        </div>

                        {!readonly && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={onDissolveSuperset} className="text-k-text-quaternary hover:text-k-text-primary p-1" title="Dissolver">
                                    <Repeat className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={onDelete} className="text-k-text-quaternary hover:text-red-400 p-1">
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Children */}
                <div className="space-y-2 pl-3">
                    {item.children?.map((child, childIndex) => (
                        <SupersetChildCard
                            key={child.id}
                            item={child}
                            exercises={exercises}
                            onUpdate={(updates) => onUpdateChild?.(child.id, updates)}
                            onDelete={() => onDeleteChild?.(child.id)}
                            onRemoveFromSuperset={() => onRemoveFromSuperset?.(child.id)}
                            readonly={readonly}
                        />
                    ))}


                </div>
            </div>
        )
    }

    if (item.item_type === 'warmup') {
        return (
            <WarmupItemCard
                item={item}
                onUpdate={onUpdate}
                onDelete={onDelete}
                dragHandleProps={dragHandleProps}
                readonly={readonly}
            />
        )
    }

    if (item.item_type === 'cardio') {
        return (
            <CardioItemCard
                item={item}
                onUpdate={onUpdate}
                onDelete={onDelete}
                dragHandleProps={dragHandleProps}
                readonly={readonly}
            />
        )
    }

    // Exercise Item
    return (
        <ExerciseItemCard
            item={item}
            exercises={exercises}
            onUpdate={onUpdate}
            onDelete={onDelete}
            dragHandleProps={dragHandleProps}
            readonly={readonly}
        />
    )
}

function ExerciseItemCard({
    item,
    exercises,
    onUpdate,
    onDelete,
    dragHandleProps,
    readonly,
}: {
    item: WorkoutItem
    exercises: Exercise[]
    onUpdate: (updates: Partial<WorkoutItem>) => void
    onDelete: () => void
    dragHandleProps?: any
    readonly?: boolean
}) {
    const [showVideo, setShowVideo] = useState(false)
    const [videoExercise, setVideoExercise] = useState<Exercise | null>(null)
    const [isSwapping, setIsSwapping] = useState(false)
    const [swapQuery, setSwapQuery] = useState('')
    const swapInputRef = useRef<HTMLInputElement>(null)

    // Swap: filter exercises by query, prioritize same muscle group
    const currentGroups = new Set((item.exercise?.muscle_groups || []).map(g => g.name.toLowerCase()))
    const swapCandidates = exercises
        .filter(ex => ex.id !== item.exercise_id)
        .filter(ex => {
            if (!swapQuery.trim()) return true
            const q = swapQuery.toLowerCase()
            return ex.name.toLowerCase().includes(q) ||
                (ex.muscle_groups || []).some(g => g.name.toLowerCase().includes(q))
        })
        .sort((a, b) => {
            const aOverlap = (a.muscle_groups || []).some(g => currentGroups.has(g.name.toLowerCase())) ? 1 : 0
            const bOverlap = (b.muscle_groups || []).some(g => currentGroups.has(g.name.toLowerCase())) ? 1 : 0
            if (aOverlap !== bOverlap) return bOverlap - aOverlap
            return a.name.localeCompare(b.name)
        })
        .slice(0, 8)

    const confirmSwap = (newExercise: Exercise) => {
        onUpdate({
            exercise_id: newExercise.id,
            exercise: newExercise,
        })
        setIsSwapping(false)
        setSwapQuery('')
    }

    const startSwap = () => {
        setIsSwapping(true)
        setSwapQuery('')
        setTimeout(() => swapInputRef.current?.focus(), 50)
    }

    if (isSwapping && !readonly) {
        return (
            <>
            <div className="bg-white dark:bg-surface-card rounded-xl border border-[#007AFF]/30 dark:border-violet-500/30 p-4 relative transition-all">
                <div className="flex items-center gap-3 mb-3">
                    <Search className="w-4 h-4 text-k-text-quaternary shrink-0" />
                    <input
                        ref={swapInputRef}
                        type="text"
                        value={swapQuery}
                        onChange={(e) => setSwapQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Escape' && setIsSwapping(false)}
                        placeholder="Buscar exercício para substituir..."
                        className="flex-1 bg-transparent text-sm text-k-text-primary placeholder:text-k-text-quaternary focus:outline-none"
                    />
                    <button
                        onClick={() => setIsSwapping(false)}
                        className="text-k-text-quaternary hover:text-k-text-primary transition-colors shrink-0"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="max-h-52 overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                    {swapCandidates.length === 0 ? (
                        <p className="text-center text-xs text-k-text-quaternary py-4">Nenhum exercício encontrado</p>
                    ) : (
                        swapCandidates.map(ex => (
                            <div
                                key={ex.id}
                                className="flex items-center gap-1 rounded-lg hover:bg-[#007AFF]/10 dark:hover:bg-violet-500/10 transition-colors group/swap"
                            >
                                <button
                                    onClick={() => confirmSwap(ex)}
                                    className="flex-1 flex items-center justify-between px-3 py-2 text-left min-w-0"
                                >
                                    <span className="text-xs font-medium text-k-text-secondary group-hover/swap:text-k-text-primary truncate">
                                        {ex.name}
                                    </span>
                                    <div className="flex gap-1 shrink-0 ml-2">
                                        {(ex.muscle_groups || []).slice(0, 2).map(g => (
                                            <span key={g.id || g.name} className="text-[9px] text-k-text-quaternary bg-glass-bg px-1.5 py-0.5 rounded font-bold">
                                                {g.name}
                                            </span>
                                        ))}
                                    </div>
                                </button>
                                {ex.video_url && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            setVideoExercise(ex)
                                            setShowVideo(true)
                                        }}
                                        className="p-1.5 text-[#AEAEB2] dark:text-k-text-quaternary hover:text-[#007AFF] dark:hover:text-violet-400 transition-colors shrink-0 mr-1"
                                        title="Ver vídeo demonstrativo"
                                    >
                                        <PlayCircle className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        ))
                    )}
                </div>

                <div className="mt-3 pt-2 border-t border-k-border-subtle text-[10px] text-k-text-quaternary">
                    Mantendo: {item.sets || 0} séries × {item.reps || '0'} reps, {item.rest_seconds || 0}s descanso
                </div>
            </div>
            <FloatingExercisePlayer
                isOpen={showVideo}
                onClose={() => { setShowVideo(false); setVideoExercise(null) }}
                videoUrl={videoExercise?.video_url || null}
                title={videoExercise?.name || ''}
            />
            </>
        )
    }

    return (
        <>
        <div className="bg-white dark:bg-surface-card rounded-xl border border-[#E8E8ED] dark:border-k-border-subtle p-4 group relative transition-all hover:border-[#D2D2D7] dark:hover:border-k-border-primary">
            <div className="flex items-start gap-3">
                {/* Drag Handle */}
                {!readonly && (
                    <div
                        {...dragHandleProps}
                        className="mt-1 text-k-text-quaternary hover:text-k-text-secondary cursor-grab active:cursor-grabbing touch-none transition-colors"
                    >
                        <GripVertical className="w-4 h-4" />
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0">
                    {/* Header: Name + Tag */}
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                            <span className="text-sm font-bold text-k-text-primary truncate">
                                {item.exercise?.name || 'Exercício sem nome'}
                            </span>
                            {!readonly && item.exercise?.video_url && (
                                <button
                                    onClick={() => { setVideoExercise(item.exercise!); setShowVideo(true) }}
                                    className="text-[#AEAEB2] dark:text-k-text-quaternary hover:text-[#007AFF] dark:hover:text-violet-400 transition-colors shrink-0"
                                    title="Ver vídeo demonstrativo"
                                >
                                    <PlayCircle className="w-4 h-4" />
                                </button>
                            )}
                            {item.exercise?.muscle_groups?.map(g => (
                                <span key={g.id || g.name} className="text-[9px] font-bold text-k-text-tertiary bg-glass-bg px-1.5 py-0.5 rounded border border-k-border-subtle whitespace-nowrap">
                                    {g.name}
                                </span>
                            ))}
                        </div>

                        {/* Hover Actions */}
                        {!readonly && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={startSwap}
                                    className="p-1.5 rounded-md text-[#AEAEB2] dark:text-k-text-quaternary hover:text-[#007AFF] dark:hover:text-violet-400 hover:bg-[#007AFF]/10 dark:hover:bg-violet-400/10 transition-colors"
                                    title="Trocar exercício"
                                >
                                    <ArrowLeftRight className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={onDelete}
                                    className="p-1.5 rounded-md text-[#AEAEB2] dark:text-k-text-quaternary hover:text-[#FF3B30] dark:hover:text-red-400 hover:bg-[#FF3B30]/10 dark:hover:bg-red-400/10 transition-colors"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Inline Parameters */}
                    <div className="flex items-center gap-6">
                        {/* Sets */}
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-[#8E8E93] dark:text-k-text-tertiary">Séries</span>
                            {readonly ? (
                                <span className="text-[#1C1C1E] dark:text-k-text-primary text-sm font-medium">{item.sets || 0}</span>
                            ) : (
                                <input
                                    type="number"
                                    min={1}
                                    step={1}
                                    value={item.sets || ''}
                                    onChange={(e) => onUpdate({ sets: parseInt(e.target.value) || null })}
                                    onFocus={(e) => e.target.select()}
                                    placeholder="0"
                                    className="w-8 bg-transparent text-[#1C1C1E] dark:text-k-text-primary text-sm font-medium text-center focus:outline-none focus:text-[#007AFF] dark:focus:text-violet-400 transition-colors placeholder:text-k-border-subtle border-b border-transparent focus:border-[#007AFF]/50 dark:focus:border-violet-500/50 p-0"
                                />
                            )}
                        </div>

                        {/* Reps */}
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-[#8E8E93] dark:text-k-text-tertiary">Reps</span>
                            {readonly ? (
                                <span className="text-[#1C1C1E] dark:text-k-text-primary text-sm font-medium">{item.reps || '—'}</span>
                            ) : (
                                <input
                                    type="text"
                                    value={item.reps || ''}
                                    onChange={(e) => onUpdate({ reps: e.target.value || null })}
                                    onFocus={(e) => e.target.select()}
                                    placeholder="0"
                                    className="w-12 bg-transparent text-[#1C1C1E] dark:text-k-text-primary text-sm font-medium text-center focus:outline-none focus:text-[#007AFF] dark:focus:text-violet-400 transition-colors placeholder:text-k-border-subtle border-b border-transparent focus:border-[#007AFF]/50 dark:focus:border-violet-500/50 p-0"
                                />
                            )}
                        </div>

                        {/* Rest */}
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-[#8E8E93] dark:text-k-text-tertiary">Descanso</span>
                            {readonly ? (
                                <span className="text-[#1C1C1E] dark:text-k-text-primary text-sm font-medium">{item.rest_seconds || 0}s</span>
                            ) : (
                                <div className="relative">
                                    <input
                                        type="number"
                                        min={0}
                                        step={15}
                                        value={item.rest_seconds || ''}
                                        onChange={(e) => onUpdate({ rest_seconds: parseInt(e.target.value) || null })}
                                        onFocus={(e) => e.target.select()}
                                        placeholder="0"
                                        className="w-10 bg-transparent text-[#1C1C1E] dark:text-k-text-primary text-sm font-medium text-center focus:outline-none focus:text-[#007AFF] dark:focus:text-violet-400 transition-colors placeholder:text-k-border-subtle border-b border-transparent focus:border-[#007AFF]/50 dark:focus:border-violet-500/50 p-0"
                                    />
                                    <span className="absolute -right-2 top-0.5 text-[9px] text-[#8E8E93] dark:text-k-text-tertiary pointer-events-none">s</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Exercise Function */}
                    <ExerciseFunctionSelect
                        value={item.exercise_function}
                        onChange={(v) => onUpdate({ exercise_function: v })}
                        readonly={readonly}
                    />

                    {/* Technical Note */}
                    <TechnicalNote
                        value={item.notes || ''}
                        onChange={(v) => onUpdate({ notes: v })}
                        readonly={readonly}
                    />

                    {!readonly && (
                        <SubstituteSelector
                            item={item}
                            exercises={exercises}
                            onUpdate={onUpdate}
                        />
                    )}
                </div>
            </div>
        </div>

        <FloatingExercisePlayer
            isOpen={showVideo}
            onClose={() => { setShowVideo(false); setVideoExercise(null) }}
            videoUrl={videoExercise?.video_url || null}
            title={videoExercise?.name || ''}
        />
        </>
    )
}

function SupersetChildCard({
    item,
    exercises,
    onUpdate,
    onDelete,
    onRemoveFromSuperset,
    readonly,
}: {
    item: WorkoutItem
    exercises: Exercise[]
    onUpdate: (updates: Partial<WorkoutItem>) => void
    onDelete: () => void
    onRemoveFromSuperset?: () => void
    readonly?: boolean
}) {
    return (
        <div className="bg-[#F9F9FB] dark:bg-surface-inset rounded-lg border border-[#E8E8ED] dark:border-k-border-subtle p-3 group/child relative hover:border-[#D2D2D7] dark:hover:border-k-border-primary transition-colors">
            <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-k-text-primary truncate">
                            {item.exercise?.name}
                        </span>

                        {!readonly && (
                            <div className="flex items-center gap-1 opacity-0 group-hover/child:opacity-100 transition-opacity">
                                <button onClick={onRemoveFromSuperset} className="text-k-text-quaternary hover:text-amber-400 p-1">
                                    <span className="sr-only">Desvincular</span>
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                                </button>
                                <button onClick={onDelete} className="text-k-text-quaternary hover:text-red-400 p-1">
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold text-[#8E8E93] dark:text-k-text-tertiary">Sets</span>
                            {readonly ? (
                                <span className="text-[#1C1C1E] dark:text-k-text-primary text-xs font-medium">{item.sets || 0}</span>
                            ) : (
                                <input
                                    type="number"
                                    min={1}
                                    step={1}
                                    value={item.sets || ''}
                                    onChange={(e) => onUpdate({ sets: parseInt(e.target.value) || null })}
                                    onFocus={(e) => e.target.select()}
                                    placeholder="0"
                                    className="w-6 bg-transparent text-[#1C1C1E] dark:text-k-text-primary text-xs font-medium text-center focus:outline-none focus:text-[#007AFF] dark:focus:text-violet-400 border-b border-transparent focus:border-[#007AFF]/50 dark:focus:border-violet-500/50 p-0"
                                />
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold text-[#8E8E93] dark:text-k-text-tertiary">Reps</span>
                            {readonly ? (
                                <span className="text-[#1D1D1F] dark:text-k-text-primary text-xs font-medium">{item.reps || '—'}</span>
                            ) : (
                                <input
                                    type="text"
                                    value={item.reps || ''}
                                    onChange={(e) => onUpdate({ reps: e.target.value || null })}
                                    onFocus={(e) => e.target.select()}
                                    placeholder="0"
                                    className="w-8 bg-transparent text-[#1D1D1F] dark:text-k-text-primary text-xs font-medium text-center focus:outline-none focus:text-[#007AFF] dark:focus:text-violet-400 border-b border-transparent focus:border-[#007AFF]/50 dark:focus:border-violet-500/50 p-0"
                                />
                            )}
                        </div>
                    </div>

                    {/* Exercise Function */}
                    <ExerciseFunctionSelect
                        value={item.exercise_function}
                        onChange={(v) => onUpdate({ exercise_function: v })}
                        readonly={readonly}
                    />
                </div>
            </div>
        </div>
    )
}

const EXERCISE_FUNCTION_OPTIONS = [
    { value: 'warmup', label: 'Aquecimento' },
    { value: 'activation', label: 'Ativação' },
    { value: 'main', label: 'Principal' },
    { value: 'accessory', label: 'Acessório' },
    { value: 'conditioning', label: 'Condicionamento' },
] as const

function ExerciseFunctionSelect({
    value,
    onChange,
    readonly,
}: {
    value?: string | null
    onChange: (v: string | null) => void
    readonly?: boolean
}) {
    const label = EXERCISE_FUNCTION_OPTIONS.find(o => o.value === value)?.label

    if (readonly) {
        if (!label) return null
        return (
            <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] font-bold text-[#8E8E93] dark:text-k-text-tertiary">Função</span>
                <span className="text-[#1D1D1F] dark:text-k-text-primary text-xs font-medium">{label}</span>
            </div>
        )
    }

    return (
        <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] font-bold text-[#8E8E93] dark:text-k-text-tertiary">Função</span>
            <select
                value={value || ''}
                onChange={(e) => onChange(e.target.value || null)}
                className="bg-transparent text-[#1D1D1F] dark:text-k-text-primary text-xs font-medium focus:outline-none focus:text-[#007AFF] dark:focus:text-violet-400 transition-colors border-b border-transparent focus:border-[#007AFF]/50 dark:focus:border-violet-500/50 cursor-pointer appearance-none pr-4"
            >
                <option value="">—</option>
                {EXERCISE_FUNCTION_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
            </select>
        </div>
    )
}

function TechnicalNote({ value, onChange, readonly }: { value: string; onChange: (v: string) => void; readonly?: boolean }) {
    const [editing, setEditing] = useState(false)
    const [local, setLocal] = useState(value)
    const inputRef = useRef<HTMLInputElement>(null)

    if (readonly) {
        if (!value) return null
        return (
            <div className="mt-2 flex items-center gap-2 py-1.5 px-2 -mx-2 rounded-lg bg-[#007AFF]/5 dark:bg-violet-500/5 border-l-2 border-[#007AFF]/40 dark:border-violet-500/40">
                <MessageSquare size={14} className="text-[#007AFF]/70 dark:text-violet-400/70 shrink-0" />
                <span className="text-k-text-secondary text-xs flex-1">{value}</span>
            </div>
        )
    }

    const commit = () => {
        setEditing(false)
        onChange(local)
    }

    const startEditing = () => {
        setLocal(value)
        setEditing(true)
        setTimeout(() => {
            inputRef.current?.focus()
            inputRef.current?.select()
        }, 30)
    }

    if (editing) {
        return (
            <div className="mt-2 flex items-center gap-2 py-1.5">
                <MessageSquare size={14} className="text-[#007AFF] dark:text-violet-400 shrink-0" />
                <input
                    ref={inputRef}
                    value={local}
                    onChange={e => setLocal(e.target.value)}
                    onBlur={commit}
                    onKeyDown={e => {
                        if (e.key === 'Enter') commit()
                        if (e.key === 'Escape') { setLocal(value); setEditing(false) }
                    }}
                    placeholder="Ex: Manter lombar neutra, descer até 90°..."
                    className="bg-transparent text-[#1D1D1F] dark:text-k-text-secondary text-xs outline-none flex-1 border-b border-[#007AFF] dark:border-violet-400 placeholder:text-[#AEAEB2] dark:placeholder:text-k-text-quaternary pb-0.5"
                />
            </div>
        )
    }

    if (value) {
        return (
            <div
                onClick={startEditing}
                className="mt-2 flex items-center gap-2 py-1.5 px-2 -mx-2 rounded-lg bg-[#007AFF]/5 dark:bg-violet-500/5 border-l-2 border-[#007AFF]/40 dark:border-violet-500/40 cursor-pointer hover:bg-[#007AFF]/10 dark:hover:bg-violet-500/10 transition-colors group/note"
            >
                <MessageSquare size={14} className="text-[#007AFF]/70 dark:text-violet-400/70 shrink-0" />
                <span className="text-k-text-secondary text-xs flex-1">{value}</span>
                <Pencil size={12} className="text-k-text-quaternary opacity-0 group-hover/note:opacity-100 transition-opacity shrink-0" />
            </div>
        )
    }

    return (
        <div
            onClick={startEditing}
            className="mt-2 flex items-center gap-2 py-1.5 cursor-pointer text-[#AEAEB2] dark:text-k-text-quaternary hover:text-[#6E6E73] dark:hover:text-k-text-tertiary transition-colors group/note"
        >
            <MessageSquare size={14} className="shrink-0 group-hover/note:text-[#007AFF]/50 dark:group-hover/note:text-violet-400/50" />
            <span className="text-xs">Adicionar nota técnica...</span>
        </div>
    )
}

// ============================================================================
// Warmup Item Card
// ============================================================================

/** Check if a warmup config has meaningful data filled in */
function isWarmupFilled(config: WarmupConfig): boolean {
    return !!(config.duration_minutes || config.description)
}

/** Build compact summary text for warmup */
function warmupSummary(config: WarmupConfig): string {
    const parts: string[] = []
    if (config.duration_minutes) parts.push(`${config.duration_minutes} min`)
    const typeLabel = WARMUP_TYPE_LABELS[config.warmup_type] || 'Livre'
    parts.push(typeLabel)
    return parts.join(' · ')
}

function WarmupItemCard({
    item,
    onUpdate,
    onDelete,
    dragHandleProps,
    readonly,
}: {
    item: WorkoutItem
    onUpdate: (updates: Partial<WorkoutItem>) => void
    onDelete: () => void
    dragHandleProps?: any
    readonly?: boolean
}) {
    const config = (item.item_config || { warmup_type: 'free' }) as WarmupConfig
    const warmupType = config.warmup_type || 'free'

    const [isExpanded, setIsExpanded] = useState(() => !isWarmupFilled(config))
    const [showDescription, setShowDescription] = useState(() => warmupType === 'free' || !!config.description)

    const updateConfig = (patch: Partial<WarmupConfig>) => {
        onUpdate({ item_config: { ...config, ...patch } })
    }

    // Readonly — compact
    if (readonly) {
        return (
            <div className="bg-white dark:bg-surface-card rounded-xl border border-[#E8E8ED] dark:border-k-border-subtle px-4 py-3">
                <div className="flex items-center gap-3">
                    <Flame className="w-[18px] h-[18px] text-amber-500 shrink-0" />
                    <span className="text-sm font-medium text-[#1D1D1F] dark:text-k-text-primary">Aquecimento</span>
                    <span className="text-sm text-[#8E8E93] dark:text-k-text-tertiary truncate">{warmupSummary(config)}</span>
                </div>
            </div>
        )
    }

    // --- Collapsed ---
    if (!isExpanded) {
        return (
            <div
                onClick={() => setIsExpanded(true)}
                className="bg-white dark:bg-surface-card rounded-xl border border-[#E8E8ED] dark:border-k-border-subtle px-4 py-3 cursor-pointer group hover:border-[#D2D2D7] dark:hover:border-k-border-primary transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div
                        {...dragHandleProps}
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                        className="text-[#D2D2D7] dark:text-k-text-quaternary hover:text-k-text-secondary cursor-grab active:cursor-grabbing touch-none transition-colors"
                    >
                        <GripVertical className="w-4 h-4" />
                    </div>

                    <Flame className="w-[18px] h-[18px] text-amber-500 shrink-0" />
                    <span className="text-sm font-medium text-[#1D1D1F] dark:text-k-text-primary">Aquecimento</span>
                    <span className="text-sm text-[#8E8E93] dark:text-k-text-tertiary flex-1 truncate">{warmupSummary(config)}</span>

                    <ChevronDown className="w-4 h-4 text-[#8E8E93] dark:text-k-text-quaternary shrink-0" />

                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete() }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-[#D2D2D7] dark:text-k-text-quaternary hover:text-red-500 dark:hover:text-red-400 p-1"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>
        )
    }

    // --- Expanded ---
    return (
        <div className="bg-white dark:bg-surface-card rounded-xl border border-[#E8E8ED] dark:border-k-border-subtle p-3 group transition-all">
            {/* Header */}
            <div className="flex items-center gap-3 mb-2">
                <div
                    {...dragHandleProps}
                    className="text-[#D2D2D7] dark:text-k-text-quaternary hover:text-k-text-secondary cursor-grab active:cursor-grabbing touch-none transition-colors"
                >
                    <GripVertical className="w-4 h-4" />
                </div>

                <Flame className="w-[18px] h-[18px] text-amber-500 shrink-0" />
                <span className="text-sm font-medium text-[#1D1D1F] dark:text-k-text-primary flex-1">Aquecimento</span>

                <button
                    onClick={() => setIsExpanded(false)}
                    className="text-[#8E8E93] dark:text-k-text-quaternary hover:text-k-text-secondary p-1 transition-colors"
                >
                    <ChevronUp className="w-4 h-4" />
                </button>

                <button
                    onClick={onDelete}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-[#D2D2D7] dark:text-k-text-quaternary hover:text-red-500 dark:hover:text-red-400 p-1"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>

            {/* Row: Type chips + Duration */}
            <div className="flex items-center gap-1.5 flex-wrap mb-2">
                {WARMUP_TYPE_OPTIONS.map(wt => {
                    const isSelected = warmupType === wt
                    return (
                        <button
                            key={wt}
                            onClick={() => {
                                updateConfig({ warmup_type: wt })
                                if (wt === 'free') setShowDescription(true)
                            }}
                            className={`px-3 py-1 rounded-full text-xs transition-colors border cursor-pointer ${
                                isSelected
                                    ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 font-medium'
                                    : 'bg-transparent border-[#E8E8ED] dark:border-slate-700/50 text-[#8E8E93] dark:text-k-text-quaternary hover:bg-[#F5F5F7] dark:hover:bg-glass-bg'
                            }`}
                        >
                            {WARMUP_TYPE_LABELS[wt]}
                        </button>
                    )
                })}

                {/* Duration inline */}
                <div className="flex items-center gap-1 ml-2">
                    <Clock size={14} className="text-[#AEAEB2] dark:text-k-text-quaternary" />
                    <input
                        type="number"
                        min={1}
                        value={config.duration_minutes || ''}
                        onChange={(e) => updateConfig({ duration_minutes: parseInt(e.target.value) || undefined })}
                        onFocus={(e) => e.target.select()}
                        placeholder="10"
                        className="w-14 h-7 bg-transparent text-[#1D1D1F] dark:text-k-text-primary text-sm font-medium text-center focus:outline-none border-0 border-b border-[#D2D2D7] dark:border-slate-600 focus:border-[#8E8E93] dark:focus:border-k-text-tertiary transition-colors placeholder:text-[#D2D2D7] dark:placeholder:text-k-text-quaternary"
                    />
                    <span className="text-xs text-[#AEAEB2] dark:text-k-text-quaternary">min</span>
                </div>
            </div>

            {/* Description textarea */}
            <AnimatePresence>
                {(warmupType === 'free' || showDescription) && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        className="overflow-hidden mb-1.5"
                    >
                        <textarea
                            value={config.description || ''}
                            onChange={(e) => updateConfig({ description: e.target.value || undefined })}
                            placeholder="Ex: 5 min esteira leve, mobilidade articular, 2x15 rotação externa"
                            rows={2}
                            className="w-full px-2.5 py-1.5 bg-[#F9F9FB] dark:bg-glass-bg border border-[#E8E8ED] dark:border-slate-700/50 rounded-lg text-k-text-primary placeholder:text-[#AEAEB2] dark:placeholder:text-k-text-quaternary focus:outline-none focus:border-[#D2D2D7] dark:focus:border-k-border-primary text-sm resize-none max-h-16"
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {warmupType !== 'free' && !showDescription && (
                <button
                    onClick={() => setShowDescription(true)}
                    className="text-xs text-[#AEAEB2] dark:text-k-text-quaternary hover:text-[#8E8E93] dark:hover:text-k-text-tertiary transition-colors mb-1.5"
                >
                    + Adicionar descrição...
                </button>
            )}

            <TechnicalNote
                value={item.notes || ''}
                onChange={(v) => onUpdate({ notes: v })}
                readonly={false}
            />
        </div>
    )
}

// ============================================================================
// Cardio Item Card
// ============================================================================

/** Check if a cardio config has meaningful data filled in */
function isCardioFilled(config: CardioConfig): boolean {
    if (config.mode === 'interval' && config.intervals) return true
    return !!(config.duration_minutes || config.distance_km || config.equipment || config.intensity)
}

/** Build compact summary for cardio */
function cardioCompactSummary(config: CardioConfig): string {
    const mode = config.mode || 'continuous'
    const parts: string[] = []

    parts.push(mode === 'interval' ? 'Intervalado' : 'Contínuo')

    if (config.equipment) {
        parts.push(CARDIO_EQUIPMENT_LABELS[config.equipment] || config.equipment)
    }

    if (mode === 'interval' && config.intervals) {
        parts.push(`${config.intervals.work_seconds}s ON`)
        parts.push(`${config.intervals.rest_seconds}s OFF`)
        parts.push(`${config.intervals.rounds} rounds`)
    } else {
        if (config.duration_minutes) parts.push(`${config.duration_minutes} min`)
        if (config.distance_km) parts.push(`${config.distance_km} km`)
        if (config.intensity) parts.push(config.intensity)
    }

    return parts.join(' · ')
}

function CardioItemCard({
    item,
    onUpdate,
    onDelete,
    dragHandleProps,
    readonly,
}: {
    item: WorkoutItem
    onUpdate: (updates: Partial<WorkoutItem>) => void
    onDelete: () => void
    dragHandleProps?: any
    readonly?: boolean
}) {
    const config = (item.item_config || { mode: 'continuous' }) as CardioConfig
    const mode: CardioMode = config.mode || 'continuous'
    const objective: CardioObjective = config.objective || 'time'

    // New items (no data) start expanded; existing items start collapsed
    const [isExpanded, setIsExpanded] = useState(() => !isCardioFilled(config))

    const updateConfig = (patch: Partial<CardioConfig>) => {
        onUpdate({ item_config: { ...config, ...patch } })
    }

    // Estimated duration for interval mode
    const estimatedIntervalDuration = config.intervals
        ? (config.intervals.work_seconds * config.intervals.rounds +
            config.intervals.rest_seconds * (config.intervals.rounds - 1))
        : 0
    const estMin = Math.floor(estimatedIntervalDuration / 60)
    const estSec = estimatedIntervalDuration % 60

    // Readonly — always compact
    if (readonly) {
        return (
            <div className="bg-white dark:bg-surface-card rounded-xl border border-[#E8E8ED] dark:border-k-border-subtle px-3 py-2.5">
                <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-cyan-500 dark:text-cyan-400 shrink-0" />
                    <span className="text-sm font-medium text-cyan-600 dark:text-cyan-400">Aeróbio</span>
                    <span className="text-sm text-[#8E8E93] dark:text-k-text-tertiary truncate">{cardioCompactSummary(config)}</span>
                </div>
            </div>
        )
    }

    // --- Collapsed ---
    if (!isExpanded) {
        return (
            <div
                onClick={() => setIsExpanded(true)}
                className="bg-white dark:bg-surface-card rounded-xl border border-[#E8E8ED] dark:border-k-border-subtle px-3 py-2.5 cursor-pointer group hover:border-[#D2D2D7] dark:hover:border-k-border transition-colors"
            >
                <div className="flex items-center gap-2">
                    <div
                        {...dragHandleProps}
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                        className="text-[#D2D2D7] dark:text-k-text-quaternary hover:text-[#8E8E93] dark:hover:text-k-text-secondary cursor-grab active:cursor-grabbing touch-none transition-colors"
                    >
                        <GripVertical className="w-4 h-4" />
                    </div>

                    <Activity className="w-4 h-4 text-cyan-500 dark:text-cyan-400 shrink-0" />
                    <span className="text-sm font-medium text-cyan-600 dark:text-cyan-400">Aeróbio</span>
                    <span className="text-sm text-[#8E8E93] dark:text-k-text-tertiary flex-1 truncate">{cardioCompactSummary(config)}</span>

                    <ChevronDown className="w-4 h-4 text-[#D2D2D7] dark:text-k-text-quaternary shrink-0" />

                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete() }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-[#D2D2D7] hover:text-red-400 p-1"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>
        )
    }

    // --- Expanded ---
    return (
        <div className="bg-white dark:bg-surface-card rounded-xl border border-[#E8E8ED] dark:border-k-border-subtle p-3 group transition-all">
            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
                <div
                    {...dragHandleProps}
                    className="text-[#D2D2D7] dark:text-k-text-quaternary hover:text-[#8E8E93] dark:hover:text-k-text-secondary cursor-grab active:cursor-grabbing touch-none transition-colors"
                >
                    <GripVertical className="w-4 h-4" />
                </div>

                <Activity className="w-4 h-4 text-cyan-500 dark:text-cyan-400 shrink-0" />
                <span className="text-sm font-medium text-cyan-600 dark:text-cyan-400 flex-1">Aeróbio</span>

                <button
                    onClick={() => setIsExpanded(false)}
                    className="text-[#D2D2D7] dark:text-k-text-quaternary hover:text-[#8E8E93] dark:hover:text-k-text-secondary p-1 transition-colors"
                >
                    <ChevronUp className="w-4 h-4" />
                </button>

                <button
                    onClick={onDelete}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-[#D2D2D7] hover:text-red-400 p-1"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>

            {/* Row 1: Mode toggle + Equipment select */}
            <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                {/* Mode segmented control */}
                <div className="inline-flex rounded-full overflow-hidden h-7 gap-1">
                    <button
                        onClick={() => updateConfig({ mode: 'continuous' })}
                        className={`px-3 text-xs font-medium rounded-full transition-all ${
                            mode === 'continuous'
                                ? 'bg-cyan-50 dark:bg-cyan-500/15 text-cyan-700 dark:text-cyan-300'
                                : 'bg-transparent text-[#8E8E93] dark:text-k-text-quaternary hover:bg-gray-50 dark:hover:bg-glass-bg'
                        }`}
                    >
                        Contínuo
                    </button>
                    <button
                        onClick={() => updateConfig({ mode: 'interval' })}
                        className={`px-3 text-xs font-medium rounded-full transition-all ${
                            mode === 'interval'
                                ? 'bg-cyan-50 dark:bg-cyan-500/15 text-cyan-700 dark:text-cyan-300'
                                : 'bg-transparent text-[#8E8E93] dark:text-k-text-quaternary hover:bg-gray-50 dark:hover:bg-glass-bg'
                        }`}
                    >
                        Intervalado
                    </button>
                </div>

                {/* Equipment select */}
                <select
                    value={config.equipment || ''}
                    onChange={(e) => updateConfig({ equipment: (e.target.value || undefined) as CardioEquipment | undefined })}
                    className="h-7 bg-transparent border-0 border-b border-[#D2D2D7] dark:border-slate-600 text-sm text-k-text-primary focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400 cursor-pointer transition-colors"
                >
                    <option value="">Selecionar...</option>
                    {CARDIO_EQUIPMENT_OPTIONS.map(eq => (
                        <option key={eq} value={eq}>{CARDIO_EQUIPMENT_LABELS[eq]}</option>
                    ))}
                </select>
            </div>

            {/* Continuous Mode */}
            {mode === 'continuous' && (
                <div className="space-y-2">
                    {/* Objective chips */}
                    <div className="flex items-center gap-1.5">
                        {(['time', 'distance'] as const).map(obj => {
                            const isSelected = objective === obj
                            return (
                                <button
                                    key={obj}
                                    onClick={() => updateConfig({ objective: obj })}
                                    className={`px-2.5 py-0.5 rounded-full text-xs transition-all border cursor-pointer ${
                                        isSelected
                                            ? 'bg-cyan-50 dark:bg-cyan-500/15 border-cyan-300 dark:border-cyan-500/40 text-cyan-700 dark:text-cyan-300 font-medium'
                                            : 'bg-transparent border-[#E8E8ED] dark:border-slate-700/50 text-[#8E8E93] dark:text-k-text-quaternary hover:border-cyan-300 dark:hover:border-cyan-500/30'
                                    }`}
                                >
                                    {CARDIO_OBJECTIVE_LABELS[obj]}
                                </button>
                            )
                        })}
                    </div>

                    {/* Duration or Distance + Intensity */}
                    <div className="flex items-center gap-4 flex-wrap">
                        {objective === 'time' ? (
                            <div className="flex items-center gap-1.5">
                                <Clock size={14} className="text-[#D2D2D7] dark:text-k-text-quaternary" />
                                <input
                                    type="number"
                                    min={1}
                                    value={config.duration_minutes || ''}
                                    onChange={(e) => updateConfig({ duration_minutes: parseInt(e.target.value) || undefined })}
                                    onFocus={(e) => e.target.select()}
                                    placeholder="30"
                                    className="w-14 h-7 bg-transparent text-k-text-primary text-sm font-medium text-center focus:outline-none border-0 border-b border-[#D2D2D7] dark:border-slate-600 focus:border-cyan-500 dark:focus:border-cyan-400 transition-colors placeholder:text-[#D2D2D7]"
                                />
                                <span className="text-xs text-[#8E8E93] dark:text-k-text-quaternary">min</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5">
                                <Activity size={14} className="text-[#D2D2D7] dark:text-k-text-quaternary" />
                                <input
                                    type="number"
                                    min={0}
                                    step={0.1}
                                    value={config.distance_km || ''}
                                    onChange={(e) => updateConfig({ distance_km: parseFloat(e.target.value) || undefined })}
                                    onFocus={(e) => e.target.select()}
                                    placeholder="5"
                                    className="w-14 h-7 bg-transparent text-k-text-primary text-sm font-medium text-center focus:outline-none border-0 border-b border-[#D2D2D7] dark:border-slate-600 focus:border-cyan-500 dark:focus:border-cyan-400 transition-colors placeholder:text-[#D2D2D7]"
                                />
                                <span className="text-xs text-[#8E8E93] dark:text-k-text-quaternary">km</span>
                            </div>
                        )}

                        {/* Intensity */}
                        <div className="flex items-center gap-1.5 flex-1 min-w-[180px]">
                            <Zap size={14} className="text-[#D2D2D7] dark:text-k-text-quaternary shrink-0" />
                            <input
                                type="text"
                                value={config.intensity || ''}
                                onChange={(e) => updateConfig({ intensity: e.target.value || undefined })}
                                placeholder="Ex: Zona 2, RPE 6, 130bpm"
                                className="flex-1 h-7 bg-transparent text-k-text-primary text-sm font-medium focus:outline-none border-0 border-b border-[#D2D2D7] dark:border-slate-600 focus:border-cyan-500 dark:focus:border-cyan-400 transition-colors placeholder:text-[#D2D2D7]"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Interval Mode */}
            {mode === 'interval' && (
                <div className="space-y-2">
                    {/* Protocol row */}
                    <div className="flex items-center gap-3 flex-wrap">
                        {/* Work */}
                        <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                            <input
                                type="number"
                                min={1}
                                value={config.intervals?.work_seconds || ''}
                                onChange={(e) => updateConfig({
                                    intervals: {
                                        work_seconds: parseInt(e.target.value) || 30,
                                        rest_seconds: config.intervals?.rest_seconds || 15,
                                        rounds: config.intervals?.rounds || 8,
                                    }
                                })}
                                onFocus={(e) => e.target.select()}
                                placeholder="30"
                                className="w-14 h-7 bg-transparent text-k-text-primary text-sm font-medium text-center focus:outline-none border-0 border-b border-[#D2D2D7] dark:border-slate-600 focus:border-red-400 dark:focus:border-red-400 transition-colors placeholder:text-[#D2D2D7]"
                            />
                            <span className="text-xs text-[#8E8E93] dark:text-k-text-quaternary">s</span>
                        </div>

                        {/* Rest */}
                        <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                            <input
                                type="number"
                                min={1}
                                value={config.intervals?.rest_seconds || ''}
                                onChange={(e) => updateConfig({
                                    intervals: {
                                        work_seconds: config.intervals?.work_seconds || 30,
                                        rest_seconds: parseInt(e.target.value) || 15,
                                        rounds: config.intervals?.rounds || 8,
                                    }
                                })}
                                onFocus={(e) => e.target.select()}
                                placeholder="15"
                                className="w-14 h-7 bg-transparent text-k-text-primary text-sm font-medium text-center focus:outline-none border-0 border-b border-[#D2D2D7] dark:border-slate-600 focus:border-emerald-400 dark:focus:border-emerald-400 transition-colors placeholder:text-[#D2D2D7]"
                            />
                            <span className="text-xs text-[#8E8E93] dark:text-k-text-quaternary">s</span>
                        </div>

                        {/* Rounds */}
                        <div className="flex items-center gap-1.5">
                            <Repeat size={14} className="text-[#8E8E93] dark:text-k-text-tertiary" />
                            <input
                                type="number"
                                min={1}
                                value={config.intervals?.rounds || ''}
                                onChange={(e) => updateConfig({
                                    intervals: {
                                        work_seconds: config.intervals?.work_seconds || 30,
                                        rest_seconds: config.intervals?.rest_seconds || 15,
                                        rounds: parseInt(e.target.value) || 8,
                                    }
                                })}
                                onFocus={(e) => e.target.select()}
                                placeholder="8"
                                className="w-14 h-7 bg-transparent text-k-text-primary text-sm font-medium text-center focus:outline-none border-0 border-b border-[#D2D2D7] dark:border-slate-600 focus:border-cyan-500 dark:focus:border-cyan-400 transition-colors placeholder:text-[#D2D2D7]"
                            />
                            <span className="text-xs text-[#8E8E93] dark:text-k-text-quaternary">séries</span>
                        </div>

                        {/* Estimated duration inline */}
                        {config.intervals && estimatedIntervalDuration > 0 && (
                            <span className="text-xs text-[#D2D2D7] dark:text-k-text-quaternary italic">
                                ≈ {estMin > 0 ? `${estMin}min ` : ''}{estSec > 0 ? `${estSec}s` : ''}
                            </span>
                        )}
                    </div>

                    {/* Intensity (optional) */}
                    <div className="flex items-center gap-1.5 flex-1">
                        <Zap size={14} className="text-[#D2D2D7] dark:text-k-text-quaternary shrink-0" />
                        <input
                            type="text"
                            value={config.intensity || ''}
                            onChange={(e) => updateConfig({ intensity: e.target.value || undefined })}
                            placeholder="Intensidade (ex: Zona 2, RPE 6, 130bpm)"
                            className="flex-1 h-7 bg-transparent text-k-text-primary text-sm font-medium focus:outline-none border-0 border-b border-[#D2D2D7] dark:border-slate-600 focus:border-cyan-500 dark:focus:border-cyan-400 transition-colors placeholder:text-[#D2D2D7]"
                        />
                    </div>
                </div>
            )}

            {/* Technical note */}
            <div className="mt-2">
                <TechnicalNote
                    value={config.notes || ''}
                    onChange={(v) => updateConfig({ notes: v || undefined })}
                    readonly={false}
                />
            </div>
        </div>
    )
}

function SubstituteSelector({
    item,
    exercises,
    onUpdate,
}: {
    item: WorkoutItem
    exercises: Exercise[]
    onUpdate: (updates: Partial<WorkoutItem>) => void
}) {
    const [isOpen, setIsOpen] = useState(false)
    const [query, setQuery] = useState('')

    const selectedIds = item.substitute_exercise_ids || []
    const selectedSet = new Set(selectedIds)
    const selectedCount = selectedIds.length

    const normalizedQuery = query.trim().toLowerCase()
    const currentExerciseId = item.exercise_id
    const currentGroups = new Set((item.exercise?.muscle_groups || []).map((group) => group.name.toLowerCase()))

    // Filter and sort mechanics (same as before)
    const sortedCandidates = [...exercises]
        .filter((exercise) => exercise.id !== currentExerciseId)
        .filter((exercise) => {
            if (!normalizedQuery) return true
            const muscleNames = (exercise.muscle_groups || []).map((group) => group.name.toLowerCase()).join(' ')
            return (
                exercise.name.toLowerCase().includes(normalizedQuery) ||
                (exercise.equipment || '').toLowerCase().includes(normalizedQuery) ||
                muscleNames.includes(normalizedQuery)
            )
        })
        .sort((a, b) => {
            const aSelected = selectedSet.has(a.id) ? 1 : 0
            const bSelected = selectedSet.has(b.id) ? 1 : 0
            if (aSelected !== bSelected) return bSelected - aSelected

            const aOverlap = (a.muscle_groups || []).some((group) => currentGroups.has(group.name.toLowerCase())) ? 1 : 0
            const bOverlap = (b.muscle_groups || []).some((group) => currentGroups.has(group.name.toLowerCase())) ? 1 : 0
            if (aOverlap !== bOverlap) return bOverlap - aOverlap

            return a.name.localeCompare(b.name)
        })

    const visibleCandidates = sortedCandidates.slice(0, normalizedQuery ? 25 : 12)

    const toggleSubstitute = (exerciseId: string) => {
        const next = selectedSet.has(exerciseId)
            ? selectedIds.filter((id) => id !== exerciseId)
            : [...selectedIds, exerciseId]
        onUpdate({ substitute_exercise_ids: next })
    }

    return (
        <div className="mt-2">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 text-[10px] font-semibold transition-colors group select-none"
            >
                <Repeat className={`w-3 h-3 ${isOpen ? 'text-[#007AFF] dark:text-violet-400' : 'text-[#6E6E73] dark:text-k-text-tertiary group-hover:text-[#1D1D1F] dark:group-hover:text-k-text-primary'}`} />
                <span className={isOpen || selectedCount > 0 ? 'text-[#007AFF] dark:text-violet-400' : 'text-[#6E6E73] dark:text-k-text-tertiary group-hover:text-[#1D1D1F] dark:group-hover:text-k-text-secondary'}>
                    {selectedCount > 0 ? `Substituições (${selectedCount})` : 'Substituições (nenhuma)'}
                </span>
            </button>

            <div className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${isOpen ? 'grid-rows-[1fr] mt-2' : 'grid-rows-[0fr]'}`}>
                <div className="overflow-hidden">
                    <div className="bg-[#F9F9FB] dark:bg-surface-inset rounded-xl border border-[#E8E8ED] dark:border-k-border-subtle p-3">
                        {/* Search */}
                        <div className="relative mb-2">
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Buscar exercício..."
                                className="w-full h-8 pl-8 pr-3 bg-white dark:bg-glass-bg border border-[#D2D2D7] dark:border-transparent rounded-lg text-[#1D1D1F] dark:text-k-text-primary text-xs placeholder:text-[#AEAEB2] dark:placeholder:text-k-text-quaternary focus:outline-none focus:ring-1 focus:ring-[#007AFF]/30 dark:focus:ring-violet-500/50 transition-all font-medium"
                            />
                            <svg className="w-3.5 h-3.5 text-k-text-quaternary absolute left-2.5 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>

                        {/* List */}
                        <div className="max-h-40 overflow-y-auto pr-1 space-y-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                            {visibleCandidates.length === 0 ? (
                                <div className="text-center py-4">
                                    <p className="text-[10px] text-k-text-quaternary">Nenhum exercício encontrado</p>
                                </div>
                            ) : (
                                visibleCandidates.map((exercise) => {
                                    const isSelected = selectedSet.has(exercise.id)
                                    return (
                                        <button
                                            key={exercise.id}
                                            onClick={() => toggleSubstitute(exercise.id)}
                                            className={`w-full text-left flex items-center justify-between p-2 rounded-lg transition-all group/item ${isSelected
                                                ? 'bg-[#007AFF]/10 dark:bg-violet-500/10 border border-[#007AFF]/20 dark:border-violet-500/20'
                                                : 'hover:bg-[#F5F5F7] dark:hover:bg-glass-bg border border-transparent hover:border-[#E8E8ED] dark:hover:border-k-border-subtle'
                                                }`}
                                        >
                                            <div className="min-w-0 flex-1 pr-2">
                                                <div className={`text-xs font-medium truncate transition-colors ${isSelected ? 'text-[#007AFF] dark:text-violet-300' : 'text-[#1D1D1F] dark:text-k-text-secondary group-hover/item:text-[#1D1D1F] dark:group-hover/item:text-k-text-primary'}`}>
                                                    {exercise.name}
                                                </div>
                                                <div className="text-[9px] text-k-text-quaternary truncate mt-0.5">
                                                    {(exercise.muscle_groups || []).map(g => g.name).join(', ') || 'Sem grupo'}
                                                </div>
                                            </div>

                                            {isSelected && (
                                                <div className="text-[#007AFF] dark:text-violet-400 animate-in zoom-in-50 duration-200">
                                                    <Check className="w-3.5 h-3.5" />
                                                </div>
                                            )}
                                        </button>
                                    )
                                })
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
