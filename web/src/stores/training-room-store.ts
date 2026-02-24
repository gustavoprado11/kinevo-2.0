import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ---------------------------------------------------------------------------
// Types — mirror mobile interfaces for data parity
// ---------------------------------------------------------------------------

export interface WorkoutSetData {
    weight: string
    reps: string
    completed: boolean
}

export interface ExerciseData {
    id: string                           // assigned_workout_item_id
    planned_exercise_id: string          // original exercise from template
    exercise_id: string                  // currently active (may differ if swapped)
    name: string
    sets: number
    reps: string                         // target reps as string
    rest_seconds: number
    video_url?: string
    substitute_exercise_ids: string[]    // trainer-approved swaps
    swap_source: 'none' | 'manual' | 'auto'
    setsData: WorkoutSetData[]
    previousLoad?: string                // e.g. "80kg"
}

export interface ActiveSession {
    studentId: string
    studentName: string
    studentAvatarUrl: string | null
    assignedWorkoutId: string
    assignedProgramId: string
    trainerId: string
    workoutName: string
    exercises: ExerciseData[]
    status: 'ready' | 'in_progress' | 'finishing'
    startedAt: number | null             // Date.now() absolute timestamp
    restTimerEnd: number | null
    restTimerDuration: number | null
}

export interface SessionSetupData {
    studentName: string
    studentAvatarUrl: string | null
    assignedWorkoutId: string
    assignedProgramId: string
    trainerId: string
    workoutName: string
    exercises: ExerciseData[]
}

interface TrainingRoomStore {
    // State
    sessions: Record<string, ActiveSession>
    activeStudentId: string | null

    // Session management
    addStudent: (studentId: string, data: SessionSetupData) => void
    removeStudent: (studentId: string) => void
    setActiveStudent: (studentId: string | null) => void

    // Workout lifecycle
    startWorkout: (studentId: string) => void
    setFinishing: (studentId: string) => void

    // Set tracking
    updateSet: (
        studentId: string,
        exerciseIdx: number,
        setIdx: number,
        field: 'weight' | 'reps',
        value: string,
    ) => void
    toggleSetComplete: (studentId: string, exerciseIdx: number, setIdx: number) => void

    // Exercise swap
    swapExercise: (
        studentId: string,
        exerciseIdx: number,
        newExercise: { id: string; name: string; source: 'manual' | 'auto' },
        previousLoad?: string,
    ) => void

    // Rest timer
    startRestTimer: (studentId: string, durationSeconds: number) => void
    clearRestTimer: (studentId: string) => void

    // Cleanup
    finishSession: (studentId: string) => void
    clearExpiredSessions: () => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createInitialSets(count: number): WorkoutSetData[] {
    return Array.from({ length: count }, () => ({
        weight: '',
        reps: '',
        completed: false,
    }))
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useTrainingRoomStore = create<TrainingRoomStore>()(
    persist(
        (set, get) => ({
            sessions: {},
            activeStudentId: null,

            addStudent(studentId, data) {
                set((state) => ({
                    sessions: {
                        ...state.sessions,
                        [studentId]: {
                            studentId,
                            studentName: data.studentName,
                            studentAvatarUrl: data.studentAvatarUrl,
                            assignedWorkoutId: data.assignedWorkoutId,
                            assignedProgramId: data.assignedProgramId,
                            trainerId: data.trainerId,
                            workoutName: data.workoutName,
                            exercises: data.exercises,
                            status: 'ready',
                            startedAt: null,
                            restTimerEnd: null,
                            restTimerDuration: null,
                        },
                    },
                    activeStudentId: studentId,
                }))
            },

            removeStudent(studentId) {
                set((state) => {
                    const { [studentId]: _, ...rest } = state.sessions
                    const remainingIds = Object.keys(rest)
                    return {
                        sessions: rest,
                        activeStudentId:
                            state.activeStudentId === studentId
                                ? remainingIds[0] ?? null
                                : state.activeStudentId,
                    }
                })
            },

            setActiveStudent(studentId) {
                set({ activeStudentId: studentId })
            },

            startWorkout(studentId) {
                set((state) => {
                    const session = state.sessions[studentId]
                    if (!session) return state
                    return {
                        sessions: {
                            ...state.sessions,
                            [studentId]: {
                                ...session,
                                status: 'in_progress',
                                startedAt: Date.now(),
                            },
                        },
                    }
                })
            },

            setFinishing(studentId) {
                set((state) => {
                    const session = state.sessions[studentId]
                    if (!session) return state
                    return {
                        sessions: {
                            ...state.sessions,
                            [studentId]: { ...session, status: 'finishing' },
                        },
                    }
                })
            },

            updateSet(studentId, exerciseIdx, setIdx, field, value) {
                set((state) => {
                    const session = state.sessions[studentId]
                    if (!session) return state

                    const exercises = session.exercises.map((ex, ei) => {
                        if (ei !== exerciseIdx) return ex

                        const setsData = [...ex.setsData]
                        const oldValue = setsData[setIdx][field]
                        setsData[setIdx] = { ...setsData[setIdx], [field]: value }

                        // Waterfall: propagate to subsequent empty/auto-filled sets
                        for (let i = setIdx + 1; i < setsData.length; i++) {
                            const current = setsData[i][field]
                            if (current === '' || current === oldValue) {
                                setsData[i] = { ...setsData[i], [field]: value }
                            } else {
                                break // stop at manually edited value
                            }
                        }

                        return { ...ex, setsData }
                    })

                    return {
                        sessions: {
                            ...state.sessions,
                            [studentId]: { ...session, exercises },
                        },
                    }
                })
            },

            toggleSetComplete(studentId, exerciseIdx, setIdx) {
                set((state) => {
                    const session = state.sessions[studentId]
                    if (!session) return state

                    const exercises = session.exercises.map((ex, ei) => {
                        if (ei !== exerciseIdx) return ex

                        const setsData = ex.setsData.map((s, si) =>
                            si === setIdx ? { ...s, completed: !s.completed } : s,
                        )

                        return { ...ex, setsData }
                    })

                    return {
                        sessions: {
                            ...state.sessions,
                            [studentId]: { ...session, exercises },
                        },
                    }
                })
            },

            swapExercise(studentId, exerciseIdx, newExercise, previousLoad) {
                set((state) => {
                    const session = state.sessions[studentId]
                    if (!session) return state

                    const exercises = session.exercises.map((ex, ei) => {
                        if (ei !== exerciseIdx) return ex
                        return {
                            ...ex,
                            exercise_id: newExercise.id,
                            name: newExercise.name,
                            swap_source: newExercise.source,
                            previousLoad,
                            setsData: createInitialSets(ex.sets),
                        }
                    })

                    return {
                        sessions: {
                            ...state.sessions,
                            [studentId]: { ...session, exercises },
                        },
                    }
                })
            },

            startRestTimer(studentId, durationSeconds) {
                set((state) => {
                    const session = state.sessions[studentId]
                    if (!session) return state
                    return {
                        sessions: {
                            ...state.sessions,
                            [studentId]: {
                                ...session,
                                restTimerEnd: Date.now() + durationSeconds * 1000,
                                restTimerDuration: durationSeconds,
                            },
                        },
                    }
                })
            },

            clearRestTimer(studentId) {
                set((state) => {
                    const session = state.sessions[studentId]
                    if (!session) return state
                    return {
                        sessions: {
                            ...state.sessions,
                            [studentId]: {
                                ...session,
                                restTimerEnd: null,
                                restTimerDuration: null,
                            },
                        },
                    }
                })
            },

            finishSession(studentId) {
                get().removeStudent(studentId)
            },

            clearExpiredSessions() {
                const MAX_AGE_MS = 24 * 60 * 60 * 1000 // 24 hours
                const now = Date.now()
                set((state) => {
                    const sessions: Record<string, ActiveSession> = {}
                    let activeId = state.activeStudentId

                    for (const [id, session] of Object.entries(state.sessions)) {
                        const age = session.startedAt
                            ? now - session.startedAt
                            : 0
                        if (age < MAX_AGE_MS) {
                            sessions[id] = session
                        } else if (activeId === id) {
                            activeId = null
                        }
                    }

                    const remainingIds = Object.keys(sessions)
                    if (activeId && !sessions[activeId]) {
                        activeId = remainingIds[0] ?? null
                    }

                    return { sessions, activeStudentId: activeId }
                })
            },
        }),
        {
            name: 'kinevo-training-room',
        },
    ),
)
