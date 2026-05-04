/**
 * HaveIBeenPwned password check via the public k-anonymity API.
 *
 * Privacy contract:
 *   - The plaintext password never leaves this server.
 *   - We send only the first 5 hex chars of SHA-1(password).
 *   - HIBP returns ~500 candidate hash suffixes that share that prefix.
 *   - We search for the rest of the hash locally.
 *
 * Public API, no key required, free for production use:
 *   https://haveibeenpwned.com/API/v3#PwnedPasswords
 *
 * This is the same protection as Supabase's "Leaked Password Protection"
 * (Pro feature), implemented directly. We use it on signup and password
 * change/reset to block new accounts and rotated passwords that have
 * appeared in known data breaches.
 *
 * A small bundled blocklist of the very-most-common passwords short-circuits
 * before any network call, so attackers spamming `123456` / `senha123` /
 * `password` get rejected in 0ms with no API hit.
 */

import { createHash } from 'crypto'

const HIBP_RANGE_URL = 'https://api.pwnedpasswords.com/range/'
const HIBP_TIMEOUT_MS = 2_500

// Top ~50 globally-most-common passwords plus a Brazil-specific tier.
// Lowercased for case-insensitive comparison. Rejecting these before
// the API call is faster AND fail-safe — if HIBP is unreachable we still
// kill the obvious cases.
const COMMON_PASSWORDS_LOWER: ReadonlySet<string> = new Set([
    // Worldwide top
    '123456', '123456789', '12345678', '1234567', '1234567890', '12345',
    '111111', '000000', '654321', '666666', '888888', '987654321',
    'password', 'password1', 'password123', 'qwerty', 'qwerty123', 'qwertyuiop',
    'abc123', 'admin', 'admin123', 'letmein', 'welcome', 'iloveyou',
    'monkey', 'dragon', 'master', 'sunshine', 'princess', 'football', 'baseball',
    'shadow', 'superman', 'batman', 'trustno1', 'login', 'starwars',
    // Brazil-specific
    'senha', 'senha123', 'senha1234', 'mudar123', 'kinevo', 'kinevo123',
    'brasil', 'brasil123', 'sao paulo', 'corinthians', 'flamengo', 'palmeiras',
    'futebol', 'amorzinho', 'amor', 'familia', 'minhasenha', 'novasenha',
])

export interface HibpCheckResult {
    /** True if the password is safe to accept. */
    safe: boolean
    /** When unsafe, a user-facing error string in PT-BR. */
    error?: string
    /** Optional debug counter — only populated for HIBP hits, not the
     *  bundled common-password blocklist. */
    pwnCount?: number
}

/**
 * Returns { safe: true } if the password is acceptable, otherwise
 * { safe: false, error } with a friendly Portuguese message.
 *
 * Network failures DO NOT block signups (fail-open) — we only fail-closed
 * on the bundled common-password blocklist. The reasoning: HIBP is an
 * external service and a transient outage shouldn't take signups offline.
 * The bundled list still kills the trivially-bad cases.
 */
export async function checkPasswordPwned(password: string): Promise<HibpCheckResult> {
    if (!password || password.length === 0) {
        return { safe: false, error: 'Informe uma senha.' }
    }

    // Fast path: the bundled blocklist (no network).
    if (COMMON_PASSWORDS_LOWER.has(password.toLowerCase())) {
        return {
            safe: false,
            error: 'Esta senha é muito comum. Escolha uma senha mais forte e única.',
        }
    }

    // SHA-1 hash → uppercase hex (HIBP's API responds in uppercase).
    const sha1 = createHash('sha1').update(password).digest('hex').toUpperCase()
    const prefix = sha1.slice(0, 5)
    const suffix = sha1.slice(5)

    try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), HIBP_TIMEOUT_MS)

        const response = await fetch(HIBP_RANGE_URL + prefix, {
            signal: controller.signal,
            headers: {
                // The Add-Padding header makes responses constant-size,
                // hardening against passive-observer timing attacks.
                'Add-Padding': 'true',
                'User-Agent': 'kinevo-signup-validator/1.0',
            },
        })

        clearTimeout(timeout)

        if (!response.ok) {
            // 404/429/5xx — fail open, log for monitoring.
            console.warn('[hibp] non-OK response, failing open:', response.status)
            return { safe: true }
        }

        const body = await response.text()
        // Response format: one entry per line, "SUFFIX:COUNT\r\n".
        for (const line of body.split('\n')) {
            const [returnedSuffix, countRaw] = line.split(':')
            if (!returnedSuffix) continue
            if (returnedSuffix.trim().toUpperCase() === suffix) {
                const count = parseInt((countRaw || '').trim(), 10) || 0
                // Padding entries have count=0; ignore those.
                if (count > 0) {
                    return {
                        safe: false,
                        error: 'Esta senha apareceu em vazamentos públicos de dados. Escolha uma senha diferente.',
                        pwnCount: count,
                    }
                }
            }
        }

        return { safe: true }
    } catch (err) {
        // Network/timeout/abort — fail open. Bundled blocklist already
        // caught the obvious cases.
        console.warn('[hibp] fetch failed, failing open:', err)
        return { safe: true }
    }
}
