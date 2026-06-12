import { describe, it, expect, vi, beforeEach } from 'vitest';

;(globalThis as any).__DEV__ = false;

// ── Mocks (içados antes do import do SUT) ────────────────────────────────────

const secureStore = vi.hoisted(() => ({
    getItemAsync: vi.fn(async () => null as string | null),
    setItemAsync: vi.fn(async () => undefined),
    deleteItemAsync: vi.fn(async () => undefined),
}));

vi.mock('expo-secure-store', () => ({
    getItemAsync: (...a: unknown[]) => secureStore.getItemAsync(...(a as [])),
    setItemAsync: (...a: unknown[]) => secureStore.setItemAsync(...(a as [])),
    deleteItemAsync: (...a: unknown[]) => secureStore.deleteItemAsync(...(a as [])),
    AFTER_FIRST_UNLOCK: 'afu',
}));

vi.mock('@kinevo/shared/utils/schedule-projection', () => ({
    getProgramWeek: () => 1,
}));

// ── Stub fluente do supabase (subset usado pelo SUT) ─────────────────────────

interface Q {
    table: string;
    op: 'select' | 'insert' | 'update' | 'upsert' | 'delete';
    payload?: unknown;
    options?: unknown;
    filters: Array<[string, string, unknown]>;
    single?: boolean;
}
type Out = { data: unknown; error: unknown } | undefined;

const sb = vi.hoisted(() => {
    const state = {
        recorded: [] as any[],
        resolver: ((_q: any) => undefined) as (q: any) => any,
        user: { id: 'auth-1' } as { id: string } | null,
    };
    class QueryBuilder {
        q: any;
        constructor(table: string) {
            this.q = { table, op: 'select', filters: [] };
            state.recorded.push(this.q);
        }
        select(_cols?: string) { return this; }
        insert(payload: unknown) { this.q.op = 'insert'; this.q.payload = payload; return this; }
        update(payload: unknown) { this.q.op = 'update'; this.q.payload = payload; return this; }
        upsert(payload: unknown, options?: unknown) { this.q.op = 'upsert'; this.q.payload = payload; this.q.options = options; return this; }
        delete() { this.q.op = 'delete'; return this; }
        eq(col: string, val: unknown) { this.q.filters.push(['eq', col, val]); return this; }
        in(col: string, val: unknown) { this.q.filters.push(['in', col, val]); return this; }
        order(_c?: string, _o?: unknown) { return this; }
        limit(_n?: number) { return this; }
        gte(col: string, val: unknown) { this.q.filters.push(['gte', col, val]); return this; }
        maybeSingle() { this.q.single = true; return this; }
        single() { this.q.single = true; return this; }
        then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
            const out = state.resolver(this.q) ?? { data: this.q.single ? null : [], error: null };
            return Promise.resolve(out).then(onFulfilled, onRejected);
        }
    }
    const supabase = {
        from: (table: string) => new QueryBuilder(table),
        auth: {
            refreshSession: async () => ({ data: {}, error: null }),
            getUser: async () => ({ data: { user: state.user }, error: null }),
        },
    };
    return { state, supabase };
});

vi.mock('../supabase', () => ({ supabase: sb.supabase }));

import { finishWorkoutFromWatch } from '../finishWorkoutFromWatch';

type Resolver = (q: Q) => Out;
const setResolver = (fn: Resolver) => { sb.state.resolver = fn as never; };
const recorded = () => sb.state.recorded as Q[];
const upserts = (table: string) => recorded().filter((q) => q.table === table && q.op === 'upsert');

beforeEach(() => {
    sb.state.recorded.length = 0;
    sb.state.user = { id: 'auth-1' };
    secureStore.getItemAsync.mockResolvedValue(null);
    secureStore.setItemAsync.mockClear();
    // Happy-path resolver: canonical-session update path.
    setResolver((q) => {
        if (q.table === 'students') return { data: { id: 'student-1', coach_id: 'coach-1' }, error: null };
        if (q.table === 'assigned_workouts') return { data: { assigned_program_id: 'prog-1', name: 'Treino A' }, error: null };
        if (q.table === 'assigned_programs') return { data: { started_at: '2026-06-01T00:00:00Z', duration_weeks: 8 }, error: null };
        if (q.table === 'workout_sessions' && q.op === 'update') return { data: null, error: null };
        if (q.table === 'assigned_workout_items') return { data: [{ id: 'item-1', exercise_id: 'ex-1' }], error: null };
        if (q.table === 'set_logs' && q.op === 'upsert') return { data: null, error: null };
        return undefined;
    });
});

describe('finishWorkoutFromWatch', () => {
    it('A3: não grava séries incompletas (sem downgrade de is_completed)', async () => {
        const result = await finishWorkoutFromWatch({
            workoutId: 'workout-1',
            sessionId: 'sess-canon', // caminho de sessão canônica
            rpe: 8,
            startedAt: '2026-06-12T10:00:00Z',
            exercises: [
                {
                    id: 'item-1',
                    sets: [
                        { setIndex: 0, reps: 10, weight: 80, completed: true },
                        { setIndex: 1, reps: 0, weight: 0, completed: false }, // incompleta
                        { setIndex: 2, reps: 8, weight: 80, completed: true },
                    ],
                },
            ],
        });

        expect(result).toBe('sess-canon');

        const setLogUpserts = upserts('set_logs');
        expect(setLogUpserts).toHaveLength(1);
        const rows = setLogUpserts[0].payload as Array<Record<string, unknown>>;
        // Só as 2 séries completas; a incompleta (setIndex 1) foi descartada.
        expect(rows).toHaveLength(2);
        expect(rows.map((r) => r.set_number).sort()).toEqual([1, 3]);
        expect(rows.every((r) => r.is_completed === true)).toBe(true);
        expect(rows.every((r) => r.completed_at !== null)).toBe(true);
    });

    it('sem usuário autenticado → retorna "pending" e enfileira no SecureStore', async () => {
        sb.state.user = null;

        const result = await finishWorkoutFromWatch({
            workoutId: 'workout-1',
            rpe: 7,
            exercises: [{ id: 'item-1', sets: [{ setIndex: 0, reps: 10, weight: 80, completed: true }] }],
        });

        expect(result).toBe('pending');
        expect(secureStore.setItemAsync).toHaveBeenCalledTimes(1);
        // Nenhuma série foi gravada (não há sessão).
        expect(upserts('set_logs')).toHaveLength(0);
    });

    it('atualiza a sessão canônica com status completed + rpe', async () => {
        await finishWorkoutFromWatch({
            workoutId: 'workout-1',
            sessionId: 'sess-canon',
            rpe: 9,
            startedAt: '2026-06-12T10:00:00Z',
            exercises: [{ id: 'item-1', sets: [{ setIndex: 0, reps: 10, weight: 80, completed: true }] }],
        });

        const updates = recorded().filter((q) => q.table === 'workout_sessions' && q.op === 'update');
        expect(updates).toHaveLength(1);
        const payload = updates[0].payload as Record<string, unknown>;
        expect(payload.status).toBe('completed');
        expect(payload.rpe).toBe(9);
        expect(updates[0].filters).toContainEqual(['eq', 'id', 'sess-canon']);
    });
});
