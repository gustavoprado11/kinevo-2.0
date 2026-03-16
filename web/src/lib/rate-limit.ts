/**
 * Simple in-memory sliding window rate limiter.
 * Suitable for single-server Next.js deployments.
 */

const ONE_MINUTE_MS = 60 * 1000
const ONE_DAY_MS = 24 * 60 * 60 * 1000

const store = new Map<string, number[]>()

function cleanup(key: string): void {
    const timestamps = store.get(key)
    if (!timestamps) return
    const cutoff = Date.now() - ONE_DAY_MS
    const filtered = timestamps.filter((t) => t > cutoff)
    if (filtered.length === 0) {
        store.delete(key)
    } else {
        store.set(key, filtered)
    }
}

export function checkRateLimit(
    key: string,
    opts: { perMinute: number; perDay: number }
): { allowed: boolean; error?: string } {
    cleanup(key)
    const timestamps = store.get(key) || []
    const now = Date.now()

    const recentMinute = timestamps.filter((t) => t > now - ONE_MINUTE_MS)
    if (recentMinute.length >= opts.perMinute) {
        return { allowed: false, error: 'Limite de requisições por minuto atingido. Aguarde um momento.' }
    }

    const recentDay = timestamps.filter((t) => t > now - ONE_DAY_MS)
    if (recentDay.length >= opts.perDay) {
        return { allowed: false, error: 'Limite diário de requisições atingido. Tente novamente amanhã.' }
    }

    return { allowed: true }
}

export function recordRequest(key: string): void {
    const timestamps = store.get(key) || []
    timestamps.push(Date.now())
    store.set(key, timestamps)
}
