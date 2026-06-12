// Rede de proteção do useWorkoutSession (1.5k linhas) — escrita antes da
// fila offline (A4) pra travar o comportamento atual do player.
//
// Estratégia: renderHook (react-dom/@testing-library) + stub fluente do
// supabase que registra cada query (tabela, operação, payload, filtros) e
// resolve via resolver configurável por teste. Platform.OS default 'android'
// pra não exercitar o require() do módulo nativo do Watch.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act, cleanup } from '@testing-library/react';

;(globalThis as any).__DEV__ = false;

// ── Mocks (antes dos imports do hook; vi.mock é içado, então tudo que as
//    factories referenciam vem de vi.hoisted) ────────────────────────────────

const { alertMock, platformMock, saveWorkoutState, loadWorkoutState, clearWorkoutState, enqueueSetLogUpsert, enqueueSetLogDelete, clearPendingSetLogsForSession } = vi.hoisted(() => ({
    alertMock: vi.fn(),
    platformMock: { OS: 'android' as string },
    saveWorkoutState: vi.fn(),
    loadWorkoutState: vi.fn(() => null as unknown),
    clearWorkoutState: vi.fn(),
    enqueueSetLogUpsert: vi.fn(),
    enqueueSetLogDelete: vi.fn(),
    clearPendingSetLogsForSession: vi.fn(),
}));

vi.mock('react-native', () => ({
    Platform: platformMock,
    Alert: { alert: (...args: unknown[]) => alertMock(...args) },
}));

vi.mock('expo-router', () => ({
    router: { back: vi.fn(), push: vi.fn(), replace: vi.fn() },
}));

vi.mock('../../contexts/AuthContext', () => ({
    useAuth: () => ({ user: { id: 'auth-1' } }),
}));

vi.mock('../../lib/workoutStatePersistence', () => ({
    saveWorkoutState: (...a: unknown[]) => saveWorkoutState(...(a as [unknown, unknown])),
    loadWorkoutState: (...a: unknown[]) => loadWorkoutState(...(a as [])),
    clearWorkoutState: (...a: unknown[]) => clearWorkoutState(...(a as [unknown])),
}));

vi.mock('../../lib/pendingSetLogQueue', () => ({
    enqueueSetLogUpsert: (...a: unknown[]) => enqueueSetLogUpsert(...(a as [unknown])),
    enqueueSetLogDelete: (...a: unknown[]) => enqueueSetLogDelete(...(a as [unknown])),
    clearPendingSetLogsForSession: (...a: unknown[]) => clearPendingSetLogsForSession(...(a as [unknown])),
}));

// ── Stub fluente do supabase ─────────────────────────────────────────────────

interface RecordedQuery {
    table: string;
    op: 'select' | 'insert' | 'update' | 'upsert' | 'delete' | 'rpc';
    payload?: unknown;
    options?: unknown;
    filters: Array<[string, string, unknown]>;
    single?: boolean;
}

type QueryResult = { data: unknown; error: unknown } | undefined;
type Resolver = (q: RecordedQuery) => QueryResult;

const sb = vi.hoisted(() => {
    interface Q {
        table: string;
        op: 'select' | 'insert' | 'update' | 'upsert' | 'delete' | 'rpc';
        payload?: unknown;
        options?: unknown;
        filters: Array<[string, string, unknown]>;
        single?: boolean;
    }
    type Out = { data: unknown; error: unknown } | undefined;
    const state = {
        recorded: [] as Q[],
        resolver: ((_q: Q) => undefined) as (q: Q) => Out,
        rpcResolver: ((_fn: string, _args: unknown) => undefined) as (fn: string, args: unknown) => Out,
    };
    class QueryBuilder {
        q: Q;
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
        ilike(col: string, val: unknown) { this.q.filters.push(['ilike', col, val]); return this; }
        order(_c?: string, _o?: unknown) { return this; }
        limit(_n?: number) { return this; }
        maybeSingle() { this.q.single = true; return this; }
        single() { this.q.single = true; return this; }
        then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
            const out = state.resolver(this.q) ?? { data: this.q.single ? null : [], error: null };
            return Promise.resolve(out).then(onFulfilled, onRejected);
        }
    }
    const supabase = {
        from: (table: string) => new QueryBuilder(table),
        rpc: (fn: string, args: unknown) => {
            const q: Q = { table: `rpc:${fn}`, op: 'rpc', payload: args, filters: [] };
            state.recorded.push(q);
            return Promise.resolve(state.rpcResolver(fn, args) ?? { data: null, error: null });
        },
    };
    return { state, supabase };
});

const recorded = sb.state.recorded as RecordedQuery[];
const setResolver = (fn: Resolver) => { sb.state.resolver = fn as never; };
const setRpcResolver = (fn: (f: string, a: unknown) => QueryResult) => { sb.state.rpcResolver = fn as never; };

vi.mock('../../lib/supabase', () => ({ supabase: sb.supabase }));

import { useWorkoutSession } from '../useWorkoutSession';

// ── Fixtures / resolver padrão ───────────────────────────────────────────────

const WORKOUT_ID = 'workout-1';

function makeItem(over: Record<string, unknown> = {}) {
    return {
        id: 'item-1',
        exercise_id: 'ex-1',
        exercise_name: 'Supino',
        sets: 3,
        reps: '10',
        rest_seconds: 60,
        substitute_exercise_ids: [],
        item_type: 'exercise',
        order_index: 0,
        parent_item_id: null,
        notes: null,
        exercise_function: null,
        item_config: {},
        method_key: null,
        rounds: 1,
        exercises: { id: 'ex-1', video_url: null },
        ...over,
    };
}

interface ScenarioOptions {
    existingSession?: { id: string; started_at: string } | null;
    persistedLogs?: Array<{ assigned_workout_item_id: string; set_number: number; weight: number; reps_completed: number; notes: string | null }>;
    items?: Array<Record<string, unknown>>;
    itemSets?: Array<Record<string, unknown>>;
    previousSets?: Array<{ set_number: number; weight: number; reps: number }>;
    sessionInsert?: QueryResult;
    sessionUpdate?: QueryResult;
    setLogUpsert?: QueryResult;
}

/** Resolver do caminho feliz do fetchWorkout, com pontos de configuração. */
function installScenario(opts: ScenarioOptions = {}) {
    const items = opts.items ?? [makeItem()];
    setResolver((q) => {
        if (q.table === 'students') {
            const byAuth = q.filters.some(([, c]) => c === 'auth_user_id');
            if (byAuth) return { data: { id: 'student-1', coach_id: 'coach-1' }, error: null };
            return { data: { coach_id: 'coach-1' }, error: null };
        }
        if (q.table === 'assigned_workouts') {
            return { data: { name: 'Treino A', assigned_program_id: 'prog-1', scheduled_days: [new Date().getDay()] }, error: null };
        }
        if (q.table === 'assigned_programs') {
            return { data: { started_at: '2026-06-01T00:00:00Z', duration_weeks: 4 }, error: null };
        }
        if (q.table === 'workout_sessions' && q.op === 'select') {
            return { data: opts.existingSession ?? null, error: null };
        }
        if (q.table === 'workout_sessions' && q.op === 'insert') {
            return opts.sessionInsert ?? { data: { id: 'sess-new' }, error: null };
        }
        if (q.table === 'workout_sessions' && q.op === 'update') {
            return opts.sessionUpdate ?? { data: null, error: null };
        }
        if (q.table === 'set_logs' && q.op === 'select') {
            // rehidratação A2 (sessão reanexada) — filtra por workout_session_id
            if (q.filters.some(([, c]) => c === 'workout_session_id')) {
                return { data: opts.persistedLogs ?? [], error: null };
            }
            return { data: null, error: null }; // fallback legado de histórico
        }
        if (q.table === 'set_logs' && q.op === 'upsert') {
            return opts.setLogUpsert ?? { data: null, error: null };
        }
        if (q.table === 'set_logs' && q.op === 'delete') {
            return { data: null, error: null };
        }
        if (q.table === 'assigned_workout_items') {
            return { data: items, error: null };
        }
        if (q.table === 'assigned_workout_item_sets') {
            return { data: opts.itemSets ?? [], error: null };
        }
        if (q.table === 'trainer_exercise_videos') {
            return { data: [], error: null };
        }
        return undefined;
    });
    setRpcResolver((fn) => {
        if (fn === 'get_previous_exercise_sets') {
            return { data: opts.previousSets ?? [], error: null };
        }
        return { data: [], error: null };
    });
}

async function renderSession(options?: Parameters<typeof useWorkoutSession>[1]) {
    const utils = renderHook(() => useWorkoutSession(WORKOUT_ID, options));
    await waitFor(() => expect(utils.result.current.isLoading).toBe(false), { timeout: 4000 });
    return utils;
}

const queriesFor = (table: string, op?: RecordedQuery['op']) =>
    recorded.filter((q) => q.table === table && (!op || q.op === op));

beforeEach(() => {
    recorded.length = 0;
    setResolver(() => undefined);
    setRpcResolver(() => undefined);
    platformMock.OS = 'android';
    alertMock.mockClear();
    saveWorkoutState.mockClear();
    loadWorkoutState.mockReset();
    loadWorkoutState.mockReturnValue(null);
    clearWorkoutState.mockClear();
    enqueueSetLogUpsert.mockClear();
    enqueueSetLogDelete.mockClear();
    clearPendingSetLogsForSession.mockClear();
});

afterEach(() => {
    cleanup();
});

// ── 1. fetchWorkout / reanexação ─────────────────────────────────────────────

describe('fetchWorkout', () => {
    it('monta exercises a partir do banco com sets vazios (sessão nova, defer)', async () => {
        installScenario();
        const { result } = await renderSession({ deferSessionCreation: true });

        expect(result.current.workoutName).toBe('Treino A');
        expect(result.current.exercises).toHaveLength(1);
        const ex = result.current.exercises[0];
        expect(ex.name).toBe('Supino');
        expect(ex.setsData).toHaveLength(3);
        expect(ex.setsData.every((s) => !s.completed && s.weight === '' && s.reps === '')).toBe(true);
        // defer: NENHUM insert de sessão no mount
        expect(queriesFor('workout_sessions', 'insert')).toHaveLength(0);
    });

    it('sem defer cria a sessão no mount com sync_status synced (comportamento atual)', async () => {
        installScenario();
        await renderSession();
        const inserts = queriesFor('workout_sessions', 'insert');
        expect(inserts).toHaveLength(1);
        const payload = inserts[0].payload as Record<string, unknown>;
        expect(payload.status).toBe('in_progress');
        expect(payload.student_id).toBe('student-1');
        expect(payload.trainer_id).toBe('coach-1');
        // comportamento atual: hardcoded 'synced' (A4 vai tornar isso real)
        expect(payload.sync_status).toBe('synced');
    });

    it('A2: sessão reanexada rehidrata set_logs como completed', async () => {
        installScenario({
            existingSession: { id: 'sess-old', started_at: '2026-06-11T10:00:00Z' },
            persistedLogs: [
                { assigned_workout_item_id: 'item-1', set_number: 1, weight: 50, reps_completed: 8, notes: null },
                { assigned_workout_item_id: 'item-1', set_number: 3, weight: 60, reps_completed: 6, notes: null },
            ],
        });
        const { result } = await renderSession({ deferSessionCreation: true });
        const sets = result.current.exercises[0].setsData;
        expect(sets[0]).toEqual({ weight: '50', reps: '8', completed: true });
        expect(sets[1].completed).toBe(false);
        expect(sets[2]).toEqual({ weight: '60', reps: '6', completed: true });
        // reanexou: não cria sessão nova
        expect(queriesFor('workout_sessions', 'insert')).toHaveLength(0);
    });
});

// ── 2. Merge do snapshot local (S4) ──────────────────────────────────────────

describe('snapshot local (S4)', () => {
    it('valores digitados não-completed vêm do snapshot; completed do banco ganham', async () => {
        loadWorkoutState.mockReturnValue({
            sessionId: 'sess-old',
            savedAt: new Date().toISOString(),
            exercises: [{
                id: 'item-1', exercise_id: 'ex-1', name: 'Supino', video_url: undefined,
                swap_source: 'none',
                setsData: [
                    { weight: '99', reps: '99', completed: false }, // banco ganha (completed lá)
                    { weight: '55', reps: '7', completed: false },  // digitado sem marcar → snapshot
                    { weight: '', reps: '', completed: false },
                ],
                item_config: {},
            }],
        });
        installScenario({
            existingSession: { id: 'sess-old', started_at: '2026-06-11T10:00:00Z' },
            persistedLogs: [
                { assigned_workout_item_id: 'item-1', set_number: 1, weight: 50, reps_completed: 8, notes: null },
            ],
        });
        const { result } = await renderSession({ deferSessionCreation: true });
        const sets = result.current.exercises[0].setsData;
        expect(sets[0]).toEqual({ weight: '50', reps: '8', completed: true }); // banco
        expect(sets[1]).toEqual({ weight: '55', reps: '7', completed: false }); // snapshot
        expect(sets[2]).toEqual({ weight: '', reps: '', completed: false });
    });

    it('snapshot de outra sessão é descartado (clearWorkoutState)', async () => {
        loadWorkoutState.mockReturnValue({
            sessionId: 'sess-MORTA',
            savedAt: new Date().toISOString(),
            exercises: [{ id: 'item-1', exercise_id: 'ex-1', name: 'Supino', swap_source: 'none', setsData: [{ weight: '55', reps: '7', completed: true }], item_config: {} }],
        });
        installScenario({ existingSession: { id: 'sess-old', started_at: '2026-06-11T10:00:00Z' } });
        const { result } = await renderSession({ deferSessionCreation: true });
        expect(clearWorkoutState).toHaveBeenCalledWith(WORKOUT_ID);
        expect(result.current.exercises[0].setsData.every((s) => !s.completed)).toBe(true);
    });

    it('efeito de save grava snapshot a cada mudança de exercises', async () => {
        installScenario();
        const { result } = await renderSession({ deferSessionCreation: true });
        saveWorkoutState.mockClear();
        act(() => result.current.handleSetChange(0, 0, 'weight', '42'));
        await waitFor(() => expect(saveWorkoutState).toHaveBeenCalled());
        const [savedWorkoutId, state] = saveWorkoutState.mock.calls.at(-1)!;
        expect(savedWorkoutId).toBe(WORKOUT_ID);
        expect((state as { exercises: Array<{ setsData: Array<{ weight: string }> }> }).exercises[0].setsData[0].weight).toBe('42');
    });
});

// ── 3. handleSetChange (waterfall) ───────────────────────────────────────────

describe('handleSetChange', () => {
    it('waterfall propaga para séries seguintes vazias/auto-preenchidas', async () => {
        installScenario();
        const { result } = await renderSession({ deferSessionCreation: true });
        act(() => result.current.handleSetChange(0, 0, 'weight', '50'));
        expect(result.current.exercises[0].setsData.map((s) => s.weight)).toEqual(['50', '50', '50']);

        // editar a série 1 também propaga (série 2 ainda era valor auto-preenchido)
        act(() => result.current.handleSetChange(0, 1, 'weight', '60'));
        expect(result.current.exercises[0].setsData.map((s) => s.weight)).toEqual(['50', '60', '60']);

        // série editada manualmente vira "pedra": editar a série 0 não passa da 1
        act(() => result.current.handleSetChange(0, 0, 'weight', '55'));
        expect(result.current.exercises[0].setsData.map((s) => s.weight)).toEqual(['55', '60', '60']);
    });

    it('NÃO propaga quando o setScheme é heterogêneo (pirâmide)', async () => {
        installScenario({
            itemSets: [
                { assigned_workout_item_id: 'item-1', set_number: 1, set_type: 'normal', reps: '12', rest_seconds: 60, weight_target_kg: 40, weight_target_pct1rm: null, rir: null, tempo: null, notes: null, round_number: null },
                { assigned_workout_item_id: 'item-1', set_number: 2, set_type: 'normal', reps: '10', rest_seconds: 60, weight_target_kg: 60, weight_target_pct1rm: null, rir: null, tempo: null, notes: null, round_number: null },
                { assigned_workout_item_id: 'item-1', set_number: 3, set_type: 'normal', reps: '8', rest_seconds: 60, weight_target_kg: 70, weight_target_pct1rm: null, rir: null, tempo: null, notes: null, round_number: null },
            ],
        });
        const { result } = await renderSession({ deferSessionCreation: true });
        act(() => result.current.handleSetChange(0, 0, 'weight', '45'));
        expect(result.current.exercises[0].setsData.map((s) => s.weight)).toEqual(['45', '', '']);
    });
});

// ── 4. handleToggleSetComplete (C1/C2) ───────────────────────────────────────

describe('handleToggleSetComplete', () => {
    it('marca com herança C1 (alvo prescrito vence) e persiste com payload certo', async () => {
        installScenario({
            existingSession: { id: 'sess-1', started_at: '2026-06-11T10:00:00Z' },
            itemSets: [
                { assigned_workout_item_id: 'item-1', set_number: 1, set_type: 'normal', reps: '12', rest_seconds: 60, weight_target_kg: 40, weight_target_pct1rm: null, rir: null, tempo: null, notes: null, round_number: null },
            ],
            previousSets: [{ set_number: 1, weight: 35, reps: 10 }],
        });
        const { result } = await renderSession({ deferSessionCreation: true });
        act(() => result.current.handleToggleSetComplete(0, 0));

        const sets = result.current.exercises[0].setsData;
        expect(sets[0].completed).toBe(true);
        expect(sets[0].weight).toBe('40'); // alvo prescrito > anterior

        await waitFor(() => expect(queriesFor('set_logs', 'upsert')).toHaveLength(1));
        const up = queriesFor('set_logs', 'upsert')[0];
        expect(up.payload).toMatchObject({
            workout_session_id: 'sess-1',
            assigned_workout_item_id: 'item-1',
            set_number: 1,
            weight: 40,
            reps_completed: 12,
            is_completed: true,
        });
        expect(up.options).toMatchObject({ onConflict: 'workout_session_id,assigned_workout_item_id,set_number' });
    });

    it('sem alvo, herda do histórico (anterior)', async () => {
        installScenario({
            existingSession: { id: 'sess-1', started_at: '2026-06-11T10:00:00Z' },
            previousSets: [{ set_number: 1, weight: 35, reps: 10 }],
        });
        const { result } = await renderSession({ deferSessionCreation: true });
        act(() => result.current.handleToggleSetComplete(0, 0));
        expect(result.current.exercises[0].setsData[0]).toMatchObject({ weight: '35', reps: '10', completed: true });
    });

    it('0×0 sem nada a herdar dispara onEmptySetLogged (sem bloquear)', async () => {
        installScenario({ existingSession: { id: 'sess-1', started_at: '2026-06-11T10:00:00Z' } });
        const onEmptySetLogged = vi.fn();
        const { result } = await renderSession({ deferSessionCreation: true, onEmptySetLogged });
        act(() => result.current.handleToggleSetComplete(0, 0));
        expect(result.current.exercises[0].setsData[0].completed).toBe(true);
        expect(onEmptySetLogged).toHaveBeenCalledWith(0, 0);
    });

    it('desmarcar deleta o log persistido (C2)', async () => {
        installScenario({
            existingSession: { id: 'sess-1', started_at: '2026-06-11T10:00:00Z' },
            persistedLogs: [{ assigned_workout_item_id: 'item-1', set_number: 1, weight: 50, reps_completed: 8, notes: null }],
        });
        const { result } = await renderSession({ deferSessionCreation: true });
        act(() => result.current.handleToggleSetComplete(0, 0)); // estava completed → desmarca
        expect(result.current.exercises[0].setsData[0].completed).toBe(false);
        await waitFor(() => {
            const dels = queriesFor('set_logs', 'delete');
            expect(dels).toHaveLength(1);
            expect(dels[0].filters).toEqual(expect.arrayContaining([
                ['eq', 'workout_session_id', 'sess-1'],
                ['eq', 'assigned_workout_item_id', 'item-1'],
                ['eq', 'set_number', 1],
            ]));
        });
    });

    it('persistSetLog sem sessão (defer + createSession falhando) retém em memória', async () => {
        installScenario({ sessionInsert: { data: null, error: { message: 'offline' } } });
        const { result } = await renderSession({ deferSessionCreation: true });
        act(() => result.current.handleToggleSetComplete(0, 0));
        // série fica marcada no estado…
        expect(result.current.exercises[0].setsData[0].completed).toBe(true);
        // …mas nenhum upsert aconteceu (vai no catch-up do finish)
        await new Promise((r) => setTimeout(r, 50));
        expect(queriesFor('set_logs', 'upsert')).toHaveLength(0);
    });
});

// ── 5. createSession ─────────────────────────────────────────────────────────

describe('createSession', () => {
    it('dedup: chamadas concorrentes geram UM insert; pre_workout_submission_id propaga', async () => {
        installScenario();
        const { result } = await renderSession({ deferSessionCreation: true });
        let a: string | null = null;
        let b: string | null = null;
        await act(async () => {
            [a, b] = await Promise.all([
                result.current.createSession('sub-1'),
                result.current.createSession('sub-1'),
            ]);
        });
        expect(a).toBe('sess-new');
        expect(b).toBe('sess-new');
        const inserts = queriesFor('workout_sessions', 'insert');
        expect(inserts).toHaveLength(1);
        expect((inserts[0].payload as Record<string, unknown>).pre_workout_submission_id).toBe('sub-1');
    });

    it('retorna o sessionId existente sem novo insert', async () => {
        installScenario({ existingSession: { id: 'sess-old', started_at: '2026-06-11T10:00:00Z' } });
        const { result } = await renderSession({ deferSessionCreation: true });
        let sid: string | null = null;
        await act(async () => { sid = await result.current.createSession(); });
        expect(sid).toBe('sess-old');
        expect(queriesFor('workout_sessions', 'insert')).toHaveLength(0);
    });
});

// ── 6. discardWorkout (A1) ───────────────────────────────────────────────────

describe('discardWorkout', () => {
    it('deleta set_logs, abandona a sessão (guard de status) e limpa o snapshot', async () => {
        installScenario({ existingSession: { id: 'sess-1', started_at: '2026-06-11T10:00:00Z' } });
        const { result } = await renderSession({ deferSessionCreation: true });
        await act(async () => { await result.current.discardWorkout(); });

        expect(clearWorkoutState).toHaveBeenCalledWith(WORKOUT_ID);
        const dels = queriesFor('set_logs', 'delete');
        expect(dels).toHaveLength(1);
        expect(dels[0].filters).toEqual([['eq', 'workout_session_id', 'sess-1']]);
        const updates = queriesFor('workout_sessions', 'update');
        expect(updates).toHaveLength(1);
        expect(updates[0].payload).toEqual({ status: 'abandoned' });
        expect(updates[0].filters).toEqual(expect.arrayContaining([
            ['eq', 'id', 'sess-1'],
            ['eq', 'status', 'in_progress'],
        ]));
    });

    it('barra persistências e snapshots posteriores (isDiscardingRef)', async () => {
        installScenario({ existingSession: { id: 'sess-1', started_at: '2026-06-11T10:00:00Z' } });
        const { result } = await renderSession({ deferSessionCreation: true });
        await act(async () => { await result.current.discardWorkout(); });
        saveWorkoutState.mockClear();
        act(() => result.current.handleToggleSetComplete(0, 0));
        await new Promise((r) => setTimeout(r, 50));
        expect(queriesFor('set_logs', 'upsert')).toHaveLength(0); // persist barrado
        expect(saveWorkoutState).not.toHaveBeenCalled(); // snapshot barrado
    });

    it('sem sessão é no-op no banco (mas limpa snapshot)', async () => {
        installScenario();
        const { result } = await renderSession({ deferSessionCreation: true });
        await act(async () => { await result.current.discardWorkout(); });
        expect(clearWorkoutState).toHaveBeenCalled();
        expect(queriesFor('set_logs', 'delete')).toHaveLength(0);
        expect(queriesFor('workout_sessions', 'update')).toHaveLength(0);
    });
});

// ── 7. finishWorkout ─────────────────────────────────────────────────────────

describe('finishWorkout', () => {
    it('completa a sessão com started_at REAL (A14) e faz catch-up das séries em memória', async () => {
        installScenario({
            existingSession: { id: 'sess-1', started_at: '2026-06-11T10:00:00Z' },
            sessionInsert: { data: null, error: { message: 'não deveria inserir' } },
        });
        const { result } = await renderSession({ deferSessionCreation: true });
        act(() => result.current.handleSetChange(0, 0, 'weight', '50'));
        act(() => result.current.handleSetChange(0, 0, 'reps', '8'));
        act(() => result.current.handleToggleSetComplete(0, 0));

        let sid: unknown;
        await act(async () => { sid = await result.current.finishWorkout(8, 'bom treino'); });
        expect(sid).toBe('sess-1');

        const updates = queriesFor('workout_sessions', 'update');
        expect(updates).toHaveLength(1);
        const payload = updates[0].payload as Record<string, unknown>;
        expect(payload.status).toBe('completed');
        expect(payload.started_at).toBe('2026-06-11T10:00:00Z'); // A14
        expect(payload.rpe).toBe(8);
        expect(typeof payload.duration_seconds).toBe('number');

        // catch-up idempotente (a série marcada já tinha sido persistida; o
        // finish re-upserta em lote)
        const upserts = queriesFor('set_logs', 'upsert');
        const batch = upserts.at(-1)!;
        expect(Array.isArray(batch.payload)).toBe(true);
        expect((batch.payload as unknown[]).length).toBe(1);
        expect(batch.options).toMatchObject({ onConflict: 'workout_session_id,assigned_workout_item_id,set_number' });

        // S4: snapshot limpo e não regravado
        expect(clearWorkoutState).toHaveBeenCalledWith(WORKOUT_ID);
    });

    it('falha no upsert do catch-up → reverte sessão p/ in_progress e lança (C3)', async () => {
        installScenario({
            existingSession: { id: 'sess-1', started_at: '2026-06-11T10:00:00Z' },
        });
        const { result } = await renderSession({ deferSessionCreation: true });
        act(() => result.current.handleToggleSetComplete(0, 0));
        await waitFor(() => expect(queriesFor('set_logs', 'upsert')).toHaveLength(1));

        // a partir de agora upserts de set_logs falham
        const prevResolver = sb.state.resolver as Resolver;
        setResolver((q) => {
            if (q.table === 'set_logs' && q.op === 'upsert') return { data: null, error: { message: 'rede caiu' } };
            return prevResolver(q);
        });
        clearWorkoutState.mockClear();

        await expect(act(async () => { await result.current.finishWorkout(7); })).rejects.toMatchObject({ message: 'rede caiu' });

        const updates = queriesFor('workout_sessions', 'update');
        // 1º update: completed; 2º update: reversão para in_progress
        expect(updates.length).toBeGreaterThanOrEqual(2);
        expect(updates.at(-1)!.payload).toMatchObject({ status: 'in_progress', completed_at: null });
        // snapshot fica VIVO de propósito (caminho de erro)
        expect(clearWorkoutState).not.toHaveBeenCalled();
        expect(result.current.isSubmitting).toBe(false);
    });

    it('cardio concluído entra no catch-up com config serializada em notes e UUIDs nulos', async () => {
        installScenario({
            existingSession: { id: 'sess-1', started_at: '2026-06-11T10:00:00Z' },
            items: [
                makeItem(),
                makeItem({ id: 'item-cardio', item_type: 'cardio', exercise_id: null, exercise_name: null, notes: 'Esteira', item_config: { mode: 'continuous' } }),
            ],
        });
        const { result } = await renderSession({ deferSessionCreation: true });
        act(() => result.current.toggleCardioComplete('item-cardio', true, { actual_duration_seconds: 600 }));
        await act(async () => { await result.current.finishWorkout(); });

        const batch = queriesFor('set_logs', 'upsert').at(-1)!.payload as Array<Record<string, unknown>>;
        expect(batch).toHaveLength(1);
        const cardioLog = batch[0];
        expect(cardioLog.assigned_workout_item_id).toBe('item-cardio');
        expect(cardioLog.exercise_id).toBeNull();
        expect(cardioLog.planned_exercise_id).toBeNull();
        expect(JSON.parse(cardioLog.notes as string)).toMatchObject({ mode: 'continuous', actual_duration_seconds: 600 });
    });
});

// ── 8. toggleCardioComplete / swap / Watch ───────────────────────────────────

describe('toggleCardioComplete', () => {
    it('marca e desmarca com item_config acumulado', async () => {
        installScenario({
            items: [makeItem({ id: 'item-cardio', item_type: 'cardio', exercise_id: null, exercise_name: null, notes: 'Bike', item_config: { mode: 'continuous' } })],
        });
        const { result } = await renderSession({ deferSessionCreation: true });
        act(() => result.current.toggleCardioComplete('item-cardio', true, { actual_duration_seconds: 300 }));
        const ex = result.current.exercises.find((e) => e.id === 'item-cardio')!;
        expect(ex.setsData).toEqual([{ weight: '0', reps: '1', completed: true }]);
        expect(ex.item_config).toMatchObject({ mode: 'continuous', actual_duration_seconds: 300 });

        act(() => result.current.toggleCardioComplete('item-cardio', false));
        expect(result.current.exercises.find((e) => e.id === 'item-cardio')!.setsData).toEqual([]);
    });
});

describe('swapExercise', () => {
    it('com séries concluídas exige confirmação; forceReset deleta logs órfãos (C4)', async () => {
        installScenario({
            existingSession: { id: 'sess-1', started_at: '2026-06-11T10:00:00Z' },
            persistedLogs: [{ assigned_workout_item_id: 'item-1', set_number: 1, weight: 50, reps_completed: 8, notes: null }],
        });
        const { result } = await renderSession({ deferSessionCreation: true });
        const substitute = { id: 'ex-2', name: 'Crucifixo', muscle_groups: [], source: 'manual' as const };

        let res: { success: boolean; requiresConfirmation?: boolean } = { success: false };
        await act(async () => { res = await result.current.swapExercise(0, substitute); });
        expect(res).toMatchObject({ success: false, requiresConfirmation: true });

        await act(async () => { res = await result.current.swapExercise(0, substitute, true); });
        expect(res.success).toBe(true);
        const dels = queriesFor('set_logs', 'delete');
        expect(dels).toHaveLength(1);
        expect(dels[0].filters).toEqual(expect.arrayContaining([
            ['eq', 'workout_session_id', 'sess-1'],
            ['eq', 'assigned_workout_item_id', 'item-1'],
        ]));
        const ex = result.current.exercises[0];
        expect(ex.exercise_id).toBe('ex-2');
        expect(ex.name).toBe('Crucifixo');
        expect(ex.swap_source).toBe('manual');
        expect(ex.setsData.every((s) => !s.completed)).toBe(true);
    });
});

describe('applyWatchSetCompletion', () => {
    it('espelha o toggle com valores do Watch e herança C1 no que faltar', async () => {
        installScenario({
            existingSession: { id: 'sess-1', started_at: '2026-06-11T10:00:00Z' },
            previousSets: [{ set_number: 1, weight: 35, reps: 10 }],
        });
        const onSetComplete = vi.fn();
        const { result } = await renderSession({ deferSessionCreation: true, onSetComplete });
        act(() => result.current.applyWatchSetCompletion(0, 0, 9 /* reps */));

        const set0 = result.current.exercises[0].setsData[0];
        expect(set0.completed).toBe(true);
        expect(set0.reps).toBe('9'); // veio do Watch
        expect(set0.weight).toBe('35'); // herdado do histórico (C1)
        expect(onSetComplete).toHaveBeenCalledWith(0, 0);
        await waitFor(() => expect(queriesFor('set_logs', 'upsert')).toHaveLength(1));
        expect((queriesFor('set_logs', 'upsert')[0].payload as Record<string, unknown>).reps_completed).toBe(9);
    });

    it('A1: roteia pelo exerciseId, não pelo índice (treino reordenado mid-treino)', async () => {
        installScenario({
            existingSession: { id: 'sess-1', started_at: '2026-06-11T10:00:00Z' },
            items: [
                makeItem(),
                makeItem({ id: 'item-2', exercise_id: 'ex-2', exercise_name: 'Agachamento', order_index: 1 }),
            ],
        });
        const { result } = await renderSession({ deferSessionCreation: true });

        // O Watch calculou índice 0, mas o exercício real (pós-reordenação) é o item-2.
        // O exerciseId deve mandar a série para o item-2 — não para o item-1 do índice 0.
        act(() => result.current.applyWatchSetCompletion(0, 0, 9, 80, 'item-2'));

        expect(result.current.exercises[1].setsData[0].completed).toBe(true);
        expect(result.current.exercises[1].setsData[0].reps).toBe('9');
        expect(result.current.exercises[1].setsData[0].weight).toBe('80');
        // O exercício do índice 0 (item-1) NÃO foi tocado.
        expect(result.current.exercises[0].setsData[0].completed).toBe(false);

        await waitFor(() => expect(queriesFor('set_logs', 'upsert')).toHaveLength(1));
        expect((queriesFor('set_logs', 'upsert')[0].payload as Record<string, unknown>).assigned_workout_item_id).toBe('item-2');
    });
});

// ── 9. Fila offline (A4) ─────────────────────────────────────────────────────

describe('fila offline (A4)', () => {
    it('persistSetLog com erro do upsert enfileira o payload exato', async () => {
        installScenario({
            existingSession: { id: 'sess-1', started_at: '2026-06-11T10:00:00Z' },
            setLogUpsert: { data: null, error: { message: 'rede caiu' } },
            previousSets: [{ set_number: 1, weight: 35, reps: 10 }],
        });
        const { result } = await renderSession({ deferSessionCreation: true });
        act(() => result.current.handleToggleSetComplete(0, 0));

        await waitFor(() => expect(enqueueSetLogUpsert).toHaveBeenCalledTimes(1));
        expect(enqueueSetLogUpsert.mock.calls[0][0]).toMatchObject({
            workout_session_id: 'sess-1',
            assigned_workout_item_id: 'item-1',
            set_number: 1,
            weight: 35,
            reps_completed: 10,
            is_completed: true,
        });
        // a série continua marcada no estado (snapshot S4 cobre o kill)
        expect(result.current.exercises[0].setsData[0].completed).toBe(true);
    });

    it('desmarcar com delete falhando enfileira a remoção', async () => {
        installScenario({
            existingSession: { id: 'sess-1', started_at: '2026-06-11T10:00:00Z' },
            persistedLogs: [{ assigned_workout_item_id: 'item-1', set_number: 1, weight: 50, reps_completed: 8, notes: null }],
        });
        const { result } = await renderSession({ deferSessionCreation: true });
        const prevResolver = sb.state.resolver as Resolver;
        setResolver((q) => {
            if (q.table === 'set_logs' && q.op === 'delete') return { data: null, error: { message: 'rede caiu' } };
            return prevResolver(q);
        });
        act(() => result.current.handleToggleSetComplete(0, 0)); // desmarca

        await waitFor(() => expect(enqueueSetLogDelete).toHaveBeenCalledTimes(1));
        expect(enqueueSetLogDelete.mock.calls[0][0]).toEqual({
            workout_session_id: 'sess-1',
            assigned_workout_item_id: 'item-1',
            set_number: 1,
        });
    });

    it('finish bem-sucedido limpa as pendências da sessão (catch-up as subsume)', async () => {
        installScenario({ existingSession: { id: 'sess-1', started_at: '2026-06-11T10:00:00Z' } });
        const { result } = await renderSession({ deferSessionCreation: true });
        act(() => result.current.handleToggleSetComplete(0, 0));
        await act(async () => { await result.current.finishWorkout(7); });
        expect(clearPendingSetLogsForSession).toHaveBeenCalledWith('sess-1');
    });

    it('descarte limpa as pendências da sessão (séries descartadas não ressuscitam)', async () => {
        installScenario({ existingSession: { id: 'sess-1', started_at: '2026-06-11T10:00:00Z' } });
        const { result } = await renderSession({ deferSessionCreation: true });
        await act(async () => { await result.current.discardWorkout(); });
        expect(clearPendingSetLogsForSession).toHaveBeenCalledWith('sess-1');
    });
});
