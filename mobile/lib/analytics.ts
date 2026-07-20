// Analytics first-party do mobile (migration 266) — primeiro wrapper do app.
// Escreve em product_events via RPC log_product_event (SECURITY DEFINER, que
// resolve trainer/student pelo JWT e nunca lança). Fire-and-forget: analytics
// jamais bloqueia ou quebra fluxo de produto.
import { supabase } from './supabase';
import type { Json } from '@kinevo/shared/types/database';

export function logProductEvent(event: string, props?: Record<string, Json>): void {
  try {
    void supabase
      .rpc('log_product_event', {
        p_event: event,
        p_props: (props ?? {}) as Json,
        p_source: 'mobile',
      })
      .then(({ error }) => {
        if (error) console.warn('[analytics]', event, error.message);
      });
  } catch {
    // nunca propaga
  }
}
