-- ============================================================================
-- Oura — agendamento dos crons (pg_cron + pg_net).
-- token-refresh: diário 03:00 UTC. webhook-setup (cria/renova subscriptions):
-- semanal segunda 03:30 UTC. As functions são verify_jwt=false; a anon key
-- (pública) é enviada só pra satisfazer o gateway.
-- Idempotente: desagenda antes de reagendar.
--
-- NOTA: já aplicado em produção via MCP com a anon key real. Aqui o token foi
-- substituído por <SUPABASE_ANON_KEY> para não versionar JWTs — se for
-- re-aplicar via `db push`, troque o placeholder pela anon key pública do projeto.
-- ============================================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$ begin perform cron.unschedule('oura-token-refresh-daily'); exception when others then null; end $$;
do $$ begin perform cron.unschedule('oura-webhook-setup-weekly'); exception when others then null; end $$;

select cron.schedule(
  'oura-token-refresh-daily',
  '0 3 * * *',
  $cmd$
  select net.http_post(
    url := 'https://lylksbtgrihzepbteest.functions.supabase.co/oura-token-refresh',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', '<SUPABASE_ANON_KEY>',
      'Authorization', 'Bearer <SUPABASE_ANON_KEY>'
    ),
    body := '{}'::jsonb
  );
  $cmd$
);

select cron.schedule(
  'oura-webhook-setup-weekly',
  '30 3 * * 1',
  $cmd$
  select net.http_post(
    url := 'https://lylksbtgrihzepbteest.functions.supabase.co/oura-webhook-setup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', '<SUPABASE_ANON_KEY>',
      'Authorization', 'Bearer <SUPABASE_ANON_KEY>'
    ),
    body := '{}'::jsonb
  );
  $cmd$
);
