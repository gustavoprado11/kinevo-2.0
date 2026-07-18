/**
 * Analytics first-party (migração 266) — eventos vão pra `product_events`
 * via RPC `log_product_event` (SECURITY DEFINER: resolve trainer/aluno do
 * JWT; sem sessão o evento é descartado no banco, silenciosamente).
 *
 * Fire-and-forget por contrato: analytics NUNCA quebra fluxo de produto —
 * qualquer erro é engolido. Leitura do funil: view `v_trainer_funnel` +
 * queries em docs/analytics.md.
 */
import { createClient } from '@/lib/supabase/client'

export function track(event: string, properties?: Record<string, unknown>) {
    if (typeof window === 'undefined') return
    if (process.env.NODE_ENV === 'development') {
        console.log(`[analytics] ${event}`, properties ?? '')
    }
    try {
        const supabase = createClient()
        void supabase
            .rpc('log_product_event', {
                p_event: event,
                p_props: (properties ?? {}) as never,
                p_source: 'web',
            })
            .then(() => undefined, () => undefined)
    } catch {
        // nunca propaga
    }
}
