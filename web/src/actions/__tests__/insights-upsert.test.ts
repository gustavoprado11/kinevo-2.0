import { describe, it, expect, vi, beforeEach } from 'vitest'
import { upsertInsightByKey, type UpsertInsightByKeyPayload } from '@/lib/insights/upsert'

// ─────────────────────────────────────────────────────────────────────
// Fixture: chainable Supabase client mock
// ─────────────────────────────────────────────────────────────────────
//
// Replica o subset usado pela helper:
//   .from('assistant_insights')
//     .select(...)  → encadeia eq/like/gte/neq/order/limit/maybeSingle/is
//     .update(...).eq(...)
//     .insert(...)
//
// `findResult` controla o que `maybeSingle()` retorna; `updateResult`/`insertResult`
// permitem injetar erro nas operações finais.

interface MockState {
    findResult: { data: { id: string; status: string } | null; error: { message: string } | null }
    updateResult: { error: { message: string } | null }
    insertResult: { error: { message: string } | null }
    captured: {
        findFilters: Record<string, unknown>[]
        updatePayload: Record<string, unknown> | null
        updateMatchId: string | null
        insertPayload: Record<string, unknown> | null
    }
}

function makeClient(state: MockState) {
    function chainable(captureKey: 'find') {
        const filters: Record<string, unknown>[] = []
        const chain: any = {
            eq: (col: string, val: unknown) => {
                filters.push({ op: 'eq', col, val })
                return chain
            },
            like: (col: string, val: unknown) => {
                filters.push({ op: 'like', col, val })
                return chain
            },
            gte: (col: string, val: unknown) => {
                filters.push({ op: 'gte', col, val })
                return chain
            },
            neq: (col: string, val: unknown) => {
                filters.push({ op: 'neq', col, val })
                return chain
            },
            is: (col: string, val: unknown) => {
                filters.push({ op: 'is', col, val })
                return chain
            },
            order: () => chain,
            limit: () => chain,
            maybeSingle: async () => {
                state.captured.findFilters = filters
                return state.findResult
            },
        }
        // captureKey é só pra debug; capture acontece no maybeSingle.
        void captureKey
        return chain
    }

    return {
        from: (_table: string) => ({
            select: (_cols: string) => chainable('find'),
            update: (payload: Record<string, unknown>) => ({
                eq: (_col: string, val: string) => {
                    state.captured.updatePayload = payload
                    state.captured.updateMatchId = val
                    return Promise.resolve(state.updateResult)
                },
            }),
            insert: (payload: Record<string, unknown>) => {
                state.captured.insertPayload = payload
                return Promise.resolve(state.insertResult)
            },
        }),
    } as any
}

function basePayload(): UpsertInsightByKeyPayload {
    return {
        trainerId: 'trainer-1',
        studentId: 'student-1',
        category: 'alert',
        priority: 'high',
        insightKeyPrefix: 'gap_alert:student-1',
        insightKey: 'gap_alert:student-1:2026-05-08',
        title: 'Sem treinar há 7 dias',
        body: 'Aluno parado faz uma semana.',
        actionType: 'contact_student',
        actionMetadata: { days_since: 7 },
        source: 'rules',
        expiresAt: null,
    }
}

let state: MockState

beforeEach(() => {
    state = {
        findResult: { data: null, error: null },
        updateResult: { error: null },
        insertResult: { error: null },
        captured: {
            findFilters: [],
            updatePayload: null,
            updateMatchId: null,
            insertPayload: null,
        },
    }
})

describe('upsertInsightByKey', () => {
    it('INSERE quando não há insight prévio na janela de 7 dias', async () => {
        const client = makeClient(state)
        const result = await upsertInsightByKey(client, basePayload())

        expect(result).toEqual({ success: true, mode: 'inserted' })
        expect(state.captured.insertPayload).toMatchObject({
            trainer_id: 'trainer-1',
            student_id: 'student-1',
            insight_key: 'gap_alert:student-1:2026-05-08',
            status: 'new',
        })
        // Schema check: snake_case no insert.
        expect(state.captured.insertPayload).toHaveProperty('action_type', 'contact_student')
        expect(state.captured.insertPayload).toHaveProperty('action_metadata', { days_since: 7 })
        expect(state.captured.updatePayload).toBeNull()
    })

    it('ATUALIZA quando há insight da mesma chave (LIKE prefix%) <7d com status != dismissed', async () => {
        state.findResult = { data: { id: 'existing-id', status: 'new' }, error: null }
        const client = makeClient(state)

        const result = await upsertInsightByKey(client, basePayload())

        expect(result).toEqual({ success: true, mode: 'updated' })
        expect(state.captured.updateMatchId).toBe('existing-id')
        expect(state.captured.updatePayload).toMatchObject({
            insight_key: 'gap_alert:student-1:2026-05-08',
            title: 'Sem treinar há 7 dias',
            body: 'Aluno parado faz uma semana.',
        })
        // updated_at preenchido.
        expect(state.captured.updatePayload?.updated_at).toBeTruthy()
        // Status NÃO é parte do payload de update (preservamos o original).
        expect(state.captured.updatePayload).not.toHaveProperty('status')
        // Sem insert.
        expect(state.captured.insertPayload).toBeNull()
    })

    it('SELECT usa LIKE com `${prefix}%` e respeita janela de 7d + status != dismissed', async () => {
        state.findResult = { data: null, error: null }
        const client = makeClient(state)
        await upsertInsightByKey(client, basePayload())

        const filters = state.captured.findFilters
        // LIKE no prefix
        const likeFilter = filters.find((f) => f.op === 'like') as
            | { op: 'like'; col: string; val: string }
            | undefined
        expect(likeFilter).toBeTruthy()
        expect(likeFilter?.col).toBe('insight_key')
        expect(likeFilter?.val).toBe('gap_alert:student-1%')
        // gte em created_at
        const gteFilter = filters.find((f) => f.op === 'gte') as
            | { op: 'gte'; col: string; val: string }
            | undefined
        expect(gteFilter?.col).toBe('created_at')
        // neq status dismissed
        const neqFilter = filters.find((f) => f.op === 'neq') as
            | { op: 'neq'; col: string; val: string }
            | undefined
        expect(neqFilter).toEqual({ op: 'neq', col: 'status', val: 'dismissed' })
    })

    it('quando o existente é dismissed, helper INSERE novo (a query exclui via neq)', async () => {
        // Como a query já filtra status != dismissed, um insight dismissed
        // simplesmente não aparece no findResult — comportamento idêntico ao
        // caso "sem prévio". Este teste documenta o contrato.
        state.findResult = { data: null, error: null }
        const client = makeClient(state)

        const result = await upsertInsightByKey(client, basePayload())
        expect(result).toEqual({ success: true, mode: 'inserted' })
    })

    it('retorna error quando o SELECT falha', async () => {
        state.findResult = { data: null, error: { message: 'connection lost' } }
        const client = makeClient(state)

        const result = await upsertInsightByKey(client, basePayload())
        expect(result).toEqual({ success: false, error: 'connection lost' })
        expect(state.captured.insertPayload).toBeNull()
        expect(state.captured.updatePayload).toBeNull()
    })

    it('retorna error quando o INSERT falha', async () => {
        state.insertResult = { error: { message: 'permission denied' } }
        const client = makeClient(state)

        const result = await upsertInsightByKey(client, basePayload())
        expect(result).toEqual({ success: false, error: 'permission denied' })
    })

    it('retorna error quando o UPDATE falha', async () => {
        state.findResult = { data: { id: 'existing', status: 'new' }, error: null }
        state.updateResult = { error: { message: 'check constraint' } }
        const client = makeClient(state)

        const result = await upsertInsightByKey(client, basePayload())
        expect(result).toEqual({ success: false, error: 'check constraint' })
    })

    it('quando studentId é null, a query usa .is("student_id", null)', async () => {
        state.findResult = { data: null, error: null }
        const client = makeClient(state)
        await upsertInsightByKey(client, { ...basePayload(), studentId: null })

        const isFilter = state.captured.findFilters.find((f) => f.op === 'is') as
            | { op: 'is'; col: string; val: unknown }
            | undefined
        expect(isFilter).toEqual({ op: 'is', col: 'student_id', val: null })
    })
})
