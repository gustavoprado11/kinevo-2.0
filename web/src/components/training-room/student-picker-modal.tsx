'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Search, User, Dumbbell, ChevronRight } from 'lucide-react'
import { getTrainingRoomStudents, type TrainingRoomStudent, type WorkoutOption } from '@/actions/training-room/get-training-room-students'
import { getStudentTodayWorkout } from '@/actions/training-room/get-student-today-workout'
import { getWorkoutFormTriggers } from '@/actions/training-room/get-workout-form-triggers'
import { useTrainingRoomStore, type SessionSetupData } from '@/stores/training-room-store'

function formatRelativeDate(isoDate: string): string {
    const date = new Date(isoDate)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'hoje'
    if (diffDays === 1) return 'ontem'
    if (diffDays < 7) return `${diffDays} dias atrás`
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

interface StudentPickerModalProps {
    isOpen: boolean
    onClose: () => void
    trainerId: string
}

export function StudentPickerModal({ isOpen, onClose, trainerId }: StudentPickerModalProps) {
    const [students, setStudents] = useState<TrainingRoomStudent[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [search, setSearch] = useState('')
    const [selectedStudent, setSelectedStudent] = useState<TrainingRoomStudent | null>(null)
    const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null)
    const [isAdding, setIsAdding] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const sessions = useTrainingRoomStore((s) => s.sessions)
    const addStudent = useTrainingRoomStore((s) => s.addStudent)

    const fetchStudents = useCallback(async () => {
        setIsLoading(true)
        const result = await getTrainingRoomStudents()
        if (result.data) {
            setStudents(result.data)
        }
        setIsLoading(false)
    }, [])

    useEffect(() => {
        if (isOpen) {
            fetchStudents()
            setSelectedStudent(null)
            setSelectedWorkoutId(null)
            setSearch('')
            setError(null)
        }
    }, [isOpen, fetchStudents])

    if (!isOpen) return null

    const alreadyInRoom = new Set(Object.keys(sessions))

    const filtered = students.filter((s) => {
        if (alreadyInRoom.has(s.id)) return false
        if (!search) return true
        return s.name.toLowerCase().includes(search.toLowerCase())
    })

    const handleSelectStudent = (student: TrainingRoomStudent) => {
        setSelectedStudent(student)
        setError(null)

        // Auto-select today's workout if there's exactly one
        if (student.todayWorkouts.length === 1) {
            setSelectedWorkoutId(student.todayWorkouts[0].id)
        } else {
            setSelectedWorkoutId(null)
        }
    }

    const handleConfirm = async () => {
        if (!selectedStudent || !selectedWorkoutId) return

        setIsAdding(true)
        setError(null)

        const result = await getStudentTodayWorkout(selectedStudent.id, selectedWorkoutId)

        if (result.error || !result.data) {
            setError(result.error || 'Erro ao carregar treino')
            setIsAdding(false)
            return
        }

        // Fetch form triggers for the program
        let preWorkoutTrigger = null
        let postWorkoutTrigger = null

        if (result.data.assignedProgramId) {
            const triggerResult = await getWorkoutFormTriggers(result.data.assignedProgramId)
            if (triggerResult.success && triggerResult.data) {
                preWorkoutTrigger = triggerResult.data.preWorkout
                    ? {
                          formTemplateId: triggerResult.data.preWorkout.formTemplateId,
                          title: triggerResult.data.preWorkout.title,
                          schemaJson: triggerResult.data.preWorkout.schemaJson,
                      }
                    : null
                postWorkoutTrigger = triggerResult.data.postWorkout
                    ? {
                          formTemplateId: triggerResult.data.postWorkout.formTemplateId,
                          title: triggerResult.data.postWorkout.title,
                          schemaJson: triggerResult.data.postWorkout.schemaJson,
                      }
                    : null
            }
        }

        const setupData: SessionSetupData = {
            studentName: selectedStudent.name,
            studentAvatarUrl: selectedStudent.avatar_url,
            assignedWorkoutId: selectedWorkoutId,
            assignedProgramId: result.data.assignedProgramId,
            trainerId,
            workoutName: result.data.workoutName,
            exercises: result.data.exercises,
            workoutNotes: result.data.workoutNotes,
            preWorkoutTrigger,
            postWorkoutTrigger,
            scheduledDays: selectedStudent.workoutOptions.find((w) => w.id === selectedWorkoutId)?.scheduledDays ?? null,
            weeklyCompleted: selectedStudent.weeklyCompleted,
            weeklyExpected: selectedStudent.weeklyExpected,
        }

        addStudent(selectedStudent.id, setupData)
        setIsAdding(false)
        onClose()
    }

    const selectedWorkoutOption = selectedStudent?.workoutOptions.find((w) => w.id === selectedWorkoutId)

    return (
        <div className="fixed inset-0 z-modal flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/30 dark:bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-lg rounded-2xl border border-[#D2D2D7] dark:border-k-border-subtle bg-white dark:bg-surface-card shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-2xl mx-4">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-[#E8E8ED] dark:border-k-border-subtle p-5">
                    <h2 className="text-lg font-semibold text-[#1D1D1F] dark:text-foreground">
                        {selectedStudent ? 'Escolher Treino' : 'Adicionar Aluno'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="rounded-full p-1.5 text-[#AEAEB2] dark:text-muted-foreground hover:bg-[#F5F5F7] dark:hover:bg-glass-bg hover:text-[#6E6E73] dark:hover:text-foreground transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-5">
                    {!selectedStudent ? (
                        /* Step 1: Select student */
                        <>
                            {/* Search */}
                            <div className="relative mb-4">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#AEAEB2] dark:text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="Buscar aluno..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full rounded-lg border border-[#D2D2D7] dark:border-k-border-subtle bg-white dark:bg-glass-bg py-2.5 pl-10 pr-4 text-sm text-[#1D1D1F] dark:text-foreground placeholder:text-[#AEAEB2] dark:placeholder:text-muted-foreground/60 focus:border-[#007AFF] dark:focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-[#007AFF]/20 dark:focus:ring-violet-500/50"
                                    autoFocus
                                />
                            </div>

                            {/* Student list */}
                            <div className="max-h-[360px] overflow-y-auto space-y-1 -mx-1 px-1">
                                {isLoading ? (
                                    <div className="flex items-center justify-center py-12">
                                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#007AFF] dark:border-violet-500 border-t-transparent" />
                                    </div>
                                ) : filtered.length === 0 ? (
                                    <p className="py-8 text-center text-sm text-[#86868B] dark:text-muted-foreground">
                                        {search ? 'Nenhum aluno encontrado' : 'Nenhum aluno disponível'}
                                    </p>
                                ) : (
                                    filtered.map((student) => (
                                        <button
                                            key={student.id}
                                            onClick={() => handleSelectStudent(student)}
                                            className="group w-full flex items-center gap-3 rounded-xl p-3 text-left transition-colors hover:bg-[#F5F5F7] dark:hover:bg-glass-bg"
                                        >
                                            {/* Avatar */}
                                            {student.avatar_url ? (
                                                <img
                                                    src={student.avatar_url}
                                                    alt=""
                                                    className="h-10 w-10 rounded-full object-cover"
                                                />
                                            ) : (
                                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F5F5F7] dark:bg-violet-600/20 border border-[#E8E8ED] dark:border-transparent text-sm font-bold text-[#6E6E73] dark:text-violet-300">
                                                    {student.name.charAt(0).toUpperCase()}
                                                </div>
                                            )}

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-[#1D1D1F] dark:text-foreground truncate">
                                                    {student.name}
                                                </p>
                                                <p className="text-xs text-[#86868B] dark:text-muted-foreground truncate">
                                                    {student.program
                                                        ? student.todayWorkouts.length > 0
                                                            ? `Hoje: ${student.todayWorkouts.map((w) => w.name).join(', ')}`
                                                            : student.program.name
                                                        : 'Sem programa ativo'}
                                                </p>
                                            </div>

                                            {/* Weekly progress badge */}
                                            {student.program && student.weeklyExpected > 0 && (
                                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md shrink-0 ${
                                                    student.weeklyCompleted >= student.weeklyExpected
                                                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400'
                                                        : student.pendingCount > 0
                                                            ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400'
                                                            : 'bg-slate-50 text-slate-500 dark:bg-white/5 dark:text-muted-foreground'
                                                }`}>
                                                    {student.weeklyCompleted}/{student.weeklyExpected}
                                                </span>
                                            )}

                                            {/* Status indicator */}
                                            {student.program && (
                                                <div className={`h-2 w-2 rounded-full shrink-0 ${student.todayWorkouts.length > 0 ? 'bg-[#34C759] dark:bg-emerald-400' : student.pendingCount > 0 ? 'bg-amber-400 dark:bg-amber-400' : 'bg-[#AEAEB2] dark:bg-muted-foreground/30'}`} />
                                            )}

                                            <ChevronRight size={16} className="text-[#AEAEB2] dark:text-muted-foreground/40 transition-transform group-hover:translate-x-0.5" />
                                        </button>
                                    ))
                                )}
                            </div>
                        </>
                    ) : (
                        /* Step 2: Select workout */
                        <>
                            {/* Back to students */}
                            <button
                                onClick={() => setSelectedStudent(null)}
                                className="mb-4 flex items-center gap-2 text-xs text-[#007AFF] dark:text-muted-foreground hover:text-[#0056B3] dark:hover:text-violet-400 transition-colors"
                            >
                                <ChevronRight size={14} className="rotate-180" />
                                Voltar para lista de alunos
                            </button>

                            {/* Selected student header */}
                            <div className="flex items-center gap-3 mb-5 p-3 rounded-xl bg-[#F5F5F7] dark:bg-glass-bg">
                                {selectedStudent.avatar_url ? (
                                    <img
                                        src={selectedStudent.avatar_url}
                                        alt=""
                                        className="h-10 w-10 rounded-full object-cover"
                                    />
                                ) : (
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F5F5F7] dark:bg-violet-600/20 border border-[#E8E8ED] dark:border-transparent text-sm font-bold text-[#6E6E73] dark:text-violet-300">
                                        {selectedStudent.name.charAt(0).toUpperCase()}
                                    </div>
                                )}
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-[#1D1D1F] dark:text-foreground">{selectedStudent.name}</p>
                                    <p className="text-xs text-[#86868B] dark:text-muted-foreground">{selectedStudent.program?.name || 'Programa'}</p>
                                </div>
                                {selectedStudent.weeklyExpected > 0 && (
                                    <div className="text-right">
                                        <p className={`text-xs font-semibold ${
                                            selectedStudent.weeklyCompleted >= selectedStudent.weeklyExpected
                                                ? 'text-emerald-600 dark:text-emerald-400'
                                                : 'text-[#1D1D1F] dark:text-foreground'
                                        }`}>
                                            {selectedStudent.weeklyCompleted}/{selectedStudent.weeklyExpected}
                                        </p>
                                        <p className="text-[10px] text-[#86868B] dark:text-muted-foreground">
                                            semana
                                        </p>
                                    </div>
                                )}
                            </div>

                            {!selectedStudent.program ? (
                                <p className="py-8 text-center text-sm text-[#86868B] dark:text-muted-foreground">
                                    Este aluno não possui um programa ativo.
                                </p>
                            ) : selectedStudent.workoutOptions.length === 0 ? (
                                <p className="py-8 text-center text-sm text-[#86868B] dark:text-muted-foreground">
                                    Nenhum treino encontrado neste programa.
                                </p>
                            ) : (
                                <>
                                    {/* Today section */}
                                    {selectedStudent.todayWorkouts.length > 0 && (
                                        <div className="mb-4">
                                            <p className="text-[11px] font-semibold text-[#34C759] dark:text-emerald-400/80 mb-2">
                                                Treino do dia
                                            </p>
                                            <div className="space-y-1">
                                                {selectedStudent.todayWorkouts.map((wo) => (
                                                    <WorkoutOptionButton
                                                        key={wo.id}
                                                        workout={wo}
                                                        isSelected={selectedWorkoutId === wo.id}
                                                        onSelect={() => setSelectedWorkoutId(wo.id)}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Pending section */}
                                    {selectedStudent.workoutOptions.filter((w) => !w.isToday && w.isPending).length > 0 && (
                                        <div className="mb-4">
                                            <p className="text-[11px] font-semibold text-amber-500 dark:text-amber-400/80 mb-2">
                                                Pendentes da semana
                                            </p>
                                            <div className="space-y-1">
                                                {selectedStudent.workoutOptions
                                                    .filter((w) => !w.isToday && w.isPending)
                                                    .map((wo) => (
                                                        <WorkoutOptionButton
                                                            key={wo.id}
                                                            workout={wo}
                                                            isSelected={selectedWorkoutId === wo.id}
                                                            onSelect={() => setSelectedWorkoutId(wo.id)}
                                                        />
                                                    ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Other workouts section */}
                                    {selectedStudent.workoutOptions.filter((w) => !w.isToday && !w.isPending).length > 0 && (
                                        <div>
                                            <p className="text-[11px] font-semibold text-[#86868B] dark:text-muted-foreground/60 mb-2">
                                                {selectedStudent.todayWorkouts.length > 0 || selectedStudent.pendingCount > 0 ? 'Outros treinos' : 'Escolher treino'}
                                            </p>
                                            <div className="space-y-1">
                                                {selectedStudent.workoutOptions
                                                    .filter((w) => !w.isToday && !w.isPending)
                                                    .map((wo) => (
                                                        <WorkoutOptionButton
                                                            key={wo.id}
                                                            workout={wo}
                                                            isSelected={selectedWorkoutId === wo.id}
                                                            onSelect={() => setSelectedWorkoutId(wo.id)}
                                                        />
                                                    ))}
                                            </div>
                                        </div>
                                    )}

                                    {error && (
                                        <p className="mt-3 text-xs text-[#FF3B30] dark:text-red-400">{error}</p>
                                    )}
                                </>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                {selectedStudent && selectedStudent.program && selectedStudent.workoutOptions.length > 0 && (
                    <div className="border-t border-[#E8E8ED] dark:border-k-border-subtle p-5">
                        <button
                            onClick={handleConfirm}
                            disabled={!selectedWorkoutId || isAdding}
                            className="w-full rounded-full bg-[#007AFF] dark:bg-violet-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0066D6] dark:hover:bg-violet-500 disabled:bg-[#D2D2D7] dark:disabled:bg-violet-600 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {isAdding ? (
                                <span className="flex items-center justify-center gap-2">
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                    Carregando treino...
                                </span>
                            ) : (
                                `Adicionar${selectedWorkoutOption ? ` — ${selectedWorkoutOption.name}` : ''}`
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

function WorkoutOptionButton({
    workout,
    isSelected,
    onSelect,
}: {
    workout: WorkoutOption
    isSelected: boolean
    onSelect: () => void
}) {
    const isFullyDone = workout.weeklyExpected > 0 && workout.weeklyCompleted >= workout.weeklyExpected
    const isPartial = workout.weeklyExpected > 0 && workout.weeklyCompleted > 0 && workout.weeklyCompleted < workout.weeklyExpected

    return (
        <button
            onClick={onSelect}
            className={`
                w-full flex items-center gap-3 rounded-xl p-3 text-left transition-all
                ${isSelected
                    ? 'bg-[#007AFF]/5 dark:bg-violet-600/20 border-2 border-[#007AFF] dark:border-violet-500/40'
                    : workout.isPending
                        ? 'bg-amber-50/50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 hover:bg-amber-50 dark:hover:bg-amber-500/10'
                        : 'bg-white dark:bg-glass-bg border border-[#E8E8ED] dark:border-transparent hover:bg-[#F5F5F7] dark:hover:bg-glass-bg-hover hover:border-[#D2D2D7]'
                }
            `}
        >
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${
                isSelected ? 'bg-[#007AFF]/10 dark:bg-violet-600/30'
                    : isFullyDone ? 'bg-emerald-50 dark:bg-emerald-500/15'
                    : workout.isPending ? 'bg-amber-50 dark:bg-amber-500/15'
                    : 'bg-[#F5F5F7] dark:bg-glass-bg'
            }`}>
                {isFullyDone ? (
                    <svg className="h-4 w-4 text-emerald-500 dark:text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                ) : (
                    <Dumbbell size={16} className={
                        isSelected ? 'text-[#007AFF] dark:text-violet-400'
                            : workout.isPending ? 'text-amber-500 dark:text-amber-400'
                            : 'text-[#AEAEB2] dark:text-muted-foreground'
                    } />
                )}
            </div>
            <div className="flex-1 min-w-0">
                <span className={`text-sm font-medium block truncate ${
                    isSelected ? 'text-[#007AFF] dark:text-violet-300'
                        : isFullyDone ? 'text-[#86868B] dark:text-muted-foreground'
                        : 'text-[#1D1D1F] dark:text-foreground'
                }`}>
                    {workout.name}
                </span>
                <div className="flex items-center gap-2">
                    {workout.isPending && workout.pendingFromDay && (
                        <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                            Pendente — era {workout.pendingFromDay}
                        </span>
                    )}
                    {!workout.isPending && workout.lastCompletedAt && (
                        <span className="text-[11px] text-[#86868B] dark:text-muted-foreground/60">
                            Último: {formatRelativeDate(workout.lastCompletedAt)}
                        </span>
                    )}
                </div>
            </div>
            {/* Weekly progress badge */}
            {workout.weeklyExpected > 0 && (
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md shrink-0 ${
                    isFullyDone
                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400'
                        : isPartial
                            ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400'
                            : 'bg-slate-50 text-slate-500 dark:bg-white/5 dark:text-muted-foreground'
                }`}>
                    {workout.weeklyCompleted}/{workout.weeklyExpected}
                </span>
            )}
            {isSelected && (
                <div className="ml-auto h-2 w-2 rounded-full bg-[#007AFF] dark:bg-violet-400 shrink-0" />
            )}
        </button>
    )
}
