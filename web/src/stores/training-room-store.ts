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

export interface PreviousSetData {
    set_number: number
    weight: number
    reps: number
}

export interface ExerciseData {
    id: string                           // assigned_workout_item_id
    item_type?: 'exercise' | 'warmup' | 'cardio'  // defaults to 'exercise'
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
    previousSets?: PreviousSetData[]     // per-set previous data
    notes?: string | null                // trainer note on exercise
    supersetId?: string | null           // parent_item_id (groups into superset)
    supersetRestSeconds?: number         // rest_seconds from superset parent
    order_index: number                  // global position in workout
    exercise_function?: string | null    // warmup, activation, main, accessory, conditioning
    item_config?: Record<string, any>    // warmup/cardio specific configuration
}

export interface WorkoutNote {
    id: string
    notes: string
    order_index: number
}

export interface FormTriggerData {
    formTemplateId: string
    title: string
    schemaJson: any
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
    workoutNotes: WorkoutNote[]
    status: 'ready' | 'pre_checkin' | 'in_progress' | 'post_checkin' | 'finishing'
    startedAt: number | null             // Date.now() absolute timestamp
    restTimerEnd: number | null
    restTimerDuration: number | null
    preWorkoutTrigger?: FormTriggerData | null
    postWorkoutTrigger?: FormTriggerData | null
    preWorkoutSubmissionId?: string | null
    postWorkoutSubmissionId?: string | null
    scheduledDays?: number[] | null
    weeklyCompleted?: number
    weeklyExpected?: number
}

export interface SessionSetupData {
    studentName: string
    studentAvatarUrl: string | null
    assignedWorkoutId: string
    assignedProgramId: string
    trainerId: string
    workoutName: string
    exercises: ExerciseData[]
    workoutNotes: WorkoutNote[]
    preWorkoutTrigger?: FormTriggerData | null
    postWorkoutTrigger?: FormTriggerData | null
    scheduledDays?: number[] | null
    weeklyCompleted?: number
    weeklyExpected?: number
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

    // Checkin lifecycle
    setPreCheckin: (studentId: string) => void
    completePreCheckin: (studentId: string, submissionId: string) => void
    setPostCheckin: (studentId: string) => void
    completePostCheckin: (studentId: string, submissionId: string) => void
    skipCheckin: (studentId: string, type: 'pre' | 'post') => void

    // Set tracking
    updateSet: (
        studentId: string,
        exerciseIdx: number,
        setIdx: number,
        field: 'weight' | 'reps',
        value: string,
    ) => void
    toggleSetComplete: (studentId: string, exerciseIdx: number, setIdx: number) => void
    toggleCardioComplete: (studentId: string, exerciseId: string, completed: boolean) => void

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
                            workoutNotes: data.workoutNotes || [],
                            status: 'ready',
                            startedAt: null,
                            restTimerEnd: null,
                            restTimerDuration: null,
                            preWorkoutTrigger: data.preWorkoutTrigger ?? null,
                            postWorkoutTrigger: data.postWorkoutTrigger ?? null,
                            preWorkoutSubmissionId: null,
                            postWorkoutSubmissionId: null,
                            scheduledDays: data.scheduledDays ?? null,
                            weeklyCompleted: data.weeklyCompleted ?? 0,
                            weeklyExpected: data.weeklyExpected ?? 0,
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

            setPreCheckin(studentId) {
                set((state) => {
                    const session = state.sessions[studentId]
                    if (!session) return state
                    return {
                        sessions: {
                            ...state.sessions,
                            [studentId]: { ...session, status: 'pre_checkin' },
                        },
                    }
                })
            },

            completePreCheckin(studentId, submissionId) {
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
                                preWorkoutSubmissionId: submissionId,
                            },
                        },
                    }
                })
            },

            setPostCheckin(studentId) {
                set((state) => {
                    const session = state.sessions[studentId]
                    if (!session) return state
                    return {
                        sessions: {
                            ...state.sessions,
                            [studentId]: { ...session, status: 'post_checkin' },
                        },
                    }
                })
            },

            completePostCheckin(studentId, submissionId) {
                set((state) => {
                    const session = state.sessions[studentId]
                    if (!session) return state
                    return {
                        sessions: {
                            ...state.sessions,
                            [studentId]: {
                                ...session,
                                status: 'finishing',
                                postWorkoutSubmissionId: submissionId,
                            },
                        },
                    }
                })
            },

            skipCheckin(studentId, type) {
                set((state) => {
                    const session = state.sessions[studentId]
                    if (!session) return state
                    const nextStatus = type === 'pre' ? 'in_progress' as const : 'finishing' as const
                    return {
                        sessions: {
                            ...state.sessions,
                            [studentId]: {
                                ...session,
                                status: nextStatus,
                                ...(type === 'pre' ? { startedAt: Date.now() } : {}),
                            },
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

            toggleCardioComplete(studentId, exerciseId, completed) {
                set((state) => {
                    const session = state.sessions[studentId]
                    if (!session) return state

                    const exercises = session.exercises.map((ex) => {
                        if (ex.id !== exerciseId) return ex
                        return {
                            ...ex,
                            setsData: completed
                                ? [{ weight: '0', reps: '1', completed: true }]
                                : [],
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
            version: 1,
            migrate(persisted: any, version: number) {
                if (version === 0 && persisted && persisted.sessions) {
                    // v0 → v1: add trigger fields to existing sessions
                    const sessions: Record<string, any> = {}
                    for (const [id, session] of Object.entries(persisted.sessions as Record<string, any>)) {
                        sessions[id] = {
                            ...session,
                            preWorkoutTrigger: session.preWorkoutTrigger ?? null,
                            postWorkoutTrigger: session.postWorkoutTrigger ?? null,
                            preWorkoutSubmissionId: session.preWorkoutSubmissionId ?? null,
                            postWorkoutSubmissionId: session.postWorkoutSubmissionId ?? null,
                            // Normalize any unknown status to 'ready'
                            status: ['ready', 'in_progress', 'finishing', 'pre_checkin', 'post_checkin'].includes(session.status)
                                ? session.status
                                : 'ready',
                        }
                    }
                    return { ...persisted, sessions }
                }
                return persisted as any
            },
        },
    ),
)
