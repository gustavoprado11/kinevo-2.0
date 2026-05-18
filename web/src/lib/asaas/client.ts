// ============================================================================
// Asaas HTTP client (base)
// ============================================================================
// Single source of truth for HTTP calls to api.asaas.com. Everything else in
// /lib/asaas/ uses the `asaasRequest()` function exported here.
//
// - URL is chosen by ASAAS_ENV ('sandbox' | 'production'). Default: sandbox.
// - Auth header (`access_token`) is taken from the per-call apiKey parameter
//   so the same client speaks for both the Kinevo main account and any
//   trainer subaccount (each subaccount has its own apiKey).
// - Errors come back as AsaasApiError with status + body parsed.
// - One light retry on 5xx + network errors to absorb transient glitches.
// ============================================================================

export type AsaasEnvironment = 'sandbox' | 'production'

export interface AsaasRequestOptions<TBody = unknown> {
    /** Asaas access_token. Use Kinevo main key for /accounts; subaccount key for /payments etc. */
    apiKey: string
    /** HTTP method. Defaults to GET if no body provided, POST otherwise. */
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
    /** Path relative to the base URL — must start with /v3. */
    path: string
    /** Body (will be JSON.stringify-ed). Set to undefined for GET. */
    body?: TBody
    /** Optional querystring params. */
    query?: Record<string, string | number | boolean | undefined>
    /** Optional environment override (testing). Defaults to ASAAS_ENV var. */
    env?: AsaasEnvironment
    /** Optional Asaas-Idempotency-Key for safe retry of POST. */
    idempotencyKey?: string
}

const URLS: Record<AsaasEnvironment, string> = {
    sandbox: 'https://sandbox.asaas.com/api/v3',
    production: 'https://api.asaas.com/v3',
}

function resolveEnv(override?: AsaasEnvironment): AsaasEnvironment {
    if (override) return override
    const v = process.env.ASAAS_ENV
    if (v === 'production') return 'production'
    return 'sandbox'
}

function buildUrl(path: string, query: AsaasRequestOptions['query'], env: AsaasEnvironment): string {
    const base = URLS[env]
    // path comes already starting with '/v3/...' but our base ends with /v3.
    // Strip leading /v3 if present to avoid /v3/v3.
    const cleanPath = path.startsWith('/v3') ? path.slice(3) : path
    const url = new URL(base + cleanPath)
    if (query) {
        for (const [k, v] of Object.entries(query)) {
            if (v !== undefined && v !== null && v !== '') {
                url.searchParams.set(k, String(v))
            }
        }
    }
    return url.toString()
}

export class AsaasApiError extends Error {
    readonly status: number
    readonly body: unknown
    readonly code?: string

    constructor(status: number, body: unknown, code?: string) {
        const message = extractMessage(body) ?? `Asaas API error (status ${status})`
        super(message)
        this.name = 'AsaasApiError'
        this.status = status
        this.body = body
        this.code = code
    }
}

function extractMessage(body: unknown): string | undefined {
    if (!body || typeof body !== 'object') return undefined
    const obj = body as { errors?: Array<{ description?: string; code?: string }>; message?: string }
    if (Array.isArray(obj.errors) && obj.errors.length > 0) {
        return obj.errors.map(e => e.description).filter(Boolean).join('; ')
    }
    if (typeof obj.message === 'string') return obj.message
    return undefined
}

/**
 * Make a request to Asaas. Throws AsaasApiError on non-2xx. Auto-retries once
 * on 5xx or network failure (with 250ms backoff).
 */
export async function asaasRequest<TResponse = unknown, TBody = unknown>(
    options: AsaasRequestOptions<TBody>
): Promise<TResponse> {
    const { apiKey, method, path, body, query, env, idempotencyKey } = options
    const resolvedEnv = resolveEnv(env)
    const url = buildUrl(path, query, resolvedEnv)
    const httpMethod = method ?? (body === undefined ? 'GET' : 'POST')

    const headers: Record<string, string> = {
        access_token: apiKey,
        'User-Agent': 'Kinevo/1.0',
        Accept: 'application/json',
    }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    if (idempotencyKey) headers['Asaas-Idempotency-Key'] = idempotencyKey

    const init: RequestInit = {
        method: httpMethod,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        // Asaas SLAs are 5-15s in practice. We bail at 30s.
        signal: AbortSignal.timeout(30_000),
    }

    let response: Response
    let attempts = 0
    while (true) {
        attempts++
        try {
            response = await fetch(url, init)
            // Retry once on 5xx
            if (response.status >= 500 && attempts === 1) {
                await sleep(250)
                continue
            }
            break
        } catch (err) {
            if (attempts === 1) {
                await sleep(250)
                continue
            }
            throw err
        }
    }

    const text = await response.text()
    let parsed: unknown = null
    if (text) {
        try {
            parsed = JSON.parse(text)
        } catch {
            parsed = text
        }
    }

    if (!response.ok) {
        throw new AsaasApiError(response.status, parsed)
    }

    return parsed as TResponse
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

// ----------------------------------------------------------------------------
// Helpers to fetch the Kinevo main account key from env
// ----------------------------------------------------------------------------

/**
 * Returns the Kinevo main account API key (the CNPJ Kinevo's account, used
 * to create/manage trainer subaccounts). Throws if missing.
 */
export function getKinevoMainApiKey(): string {
    const key = process.env.ASAAS_MAIN_API_KEY
    if (!key) {
        throw new Error(
            'ASAAS_MAIN_API_KEY is missing. Set it in your environment (.env.local). ' +
            'See web/.env.example and docs/asaas-integration/SETUP.md.'
        )
    }
    return key
}

/**
 * Returns the Kinevo main walletId (used as recipient in split payments to
 * collect take rate). Optional — when not set, no split is applied.
 */
export function getKinevoWalletId(): string | null {
    return process.env.ASAAS_KINEVO_WALLET_ID ?? null
}
