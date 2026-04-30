import { describe, it, expect, beforeEach, vi } from 'vitest';

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

describe('addParsedWorkoutsToDraft — frequency extraction', () => {
    beforeEach(() => {
        counter.value = 0;
        mmkvStore.clear();
        useProgramBuilderStore.getState().reset();
    });

    it('programa novo: extrai dia do nome ("Superior A - segunda" → name "Superior A", frequency ["mon"])', () => {
        useProgramBuilderStore.getState().initNewProgram('student-1');
        useProgramBuilderStore.getState().addParsedWorkoutsToDraft('student-1', [
            {
                name: 'Superior A - segunda',
                exercises: [{
                    exercise_id: 'ex-1',
                    catalog_name: 'Supino',
                    sets: 3,
                    reps: '10',
                    rest_seconds: 60,
                    notes: null,
                    superset_group: null,
                }],
            },
        ]);

        const { draft } = useProgramBuilderStore.getState();
        expect(draft.workouts).toHaveLength(1);
        expect(draft.workouts[0].name).toBe('Superior A');
        expect(draft.workouts[0].frequency).toEqual(['mon']);
        expect(draft.workouts[0].items).toHaveLength(1);
    });

    it('merge: NÃO sobrescreve frequency de workout existente já configurada', () => {
        // Primeira prescrição cria "Superior A" com frequency=['mon']
        useProgramBuilderStore.getState().initNewProgram('student-1');
        useProgramBuilderStore.getState().addParsedWorkoutsToDraft('student-1', [
            {
                name: 'Superior A - segunda',
                exercises: [{
                    exercise_id: 'ex-1',
                    catalog_name: 'Supino',
                    sets: 3,
                    reps: '10',
                    rest_seconds: 60,
                    notes: null,
                    superset_group: null,
                }],
            },
        ]);

        // Segunda prescrição com mesmo workout mas dia diferente
        useProgramBuilderStore.getState().addParsedWorkoutsToDraft('student-1', [
            {
                name: 'Superior A - quinta',
                exercises: [{
                    exercise_id: 'ex-2',
                    catalog_name: 'Agachamento',
                    sets: 3,
                    reps: '10',
                    rest_seconds: 60,
                    notes: null,
                    superset_group: null,
                }],
            },
        ]);

        const { draft } = useProgramBuilderStore.getState();
        expect(draft.workouts).toHaveLength(1);
        expect(draft.workouts[0].name).toBe('Superior A');
        // Frequency original preservada
        expect(draft.workouts[0].frequency).toEqual(['mon']);
        // Items mesclados
        expect(draft.workouts[0].items).toHaveLength(2);
    });
});
