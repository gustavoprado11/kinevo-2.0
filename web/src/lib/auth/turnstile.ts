/**
 * Cloudflare Turnstile token verification.
 *
 * Turnstile is a free, privacy-respecting CAPTCHA replacement. The widget
 * runs client-side, produces a token, and the server verifies the token
 * by POSTing to Cloudflare's siteverify endpoint.
 *
 *   docs: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 *
 * Setup (operator):
 *   1. Create site at https://dash.cloudflare.com/?to=/:account/turnstile
 *      with the production hostname (www.kinevoapp.com).
 *   2. Set env vars in Vercel:
 *        NEXT_PUBLIC_TURNSTILE_SITE_KEY  (public — embedded in client bundle)
 *        TURNSTILE_SECRET_KEY            (secret — server only)
 *   3. Deploy. The widget renders automatically when both vars are present.
 *
 * Until the env vars are set this module is a no-op:
 *   - The signup page renders without the widget.
 *   - The server action skips verification.
 * That means we can ship the code now and the operator switches CAPTCHA on
 * later without any code change.
 */

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const VERIFY_TIMEOUT_MS = 4_000

export interface TurnstileVerifyResult {
    /** True if Turnstile passed OR is disabled (graceful degrade). */
    ok: boolean
    /** When ok is false, a user-facing error in PT-BR. */
    error?: string
    /** True iff Turnstile is currently disabled (env var missing). */
    disabled?: boolean
}

/** True iff Turnstile is configured server-side. */
export function isTurnstileEnabled(): boolean {
    return !!process.env.TURNSTILE_SECRET_KEY
}

/**
 * Verifies a token against Cloudflare's siteverify endpoint. Returns
 * { ok: true, disabled: true } when env vars are missing — callers should
 * treat this as "skip verification, log nothing".
 *
 * Network or timeout errors fail CLOSED (ok: false) when Turnstile is
 * enabled — once we depend on the captcha we treat its absence as suspicious.
 * This is the opposite of the HIBP fail-open posture because Turnstile is
 * the front-line bot defense.
 */
export async function verifyTurnstileToken(
    token: string | null | undefined,
    remoteIp?: string,
): Promise<TurnstileVerifyResult> {
    const secret = process.env.TURNSTILE_SECRET_KEY
    if (!secret) {
        // Not configured — operator hasn't enabled CAPTCHA yet. Pass through.
        return { ok: true, disabled: true }
    }

    if (!token || token.length === 0) {
        return { ok: false, error: 'Verifique que você não é um robô e tente novamente.' }
    }

    try {
        const body = new URLSearchParams({ secret, response: token })
        if (remoteIp) body.set('remoteip', remoteIp)

        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS)

        const response = await fetch(VERIFY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
            signal: controller.signal,
        })

        clearTimeout(timeout)

        if (!response.ok) {
            console.warn('[turnstile] verify returned non-OK status:', response.status)
            return { ok: false, error: 'Falha na verificação anti-robô. Tente novamente.' }
        }

        const json = (await response.json()) as { success: boolean; 'error-codes'?: string[] }

        if (!json.success) {
            console.warn('[turnstile] verify failed:', json['error-codes'])
            return { ok: false, error: 'Verificação anti-robô falhou. Recarregue a página e tente novamente.' }
        }

        return { ok: true }
    } catch (err) {
        console.warn('[turnstile] verify error:', err)
        return { ok: false, error: 'Falha na verificação anti-robô. Tente novamente.' }
    }
}
