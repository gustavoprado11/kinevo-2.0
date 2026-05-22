-- ============================================================================
-- Agendamento dos crons da integração Oura (pg_cron + pg_net).
-- Rodar no SQL editor do Supabase APÓS deployar as edge functions.
-- Requer extensões pg_cron e pg_net habilitadas (Database → Extensions).
--
-- Substitua:
--   <PROJECT_REF>      → ref do projeto (ex: abcdefghijklmno)
--   <SERVICE_ROLE_KEY> → service_role key (Settings → API)
-- ============================================================================

-- Habilita extensões (idempotente).
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 1. Refresh de tokens — diário às 03:00 UTC.
select cron.schedule(
  'oura-token-refresh-daily',
  '0 3 * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.functions.supabase.co/oura-token-refresh',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 2. Setup/renovação de subscriptions de webhook — semanal (segunda 03:30 UTC).
select cron.schedule(
  'oura-webhook-setup-weekly',
  '30 3 * * 1',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.functions.supabase.co/oura-webhook-setup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Para remover depois, se precisar:
--   select cron.unschedule('oura-token-refresh-daily');
--   select cron.unschedule('oura-webhook-setup-weekly');
