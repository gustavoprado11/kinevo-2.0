import { describe, it, expect, vi, beforeEach } from 'vitest';

;(globalThis as any).__DEV__ = false;

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
        select() { return this; }
        upsert(payload: unknown, options?: unknown) { this.q.op = 'upsert'; this.q.payload = payload; this.q.options = options; return this; }
        eq(col: string, val: unknown) { this.q.filters.push(['eq', col, val]); return this; }
        order() { return this; }
        limit() { return this; }
        maybeSingle() { this.q.single = true; return this; }
        then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
            const out = state.resolver(this.q) ?? { data: this.q.single ? null : [], error: null };
            return Promise.resolve(out).then(onFulfilled, onRejected);
        }
    }
    const supabase = {
        from: (table: string) => new QueryBuilder(table),
        auth: { getUser: async () => ({ data: { user: state.user }, error: null }) },
    };
    return { state, supabase };
});

vi.mock('../supabase', () => ({ supabase: sb.supabase }));

import { persistWatchSetLog, clearWatchSessionCache } from '../persistWatchSetLog';

const recorded = () => sb.state.recorded as any[];

beforeEach(() => {
    sb.state.recorded.length = 0;
    sb.state.user = { id: 'auth-1' };
    clearWatchSessionCache();
    sb.state.resolver = (q: any) => {
        if (q.table === 'students') return { data: { id: 'student-1' }, error: null };
        if (q.table === 'workout_sessions') return { data: { id: 'sess-1' }, error: null };
        if (q.table === 'assigned_workout_items') return { data: { exercise_id: 'ex-1' }, error: null };
        if (q.table === 'set_logs' && q.op === 'upsert') return { data: null, error: null };
        return undefined;
    };
});

describe('persistWatchSetLog', () => {
    it('grava a série do Watch como is_completed=true (idempotente)', async () => {
        const ok = await persistWatchSetLog({ workoutId: 'w1', exerciseId: 'item-1', setIndex: 2, reps: 10, weight: 80 });

        expect(ok).toBe(true);
        const ups = recorded().filter((q) => q.table === 'set_logs' && q.op === 'upsert');
        expect(ups).toHaveLength(1);
        const row = ups[0].payload as Record<string, unknown>;
        expect(row).toMatchObject({
            workout_session_id: 'sess-1',
            assigned_workout_item_id: 'item-1',
            exercise_id: 'ex-1',
            set_number: 3, // setIndex + 1
            reps_completed: 10,
            weight: 80,
            is_completed: true,
        });
        expect(ups[0].options).toMatchObject({ onConflict: 'workout_session_id,assigned_workout_item_id,set_number' });
    });

    it('sem sessão in_progress → não grava nada e retorna false', async () => {
        sb.state.resolver = (q: any) => {
            if (q.table === 'students') return { data: { id: 'student-1' }, error: null };
            if (q.table === 'workout_sessions') return { data: null, error: null }; // nenhuma sessão ativa
            return undefined;
        };

        const ok = await persistWatchSetLog({ workoutId: 'w1', exerciseId: 'item-1', setIndex: 0, reps: 8, weight: 50 });

        expect(ok).toBe(false);
        expect(recorded().some((q) => q.table === 'set_logs')).toBe(false);
    });
});
