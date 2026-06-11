// ============================================================================
// Stub fluente do supabaseAdmin para testes de webhook
// ============================================================================
// Os handlers de webhook fazem muitas escritas encadeadas:
//   .from(t).update(p).eq(...).in(...).select(...)
//   .from(t).upsert(p, { onConflict })
//   .from(t).select(c).eq(...).limit(1).maybeSingle()
//   .from(t).delete().eq(...)
//   .rpc('fn', args)
// Este stub registra cada query (tabela, operação, payload, filtros e
// terminadores) e delega o resultado a um resolver definido por teste.
// Sem resolver — ou com resolver retornando undefined — o resultado padrão é
// { data: null, error: null }. Se o resolver lançar, o await da query rejeita
// (útil pra simular handler quebrando no meio).
//
// Usado por:
//   - src/app/api/webhooks/asaas/__tests__/route.test.ts
//   - src/app/api/webhooks/stripe/__tests__/route.test.ts
//   - src/app/api/webhooks/stripe-connect/__tests__/route.test.ts
// ============================================================================

export type StubOp = 'select' | 'insert' | 'update' | 'upsert' | 'delete'

export interface StubError {
    code?: string
    message?: string
}

export interface StubResult {
    data?: unknown
    error?: StubError | null
}

export interface RecordedQuery {
    table: string
    op: StubOp
    /** Payload de insert/update/upsert. */
    payload?: unknown
    /** Opções do insert/upsert (ex.: { onConflict: 'asaas_payment_id' }). */
    options?: unknown
    /** Colunas pedidas no .select(). */
    columns?: string
    /** Filtros aplicados, na ordem: { method: 'eq', args: ['id', '123'] }. */
    filters: Array<{ method: string; args: unknown[] }>
    single: boolean
    maybeSingle: boolean
    limit?: number
}

/** Resolver por query. Retornar undefined → default { data: null, error: null }. */
export type QueryResolver = (q: RecordedQuery) => StubResult | undefined

export interface RpcCall {
    fn: string
    args: unknown
}

interface ResolvedResult {
    data: unknown
    error: StubError | null
}

class StubQueryBuilder implements PromiseLike<ResolvedResult> {
    private readonly q: RecordedQuery

    constructor(
        table: string,
        private readonly getResolver: () => QueryResolver,
        register: (q: RecordedQuery) => void,
    ) {
        this.q = { table, op: 'select', filters: [], single: false, maybeSingle: false }
        register(this.q)
    }

    select(columns?: string): this {
        // Em mutações, .select() é só o "returning" — não muda a operação.
        this.q.columns = columns
        return this
    }
    insert(payload: unknown, options?: unknown): this {
        this.q.op = 'insert'
        this.q.payload = payload
        this.q.options = options
        return this
    }
    update(payload: unknown): this {
        this.q.op = 'update'
        this.q.payload = payload
        return this
    }
    upsert(payload: unknown, options?: unknown): this {
        this.q.op = 'upsert'
        this.q.payload = payload
        this.q.options = options
        return this
    }
    delete(): this {
        this.q.op = 'delete'
        return this
    }

    eq(column: string, value: unknown): this {
        this.q.filters.push({ method: 'eq', args: [column, value] })
        return this
    }
    neq(column: string, value: unknown): this {
        this.q.filters.push({ method: 'neq', args: [column, value] })
        return this
    }
    in(column: string, values: unknown[]): this {
        this.q.filters.push({ method: 'in', args: [column, values] })
        return this
    }
    is(column: string, value: unknown): this {
        this.q.filters.push({ method: 'is', args: [column, value] })
        return this
    }
    limit(n: number): this {
        this.q.limit = n
        return this
    }
    single(): this {
        this.q.single = true
        return this
    }
    maybeSingle(): this {
        this.q.maybeSingle = true
        return this
    }

    then<TResult1 = ResolvedResult, TResult2 = never>(
        onfulfilled?: ((value: ResolvedResult) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ): PromiseLike<TResult1 | TResult2> {
        const run = async (): Promise<ResolvedResult> => {
            const r = this.getResolver()(this.q)
            return { data: r?.data ?? null, error: r?.error ?? null }
        }
        return run().then(onfulfilled, onrejected)
    }
}

export function createSupabaseAdminStub() {
    const queries: RecordedQuery[] = []
    const rpcCalls: RpcCall[] = []
    let resolver: QueryResolver = () => undefined
    let rpcResult: StubResult = { data: null, error: null }

    return {
        /** Todas as queries registradas, na ordem de execução. */
        queries,
        /** Todas as chamadas rpc registradas. */
        rpcCalls,
        /** Plugar em supabaseAdmin.from via mockImplementation. */
        from(table: string): StubQueryBuilder {
            return new StubQueryBuilder(table, () => resolver, (q) => queries.push(q))
        },
        /** Plugar em supabaseAdmin.rpc via mockImplementation. */
        async rpc(fn: string, args?: unknown): Promise<ResolvedResult> {
            rpcCalls.push({ fn, args })
            return { data: rpcResult.data ?? null, error: rpcResult.error ?? null }
        },
        /** Define o resolver de resultados por query. */
        onQuery(fn: QueryResolver): void {
            resolver = fn
        },
        /** Resultado fixo das chamadas rpc. */
        setRpcResult(r: StubResult): void {
            rpcResult = r
        },
        /** Queries registradas pra uma tabela (e opcionalmente uma operação). */
        calls(table: string, op?: StubOp): RecordedQuery[] {
            return queries.filter((q) => q.table === table && (op === undefined || q.op === op))
        },
    }
}

export type SupabaseAdminStub = ReturnType<typeof createSupabaseAdminStub>

/** True se a query tem o filtro `method(column, value)`. value=undefined → ignora o valor. */
export function hasFilter(
    q: RecordedQuery,
    method: string,
    column: string,
    value?: unknown,
): boolean {
    return q.filters.some(
        (f) => f.method === method && f.args[0] === column && (value === undefined || f.args[1] === value),
    )
}

/** Args do primeiro filtro `method(column, ...)` — ex.: getFilter(q, 'in', 'status')?.[1]. */
export function getFilter(q: RecordedQuery, method: string, column: string): unknown[] | undefined {
    return q.filters.find((f) => f.method === method && f.args[0] === column)?.args
}
