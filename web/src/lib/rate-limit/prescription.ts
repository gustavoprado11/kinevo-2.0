import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Per-trainer rate limit for AI prescription generations.
 *
 * Counts rows in `prescription_generations` over the last minute and the last
 * day. The `analyze` endpoint and the `generate` endpoint share these limits
 * because both consume the same upstream LLM budget — analyze runs the agent
 * to produce questions, generate runs the agent + the optimizer to produce
 * the program. They are not separated server-side.
 *
 * IMPORTANT — counter semantics:
 *   The counter is *write-driven*. It increments only when a row lands in
 *   `prescription_generations`, which only happens inside `/generate`. The
 *   `/analyze` endpoint reads this same counter (so a hot trainer that has
 *   already burned 20 generations today gets 429 on analyze too) but does
 *   not contribute to it. This is intentional: analysis is cheap (one
 *   prompt round-trip, no optimizer), the LLM cost lives in /generate, and
 *   the persisted row in `prescription_generations` is the natural counter.
 *   If you ever need analyze to count too, add a separate persisted counter
 *   table — do NOT switch this to in-memory or the in-memory store in
 *   web/src/lib/rate-limit.ts (that one resets on every Vercel cold start).
 *
 * Defaults (5/min, 20/day) match the inline limits previously hard-coded in
 * `web/src/app/api/prescription/generate/route.ts`. Bump centrally here and
 * both routes pick it up.
 */
export const PRESCRIPTION_PER_MINUTE = 5
export const PRESCRIPTION_PER_DAY = 20

export interface PrescriptionRateLimitResult {
    allowed: boolean
    /** HTTP status to use when blocked (always 429). */
    status?: number
    /** User-facing pt-BR message. */
    error?: string
}

/**
 * Returns `{ allowed: true }` if the trainer is within both windows. Returns
 * `{ allowed: false, status: 429, error }` otherwise. The caller is expected
 * to short-circuit the request with the returned status/message.
 *
 * The supabase client must already be authenticated as the trainer (RLS will
 * still let trainers see only their own rows, but we filter by trainer_id
 * explicitly for clarity).
 */
export async function checkPrescriptionRateLimit(
    supabase: SupabaseClient,
    trainerId: string,
    opts: { perMinute?: number; perDay?: number } = {},
): Promise<PrescriptionRateLimitResult> {
    const perMinute = opts.perMinute ?? PRESCRIPTION_PER_MINUTE
    const perDay = opts.perDay ?? PRESCRIPTION_PER_DAY

    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString()
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const [perMinuteResult, perDayResult] = await Promise.all([
        supabase
            .from('prescription_generations')
            .select('id', { count: 'exact', head: true })
            .eq('trainer_id', trainerId)
            .gte('created_at', oneMinuteAgo),
        supabase
            .from('prescription_generations')
            .select('id', { count: 'exact', head: true })
            .eq('trainer_id', trainerId)
            .gte('created_at', oneDayAgo),
    ])

    if ((perMinuteResult.count ?? 0) >= perMinute) {
        return {
            allowed: false,
            status: 429,
            error: 'Limite de gerações por minuto atingido. Aguarde um momento.',
        }
    }
    if ((perDayResult.count ?? 0) >= perDay) {
        return {
            allowed: false,
            status: 429,
            error: `Limite diário de gerações atingido (${perDay}/dia). Tente novamente amanhã.`,
        }
    }

    return { allowed: true }
}
