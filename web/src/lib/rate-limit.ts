/**
 * Rate limiter DURÁVEL e atômico, compartilhado entre instâncias serverless.
 *
 * Backend: função SQL `consume_rate_limit` (migration 195) que faz check+insert
 * atômico sob advisory lock por chave — fecha o TOCTOU e o problema do antigo
 * `Map` em memória (que era por-lambda na Vercel → limites nunca convergiam).
 *
 * Uma única chamada `consumeRateLimit` substitui o par check/record antigo:
 * ela já registra o request quando permite, então NÃO há mais `recordRequest`.
 */
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function consumeRateLimit(
    key: string,
    opts: { perMinute: number; perDay: number }
): Promise<{ allowed: boolean; error?: string }> {
    try {
        // Boundary cast: a função é nova e ainda não está nos tipos gerados (gen:types).
        const { data, error } = await supabaseAdmin.rpc('consume_rate_limit' as never, {
            p_key: key,
            p_per_minute: opts.perMinute,
            p_per_day: opts.perDay,
        } as never)

        if (error) {
            // Fail-open: um hiccup do banco não deve derrubar o endpoint (que já tem auth).
            console.error('[rate-limit] consume_rate_limit RPC error, failing open:', error.message)
            return { allowed: true }
        }

        const res = data as unknown as { allowed: boolean; scope?: 'minute' | 'day' }
        if (res?.allowed) return { allowed: true }
        return {
            allowed: false,
            error: res?.scope === 'minute'
                ? 'Limite de requisições por minuto atingido. Aguarde um momento.'
                : 'Limite diário de requisições atingido. Tente novamente amanhã.',
        }
    } catch (e) {
        console.error('[rate-limit] consume_rate_limit unexpected error, failing open:', e)
        return { allowed: true }
    }
}
