import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';

// ---------------------------------------------------------------------------
// Storage Adapter — MMKV with in-memory fallback for Expo Go
// ---------------------------------------------------------------------------

let storageBackend: StateStorage;

try {
    const { createMMKV } = require('react-native-mmkv');
    const mmkv = createMMKV({ id: 'kinevo-training-room' });
    storageBackend = {
        getItem: (name: string) => mmkv.getString(name) ?? null,
        setItem: (name: string, value: string) => mmkv.set(name, value),
        removeItem: (name: string) => { mmkv.remove(name); },
    };
} catch {
    // In-memory fallback when native MMKV is unavailable (e.g. Expo Go)
    const memoryStore = new Map<string, string>();
    storageBackend = {
        getItem: (name: string) => memoryStore.get(name) ?? null,
        setItem: (name: string, value: string) => { memoryStore.set(name, value); },
        removeItem: (name: string) => { memoryStore.delete(name); },
    };
}

// ---------------------------------------------------------------------------
// Types — exact parity with web/src/stores/training-room-store.ts
// ---------------------------------------------------------------------------

export interface WorkoutSetData {
    weight: string;
    reps: string;
    completed: boolean;
}

export interface PreviousSetData {
    set_number: number;
    weight: number;
    reps: number;
}

export interface ExerciseData {
    id: string;                           // assigned_workout_item_id
    planned_exercise_id: string;          // original exercise from template
    exercise_id: string;                  // currently active (may differ if swapped)
    name: string;
    sets: number;
    reps: string;                         // target reps as string
    rest_seconds: number;
    video_url?: string;
    substitute_exercise_ids: string[];    // trainer-approved swaps
    swap_source: 'none' | 'manual' | 'auto';
    setsData: WorkoutSetData[];
    previousLoad?: string;                // e.g. "80kg"
    previousSets?: PreviousSetData[];
    notes?: string | null;                // trainer note on exercise
    supersetId?: string | null;           // parent_item_id (groups into superset)
    supersetRestSeconds?: number;         // rest_seconds from superset parent
    order_index: number;                  // global position in workout
}

export interface WorkoutNote {
    id: string;
    notes: string;
    order_index: number;
}

export interface ActiveSession {
    studentId: string;
    studentName: string;
    studentAvatarUrl: string | null;
    assignedWorkoutId: string;
    assignedProgramId: string;
    trainerId: string;
    workoutName: string;
    exercises: ExerciseData[];
    workoutNotes: WorkoutNote[];
    status: 'ready' | 'in_progress' | 'finishing';
    startedAt: number | null;             // Date.now() absolute timestamp
    restTimerEnd: number | null;
    restTimerDuration: number | null;
}

export interface SessionSetupData {
    studentName: string;
    studentAvatarUrl: string | null;
    assignedWorkoutId: string;
    assignedProgramId: string;
    trainerId: string;
    workoutName: string;
    exercises: ExerciseData[];
    workoutNotes: WorkoutNote[];
}

interface TrainingRoomStore {
    // State
    sessions: Record<string, ActiveSession>;
    activeStudentId: string | null;

    // Session management
    sessionOrder: string[];
    addStudent: (studentId: string, data: SessionSetupData) => void;
    removeStudent: (studentId: string) => void;
    setActiveStudent: (studentId: string | null) => void;
    reorderStudents: (orderedIds: string[]) => void;

    // Workout lifecycle
    startWorkout: (studentId: string) => void;
    setFinishing: (studentId: string) => void;

    // Set tracking
    updateSet: (
        studentId: string,
        exerciseIdx: number,
        setIdx: number,
        field: 'weight' | 'reps',
        value: string,
    ) => void;
    toggleSetComplete: (studentId: string, exerciseIdx: number, setIdx: number) => void;

    // Exercise swap
    swapExercise: (
        studentId: string,
        exerciseIdx: number,
        newExercise: { id: string; name: string; source: 'manual' | 'auto' },
        previousLoad?: string,
    ) => void;

    // Rest timer
    startRestTimer: (studentId: string, durationSeconds: number) => void;
    clearRestTimer: (studentId: string) => void;

    // Cleanup
    finishSession: (studentId: string) => void;
    clearExpiredSessions: () => void;

    // Session count helper
    getSessionCount: () => number;
    getCompletedSets: (studentId: string) => { completed: number; total: number };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createInitialSets(count: number): WorkoutSetData[] {
    return Array.from({ length: count }, () => ({
        weight: '',
        reps: '',
        completed: false,
    }));
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const MAX_SIMULTANEOUS_STUDENTS = 6;

export const useTrainingRoomStore = create<TrainingRoomStore>()(
    persist(
        (set, get) => ({
            sessions: {},
            activeStudentId: null,
            sessionOrder: [],

            addStudent(studentId: string, data: SessionSetupData) {
                const count = Object.keys(get().sessions).length;
                if (count >= MAX_SIMULTANEOUS_STUDENTS) return;

                set((state: TrainingRoomStore) => ({
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
                        },
                    },
                    activeStudentId: studentId,
                    sessionOrder: state.sessionOrder.includes(studentId)
                        ? state.sessionOrder
                        : [...state.sessionOrder, studentId],
                }));
            },

            removeStudent(studentId: string) {
                set((state: TrainingRoomStore) => {
                    const { [studentId]: _, ...rest } = state.sessions;
                    const remainingOrder = state.sessionOrder.filter((id: string) => id !== studentId);
                    return {
                        sessions: rest,
                        sessionOrder: remainingOrder,
                        activeStudentId:
                            state.activeStudentId === studentId
                                ? remainingOrder[0] ?? null
                                : state.activeStudentId,
                    };
                });
            },

            setActiveStudent(studentId: string | null) {
                set({ activeStudentId: studentId });
            },

            reorderStudents(orderedIds: string[]) {
                set({ sessionOrder: orderedIds });
            },

            startWorkout(studentId: string) {
                set((state: TrainingRoomStore) => {
                    const session = state.sessions[studentId];
                    if (!session) return state;
                    return {
                        sessions: {
                            ...state.sessions,
                            [studentId]: {
                                ...session,
                                status: 'in_progress',
                                startedAt: session.startedAt ?? Date.now(),
                            },
                        },
                    };
                });
            },

            setFinishing(studentId: string) {
                set((state: TrainingRoomStore) => {
                    const session = state.sessions[studentId];
                    if (!session) return state;
                    return {
                        sessions: {
                            ...state.sessions,
                            [studentId]: { ...session, status: 'finishing' },
                        },
                    };
                });
            },

            updateSet(studentId: string, exerciseIdx: number, setIdx: number, field: 'weight' | 'reps', value: string) {
                set((state: TrainingRoomStore) => {
                    const session = state.sessions[studentId];
                    if (!session) return state;

                    const exercises = session.exercises.map((ex: ExerciseData, ei: number) => {
                        if (ei !== exerciseIdx) return ex;

                        const setsData = [...ex.setsData];
                        const oldValue = setsData[setIdx][field];
                        setsData[setIdx] = { ...setsData[setIdx], [field]: value };

                        // Waterfall: propagate to subsequent empty/auto-filled sets
                        for (let i = setIdx + 1; i < setsData.length; i++) {
                            const current = setsData[i][field];
                            if (current === '' || current === oldValue) {
                                setsData[i] = { ...setsData[i], [field]: value };
                            } else {
                                break; // stop at manually edited value
                            }
                        }

                        return { ...ex, setsData };
                    });

                    return {
                        sessions: {
                            ...state.sessions,
                            [studentId]: { ...session, exercises },
                        },
                    };
                });
            },

            toggleSetComplete(studentId: string, exerciseIdx: number, setIdx: number) {
                set((state: TrainingRoomStore) => {
                    const session = state.sessions[studentId];
                    if (!session) return state;

                    const exercises = session.exercises.map((ex: ExerciseData, ei: number) => {
                        if (ei !== exerciseIdx) return ex;

                        const setsData = ex.setsData.map((s: WorkoutSetData, si: number) =>
                            si === setIdx ? { ...s, completed: !s.completed } : s,
                        );

                        return { ...ex, setsData };
                    });

                    return {
                        sessions: {
                            ...state.sessions,
                            [studentId]: { ...session, exercises },
                        },
                    };
                });
            },

            swapExercise(studentId: string, exerciseIdx: number, newExercise: { id: string; name: string; source: 'manual' | 'auto' }, previousLoad?: string) {
                set((state: TrainingRoomStore) => {
                    const session = state.sessions[studentId];
                    if (!session) return state;

                    const exercises = session.exercises.map((ex: ExerciseData, ei: number) => {
                        if (ei !== exerciseIdx) return ex;
                        return {
                            ...ex,
                            exercise_id: newExercise.id,
                            name: newExercise.name,
                            swap_source: newExercise.source,
                            previousLoad,
                            previousSets: undefined,
                            setsData: createInitialSets(ex.sets),
                        };
                    });

                    return {
                        sessions: {
                            ...state.sessions,
                            [studentId]: { ...session, exercises },
                        },
                    };
                });
            },

            startRestTimer(studentId: string, durationSeconds: number) {
                set((state: TrainingRoomStore) => {
                    const session = state.sessions[studentId];
                    if (!session) return state;
                    return {
                        sessions: {
                            ...state.sessions,
                            [studentId]: {
                                ...session,
                                restTimerEnd: Date.now() + durationSeconds * 1000,
                                restTimerDuration: durationSeconds,
                            },
                        },
                    };
                });
            },

            clearRestTimer(studentId: string) {
                set((state: TrainingRoomStore) => {
                    const session = state.sessions[studentId];
                    if (!session) return state;
                    return {
                        sessions: {
                            ...state.sessions,
                            [studentId]: {
                                ...session,
                                restTimerEnd: null,
                                restTimerDuration: null,
                            },
                        },
                    };
                });
            },

            finishSession(studentId: string) {
                get().removeStudent(studentId);
            },

            clearExpiredSessions() {
                const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
                const now = Date.now();
                set((state: TrainingRoomStore) => {
                    const sessions: Record<string, ActiveSession> = {};
                    let activeId = state.activeStudentId;
                    const keptIds = new Set<string>();

                    for (const [id, session] of Object.entries(state.sessions) as [string, ActiveSession][]) {
                        const age = session.startedAt
                            ? now - session.startedAt
                            : 0;
                        if (age < MAX_AGE_MS) {
                            sessions[id] = session;
                            keptIds.add(id);
                        } else if (activeId === id) {
                            activeId = null;
                        }
                    }

                    const sessionOrder = state.sessionOrder.filter((id: string) => keptIds.has(id));

                    if (activeId && !sessions[activeId]) {
                        activeId = sessionOrder[0] ?? null;
                    }

                    return { sessions, sessionOrder, activeStudentId: activeId };
                });
            },

            getSessionCount() {
                return Object.keys(get().sessions).length;
            },

            getCompletedSets(studentId: string) {
                const session = get().sessions[studentId];
                if (!session) return { completed: 0, total: 0 };
                let completed = 0;
                let total = 0;
                for (const ex of session.exercises) {
                    for (const s of ex.setsData) {
                        total++;
                        if (s.completed) completed++;
                    }
                }
                return { completed, total };
            },
        }),
        {
            name: 'kinevo-training-room',
            storage: createJSONStorage(() => storageBackend),
            merge: (persisted: any, current: any) => {
                const merged = { ...current, ...persisted };
                // Rebuild sessionOrder from sessions if missing (MMKV migration)
                if (
                    (!merged.sessionOrder || merged.sessionOrder.length === 0) &&
                    merged.sessions &&
                    Object.keys(merged.sessions).length > 0
                ) {
                    merged.sessionOrder = Object.keys(merged.sessions);
                }
                return merged;
            },
        },
    ),
);
