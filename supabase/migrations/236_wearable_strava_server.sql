-- ============================================================================
-- 236 — Saúde F3: Strava server-side + watchdog de reconciliação de wearables.
-- (docs/analise-saude-aluno-2026-07-07.md §5 F3)
--
-- 1. wearable_oauth_tokens passa a aceitar source='strava' — as edge functions
--    strava-token-exchange/refresh agora PERSISTEM os tokens no servidor
--    (antes viviam só no SecureStore do device → webhook/cron eram impossíveis).
-- 2. Cron diário `wearable-reconcile-daily` (04:00 UTC): sincroniza Oura+Strava
--    server-side e grava o desfecho REAL na conexão — o watchdog que teria
--    pego o webhook do Oura mudo em maio (ficou 6 semanas sem ninguém saber).
-- 3. Cron semanal `strava-webhook-setup-weekly` (seg 03:45 UTC): garante a
--    push subscription do Strava viva (paridade com oura-webhook-setup).
--
-- A linha 'strava' de wearable_provider_config (verification_token, callback_url,
-- setup_secret; client_secret é o placeholder 'env:STRAVA_CLIENT_SECRET' — as
-- credenciais reais são secrets de function) é inserida FORA desta migration
-- (valores gerados, não versionáveis). anon key via vault (padrão da 154/atual).
-- Idempotente: desagenda antes de reagendar.
-- ============================================================================

alter table wearable_oauth_tokens drop constraint if exists wearable_oauth_tokens_source_check;
alter table wearable_oauth_tokens add constraint wearable_oauth_tokens_source_check
  check (source = any (array['oura'::text, 'whoop'::text, 'strava'::text]));

alter table wearable_provider_config drop constraint if exists wearable_provider_config_source_check;
alter table wearable_provider_config add constraint wearable_provider_config_source_check
  check (source = any (array['oura'::text, 'whoop'::text, 'strava'::text]));

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$ begin perform cron.unschedule('wearable-reconcile-daily'); exception when others then null; end $$;
do $$ begin perform cron.unschedule('strava-webhook-setup-weekly'); exception when others then null; end $$;

select cron.schedule(
  'wearable-reconcile-daily',
  '0 4 * * *',
  $cmd$
  select net.http_post(
    url := 'https://lylksbtgrihzepbteest.functions.supabase.co/wearable-reconcile',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_anon_key' limit 1),
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_anon_key' limit 1),
      'x-setup-secret', (select setup_secret from public.wearable_provider_config where source = 'strava' limit 1)
    ),
    body := '{}'::jsonb
  );
  $cmd$
);

select cron.schedule(
  'strava-webhook-setup-weekly',
  '45 3 * * 1',
  $cmd$
  select net.http_post(
    url := 'https://lylksbtgrihzepbteest.functions.supabase.co/strava-webhook-setup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_anon_key' limit 1),
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_anon_key' limit 1),
      'x-setup-secret', (select setup_secret from public.wearable_provider_config where source = 'strava' limit 1)
    ),
    body := '{}'::jsonb
  );
  $cmd$
);
