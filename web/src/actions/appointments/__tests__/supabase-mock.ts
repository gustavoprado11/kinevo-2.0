import { vi } from 'vitest'

type Resolved<T = unknown> = { data: T; error: unknown }

/**
 * Test helper: builds a chainable Supabase mock whose terminal operation
 * returns a configurable response based on the (table, op) pair.
 *
 * Usage:
 *   const supabase = createSupabaseMock({
 *       trainers: { single: { data: { id: 'trainer-1' }, error: null } },
 *       students: { single: { data: { id: 's-1', coach_id: 'trainer-1', name: 'João' }, error: null } },
 *       recurring_appointments: {
 *           select: { data: [], error: null },   // list
 *           insert: { data: { id: 'ra-1' }, error: null }, // insert().select().single()
 *           update: { data: null, error: null },
 *           upsert: { data: null, error: null },
 *       },
 *   })
 *
 * The mock is intentionally loose: every call to select/insert/update/etc
 * returns the same chainable and eventually resolves with the configured value.
 */

export interface TableResponses {
    select?: Resolved
    insert?: Resolved
    update?: Resolved
    upsert?: Resolved
    delete?: Resolved
    /** Used when `.single()` terminates an existence-check chain. */
    single?: Resolved
}

export interface MockOptions {
    auth?: Resolved<{ user: { id: string } | null }>
    [tableName: string]: TableResponses | Resolved | undefined
}

function buildChain(table: string, responses: TableResponses) {
    // Terminal resolved values fall through in this priority.
    // - If a chain terminates with .single(), use `single` override if present,
    //   otherwise fall back to the last operation configured.
    // - If a chain terminates as a list (no .single()), fall back similarly.
    // We track the "last op" to pick the right terminal value.

    let lastOp: keyof TableResponses = 'select'
    let mutationLocked = false

    const chain = {
        select: vi.fn(() => {
            if (!mutationLocked) lastOp = 'select'
            return chain
        }),
        insert: vi.fn(() => {
            lastOp = 'insert'
            mutationLocked = true
            return chain
        }),
        update: vi.fn(() => {
            lastOp = 'update'
            mutationLocked = true
            return chain
        }),
        upsert: vi.fn(() => {
            lastOp = 'upsert'
            mutationLocked = true
            return chain
        }),
        delete: vi.fn(() => {
            lastOp = 'delete'
            mutationLocked = true
            return chain
        }),
        eq: vi.fn(() => chain),
        in: vi.fn(() => chain),
        gte: vi.fn(() => chain),
        lte: vi.fn(() => chain),
        or: vi.fn(() => chain),
        single: vi.fn(async () => {
            if (lastOp === 'insert' && responses.insert) return responses.insert
            if (lastOp === 'update' && responses.update) return responses.update
            if (lastOp === 'upsert' && responses.upsert) return responses.upsert
            if (lastOp === 'delete' && responses.delete) return responses.delete
            if (responses.single) return responses.single
            return responses.select ?? { data: null, error: null }
        }),
        /** Terminal thenable when the caller awaits without .single(). */
        then(resolve: (value: Resolved) => unknown) {
            const value =
                (lastOp === 'insert' && responses.insert) ||
                (lastOp === 'update' && responses.update) ||
                (lastOp === 'upsert' && responses.upsert) ||
                (lastOp === 'delete' && responses.delete) ||
                responses.select ||
                { data: null, error: null }
            return Promise.resolve(value).then(resolve)
        },
    }

    // Silence unused warning — `table` kept for debugability.
    void table
    return chain
}

export function createSupabaseMock(options: MockOptions = {}) {
    const authResponse =
        (options.auth as Resolved<{ user: { id: string } | null }>) ?? {
            data: { user: { id: 'user-1' } },
            error: null,
        }

    const tables = new Map<string, TableResponses>()
    for (const [key, value] of Object.entries(options)) {
        if (key === 'auth' || value === undefined) continue
        tables.set(key, value as TableResponses)
    }

    const fromMock = vi.fn((tableName: string) =>
        buildChain(tableName, tables.get(tableName) ?? {}),
    )

    return {
        auth: {
            getUser: vi.fn().mockResolvedValue(authResponse),
        },
        from: fromMock,
    }
}

export type SupabaseMock = ReturnType<typeof createSupabaseMock>
