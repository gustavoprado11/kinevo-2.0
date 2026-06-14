-- 194: cron oura-webhook-setup-weekly passa a enviar o header x-setup-secret.
--
-- Acompanha a migration 193 (coluna setup_secret) e o guard fail-closed adicionado
-- na função oura-webhook-setup. O valor é lido EM RUNTIME da mesma tabela
-- (wearable_provider_config) — rotacionar = atualizar a coluna, sem tocar no cron.
--
-- Só o job de setup muda; oura-token-refresh-daily fica como está. Idempotente.

do $$ begin perform cron.unschedule('oura-webhook-setup-weekly'); exception when others then null; end $$;

select cron.schedule(
  'oura-webhook-setup-weekly',
  '30 3 * * 1',
  $cmd$
  select net.http_post(
    url := 'https://lylksbtgrihzepbteest.functions.supabase.co/oura-webhook-setup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_anon_key' limit 1),
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_anon_key' limit 1),
      'x-setup-secret', (select setup_secret from public.wearable_provider_config where source = 'oura' limit 1)
    ),
    body := '{}'::jsonb
  );
  $cmd$
);
