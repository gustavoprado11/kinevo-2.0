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
        op: 'upsert' | 'delete' | 'select' | 'update';
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
        update(payload: unknown) { this.q.op = 'update'; this.q.payload = payload; return this; }
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
    enqueueDiscardSession,
    enqueueFinishSession,
    markSessionDiscarded,
    isSessionDiscarded,
    unmarkSessionDiscarded,
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

// ── FIX C: registro de sessões descartadas ───────────────────────────────────

describe('discarded_sessions (FIX C)', () => {
    it('marca, consulta e desmarca uma sessão descartada', () => {
        const sid = freshSession();
        expect(isSessionDiscarded(sid)).toBe(false);
        markSessionDiscarded(sid);
        expect(isSessionDiscarded(sid)).toBe(true);
        // idempotente: marcar de novo não duplica
        markSessionDiscarded(sid);
        expect(isSessionDiscarded(sid)).toBe(true);
        unmarkSessionDiscarded(sid);
        expect(isSessionDiscarded(sid)).toBe(false);
    });
});

// ── FIX C/D: ops duráveis (discard_session / finish_session) ──────────────────

describe('drain de ops duráveis (FIX C/D)', () => {
    it('discard_session drena delete-por-session_id + update abandoned e desmarca', async () => {
        const sid = freshSession();
        markSessionDiscarded(sid);
        enqueueDiscardSession(sid);

        sb.state.resolver = () => ({ data: null, error: null });
        const result = await drainPendingSetLogs();
        expect(result.flushed).toBe(1);

        const dels = sb.state.recorded.filter((q) => q.op === 'delete' && q.table === 'set_logs');
        expect(dels).toHaveLength(1);
        expect(dels[0].filters).toEqual([['workout_session_id', sid]]);

        const upds = sb.state.recorded.filter((q) => q.op === 'update' && q.table === 'workout_sessions');
        expect(upds).toHaveLength(1);
        expect(upds[0].payload).toEqual({ status: 'abandoned' });
        expect(upds[0].filters).toEqual([['id', sid], ['status', 'in_progress']]);

        // confirmado no servidor → sai do registro de descartadas
        expect(isSessionDiscarded(sid)).toBe(false);
    });

    it('discard_session que falha no delete permanece na fila e mantém a marca', async () => {
        const sid = freshSession();
        markSessionDiscarded(sid);
        enqueueDiscardSession(sid);

        sb.state.resolver = (q) => {
            if (q.op === 'delete') return { data: null, error: { message: 'ainda offline' } };
            return { data: null, error: null };
        };
        const result = await drainPendingSetLogs();
        expect(result.remaining).toBe(1);
        expect(isSessionDiscarded(sid)).toBe(true);

        // limpa pro próximo teste
        sb.state.resolver = () => ({ data: null, error: null });
        await drainPendingSetLogs();
    });

    it('finish_session drena update completed + upsert idempotente das séries', async () => {
        const sid = freshSession();
        enqueueFinishSession({
            session_id: sid,
            session_update: { status: 'completed', rpe: 8, completed_at: '2026-06-11T11:00:00Z' },
            set_logs: [payloadFor(sid, 'item-1', 1), payloadFor(sid, 'item-1', 2)],
        });

        sb.state.resolver = () => ({ data: null, error: null });
        const result = await drainPendingSetLogs();
        expect(result.flushed).toBe(1);

        const upds = sb.state.recorded.filter((q) => q.op === 'update' && q.table === 'workout_sessions');
        expect(upds).toHaveLength(1);
        expect(upds[0].payload).toMatchObject({ status: 'completed', rpe: 8 });
        expect(upds[0].filters).toEqual([['id', sid], ['status', 'in_progress']]);

        const ups = sb.state.recorded.filter((q) => q.op === 'upsert' && q.table === 'set_logs');
        expect(ups).toHaveLength(1);
        expect(ups[0].options).toMatchObject({ onConflict: 'workout_session_id,assigned_workout_item_id,set_number' });
        expect((ups[0].payload as unknown[]).length).toBe(2);
    });

    it('finish_session re-enfileirado (retry) substitui, não empilha', () => {
        const sid = freshSession();
        enqueueFinishSession({ session_id: sid, session_update: { status: 'completed' }, set_logs: [] });
        enqueueFinishSession({ session_id: sid, session_update: { status: 'completed', rpe: 9 }, set_logs: [] });
        expect(pendingSetLogCount()).toBe(1);
        clearPendingSetLogsForSession(sid);
        expect(pendingSetLogCount()).toBe(0);
    });
});
