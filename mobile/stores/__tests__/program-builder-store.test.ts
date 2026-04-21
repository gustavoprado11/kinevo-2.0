import { describe, it, expect, beforeEach, vi } from 'vitest';

// vi.hoisted runs before vi.mock hoisting
const { counter, mmkvStore } = vi.hoisted(() => {
    const counter = { value: 0 };
    const mmkvStore = new Map<string, string>();
    return { counter, mmkvStore };
});

vi.mock('expo-crypto', () => ({
    randomUUID: () => `mock-uuid-${++counter.value}`,
}));

vi.mock('react-native-mmkv', () => ({
    createMMKV: () => ({
        getString: (key: string) => mmkvStore.get(key) ?? undefined,
        set: (key: string, value: string) => mmkvStore.set(key, value),
        remove: (key: string) => mmkvStore.delete(key),
        delete: (key: string) => mmkvStore.delete(key),
        getAllKeys: () => Array.from(mmkvStore.keys()),
        clearAll: () => mmkvStore.clear(),
    }),
}));

import { useProgramBuilderStore } from '../program-builder-store';

describe('program-builder-store', () => {
    beforeEach(() => {
        counter.value = 0;
        mmkvStore.clear();
        // Reset store to initial state
        useProgramBuilderStore.getState().reset();
        counter.value = 0; // reset again after reset() generates UUIDs
    });

    describe('initNewProgram', () => {
        it('creates a draft with one workout (Treino A)', () => {
            useProgramBuilderStore.getState().initNewProgram();
            const { draft } = useProgramBuilderStore.getState();

            expect(draft.name).toBe('');
            expect(draft.description).toBe('');
            expect(draft.duration_weeks).toBeNull();
            expect(draft.workouts).toHaveLength(1);
            expect(draft.workouts[0].name).toBe('Treino A');
            expect(draft.workouts[0].items).toHaveLength(0);
        });

        it('sets studentId when provided', () => {
            useProgramBuilderStore.getState().initNewProgram('student-42');
            const { draft } = useProgramBuilderStore.getState();

            expect(draft.studentId).toBe('student-42');
        });

        it('sets currentWorkoutId to the first workout', () => {
            useProgramBuilderStore.getState().initNewProgram();
            const state = useProgramBuilderStore.getState();

            expect(state.currentWorkoutId).toBe(state.draft.workouts[0].id);
        });

        it('resets isDirty to false', () => {
            useProgramBuilderStore.getState().updateName('something');
            expect(useProgramBuilderStore.getState().isDirty).toBe(true);

            useProgramBuilderStore.getState().initNewProgram();
            expect(useProgramBuilderStore.getState().isDirty).toBe(false);
        });
    });

    describe('updateName / updateDescription / updateDurationWeeks', () => {
        it('updates program name and marks dirty', () => {
            useProgramBuilderStore.getState().initNewProgram();
            useProgramBuilderStore.getState().updateName('Hipertrofia Total');

            const { draft, isDirty } = useProgramBuilderStore.getState();
            expect(draft.name).toBe('Hipertrofia Total');
            expect(isDirty).toBe(true);
        });

        it('updates description', () => {
            useProgramBuilderStore.getState().initNewProgram();
            useProgramBuilderStore.getState().updateDescription('Programa de 12 semanas');

            expect(useProgramBuilderStore.getState().draft.description).toBe('Programa de 12 semanas');
        });

        it('updates duration weeks', () => {
            useProgramBuilderStore.getState().initNewProgram();
            useProgramBuilderStore.getState().updateDurationWeeks(8);

            expect(useProgramBuilderStore.getState().draft.duration_weeks).toBe(8);
        });
    });

    describe('addWorkout', () => {
        it('adds a new workout with next letter name', () => {
            useProgramBuilderStore.getState().initNewProgram();
            useProgramBuilderStore.getState().addWorkout();

            const { draft } = useProgramBuilderStore.getState();
            expect(draft.workouts).toHaveLength(2);
            expect(draft.workouts[1].name).toBe('Treino B');
        });

        it('skips used letters', () => {
            useProgramBuilderStore.getState().initNewProgram();
            // Already has Treino A
            useProgramBuilderStore.getState().addWorkout(); // Treino B
            useProgramBuilderStore.getState().addWorkout(); // Treino C

            const names = useProgramBuilderStore.getState().draft.workouts.map(w => w.name);
            expect(names).toEqual(['Treino A', 'Treino B', 'Treino C']);
        });

        it('sets currentWorkoutId to the new workout', () => {
            useProgramBuilderStore.getState().initNewProgram();
            const firstId = useProgramBuilderStore.getState().currentWorkoutId;

            useProgramBuilderStore.getState().addWorkout();
            const newId = useProgramBuilderStore.getState().currentWorkoutId;

            expect(newId).not.toBe(firstId);
        });
    });

    describe('removeWorkout', () => {
        it('removes a workout and reindexes', () => {
            useProgramBuilderStore.getState().initNewProgram();
            useProgramBuilderStore.getState().addWorkout();
            useProgramBuilderStore.getState().addWorkout();

            const workouts = useProgramBuilderStore.getState().draft.workouts;
            const middleId = workouts[1].id;

            useProgramBuilderStore.getState().removeWorkout(middleId);

            const remaining = useProgramBuilderStore.getState().draft.workouts;
            expect(remaining).toHaveLength(2);
            expect(remaining[0].order_index).toBe(0);
            expect(remaining[1].order_index).toBe(1);
        });

        it('updates currentWorkoutId if removed workout was current', () => {
            useProgramBuilderStore.getState().initNewProgram();
            useProgramBuilderStore.getState().addWorkout();

            const state = useProgramBuilderStore.getState();
            // currentWorkoutId is the second workout (added last)
            const currentId = state.currentWorkoutId!;
            const firstId = state.draft.workouts[0].id;

            useProgramBuilderStore.getState().removeWorkout(currentId);

            expect(useProgramBuilderStore.getState().currentWorkoutId).toBe(firstId);
        });
    });

    describe('addExercise', () => {
        it('adds an exercise item with defaults', () => {
            useProgramBuilderStore.getState().initNewProgram();
            const workoutId = useProgramBuilderStore.getState().draft.workouts[0].id;

            useProgramBuilderStore.getState().addExercise(workoutId, {
                id: 'ex-1',
                name: 'Supino Reto',
                equipment: 'Barra',
                muscle_groups: [{ id: 'mg-1', name: 'Peitoral' }],
            });

            const items = useProgramBuilderStore.getState().draft.workouts[0].items;
            expect(items).toHaveLength(1);
            expect(items[0].exercise_name).toBe('Supino Reto');
            expect(items[0].sets).toBe(3);
            expect(items[0].reps).toBe('10');
            expect(items[0].rest_seconds).toBe(60);
            expect(items[0].exercise_muscle_groups).toEqual(['Peitoral']);
        });

        it('does nothing for non-existent workout', () => {
            useProgramBuilderStore.getState().initNewProgram();

            useProgramBuilderStore.getState().addExercise('fake-id', {
                id: 'ex-1',
                name: 'Test',
                equipment: null,
                muscle_groups: [],
            });

            // Still 1 workout with 0 items
            expect(useProgramBuilderStore.getState().draft.workouts[0].items).toHaveLength(0);
        });
    });

    describe('updateItem', () => {
        it('updates specific fields of an item', () => {
            useProgramBuilderStore.getState().initNewProgram();
            const workoutId = useProgramBuilderStore.getState().draft.workouts[0].id;

            useProgramBuilderStore.getState().addExercise(workoutId, {
                id: 'ex-1',
                name: 'Agachamento',
                equipment: 'Barra',
                muscle_groups: [{ id: 'mg-1', name: 'Quadríceps' }],
            });

            const itemId = useProgramBuilderStore.getState().draft.workouts[0].items[0].id;

            useProgramBuilderStore.getState().updateItem(workoutId, itemId, {
                sets: 5,
                reps: '5',
                rest_seconds: 120,
            });

            const updated = useProgramBuilderStore.getState().draft.workouts[0].items[0];
            expect(updated.sets).toBe(5);
            expect(updated.reps).toBe('5');
            expect(updated.rest_seconds).toBe(120);
            expect(updated.exercise_name).toBe('Agachamento'); // unchanged
        });
    });

    describe('removeItem', () => {
        it('removes item and reindexes remaining', () => {
            useProgramBuilderStore.getState().initNewProgram();
            const workoutId = useProgramBuilderStore.getState().draft.workouts[0].id;

            useProgramBuilderStore.getState().addExercise(workoutId, {
                id: 'ex-1', name: 'A', equipment: null, muscle_groups: [],
            });
            useProgramBuilderStore.getState().addExercise(workoutId, {
                id: 'ex-2', name: 'B', equipment: null, muscle_groups: [],
            });
            useProgramBuilderStore.getState().addExercise(workoutId, {
                id: 'ex-3', name: 'C', equipment: null, muscle_groups: [],
            });

            const firstItemId = useProgramBuilderStore.getState().draft.workouts[0].items[0].id;
            useProgramBuilderStore.getState().removeItem(workoutId, firstItemId);

            const items = useProgramBuilderStore.getState().draft.workouts[0].items;
            expect(items).toHaveLength(2);
            expect(items[0].exercise_name).toBe('B');
            expect(items[0].order_index).toBe(0);
            expect(items[1].exercise_name).toBe('C');
            expect(items[1].order_index).toBe(1);
        });
    });

    describe('reset', () => {
        it('resets entire store to clean state', () => {
            useProgramBuilderStore.getState().initNewProgram('student-x');
            useProgramBuilderStore.getState().updateName('My Program');
            useProgramBuilderStore.getState().addWorkout();

            useProgramBuilderStore.getState().reset();

            const state = useProgramBuilderStore.getState();
            expect(state.draft.name).toBe('');
            expect(state.draft.studentId).toBeNull();
            expect(state.currentWorkoutId).toBeNull();
            expect(state.isDirty).toBe(false);
            // Fase 3: AI fields default cleanly on reset.
            expect(state.draft.generationId).toBeNull();
            expect(state.draft.originatedFromAi).toBe(false);
            expect(state.draft.originalSnapshot).toBeNull();
        });
    });

    describe('initFromAiSnapshot', () => {
        const SNAPSHOT = {
            program: { name: 'Programa IA', description: 'desc', duration_weeks: 8 },
            workouts: [
                {
                    name: 'A',
                    order_index: 0,
                    scheduled_days: [1, 4],
                    items: [
                        { item_type: 'exercise' as const, order_index: 0, exercise_id: 'ex-1', sets: 3, reps: '10', rest_seconds: 60, notes: null },
                    ],
                },
            ],
            reasoning: { structure_rationale: 'r', volume_rationale: 'v', workout_notes: [], attention_flags: [], confidence_score: 0.7 },
        };

        const BUILDER_DATA = {
            id: 'temp_program',
            name: 'Programa IA',
            description: 'desc',
            duration_weeks: 8,
            workout_templates: [
                {
                    id: 'temp_workout',
                    name: 'A',
                    order_index: 0,
                    frequency: ['mon', 'thu'],
                    workout_item_templates: [
                        {
                            id: 'temp_item',
                            item_type: 'exercise',
                            order_index: 0,
                            parent_item_id: null,
                            exercise_id: 'ex-1',
                            substitute_exercise_ids: null,
                            sets: 3,
                            reps: '10',
                            rest_seconds: 60,
                            notes: null,
                            exercise_function: null,
                            item_config: undefined,
                        },
                    ],
                },
            ],
        };

        it('populates workouts, generationId, originatedFromAi, originalSnapshot', () => {
            useProgramBuilderStore.getState().initFromAiSnapshot(
                'student-z',
                BUILDER_DATA,
                'gen-42',
                SNAPSHOT,
            );
            const { draft, currentWorkoutId } = useProgramBuilderStore.getState();
            expect(draft.studentId).toBe('student-z');
            expect(draft.name).toBe('Programa IA');
            expect(draft.duration_weeks).toBe(8);
            expect(draft.generationId).toBe('gen-42');
            expect(draft.originatedFromAi).toBe(true);
            expect(draft.originalSnapshot).toEqual(SNAPSHOT);
            expect(draft.workouts).toHaveLength(1);
            expect(draft.workouts[0].name).toBe('A');
            expect(draft.workouts[0].frequency).toEqual(['mon', 'thu']);
            expect(draft.workouts[0].items).toHaveLength(1);
            expect(draft.workouts[0].items[0].exercise_id).toBe('ex-1');
            expect(draft.workouts[0].items[0].sets).toBe(3);
            expect(currentWorkoutId).toBe(draft.workouts[0].id);
        });

        it('falls back to a placeholder Treino A when builderData has no workouts', () => {
            useProgramBuilderStore.getState().initFromAiSnapshot(
                'student-z',
                { ...BUILDER_DATA, workout_templates: [] },
                'gen-empty',
                SNAPSHOT,
            );
            const { draft } = useProgramBuilderStore.getState();
            expect(draft.workouts).toHaveLength(1);
            expect(draft.workouts[0].name).toBe('Treino A');
            expect(draft.workouts[0].items).toHaveLength(0);
            expect(draft.originatedFromAi).toBe(true);
        });
    });
});
