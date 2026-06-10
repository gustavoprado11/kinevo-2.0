-- ============================================================================
-- Migration 181: Crons Oura — anon key sai do comando literal e vai pro Vault
--
-- Problema (análise noturna 09/06/2026): em produção, cron.job.command dos
-- jobs oura-* contém o JWT anon em texto puro (aplicado via MCP na 154).
-- A anon key é pública por design, mas o literal no comando quebra rotação
-- de chave e é má higiene (aparece em dumps de cron.job).
--
-- Solução: o comando lê a key do Vault EM RUNTIME (subselect). Rotacionar a
-- key = atualizar o secret no Vault, sem tocar nos crons.
--
-- PRÉ-REQUISITO (SQL editor, NÃO commitar o valor):
--   select vault.create_secret('<anon key do projeto>', 'supabase_anon_key');
--
-- Idempotente: desagenda antes de reagendar (mesmo padrão da 154).
-- ============================================================================

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
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_anon_key' limit 1),
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_anon_key' limit 1)
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
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_anon_key' limit 1),
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_anon_key' limit 1)
    ),
    body := '{}'::jsonb
  );
  $cmd$
);
