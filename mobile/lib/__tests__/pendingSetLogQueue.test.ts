// Testes da fila offline de set_logs (A4). O storage cai no fallback
// in-memory (mock do react-native-mmkv lança) e o supabase é um stub que
// registra upserts/deletes e resolve via resolver configurável.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

;(globalThis as any).__DEV__ = false;

vi.mock('react-native-mmkv', () => ({
    createMMKV: () => { throw new Error('sem módulo nativo no teste'); },
}));

const sb = vi.hoisted(() => {
    interface Q {
        table: string;
        op: 'upsert' | 'delete' | 'select';
        payload?: unknown;
        options?: unknown;
        filters: Array<[string, unknown]>;
    }
    type Out = { data: unknown; error: unknown } | undefined;
    const state = {
        recorded: [] as Q[],
        resolver: ((_q: Q) => undefined) as (q: Q) => Out,
    };
    class QueryBuilder {
        q: Q;
        constructor(table: string) {
            this.q = { table, op: 'select', filters: [] };
            state.recorded.push(this.q);
        }
        upsert(payload: unknown, options?: unknown) { this.q.op = 'upsert'; this.q.payload = payload; this.q.options = options; return this; }
        delete() { this.q.op = 'delete'; return this; }
        eq(col: string, val: unknown) { this.q.filters.push([col, val]); return this; }
        then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
            const out = state.resolver(this.q) ?? { data: null, error: null };
            return Promise.resolve(out).then(onFulfilled, onRejected);
        }
    }
    return { state, supabase: { from: (t: string) => new QueryBuilder(t) } };
});

vi.mock('../supabase', () => ({ supabase: sb.supabase }));

import {
    enqueueSetLogUpsert,
    enqueueSetLogDelete,
    clearPendingSetLogsForSession,
    drainPendingSetLogs,
    pendingSetLogCount,
} from '../pendingSetLogQueue';

let seq = 0;
/** Sessão única por teste — o storage in-memory é compartilhado no arquivo. */
function freshSession() {
    seq++;
    return `sess-${seq}`;
}

function payloadFor(sessionId: string, item = 'item-1', setNumber = 1) {
    return {
        workout_session_id: sessionId,
        assigned_workout_item_id: item,
        set_number: setNumber,
        weight: 50,
        reps_completed: 8,
        is_completed: true,
    };
}

beforeEach(() => {
    sb.state.recorded.length = 0;
    sb.state.resolver = () => undefined;
});

afterEach(async () => {
    // esvazia a fila pro próximo teste (drain com supabase ok)
    sb.state.resolver = () => ({ data: null, error: null });
    await drainPendingSetLogs();
    vi.useRealTimers();
});

describe('pendingSetLogQueue', () => {
    it('enfileira e deduplica pela chave natural (última operação vence)', () => {
        const sid = freshSession();
        enqueueSetLogUpsert(payloadFor(sid, 'item-1', 1));
        enqueueSetLogUpsert(payloadFor(sid, 'item-1', 2));
        expect(pendingSetLogCount()).toBe(2);

        // upsert repetido da mesma série substitui (não acumula)
        enqueueSetLogUpsert({ ...payloadFor(sid, 'item-1', 1), weight: 60 });
        expect(pendingSetLogCount()).toBe(2);

        // delete da mesma série substitui o upsert pendente
        enqueueSetLogDelete({ workout_session_id: sid, assigned_workout_item_id: 'item-1', set_number: 1 });
        expect(pendingSetLogCount()).toBe(2);
    });

    it('drena upserts com onConflict idempotente e remove os que deram certo', async () => {
        const sid = freshSession();
        enqueueSetLogUpsert(payloadFor(sid, 'item-1', 1));
        enqueueSetLogUpsert(payloadFor(sid, 'item-2', 1));

        const result = await drainPendingSetLogs();
        expect(result).toEqual({ flushed: 2, remaining: 0 });
        expect(pendingSetLogCount()).toBe(0);

        const upserts = sb.state.recorded.filter((q) => q.op === 'upsert');
        expect(upserts).toHaveLength(2);
        expect(upserts[0].options).toMatchObject({ onConflict: 'workout_session_id,assigned_workout_item_id,set_number' });
        expect(upserts[0].payload).toMatchObject({ workout_session_id: sid, weight: 50 });
    });

    it('drena deletes com os três filtros da chave', async () => {
        const sid = freshSession();
        enqueueSetLogDelete({ workout_session_id: sid, assigned_workout_item_id: 'item-1', set_number: 3 });

        await drainPendingSetLogs();
        const dels = sb.state.recorded.filter((q) => q.op === 'delete');
        expect(dels).toHaveLength(1);
        expect(dels[0].filters).toEqual([
            ['workout_session_id', sid],
            ['assigned_workout_item_id', 'item-1'],
            ['set_number', 3],
        ]);
    });

    it('mantém na fila o que falhar (ainda offline) e drena depois', async () => {
        const sid = freshSession();
        enqueueSetLogUpsert(payloadFor(sid, 'item-1', 1));
        enqueueSetLogUpsert(payloadFor(sid, 'item-2', 1));

        sb.state.resolver = (q) => {
            const p = q.payload as { assigned_workout_item_id?: string } | undefined;
            if (q.op === 'upsert' && p?.assigned_workout_item_id === 'item-2') {
                return { data: null, error: { message: 'ainda offline' } };
            }
            return { data: null, error: null };
        };

        const first = await drainPendingSetLogs();
        expect(first).toEqual({ flushed: 1, remaining: 1 });
        expect(pendingSetLogCount()).toBe(1);

        sb.state.resolver = () => ({ data: null, error: null });
        const second = await drainPendingSetLogs();
        expect(second).toEqual({ flushed: 1, remaining: 0 });
    });

    it('clearPendingSetLogsForSession remove SÓ as pendências daquela sessão', () => {
        const sidA = freshSession();
        const sidB = freshSession();
        enqueueSetLogUpsert(payloadFor(sidA, 'item-1', 1));
        enqueueSetLogUpsert(payloadFor(sidB, 'item-1', 1));
        expect(pendingSetLogCount()).toBe(2);

        clearPendingSetLogsForSession(sidA);
        expect(pendingSetLogCount()).toBe(1);
    });

    it('descarta pendências velhas (>24h) sem executar nada', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-06-10T00:00:00Z'));
        const sid = freshSession();
        enqueueSetLogUpsert(payloadFor(sid, 'item-1', 1));

        vi.setSystemTime(new Date('2026-06-11T01:00:00Z')); // 25h depois
        const result = await drainPendingSetLogs();
        expect(result).toEqual({ flushed: 0, remaining: 0 });
        expect(sb.state.recorded.filter((q) => q.op === 'upsert')).toHaveLength(0);
    });
});
