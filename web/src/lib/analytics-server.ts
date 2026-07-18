/**
 * Analytics server-side (migração 266) — insert direto em `product_events`
 * com o admin client, para eventos que nascem no servidor (signup, checkout,
 * webhook de assinatura). Fire-and-forget: nunca lança.
 */
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function trackServer(
    event: string,
    opts: {
        trainerId?: string | null
        studentId?: string | null
        props?: Record<string, unknown>
    } = {},
): Promise<void> {
    try {
        await supabaseAdmin.from('product_events').insert({
            event: event.slice(0, 64),
            source: 'server',
            trainer_id: opts.trainerId ?? null,
            student_id: opts.studentId ?? null,
            props: (opts.props ?? {}) as never,
        })
    } catch (err) {
        console.error('[analytics-server]', event, err)
    }
}
