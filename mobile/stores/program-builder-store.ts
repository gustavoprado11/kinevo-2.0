import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import * as Crypto from 'expo-crypto';

// ---------------------------------------------------------------------------
// Storage Adapter — MMKV with in-memory fallback for Expo Go
// ---------------------------------------------------------------------------

let storageBackend: StateStorage;

try {
    const { createMMKV } = require('react-native-mmkv');
    const mmkv = createMMKV({ id: 'kinevo-program-builder' });
    storageBackend = {
        getItem: (name: string) => mmkv.getString(name) ?? null,
        setItem: (name: string, value: string) => mmkv.set(name, value),
        removeItem: (name: string) => { mmkv.remove(name); },
    };
} catch {
    const memoryStore = new Map<string, string>();
    storageBackend = {
        getItem: (name: string) => memoryStore.get(name) ?? null,
        setItem: (name: string, value: string) => { memoryStore.set(name, value); },
        removeItem: (name: string) => { memoryStore.delete(name); },
    };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkoutItem {
    id: string;
    item_type: 'exercise' | 'superset';
    order_index: number;
    parent_item_id: string | null;
    exercise_id: string;
    exercise_name: string;
    exercise_equipment: string | null;
    exercise_muscle_groups: string[];
    sets: number;
    reps: string;
    rest_seconds: number;
    notes: string | null;
    exercise_function: string | null;
    item_config: Record<string, unknown>;
    substitute_exercise_ids: string[];
}

export interface Workout {
    id: string;
    name: string;
    order_index: number;
    frequency: string[];
    items: WorkoutItem[];
}

export interface ProgramDraft {
    name: string;
    description: string;
    duration_weeks: number | null;
    workouts: Workout[];
    studentId: string | null;
}

/** Parsed exercise from text prescription AI */
export interface ParsedExerciseForBuilder {
    exercise_id: string;
    catalog_name: string;
    sets: number;
    reps: string;
    rest_seconds: number | null;
    notes: string | null;
    superset_group: string | null;
}

/** Parsed workout from text prescription AI */
export interface ParsedWorkoutForBuilder {
    name: string;
    exercises: ParsedExerciseForBuilder[];
}

interface ProgramBuilderState {
    draft: ProgramDraft;
    currentWorkoutId: string | null;
    isSaving: boolean;
    isDirty: boolean;

    // Init
    initNewProgram: (studentId?: string) => void;
    /** Initialize program builder pre-filled with AI-parsed workouts */
    initFromParsedText: (studentId: string, workouts: ParsedWorkoutForBuilder[]) => void;

    // Program metadata
    updateName: (name: string) => void;
    updateDescription: (desc: string) => void;
    updateDurationWeeks: (weeks: number | null) => void;

    // Workouts
    addWorkout: () => void;
    removeWorkout: (workoutId: string) => void;
    renameWorkout: (workoutId: string, name: string) => void;
    updateWorkoutFrequency: (workoutId: string, days: string[]) => void;
    setCurrentWorkout: (workoutId: string) => void;

    // Items
    addExercise: (workoutId: string, exercise: {
        id: string;
        name: string;
        equipment: string | null;
        muscle_groups: { id: string; name: string }[];
    }) => void;
    updateItem: (workoutId: string, itemId: string, updates: Partial<Pick<WorkoutItem, 'sets' | 'reps' | 'rest_seconds' | 'notes'>>) => void;
    removeItem: (workoutId: string, itemId: string) => void;
    reorderItems: (workoutId: string, newItems: WorkoutItem[]) => void;

    // Persistence
    setSaving: (saving: boolean) => void;
    reset: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WORKOUT_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function nextWorkoutName(workouts: Workout[]): string {
    const usedNames = new Set(workouts.map(w => w.name));
    for (const letter of WORKOUT_LETTERS) {
        const name = `Treino ${letter}`;
        if (!usedNames.has(name)) return name;
    }
    return `Treino ${workouts.length + 1}`;
}

function createEmptyDraft(studentId?: string): ProgramDraft {
    const workoutId = Crypto.randomUUID();
    return {
        name: '',
        description: '',
        duration_weeks: null,
        studentId: studentId ?? null,
        workouts: [{
            id: workoutId,
            name: 'Treino A',
            order_index: 0,
            frequency: [],
            items: [],
        }],
    };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useProgramBuilderStore = create<ProgramBuilderState>()(
    persist(
        (set) => ({
            draft: createEmptyDraft(),
            currentWorkoutId: null,
            isSaving: false,
            isDirty: false,

            initNewProgram: (studentId?: string) => {
                const draft = createEmptyDraft(studentId);
                set({
                    draft,
                    currentWorkoutId: draft.workouts[0].id,
                    isDirty: false,
                    isSaving: false,
                });
            },

            initFromParsedText: (studentId: string, parsedWorkouts: ParsedWorkoutForBuilder[]) => {
                const workouts: Workout[] = parsedWorkouts.map((pw, wi) => {
                    const workoutId = Crypto.randomUUID();
                    const items: WorkoutItem[] = [];
                    let orderIndex = 0;

                    // Group exercises by superset_group
                    // Process in order, creating superset parents when we encounter grouped exercises
                    const processedGroups = new Set<string>();

                    for (let ei = 0; ei < pw.exercises.length; ei++) {
                        const ex = pw.exercises[ei];

                        if (!ex.superset_group) {
                            // Regular exercise (no superset)
                            items.push({
                                id: Crypto.randomUUID(),
                                item_type: 'exercise',
                                order_index: orderIndex++,
                                parent_item_id: null,
                                exercise_id: ex.exercise_id,
                                exercise_name: ex.catalog_name,
                                exercise_equipment: null,
                                exercise_muscle_groups: [],
                                sets: ex.sets,
                                reps: ex.reps,
                                rest_seconds: ex.rest_seconds ?? 60,
                                notes: ex.notes ?? null,
                                exercise_function: null,
                                item_config: {},
                                substitute_exercise_ids: [],
                            });
                        } else if (!processedGroups.has(ex.superset_group)) {
                            // First exercise of a superset group — create parent + all children
                            processedGroups.add(ex.superset_group);
                            const groupId = ex.superset_group;

                            // Collect all exercises in this superset group
                            const groupExercises = pw.exercises.filter(
                                (e) => e.superset_group === groupId
                            );

                            // Create superset parent item
                            const supersetId = Crypto.randomUUID();
                            // Use rest_seconds from first exercise as rest between rounds
                            const restBetweenRounds = groupExercises[0]?.rest_seconds ?? 60;

                            items.push({
                                id: supersetId,
                                item_type: 'superset',
                                order_index: orderIndex++,
                                parent_item_id: null,
                                exercise_id: '',
                                exercise_name: `Superset (${groupExercises.length})`,
                                exercise_equipment: null,
                                exercise_muscle_groups: [],
                                sets: groupExercises[0]?.sets ?? 3,
                                reps: '',
                                rest_seconds: restBetweenRounds,
                                notes: null,
                                exercise_function: null,
                                item_config: {},
                                substitute_exercise_ids: [],
                            });

                            // Create child exercise items
                            groupExercises.forEach((gex, childIdx) => {
                                items.push({
                                    id: Crypto.randomUUID(),
                                    item_type: 'exercise',
                                    order_index: childIdx,
                                    parent_item_id: supersetId,
                                    exercise_id: gex.exercise_id,
                                    exercise_name: gex.catalog_name,
                                    exercise_equipment: null,
                                    exercise_muscle_groups: [],
                                    sets: gex.sets,
                                    reps: gex.reps,
                                    rest_seconds: 0, // No rest between exercises within superset
                                    notes: gex.notes ?? null,
                                    exercise_function: null,
                                    item_config: {},
                                    substitute_exercise_ids: [],
                                });
                            });
                        }
                        // else: exercise belongs to a group already processed — skip
                    }

                    return {
                        id: workoutId,
                        name: pw.name,
                        order_index: wi,
                        frequency: [],
                        items,
                    };
                });

                // Ensure at least one workout
                if (workouts.length === 0) {
                    workouts.push({
                        id: Crypto.randomUUID(),
                        name: 'Treino A',
                        order_index: 0,
                        frequency: [],
                        items: [],
                    });
                }

                const draft: ProgramDraft = {
                    name: '',
                    description: '',
                    duration_weeks: null,
                    studentId,
                    workouts,
                };

                set({
                    draft,
                    currentWorkoutId: workouts[0].id,
                    isDirty: true,
                    isSaving: false,
                });
            },

            updateName: (name) => set((state) => ({
                draft: { ...state.draft, name },
                isDirty: true,
            })),

            updateDescription: (description) => set((state) => ({
                draft: { ...state.draft, description },
                isDirty: true,
            })),

            updateDurationWeeks: (duration_weeks) => set((state) => ({
                draft: { ...state.draft, duration_weeks },
                isDirty: true,
            })),

            addWorkout: () => set((state) => {
                const newWorkout: Workout = {
                    id: Crypto.randomUUID(),
                    name: nextWorkoutName(state.draft.workouts),
                    order_index: state.draft.workouts.length,
                    frequency: [],
                    items: [],
                };
                return {
                    draft: {
                        ...state.draft,
                        workouts: [...state.draft.workouts, newWorkout],
                    },
                    currentWorkoutId: newWorkout.id,
                    isDirty: true,
                };
            }),

            removeWorkout: (workoutId) => set((state) => {
                const workouts = state.draft.workouts
                    .filter(w => w.id !== workoutId)
                    .map((w, i) => ({ ...w, order_index: i }));
                const currentId = state.currentWorkoutId === workoutId
                    ? (workouts[0]?.id ?? null)
                    : state.currentWorkoutId;
                return {
                    draft: { ...state.draft, workouts },
                    currentWorkoutId: currentId,
                    isDirty: true,
                };
            }),

            renameWorkout: (workoutId, name) => set((state) => ({
                draft: {
                    ...state.draft,
                    workouts: state.draft.workouts.map(w =>
                        w.id === workoutId ? { ...w, name } : w
                    ),
                },
                isDirty: true,
            })),

            updateWorkoutFrequency: (workoutId, days) => set((state) => ({
                draft: {
                    ...state.draft,
                    workouts: state.draft.workouts.map(w =>
                        w.id === workoutId ? { ...w, frequency: days } : w
                    ),
                },
                isDirty: true,
            })),

            setCurrentWorkout: (workoutId) => set({ currentWorkoutId: workoutId }),

            addExercise: (workoutId, exercise) => set((state) => {
                const workout = state.draft.workouts.find(w => w.id === workoutId);
                if (!workout) return state;

                const newItem: WorkoutItem = {
                    id: Crypto.randomUUID(),
                    item_type: 'exercise',
                    order_index: workout.items.length,
                    parent_item_id: null,
                    exercise_id: exercise.id,
                    exercise_name: exercise.name,
                    exercise_equipment: exercise.equipment,
                    exercise_muscle_groups: exercise.muscle_groups.map(mg => mg.name),
                    sets: 3,
                    reps: '10',
                    rest_seconds: 60,
                    notes: null,
                    exercise_function: null,
                    item_config: {},
                    substitute_exercise_ids: [],
                };

                return {
                    draft: {
                        ...state.draft,
                        workouts: state.draft.workouts.map(w =>
                            w.id === workoutId
                                ? { ...w, items: [...w.items, newItem] }
                                : w
                        ),
                    },
                    isDirty: true,
                };
            }),

            updateItem: (workoutId, itemId, updates) => set((state) => ({
                draft: {
                    ...state.draft,
                    workouts: state.draft.workouts.map(w =>
                        w.id === workoutId
                            ? {
                                ...w,
                                items: w.items.map(item =>
                                    item.id === itemId ? { ...item, ...updates } : item
                                ),
                            }
                            : w
                    ),
                },
                isDirty: true,
            })),

            removeItem: (workoutId, itemId) => set((state) => ({
                draft: {
                    ...state.draft,
                    workouts: state.draft.workouts.map(w =>
                        w.id === workoutId
                            ? {
                                ...w,
                                items: w.items
                                    .filter(item => item.id !== itemId)
                                    .map((item, i) => ({ ...item, order_index: i })),
                            }
                            : w
                    ),
                },
                isDirty: true,
            })),

            reorderItems: (workoutId, newItems) => set((state) => ({
                draft: {
                    ...state.draft,
                    workouts: state.draft.workouts.map(w =>
                        w.id === workoutId
                            ? { ...w, items: newItems.map((item, i) => ({ ...item, order_index: i })) }
                            : w
                    ),
                },
                isDirty: true,
            })),

            setSaving: (isSaving) => set({ isSaving }),

            reset: () => set({
                draft: createEmptyDraft(),
                currentWorkoutId: null,
                isDirty: false,
                isSaving: false,
            }),
        }),
        {
            name: 'kinevo-program-builder',
            storage: createJSONStorage(() => storageBackend),
        }
    )
);
