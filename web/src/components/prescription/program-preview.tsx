'use client'

import { useState, useCallback } from 'react'
import {
    Check, X, AlertTriangle, ChevronDown, ChevronUp,
    Pencil, Loader2, Brain, Zap, Dumbbell,
    Clock, Shield, Info,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

import type { AiMode, AiSource, RulesViolation } from '@kinevo/shared/types/prescription'
import type { PreviewProgramData, PreviewWorkout, PreviewWorkoutItem } from '@/actions/prescription/get-program-preview'

// ============================================================================
// Props
// ============================================================================

interface ProgramPreviewProps {
    program: PreviewProgramData
    aiMode: AiMode
    source: AiSource
    violations?: RulesViolation[]
    onApprove: () => Promise<void>
    onReject: (reason?: string) => Promise<void>
    onUpdateItem: (
        itemId: string,
        updates: { sets?: number; reps?: string; rest_seconds?: number; notes?: string | null },
    ) => Promise<void>
}

// ============================================================================
// Component
// ============================================================================

export function ProgramPreview({
    program,
    aiMode,
    source,
    violations,
    onApprove,
    onReject,
    onUpdateItem,
}: ProgramPreviewProps) {
    const [approving, setApproving] = useState(false)
    const [rejecting, setRejecting] = useState(false)
    const [rejectReason, setRejectReason] = useState('')
    const [showRejectInput, setShowRejectInput] = useState(false)
    const [expandedWorkouts, setExpandedWorkouts] = useState<Set<string>>(
        () => new Set(program.workouts.map(w => w.id))
    )
    const [editingItem, setEditingItem] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const toggleWorkout = useCallback((workoutId: string) => {
        setExpandedWorkouts(prev => {
            const next = new Set(prev)
            if (next.has(workoutId)) next.delete(workoutId)
            else next.add(workoutId)
            return next
        })
    }, [])

    // ── Approve ──
    const handleApprove = useCallback(async () => {
        setApproving(true)
        setError(null)
        try {
            await onApprove()
        } catch {
            setError('Erro ao aprovar programa.')
        } finally {
            setApproving(false)
        }
    }, [onApprove])

    // ── Reject ──
    const handleReject = useCallback(async () => {
        setRejecting(true)
        setError(null)
        try {
            await onReject(rejectReason.trim() || undefined)
        } catch {
            setError('Erro ao rejeitar programa.')
        } finally {
            setRejecting(false)
        }
    }, [onReject, rejectReason])

    const warnings = violations?.filter(v => v.severity === 'warning') || []
    const errors = violations?.filter(v => v.severity === 'error') || []

    return (
        <div className="space-y-4">
            {/* ── Header Card: Program Info + Badges ── */}
            <div className="bg-glass-bg backdrop-blur-md rounded-2xl border border-k-border-primary p-6">
                <div className="flex items-start justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-k-text-primary">{program.name}</h2>
                        {program.description && (
                            <p className="text-sm text-k-text-tertiary mt-1">{program.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-3">
                            <span className="text-xs text-k-text-quaternary">
                                {program.workouts.length} treino{program.workouts.length !== 1 ? 's' : ''} &middot;{' '}
                                {program.duration_weeks ? `${program.duration_weeks} semanas` : 'Sem duração definida'}
                            </span>
                        </div>
                    </div>

                    {/* Source + Mode badges */}
                    <div className="flex gap-2 flex-shrink-0">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full border ${
                            source === 'llm'
                                ? 'bg-violet-500/10 text-violet-400 border-violet-500/20'
                                : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                        }`}>
                            {source === 'llm' ? <Brain className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
                            {source === 'llm' ? 'IA' : 'Heurístico'}
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                            <Shield className="w-3 h-3" />
                            {aiMode === 'auto' ? 'Auto' : aiMode === 'copilot' ? 'Copiloto' : 'Assistente'}
                        </span>
                    </div>
                </div>
            </div>

            {/* ── Violations ── */}
            {errors.length > 0 && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 space-y-2">
                    <div className="flex items-center gap-2 text-red-400 text-sm font-semibold">
                        <AlertTriangle className="w-4 h-4" />
                        Erros de validação
                    </div>
                    {errors.map((v, i) => (
                        <p key={i} className="text-xs text-red-300 ml-6">
                            {v.description} {v.auto_fixed && '(corrigido automaticamente)'}
                        </p>
                    ))}
                </div>
            )}

            {warnings.length > 0 && (
                <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 space-y-2">
                    <div className="flex items-center gap-2 text-amber-400 text-sm font-semibold">
                        <Info className="w-4 h-4" />
                        Avisos
                    </div>
                    {warnings.map((v, i) => (
                        <p key={i} className="text-xs text-amber-300 ml-6">
                            {v.description}
                        </p>
                    ))}
                </div>
            )}

            {/* ── Workout Cards ── */}
            {program.workouts
                .sort((a, b) => a.order_index - b.order_index)
                .map(workout => (
                    <WorkoutCard
                        key={workout.id}
                        workout={workout}
                        expanded={expandedWorkouts.has(workout.id)}
                        onToggle={() => toggleWorkout(workout.id)}
                        editingItem={editingItem}
                        onEditItem={setEditingItem}
                        onUpdateItem={onUpdateItem}
                    />
                ))}

            {/* ── Error ── */}
            {error && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400">
                    {error}
                </div>
            )}

            {/* ── Approve / Reject ── */}
            <div className="bg-glass-bg backdrop-blur-md rounded-2xl border border-k-border-primary p-6">
                {showRejectInput && (
                    <div className="mb-4">
                        <label className="mb-1.5 block text-[11px] font-bold text-k-text-tertiary uppercase tracking-widest">
                            Motivo da rejeição (opcional)
                        </label>
                        <textarea
                            value={rejectReason}
                            onChange={e => setRejectReason(e.target.value)}
                            rows={2}
                            placeholder="Ex: Volume muito alto para este aluno..."
                            className="w-full px-4 py-3 bg-glass-bg border border-k-border-subtle rounded-xl text-k-text-primary placeholder:text-k-text-quaternary focus:outline-none focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500/50 transition-all resize-none text-sm"
                        />
                    </div>
                )}

                <div className="flex items-center gap-3">
                    <Button
                        onClick={handleApprove}
                        disabled={approving || rejecting}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2 flex-1"
                    >
                        {approving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Check className="w-4 h-4" />
                        )}
                        {approving ? 'Aprovando...' : 'Aprovar e Ativar'}
                    </Button>

                    {!showRejectInput ? (
                        <Button
                            variant="outline"
                            onClick={() => setShowRejectInput(true)}
                            disabled={approving || rejecting}
                            className="gap-2"
                        >
                            <X className="w-4 h-4" />
                            Rejeitar
                        </Button>
                    ) : (
                        <div className="flex gap-2">
                            <Button
                                variant="destructive"
                                onClick={handleReject}
                                disabled={approving || rejecting}
                                className="gap-2"
                            >
                                {rejecting ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <X className="w-4 h-4" />
                                )}
                                Confirmar Rejeição
                            </Button>
                            <Button
                                variant="ghost"
                                onClick={() => { setShowRejectInput(false); setRejectReason('') }}
                                disabled={rejecting}
                            >
                                Cancelar
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

// ============================================================================
// WorkoutCard — Sub-component
// ============================================================================

interface WorkoutCardProps {
    workout: PreviewWorkout
    expanded: boolean
    onToggle: () => void
    editingItem: string | null
    onEditItem: (itemId: string | null) => void
    onUpdateItem: (
        itemId: string,
        updates: { sets?: number; reps?: string; rest_seconds?: number; notes?: string | null },
    ) => Promise<void>
}

function WorkoutCard({ workout, expanded, onToggle, editingItem, onEditItem, onUpdateItem }: WorkoutCardProps) {
    const totalSets = workout.items.reduce((sum, item) => sum + item.sets, 0)
    const muscleGroups = [...new Set(workout.items.map(i => i.exercise_muscle_group))].filter(Boolean)

    return (
        <div className="bg-glass-bg backdrop-blur-md rounded-2xl border border-k-border-primary overflow-hidden">
            {/* Workout Header */}
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-glass-bg-hover transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-violet-500/15 border border-violet-500/30 flex items-center justify-center">
                        <Dumbbell className="w-4 h-4 text-violet-400" />
                    </div>
                    <div className="text-left">
                        <h3 className="text-sm font-bold text-k-text-primary">{workout.name}</h3>
                        <p className="text-[11px] text-k-text-quaternary">
                            {workout.items.length} exercício{workout.items.length !== 1 ? 's' : ''} &middot; {totalSets} séries totais
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {/* Muscle group tags */}
                    <div className="hidden sm:flex gap-1.5">
                        {muscleGroups.slice(0, 3).map(mg => (
                            <span
                                key={mg}
                                className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-violet-500/10 text-violet-400 border border-violet-500/20"
                            >
                                {mg}
                            </span>
                        ))}
                        {muscleGroups.length > 3 && (
                            <span className="px-2 py-0.5 text-[10px] font-bold text-k-text-quaternary">
                                +{muscleGroups.length - 3}
                            </span>
                        )}
                    </div>
                    {expanded ? (
                        <ChevronUp className="w-4 h-4 text-k-text-quaternary" />
                    ) : (
                        <ChevronDown className="w-4 h-4 text-k-text-quaternary" />
                    )}
                </div>
            </button>

            {/* Exercise List */}
            {expanded && (
                <div className="border-t border-k-border-subtle">
                    {workout.items
                        .sort((a, b) => a.order_index - b.order_index)
                        .map((item, index) => (
                            <ExerciseRow
                                key={item.id}
                                item={item}
                                index={index}
                                isEditing={editingItem === item.id}
                                onEdit={() => onEditItem(item.id)}
                                onCancel={() => onEditItem(null)}
                                onSave={onUpdateItem}
                            />
                        ))}
                </div>
            )}
        </div>
    )
}

// ============================================================================
// ExerciseRow — Sub-component with inline editing
// ============================================================================

interface ExerciseRowProps {
    item: PreviewWorkoutItem
    index: number
    isEditing: boolean
    onEdit: () => void
    onCancel: () => void
    onSave: (
        itemId: string,
        updates: { sets?: number; reps?: string; rest_seconds?: number; notes?: string | null },
    ) => Promise<void>
}

function ExerciseRow({ item, index, isEditing, onEdit, onCancel, onSave }: ExerciseRowProps) {
    const [sets, setSets] = useState(item.sets)
    const [reps, setReps] = useState(item.reps)
    const [restSeconds, setRestSeconds] = useState(item.rest_seconds)
    const [notes, setNotes] = useState(item.notes || '')
    const [saving, setSaving] = useState(false)

    const handleSave = useCallback(async () => {
        setSaving(true)
        try {
            await onSave(item.id, {
                sets,
                reps,
                rest_seconds: restSeconds,
                notes: notes.trim() || null,
            })
            onCancel()
        } finally {
            setSaving(false)
        }
    }, [item.id, sets, reps, restSeconds, notes, onSave, onCancel])

    if (isEditing) {
        return (
            <div className="px-6 py-4 border-b border-k-border-subtle last:border-b-0 bg-violet-500/5">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <span className="text-sm font-semibold text-k-text-primary">{item.exercise_name}</span>
                        <span className="text-[11px] text-k-text-quaternary ml-2">{item.exercise_muscle_group}</span>
                    </div>
                    <div className="flex gap-2">
                        <Button size="sm" onClick={handleSave} disabled={saving} className="bg-violet-600 hover:bg-violet-500 text-white gap-1.5 h-7 text-xs">
                            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                            Salvar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={onCancel} disabled={saving} className="h-7 text-xs">
                            Cancelar
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                    <div>
                        <label className="block text-[10px] font-bold text-k-text-tertiary uppercase tracking-wider mb-1">Séries</label>
                        <input
                            type="number"
                            min={1}
                            max={10}
                            value={sets}
                            onChange={e => setSets(Number(e.target.value))}
                            className="w-full rounded-lg border border-k-border-subtle bg-glass-bg px-3 py-2 text-sm text-k-text-primary focus:outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/10"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-k-text-tertiary uppercase tracking-wider mb-1">Reps</label>
                        <input
                            type="text"
                            value={reps}
                            onChange={e => setReps(e.target.value)}
                            placeholder="8-12"
                            className="w-full rounded-lg border border-k-border-subtle bg-glass-bg px-3 py-2 text-sm text-k-text-primary focus:outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/10"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-k-text-tertiary uppercase tracking-wider mb-1">Descanso (s)</label>
                        <input
                            type="number"
                            min={15}
                            max={300}
                            step={15}
                            value={restSeconds}
                            onChange={e => setRestSeconds(Number(e.target.value))}
                            className="w-full rounded-lg border border-k-border-subtle bg-glass-bg px-3 py-2 text-sm text-k-text-primary focus:outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/10"
                        />
                    </div>
                </div>

                <div className="mt-3">
                    <label className="block text-[10px] font-bold text-k-text-tertiary uppercase tracking-wider mb-1">Notas</label>
                    <input
                        type="text"
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        placeholder="Observações para o aluno..."
                        className="w-full rounded-lg border border-k-border-subtle bg-glass-bg px-3 py-2 text-sm text-k-text-primary placeholder:text-k-text-quaternary focus:outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/10"
                    />
                </div>
            </div>
        )
    }

    return (
        <div className="group flex items-center gap-4 px-6 py-3 border-b border-k-border-subtle last:border-b-0 hover:bg-glass-bg-hover transition-colors">
            {/* Index */}
            <span className="w-5 text-center text-[11px] font-bold text-k-text-quaternary">
                {index + 1}
            </span>

            {/* Exercise info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-k-text-primary truncate">{item.exercise_name}</span>
                    {item.exercise_equipment && (
                        <span className="text-[10px] text-k-text-quaternary hidden sm:inline">
                            {item.exercise_equipment}
                        </span>
                    )}
                </div>
                <span className="text-[11px] text-k-text-quaternary">{item.exercise_muscle_group}</span>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 text-sm text-k-text-secondary">
                <div className="text-center">
                    <span className="font-bold">{item.sets}</span>
                    <span className="text-[10px] text-k-text-quaternary ml-0.5">&times;</span>
                    <span className="font-bold ml-0.5">{item.reps}</span>
                </div>
                <div className="flex items-center gap-1 text-k-text-quaternary">
                    <Clock className="w-3 h-3" />
                    <span className="text-xs">{item.rest_seconds}s</span>
                </div>
            </div>

            {/* Edit button */}
            <button
                onClick={onEdit}
                className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-violet-500/10 text-k-text-quaternary hover:text-violet-400 transition-all"
            >
                <Pencil className="w-3.5 h-3.5" />
            </button>
        </div>
    )
}
