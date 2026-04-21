import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
// @ts-expect-error react-dom typings are not installed in the mobile workspace
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';

function renderHook<T>(callback: () => T): { result: { current: T }; unmount: () => void } {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    const result: { current: T } = { current: undefined as unknown as T };
    function Wrapper() {
        result.current = callback();
        return null;
    }
    act(() => {
        root.render(React.createElement(Wrapper));
    });
    return {
        result,
        unmount: () => {
            act(() => root.unmount());
            container.remove();
        },
    };
}

async function waitFor(predicate: () => void, timeoutMs = 2000): Promise<void> {
    const start = Date.now();
    let lastErr: unknown;
    while (Date.now() - start < timeoutMs) {
        try {
            predicate();
            return;
        } catch (e) {
            lastErr = e;
            await new Promise((r) => setTimeout(r, 10));
        }
    }
    throw lastErr instanceof Error ? lastErr : new Error('waitFor: predicate never satisfied');
}

// MMKV mock so the store loads.
const { mmkvStore } = vi.hoisted(() => ({ mmkvStore: new Map<string, string>() }));
vi.mock('react-native-mmkv', () => ({
    createMMKV: () => ({
        getString: (k: string) => mmkvStore.get(k) ?? undefined,
        set: (k: string, v: string) => mmkvStore.set(k, v),
        remove: (k: string) => mmkvStore.delete(k),
        delete: (k: string) => mmkvStore.delete(k),
        getAllKeys: () => Array.from(mmkvStore.keys()),
        clearAll: () => mmkvStore.clear(),
    }),
}));

const { counter } = vi.hoisted(() => ({ counter: { value: 0 } }));
vi.mock('expo-crypto', () => ({
    randomUUID: () => `mock-uuid-${++counter.value}`,
}));

vi.mock('expo-haptics', () => ({
    impactAsync: vi.fn(() => Promise.resolve()),
    notificationAsync: vi.fn(() => Promise.resolve()),
    ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium' },
    NotificationFeedbackType: { Success: 'Success', Error: 'Error' },
}));

const { toastSpy } = vi.hoisted(() => ({
    toastSpy: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock('../../lib/toast', () => ({ toast: toastSpy }));

const { supabaseStub } = vi.hoisted(() => {
    const supabaseStub = {
        auth: { getSession: vi.fn(() => Promise.resolve({ data: { session: { access_token: 'tok' } } })) },
        from: vi.fn((_table: string) => ({
            insert: () => ({
                select: () => ({ single: () => Promise.resolve({ data: { id: 'stub-id' }, error: null }) }),
            }),
        })),
        functions: {
            invoke: vi.fn(() => Promise.resolve({ data: { success: true }, error: null })),
        },
    };
    return { supabaseStub };
});
vi.mock('../../lib/supabase', () => ({ supabase: supabaseStub }));

import { useProgramBuilder } from '../useProgramBuilder';
import { useProgramBuilderStore } from '../../stores/program-builder-store';
import type { PrescriptionOutputSnapshot } from '@kinevo/shared/types/prescription';

const STUDENT_ID = 'student-99';

const BUILDER_DATA = {
    id: 'temp_program',
    name: 'AI Program',
    description: '',
    duration_weeks: 6,
    workout_templates: [
        {
            id: 'temp_workout',
            name: 'A',
            order_index: 0,
            frequency: ['mon'],
            workout_item_templates: [
                {
                    id: 'temp_item',
                    item_type: 'exercise',
                    order_index: 0,
                    parent_item_id: null,
                    exercise_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
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

const ORIGINAL_SNAPSHOT: PrescriptionOutputSnapshot = {
    program: { name: 'AI Program', description: '', duration_weeks: 6 },
    workouts: [
        {
            name: 'A',
            order_index: 0,
            scheduled_days: [1],
            items: [{ item_type: 'exercise', order_index: 0, exercise_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', sets: 3, reps: '10', rest_seconds: 60, notes: null }],
        },
    ],
    reasoning: { structure_rationale: 'Original rationale', volume_rationale: 'Original volume', workout_notes: [], attention_flags: [], confidence_score: 0.85 },
};

function mockFetch(impl: (url: string, init?: RequestInit) => Promise<{ status: number; body: unknown }>) {
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        const { status, body } = await impl(url, init);
        return {
            ok: status >= 200 && status < 300,
            status,
            json: async () => body,
        } as Response;
    }) as unknown as typeof fetch;
}

describe('useProgramBuilder.saveAndAssign', () => {
    beforeEach(() => {
        mmkvStore.clear();
        counter.value = 0;
        toastSpy.success.mockClear();
        toastSpy.error.mockClear();
        supabaseStub.functions.invoke.mockClear();
        useProgramBuilderStore.getState().reset();
    });

    it('AI path: with originatedFromAi and no supersets, posts isEdited:true + outputSnapshot to /api/programs/assign', async () => {
        useProgramBuilderStore.getState().initFromAiSnapshot(
            STUDENT_ID,
            BUILDER_DATA,
            'gen-1',
            ORIGINAL_SNAPSHOT,
        );
        useProgramBuilderStore.getState().updateName('AI Program');

        let assignBody: Record<string, unknown> | null = null;
        mockFetch(async (url, init) => {
            if (url.endsWith('/api/programs/assign')) {
                assignBody = JSON.parse(init!.body as string);
                return { status: 200, body: { success: true, programId: 'p-1' } };
            }
            throw new Error(`unexpected url ${url}`);
        });

        const { result } = renderHook(() => useProgramBuilder());
        let res: any;
        await act(async () => { res = await result.current.saveAndAssign(STUDENT_ID); });

        expect(res.ok).toBe(true);
        expect(assignBody).not.toBeNull();
        const body = assignBody as unknown as Record<string, unknown>;
        expect(body.studentId).toBe(STUDENT_ID);
        expect(body.generationId).toBe('gen-1');
        expect(body.isEdited).toBe(true);
        const snap = body.outputSnapshot as PrescriptionOutputSnapshot;
        expect(snap.program.name).toBe('AI Program');
        expect(snap.workouts).toHaveLength(1);
        // preserveReasoning: the original reasoning is reused (not the empty default).
        expect(snap.reasoning.structure_rationale).toBe('Original rationale');
        expect(snap.reasoning.confidence_score).toBe(0.85);
        // Edge Function path is NOT taken on the AI path.
        expect(supabaseStub.functions.invoke).not.toHaveBeenCalled();
        expect(toastSpy.success).toHaveBeenCalled();
        // Draft is reset on success.
        expect(useProgramBuilderStore.getState().draft.originatedFromAi).toBe(false);
    });

    it('AI path: returns SUPERSET_BLOCKED without making any HTTP call when draft has supersets', async () => {
        useProgramBuilderStore.getState().initFromAiSnapshot(
            STUDENT_ID,
            BUILDER_DATA,
            'gen-2',
            ORIGINAL_SNAPSHOT,
        );
        useProgramBuilderStore.getState().updateName('AI Program');
        // Inject a child item simulating a superset child the user added.
        useProgramBuilderStore.setState((state) => {
            const w = state.draft.workouts[0];
            return {
                draft: {
                    ...state.draft,
                    workouts: [{
                        ...w,
                        items: [
                            ...w.items,
                            {
                                id: 'child-1',
                                item_type: 'exercise' as const,
                                order_index: 1,
                                parent_item_id: 'child-parent',
                                exercise_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
                                exercise_name: '',
                                exercise_equipment: null,
                                exercise_muscle_groups: [],
                                sets: 3,
                                reps: '10',
                                rest_seconds: 0,
                                notes: null,
                                exercise_function: null,
                                item_config: {},
                                substitute_exercise_ids: [],
                            },
                        ],
                    }],
                },
            };
        });

        const fetchSpy = vi.fn();
        global.fetch = fetchSpy as unknown as typeof fetch;

        const { result } = renderHook(() => useProgramBuilder());
        let res: any;
        await act(async () => { res = await result.current.saveAndAssign(STUDENT_ID); });

        expect(res.ok).toBe(false);
        expect(res.reason).toBe('SUPERSET_BLOCKED');
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(supabaseStub.functions.invoke).not.toHaveBeenCalled();
    });

    it('non-AI path (originatedFromAi=false): falls back to legacy template + assign-program Edge Function', async () => {
        useProgramBuilderStore.getState().initNewProgram(STUDENT_ID);
        useProgramBuilderStore.getState().updateName('Manual Program');
        useProgramBuilderStore.getState().addExercise(
            useProgramBuilderStore.getState().draft.workouts[0].id,
            { id: 'ex-z', name: 'Manual Ex', equipment: null, muscle_groups: [] },
        );

        const fetchSpy = vi.fn();
        global.fetch = fetchSpy as unknown as typeof fetch;

        const { result } = renderHook(() => useProgramBuilder());
        let res: any;
        await act(async () => { res = await result.current.saveAndAssign(STUDENT_ID); });

        expect(res.ok).toBe(true);
        // No call to /api/programs/assign — legacy path uses Edge Function.
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(supabaseStub.functions.invoke).toHaveBeenCalledWith(
            'assign-program',
            expect.objectContaining({
                body: expect.objectContaining({
                    studentId: STUDENT_ID,
                    templateId: 'stub-id',
                }),
            }),
        );
    });
});
