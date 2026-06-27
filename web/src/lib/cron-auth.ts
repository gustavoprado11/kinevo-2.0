import { createHash, timingSafeEqual } from 'crypto'

/**
 * Autentica uma chamada de cron via header `Authorization: Bearer <CRON_SECRET>`.
 *
 * - FAIL-CLOSED: sem `CRON_SECRET` no ambiente, rejeita TUDO. Antes, com a env
 *   ausente, o valor esperado virava a string literal `"Bearer undefined"` e um
 *   atacante mandando exatamente esse header passava — bypass do cron (que roda
 *   jobs que custam IA/dinheiro, ex.: morning-briefing/generate-insights).
 * - Comparação em TEMPO CONSTANTE (sha256 + timingSafeEqual): não vaza o segredo
 *   por timing e, por hashear pra tamanho fixo, não vaza o tamanho nem lança em
 *   inputs de comprimentos diferentes.
 */
export function verifyCronAuth(request: Request): boolean {
    const secret = process.env.CRON_SECRET
    if (!secret) {
        console.error('[cron] CRON_SECRET ausente — rejeitando todas as chamadas de cron')
        return false
    }
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return false
    return constantTimeEqual(authHeader, `Bearer ${secret}`)
}

function constantTimeEqual(a: string, b: string): boolean {
    const ha = createHash('sha256').update(a).digest()
    const hb = createHash('sha256').update(b).digest()
    return timingSafeEqual(ha, hb)
}
