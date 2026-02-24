'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Search, User, Dumbbell, ChevronRight } from 'lucide-react'
import { getTrainingRoomStudents, type TrainingRoomStudent, type WorkoutOption } from '@/actions/training-room/get-training-room-students'
import { getStudentTodayWorkout } from '@/actions/training-room/get-student-today-workout'
import { useTrainingRoomStore, type SessionSetupData } from '@/stores/training-room-store'

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

        const setupData: SessionSetupData = {
            studentName: selectedStudent.name,
            studentAvatarUrl: selectedStudent.avatar_url,
            assignedWorkoutId: selectedWorkoutId,
            assignedProgramId: result.data.assignedProgramId,
            trainerId,
            workoutName: result.data.workoutName,
            exercises: result.data.exercises,
        }

        addStudent(selectedStudent.id, setupData)
        setIsAdding(false)
        onClose()
    }

    const selectedWorkoutOption = selectedStudent?.workoutOptions.find((w) => w.id === selectedWorkoutId)

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-lg rounded-2xl border border-k-border-subtle bg-surface-card shadow-2xl mx-4">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-k-border-subtle p-5">
                    <h2 className="text-lg font-semibold text-foreground">
                        {selectedStudent ? 'Escolher Treino' : 'Adicionar Aluno'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-glass-bg hover:text-foreground transition-colors"
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
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="Buscar aluno..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full rounded-xl border border-k-border-subtle bg-glass-bg py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                                    autoFocus
                                />
                            </div>

                            {/* Student list */}
                            <div className="max-h-[360px] overflow-y-auto space-y-1 -mx-1 px-1">
                                {isLoading ? (
                                    <div className="flex items-center justify-center py-12">
                                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
                                    </div>
                                ) : filtered.length === 0 ? (
                                    <p className="py-8 text-center text-sm text-muted-foreground">
                                        {search ? 'Nenhum aluno encontrado' : 'Nenhum aluno disponível'}
                                    </p>
                                ) : (
                                    filtered.map((student) => (
                                        <button
                                            key={student.id}
                                            onClick={() => handleSelectStudent(student)}
                                            className="group w-full flex items-center gap-3 rounded-xl p-3 text-left transition-colors hover:bg-glass-bg"
                                        >
                                            {/* Avatar */}
                                            {student.avatar_url ? (
                                                <img
                                                    src={student.avatar_url}
                                                    alt=""
                                                    className="h-10 w-10 rounded-full object-cover"
                                                />
                                            ) : (
                                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-600/20 text-sm font-bold text-violet-300">
                                                    {student.name.charAt(0).toUpperCase()}
                                                </div>
                                            )}

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-foreground truncate">
                                                    {student.name}
                                                </p>
                                                <p className="text-xs text-muted-foreground truncate">
                                                    {student.program
                                                        ? student.todayWorkouts.length > 0
                                                            ? `Hoje: ${student.todayWorkouts.map((w) => w.name).join(', ')}`
                                                            : student.program.name
                                                        : 'Sem programa ativo'}
                                                </p>
                                            </div>

                                            {/* Status indicator */}
                                            {student.program && (
                                                <div className={`h-2 w-2 rounded-full ${student.todayWorkouts.length > 0 ? 'bg-emerald-400' : 'bg-muted-foreground/30'}`} />
                                            )}

                                            <ChevronRight size={16} className="text-muted-foreground/40 transition-transform group-hover:translate-x-0.5" />
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
                                className="mb-4 flex items-center gap-2 text-xs text-muted-foreground hover:text-violet-400 transition-colors"
                            >
                                <ChevronRight size={14} className="rotate-180" />
                                Voltar para lista de alunos
                            </button>

                            {/* Selected student header */}
                            <div className="flex items-center gap-3 mb-5 p-3 rounded-xl bg-glass-bg">
                                {selectedStudent.avatar_url ? (
                                    <img
                                        src={selectedStudent.avatar_url}
                                        alt=""
                                        className="h-10 w-10 rounded-full object-cover"
                                    />
                                ) : (
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-600/20 text-sm font-bold text-violet-300">
                                        {selectedStudent.name.charAt(0).toUpperCase()}
                                    </div>
                                )}
                                <div>
                                    <p className="text-sm font-semibold text-foreground">{selectedStudent.name}</p>
                                    <p className="text-xs text-muted-foreground">{selectedStudent.program?.name || 'Programa'}</p>
                                </div>
                            </div>

                            {!selectedStudent.program ? (
                                <p className="py-8 text-center text-sm text-muted-foreground">
                                    Este aluno não possui um programa ativo.
                                </p>
                            ) : selectedStudent.workoutOptions.length === 0 ? (
                                <p className="py-8 text-center text-sm text-muted-foreground">
                                    Nenhum treino encontrado neste programa.
                                </p>
                            ) : (
                                <>
                                    {/* Today section */}
                                    {selectedStudent.todayWorkouts.length > 0 && (
                                        <div className="mb-4">
                                            <p className="text-[11px] uppercase tracking-widest font-semibold text-emerald-400/80 mb-2">
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

                                    {/* All workouts section */}
                                    {selectedStudent.workoutOptions.filter((w) => !w.isToday).length > 0 && (
                                        <div>
                                            <p className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground/60 mb-2">
                                                {selectedStudent.todayWorkouts.length > 0 ? 'Outros treinos' : 'Escolher treino'}
                                            </p>
                                            <div className="space-y-1">
                                                {selectedStudent.workoutOptions
                                                    .filter((w) => !w.isToday)
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
                                        <p className="mt-3 text-xs text-red-400">{error}</p>
                                    )}
                                </>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                {selectedStudent && selectedStudent.program && selectedStudent.workoutOptions.length > 0 && (
                    <div className="border-t border-k-border-subtle p-5">
                        <button
                            onClick={handleConfirm}
                            disabled={!selectedWorkoutId || isAdding}
                            className="w-full rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed"
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
    return (
        <button
            onClick={onSelect}
            className={`
                w-full flex items-center gap-3 rounded-xl p-3 text-left transition-all
                ${isSelected
                    ? 'bg-violet-600/20 border border-violet-500/40'
                    : 'bg-glass-bg border border-transparent hover:bg-glass-bg-hover'
                }
            `}
        >
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${isSelected ? 'bg-violet-600/30' : 'bg-glass-bg'}`}>
                <Dumbbell size={16} className={isSelected ? 'text-violet-400' : 'text-muted-foreground'} />
            </div>
            <span className={`text-sm font-medium ${isSelected ? 'text-violet-300' : 'text-foreground'}`}>
                {workout.name}
            </span>
            {isSelected && (
                <div className="ml-auto h-2 w-2 rounded-full bg-violet-400" />
            )}
        </button>
    )
}
