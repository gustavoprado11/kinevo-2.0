'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { Plus, ArrowLeft, Play, Square, Trash2, X } from 'lucide-react'
import { useTrainingRoomStore } from '@/stores/training-room-store'
import type { ExerciseData, WorkoutNote } from '@/stores/training-room-store'
import { StudentPickerModal } from '@/components/training-room/student-picker-modal'
import { ExerciseCard } from '@/components/training-room/exercise-card'
import { SupersetGroup } from '@/components/training-room/superset-group'
import { WorkoutNoteCard } from '@/components/training-room/workout-note-card'
import { WorkoutTimer } from '@/components/training-room/workout-timer'
import { WorkoutFeedbackModal } from '@/components/training-room/workout-feedback-modal'
import { finishTrainingRoomWorkout } from '@/actions/training-room/finish-training-room-workout'

interface TrainingRoomClientProps {
    trainerId: string
}

export function TrainingRoomClient({ trainerId }: TrainingRoomClientProps) {
    const sessions = useTrainingRoomStore((s) => s.sessions)
    const activeStudentId = useTrainingRoomStore((s) => s.activeStudentId)
    const clearExpiredSessions = useTrainingRoomStore((s) => s.clearExpiredSessions)
    const startWorkout = useTrainingRoomStore((s) => s.startWorkout)
    const updateSet = useTrainingRoomStore((s) => s.updateSet)
    const toggleSetComplete = useTrainingRoomStore((s) => s.toggleSetComplete)
    const setFinishing = useTrainingRoomStore((s) => s.setFinishing)
    const finishSession = useTrainingRoomStore((s) => s.finishSession)
    const removeStudent = useTrainingRoomStore((s) => s.removeStudent)

    const [isPickerOpen, setIsPickerOpen] = useState(false)
    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const sessionCount = Object.keys(sessions).length
    const activeSession = activeStudentId ? sessions[activeStudentId] : null

    // Clear expired sessions on mount
    useEffect(() => {
        clearExpiredSessions()
    }, [clearExpiredSessions])

    const handleStartWorkout = () => {
        if (!activeStudentId) return
        startWorkout(activeStudentId)
    }

    const handleFinishClick = () => {
        if (!activeStudentId) return
        setFinishing(activeStudentId)
        setIsFeedbackOpen(true)
    }

    const handleConfirmFinish = async (rpe: number | null, feedback: string | null) => {
        if (!activeSession || !activeStudentId) return

        setIsSubmitting(true)

        const result = await finishTrainingRoomWorkout({
            studentId: activeSession.studentId,
            trainerId: activeSession.trainerId,
            assignedWorkoutId: activeSession.assignedWorkoutId,
            assignedProgramId: activeSession.assignedProgramId,
            startedAt: activeSession.startedAt!,
            exercises: activeSession.exercises,
            rpe,
            feedback,
        })

        setIsSubmitting(false)

        if (result.error) {
            alert(`Erro ao salvar: ${result.error}`)
            return
        }

        setIsFeedbackOpen(false)
        finishSession(activeStudentId)
    }

    const handleCancelFeedback = () => {
        if (!activeStudentId) return
        // Revert back to in_progress
        useTrainingRoomStore.getState().startWorkout(activeStudentId)
        setIsFeedbackOpen(false)
    }

    const handleDiscardWorkout = () => {
        if (!activeStudentId) return
        if (!confirm('Descartar treino? Os dados não serão salvos.')) return
        removeStudent(activeStudentId)
    }

    const completedSetsTotal = activeSession
        ? activeSession.exercises.reduce(
              (acc, ex) => acc + ex.setsData.filter((s) => s.completed).length,
              0,
          )
        : 0
    const totalSets = activeSession
        ? activeSession.exercises.reduce((acc, ex) => acc + ex.setsData.length, 0)
        : 0

    return (
        <div className="flex flex-col gap-6">
            {/* Back navigation */}
            <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
            >
                <ArrowLeft size={16} />
                Voltar para Dashboard
            </Link>

            {sessionCount === 0 ? (
                /* Empty state */
                <div className="flex flex-1 items-center justify-center min-h-[60vh]">
                    <div className="text-center">
                        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-glass-bg">
                            <Plus size={32} className="text-violet-400" strokeWidth={1.5} />
                        </div>
                        <h2 className="text-xl font-semibold text-foreground mb-2">
                            Sala de Treino
                        </h2>
                        <p className="text-sm text-muted-foreground mb-8 max-w-sm">
                            Adicione alunos para iniciar sessões de treino presenciais.
                            Os dados serão salvos no histórico do aluno.
                        </p>
                        <button
                            onClick={() => setIsPickerOpen(true)}
                            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-500"
                        >
                            <Plus size={18} strokeWidth={2} />
                            Adicionar Aluno
                        </button>
                    </div>
                </div>
            ) : (
                /* Active sessions view */
                <>
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <h1 className="text-xl font-semibold text-foreground">
                            Sala de Treino
                        </h1>
                        <button
                            onClick={() => setIsPickerOpen(true)}
                            className="inline-flex items-center gap-2 rounded-xl bg-glass-bg px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-glass-bg-hover"
                        >
                            <Plus size={16} strokeWidth={2} />
                            Adicionar Aluno
                        </button>
                    </div>

                    {/* Student tabs */}
                    <div className="flex gap-2 border-b border-k-border-subtle pb-3 overflow-x-auto">
                        {Object.values(sessions).map((session) => (
                            <div
                                key={session.studentId}
                                onClick={() =>
                                    useTrainingRoomStore.getState().setActiveStudent(session.studentId)
                                }
                                className={`group flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors shrink-0 cursor-pointer ${
                                    session.studentId === activeStudentId
                                        ? 'bg-violet-600/20 text-violet-400'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-glass-bg'
                                }`}
                            >
                                {session.studentAvatarUrl ? (
                                    <img
                                        src={session.studentAvatarUrl}
                                        alt=""
                                        className="h-6 w-6 rounded-full object-cover"
                                    />
                                ) : (
                                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-600/30 text-[10px] font-bold text-violet-300">
                                        {session.studentName.charAt(0).toUpperCase()}
                                    </div>
                                )}
                                <span>{session.studentName}</span>
                                {session.status === 'in_progress' && (
                                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                                )}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        if (session.status === 'in_progress') {
                                            if (!window.confirm(`Remover ${session.studentName}? Os dados do treino em andamento serão perdidos.`)) return
                                        }
                                        removeStudent(session.studentId)
                                    }}
                                    className="ml-1 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Active session content */}
                    {activeSession && (
                        <div className="space-y-4">
                            {/* Workout info bar */}
                            <div className="flex items-center justify-between rounded-2xl border border-k-border-subtle bg-surface-card p-4">
                                <div className="flex items-center gap-3">
                                    {activeSession.studentAvatarUrl ? (
                                        <img
                                            src={activeSession.studentAvatarUrl}
                                            alt=""
                                            className="h-10 w-10 rounded-full object-cover"
                                        />
                                    ) : (
                                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-600/20 text-sm font-bold text-violet-300">
                                            {activeSession.studentName.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                    <div>
                                        <p className="text-sm font-semibold text-foreground">
                                            {activeSession.workoutName}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {activeSession.exercises.length} exercício(s) — {completedSetsTotal}/{totalSets} séries
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    {activeSession.status === 'in_progress' && activeSession.startedAt && (
                                        <WorkoutTimer startedAt={activeSession.startedAt} />
                                    )}

                                    {activeSession.status === 'ready' && (
                                        <button
                                            onClick={handleStartWorkout}
                                            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
                                        >
                                            <Play size={14} fill="currentColor" />
                                            Iniciar
                                        </button>
                                    )}

                                    {activeSession.status === 'in_progress' && (
                                        <>
                                            <button
                                                onClick={handleFinishClick}
                                                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-500"
                                            >
                                                <Square size={14} fill="currentColor" />
                                                Concluir
                                            </button>
                                            <button
                                                onClick={handleDiscardWorkout}
                                                className="rounded-xl p-2 text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition-colors"
                                                title="Descartar treino"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Unified workout items: exercises, supersets, and notes ordered by order_index */}
                            <div className="space-y-3">
                                {(() => {
                                    const exercises = activeSession.exercises
                                    const notes = activeSession.workoutNotes || []
                                    const disabled = activeSession.status === 'ready'
                                    const processedSupersets = new Set<string>()

                                    type RenderItem =
                                        | { type: 'exercise'; orderIndex: number; node: React.ReactNode; exerciseFunction?: string | null }
                                        | { type: 'superset'; orderIndex: number; node: React.ReactNode; exerciseFunction?: string | null }
                                        | { type: 'note'; orderIndex: number; node: React.ReactNode }

                                    const items: RenderItem[] = []

                                    exercises.forEach((exercise, ei) => {
                                        if (exercise.supersetId) {
                                            if (processedSupersets.has(exercise.supersetId)) return
                                            processedSupersets.add(exercise.supersetId)

                                            const group = exercises
                                                .map((e, i) => ({ ...e, _gi: i }))
                                                .filter((e) => e.supersetId === exercise.supersetId)

                                            // Use first child's order_index - 0.5 to approximate parent superset position
                                            const groupOrderIndex = Math.min(...group.map((e) => e.order_index)) - 0.5

                                            items.push({
                                                type: 'superset',
                                                orderIndex: groupOrderIndex,
                                                exerciseFunction: group[0]?.exercise_function || null,
                                                node: (
                                                    <SupersetGroup
                                                        key={exercise.supersetId}
                                                        exercises={group}
                                                        supersetRestSeconds={exercise.supersetRestSeconds || 60}
                                                        disabled={disabled}
                                                        onWeightChange={(gi, si, v) =>
                                                            updateSet(activeStudentId!, gi, si, 'weight', v)
                                                        }
                                                        onRepsChange={(gi, si, v) =>
                                                            updateSet(activeStudentId!, gi, si, 'reps', v)
                                                        }
                                                        onToggleComplete={(gi, si) =>
                                                            toggleSetComplete(activeStudentId!, gi, si)
                                                        }
                                                        globalIndexOffset={group[0]._gi}
                                                    />
                                                ),
                                            })
                                        } else {
                                            items.push({
                                                type: 'exercise',
                                                orderIndex: exercise.order_index,
                                                exerciseFunction: exercise.exercise_function || null,
                                                node: (
                                                    <ExerciseCard
                                                        key={exercise.id}
                                                        exercise={exercise}
                                                        exerciseIndex={ei}
                                                        disabled={disabled}
                                                        onWeightChange={(si, v) =>
                                                            updateSet(activeStudentId!, ei, si, 'weight', v)
                                                        }
                                                        onRepsChange={(si, v) =>
                                                            updateSet(activeStudentId!, ei, si, 'reps', v)
                                                        }
                                                        onToggleComplete={(si) =>
                                                            toggleSetComplete(activeStudentId!, ei, si)
                                                        }
                                                    />
                                                ),
                                            })
                                        }
                                    })

                                    // Add notes into unified list
                                    notes.forEach((note) => {
                                        items.push({
                                            type: 'note',
                                            orderIndex: note.order_index,
                                            node: (
                                                <WorkoutNoteCard
                                                    key={note.id}
                                                    note={note.notes}
                                                    isTrainerView
                                                />
                                            ),
                                        })
                                    })

                                    // Sort by order_index so items appear in trainer-defined order
                                    items.sort((a, b) => a.orderIndex - b.orderIndex)

                                    // Insert section headers when exercise_function changes
                                    const FUNCTION_LABELS: Record<string, string> = {
                                        warmup: 'AQUECIMENTO',
                                        activation: 'ATIVAÇÃO',
                                        main: 'PRINCIPAL',
                                        accessory: 'ACESSÓRIO',
                                        conditioning: 'CONDICIONAMENTO',
                                    }

                                    const hasAnyFunction = exercises.some(e => e.exercise_function)
                                    const finalNodes: React.ReactNode[] = []

                                    if (hasAnyFunction) {
                                        let lastFunction: string | null | undefined = undefined
                                        items.forEach((item, idx) => {
                                            const itemFunction = item.type !== 'note' ? (item as any).exerciseFunction : null

                                            if (item.type !== 'note' && itemFunction && itemFunction !== lastFunction) {
                                                finalNodes.push(
                                                    <div key={`section-${itemFunction}-${idx}`} className="flex items-center gap-3 pt-4 pb-1">
                                                        <span className="text-[10px] font-bold text-muted-foreground/50">
                                                            {FUNCTION_LABELS[itemFunction] || itemFunction}
                                                        </span>
                                                        <div className="flex-1 h-px bg-k-border-subtle" />
                                                    </div>
                                                )
                                                lastFunction = itemFunction
                                            }

                                            finalNodes.push(item.node)
                                        })
                                    } else {
                                        items.forEach((item) => finalNodes.push(item.node))
                                    }

                                    return finalNodes
                                })()}
                            </div>

                            {/* Bottom actions (visible when in_progress) */}
                            {activeSession.status === 'in_progress' && (
                                <div className="flex justify-center gap-3 pt-4 pb-8">
                                    <button
                                        onClick={handleFinishClick}
                                        className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-500"
                                    >
                                        Concluir Treino
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* Student Picker Modal */}
            <StudentPickerModal
                isOpen={isPickerOpen}
                onClose={() => setIsPickerOpen(false)}
                trainerId={trainerId}
            />

            {/* Feedback Modal */}
            {activeSession && (
                <WorkoutFeedbackModal
                    isOpen={isFeedbackOpen}
                    studentName={activeSession.studentName}
                    workoutName={activeSession.workoutName}
                    isSubmitting={isSubmitting}
                    onConfirm={handleConfirmFinish}
                    onCancel={handleCancelFeedback}
                />
            )}
        </div>
    )
}
