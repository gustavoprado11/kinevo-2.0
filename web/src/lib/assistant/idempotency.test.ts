import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
    claimActionIdempotency,
    finishActionIdempotency,
    releaseActionIdempotency,
} from './idempotency'

/**
 * C6 (auditoria 2026-06-22): o execute-tool reserva a idempotency_key do card e
 * dedup re-cliques/retries (anti contrato/pagamento duplicado). Aqui testamos a
 * lógica de claim/finish/release contra um fake in-memory que simula o upsert
 * (INSERT ... ON CONFLICT DO NOTHING) e o select.
 */

interface Row {
    idempotency_key: string
    trainer_id: string
    tool_name: string
    status: string
    result: unknown
}

function makeFakeSb() {
    const store = new Map<string, Row>()

    function builder() {
        let op: 'upsert' | 'select' | 'update' | 'delete' | null = null
        let upsertRow: Partial<Row> = {}
        let updatePatch: Partial<Row> = {}
        const filters: Array<[string, unknown]> = []
        const match = (r: Row) => filters.every(([c, v]) => (r as unknown as Record<string, unknown>)[c] === v)

        const run = () => {
            if (op === 'upsert') {
                const key = upsertRow.idempotency_key as string
                if (store.has(key)) return { data: [], error: null } // conflito → ignoreDuplicates
                store.set(key, { result: null, ...(upsertRow as Row) })
                return { data: [{ idempotency_key: key }], error: null }
            }
            if (op === 'update') {
                for (const r of store.values()) if (match(r)) Object.assign(r, updatePatch)
                return { data: null, error: null }
            }
            if (op === 'delete') {
                for (const [k, r] of [...store.entries()]) if (match(r)) store.delete(k)
                return { data: null, error: null }
            }
            return { data: [...store.values()], error: null }
        }

        const b = {
            upsert(row: Partial<Row>) { op = 'upsert'; upsertRow = row; return b },
            update(patch: Partial<Row>) { op = 'update'; updatePatch = patch; return b },
            delete() { op = 'delete'; return b },
            select() { if (!op) op = 'select'; return b },
            eq(col: string, val: unknown) { filters.push([col, val]); return b },
            maybeSingle() {
                const row = [...store.values()].find(match) ?? null
                return Promise.resolve({ data: row, error: null })
            },
            then(resolve: (v: { data: unknown; error: unknown }) => unknown) {
                return Promise.resolve(run()).then(resolve)
            },
        }
        return b
    }

    return { sb: { from: () => builder() } as unknown as SupabaseClient, store }
}

const KEY = '11111111-1111-4111-8111-111111111111'
const TRAINER = 'trainer-1'

describe('idempotency — claim/finish/release (C6)', () => {
    it('primeira reserva = claimed e grava status processing', async () => {
        const { sb, store } = makeFakeSb()
        const claim = await claimActionIdempotency(sb, KEY, TRAINER, 'kinevo_create_contract')
        expect(claim.outcome).toBe('claimed')
        expect(store.get(KEY)?.status).toBe('processing')
    })

    it('2º clique enquanto processa = processing (NÃO re-executa)', async () => {
        const { sb } = makeFakeSb()
        await claimActionIdempotency(sb, KEY, TRAINER, 'kinevo_create_contract')
        const second = await claimActionIdempotency(sb, KEY, TRAINER, 'kinevo_create_contract')
        expect(second.outcome).toBe('processing')
    })

    it('após finish, novo claim = replay com o resultado salvo', async () => {
        const { sb } = makeFakeSb()
        await claimActionIdempotency(sb, KEY, TRAINER, 'kinevo_create_contract')
        await finishActionIdempotency(sb, KEY, TRAINER, { contract_id: 'c1', message: 'ok' })
        const replay = await claimActionIdempotency(sb, KEY, TRAINER, 'kinevo_create_contract')
        expect(replay.outcome).toBe('replay')
        expect(replay).toMatchObject({ result: { contract_id: 'c1', message: 'ok' } })
    })

    it('release (execução falhou) libera p/ retry → claimed de novo', async () => {
        const { sb, store } = makeFakeSb()
        await claimActionIdempotency(sb, KEY, TRAINER, 'kinevo_create_contract')
        await releaseActionIdempotency(sb, KEY, TRAINER)
        expect(store.has(KEY)).toBe(false)
        const retry = await claimActionIdempotency(sb, KEY, TRAINER, 'kinevo_create_contract')
        expect(retry.outcome).toBe('claimed')
    })

    it('release NÃO apaga uma ação já concluída (status done)', async () => {
        const { sb, store } = makeFakeSb()
        await claimActionIdempotency(sb, KEY, TRAINER, 'kinevo_create_contract')
        await finishActionIdempotency(sb, KEY, TRAINER, { ok: true })
        await releaseActionIdempotency(sb, KEY, TRAINER) // só apaga 'processing'
        expect(store.get(KEY)?.status).toBe('done')
    })
})
