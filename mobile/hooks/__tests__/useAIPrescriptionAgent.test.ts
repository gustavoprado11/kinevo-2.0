import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
// @ts-expect-error react-dom typings are not installed in the mobile workspace
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';

/**
 * Minimal renderHook substitute — we don't have @testing-library/react in
 * the mobile workspace, but react-dom/client + React.act are enough for the
 * pattern these hooks need. Keeps everything synchronous via act() so async
 * state updates flush before assertions.
 */
function renderHook<T>(callback: () => T): { result: { current: T }; unmount: () => void; container: HTMLDivElement } {
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
        container,
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

vi.mock('expo-haptics', () => ({
    impactAsync: vi.fn(() => Promise.resolve()),
    notificationAsync: vi.fn(() => Promise.resolve()),
    ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium', Heavy: 'Heavy' },
    NotificationFeedbackType: { Success: 'Success', Warning: 'Warning', Error: 'Error' },
}));

vi.mock('../../lib/supabase', () => ({
    supabase: {
        auth: {
            getSession: vi.fn(() => Promise.resolve({ data: { session: { access_token: 'tok' } } })),
        },
    },
}));

import { useAIPrescriptionAgent } from '../useAIPrescriptionAgent';
import type {
    PrescriptionAgentState,
    PrescriptionAgentQuestion,
    PrescriptionOutputSnapshot,
} from '@kinevo/shared/types/prescription';

const STUDENT_ID = 'student-1';

const QUESTIONS: PrescriptionAgentQuestion[] = [
    { id: 'q1', question: 'Prefere supino reto?', context: 'estilo', type: 'single_choice', options: ['Sim', 'Não'] },
];

const AGENT_STATE: PrescriptionAgentState = {
    conversation_messages: [],
    context_analysis: null,
    questions: QUESTIONS,
    answers: [],
    phase: 'questions',
};

const SNAPSHOT: PrescriptionOutputSnapshot = {
    program: { name: 'P', description: '', duration_weeks: 4 },
    workouts: [
        { name: 'A', order_index: 0, scheduled_days: [1], items: [{ item_type: 'exercise', order_index: 0, exercise_id: 'ex-1', sets: 3, reps: '10', rest_seconds: 60, notes: null }] },
    ],
    reasoning: { structure_rationale: '', volume_rationale: '', workout_notes: [], attention_flags: [], confidence_score: 0 },
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

describe('useAIPrescriptionAgent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('transitions anamnese → analyzing → questions when analyze returns >0 questions', async () => {
        mockFetch(async (url) => {
            if (url.endsWith('/api/prescription/analyze')) {
                return {
                    status: 200,
                    body: { success: true, agentState: AGENT_STATE, questions: QUESTIONS },
                };
            }
            throw new Error(`unexpected url ${url}`);
        });

        const onSuccess = vi.fn();
        const { result } = renderHook(() => useAIPrescriptionAgent(STUDENT_ID, { onSuccess }));
        expect(result.current.pageState).toBe('anamnese');

        await act(async () => { await result.current.startAnalysis(); });

        expect(result.current.pageState).toBe('questions');
        expect(result.current.questions).toHaveLength(1);
        expect(result.current.agentState).toEqual(AGENT_STATE);
        expect(onSuccess).not.toHaveBeenCalled();
    });

    it('skips straight to generating when analyze returns 0 questions', async () => {
        mockFetch(async (url) => {
            if (url.endsWith('/api/prescription/analyze')) {
                return { status: 200, body: { success: true, agentState: { ...AGENT_STATE, questions: [], phase: 'generating' }, questions: [] } };
            }
            if (url.endsWith('/api/prescription/generate')) {
                return { status: 200, body: { success: true, generationId: 'gen-1', outputSnapshot: SNAPSHOT } };
            }
            throw new Error(`unexpected url ${url}`);
        });

        const onSuccess = vi.fn();
        const { result } = renderHook(() => useAIPrescriptionAgent(STUDENT_ID, { onSuccess }));

        await act(async () => { await result.current.startAnalysis(); });

        await waitFor(() => expect(result.current.pageState).toBe('done'));
        expect(result.current.result?.generationId).toBe('gen-1');
        expect(onSuccess).toHaveBeenCalledWith({ generationId: 'gen-1', outputSnapshot: SNAPSHOT });
    });

    it('submitAnswersAndGenerate posts agentState with answers and reaches done', async () => {
        let generateBody: Record<string, unknown> | null = null;
        mockFetch(async (url, init) => {
            if (url.endsWith('/api/prescription/analyze')) {
                return { status: 200, body: { success: true, agentState: AGENT_STATE, questions: QUESTIONS } };
            }
            if (url.endsWith('/api/prescription/generate')) {
                generateBody = JSON.parse(init!.body as string);
                return { status: 200, body: { success: true, generationId: 'gen-2', outputSnapshot: SNAPSHOT } };
            }
            throw new Error(`unexpected url ${url}`);
        });

        const onSuccess = vi.fn();
        const { result } = renderHook(() => useAIPrescriptionAgent(STUDENT_ID, { onSuccess }));
        await act(async () => { await result.current.startAnalysis(); });

        act(() => { result.current.setAnswer('q1', 'Sim'); });
        await act(async () => { await result.current.submitAnswersAndGenerate(); });

        await waitFor(() => expect(result.current.pageState).toBe('done'));
        expect(generateBody).not.toBeNull();
        const sent = generateBody as unknown as Record<string, unknown>;
        expect(sent.studentId).toBe(STUDENT_ID);
        const sentAgentState = sent.agentState as PrescriptionAgentState;
        expect(sentAgentState.answers).toEqual([{ question_id: 'q1', answer: 'Sim' }]);
        expect(sentAgentState.phase).toBe('generating');
        expect(onSuccess).toHaveBeenCalledTimes(1);
    });

    it('skipQuestionsAndGenerate posts empty answers and reaches done', async () => {
        let generateBody: Record<string, unknown> | null = null;
        mockFetch(async (url, init) => {
            if (url.endsWith('/api/prescription/analyze')) {
                return { status: 200, body: { success: true, agentState: AGENT_STATE, questions: QUESTIONS } };
            }
            if (url.endsWith('/api/prescription/generate')) {
                generateBody = JSON.parse(init!.body as string);
                return { status: 200, body: { success: true, generationId: 'gen-3', outputSnapshot: SNAPSHOT } };
            }
            throw new Error(`unexpected url ${url}`);
        });

        const onSuccess = vi.fn();
        const { result } = renderHook(() => useAIPrescriptionAgent(STUDENT_ID, { onSuccess }));
        await act(async () => { await result.current.startAnalysis(); });
        await act(async () => { await result.current.skipQuestionsAndGenerate(); });

        await waitFor(() => expect(result.current.pageState).toBe('done'));
        const sentAgentState = (generateBody as unknown as Record<string, unknown>).agentState as PrescriptionAgentState;
        expect(sentAgentState.answers).toEqual([]);
        expect(sentAgentState.phase).toBe('generating');
    });

    it('sets pageState=error and exposes a pt-BR message when analyze returns 429', async () => {
        mockFetch(async () => ({ status: 429, body: { error: 'rate-limit' } }));

        const onSuccess = vi.fn();
        const { result } = renderHook(() => useAIPrescriptionAgent(STUDENT_ID, { onSuccess }));
        await act(async () => { await result.current.startAnalysis(); });

        expect(result.current.pageState).toBe('error');
        expect(result.current.error).toMatch(/Limite de gerações/i);
        expect(onSuccess).not.toHaveBeenCalled();
    });

    it('sets pageState=error when generate fails', async () => {
        mockFetch(async (url) => {
            if (url.endsWith('/api/prescription/analyze')) {
                return { status: 200, body: { success: true, agentState: { ...AGENT_STATE, questions: [] }, questions: [] } };
            }
            if (url.endsWith('/api/prescription/generate')) {
                return { status: 500, body: { error: 'boom' } };
            }
            throw new Error(`unexpected url ${url}`);
        });

        const onSuccess = vi.fn();
        const { result } = renderHook(() => useAIPrescriptionAgent(STUDENT_ID, { onSuccess }));
        await act(async () => { await result.current.startAnalysis(); });

        await waitFor(() => expect(result.current.pageState).toBe('error'));
        expect(onSuccess).not.toHaveBeenCalled();
    });
});
