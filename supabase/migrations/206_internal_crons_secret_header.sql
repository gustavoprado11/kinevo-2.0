-- Security hardening (loop de segurança, 2026-06-15, achados baixos): 3 crons
-- internos chamavam suas Edge Functions (verify_jwt=false) SEM header de auth,
-- então um POST anônimo podia acioná-las — consumo de quota de APIs terceiras e
-- trabalho de batch (sem leak cross-tenant). Fix: as funções passam a exigir
-- x-push-secret (mesmo secret interno do send-push, já no Vault) e os crons
-- passam a enviá-lo. Acompanha o deploy das 3 edge functions atualizadas.
--
-- ORDEM DE DEPLOY zero-downtime (igual à migration 205): esta migration primeiro
-- (crons enviam o header; as edges antigas ignoram), depois deploy das edges.
--
-- Preserva URL, horário e (no Oura) os headers apikey/Authorization existentes;
-- só ADICIONA x-push-secret, lido do Vault em runtime.

-- 1. extend-scheduled-notifications (diário 05:00 UTC)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'extend-scheduled-notifications') THEN
        PERFORM cron.unschedule('extend-scheduled-notifications');
    END IF;
END $$;

SELECT cron.schedule(
    'extend-scheduled-notifications',
    '0 5 * * *',
    $$
    SELECT net.http_post(
        url := 'https://lylksbtgrihzepbteest.supabase.co/functions/v1/extend-scheduled-notifications',
        body := '{}'::jsonb,
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-push-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'push_webhook_secret' LIMIT 1)
        )
    )
    $$
);

-- 2. renew-google-watch-channels (diário 06:00 UTC)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'renew-google-watch-channels') THEN
        PERFORM cron.unschedule('renew-google-watch-channels');
    END IF;
END $$;

SELECT cron.schedule(
    'renew-google-watch-channels',
    '0 6 * * *',
    $$
    SELECT net.http_post(
        url := 'https://lylksbtgrihzepbteest.supabase.co/functions/v1/renew-google-watch-channels',
        body := '{}'::jsonb,
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-push-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'push_webhook_secret' LIMIT 1)
        )
    )
    $$
);

-- 3. oura-token-refresh-daily (diário 03:00 UTC) — preserva apikey/Authorization
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'oura-token-refresh-daily') THEN
        PERFORM cron.unschedule('oura-token-refresh-daily');
    END IF;
END $$;

SELECT cron.schedule(
    'oura-token-refresh-daily',
    '0 3 * * *',
    $$
    SELECT net.http_post(
        url := 'https://lylksbtgrihzepbteest.functions.supabase.co/oura-token-refresh',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'apikey', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_anon_key' LIMIT 1),
            'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_anon_key' LIMIT 1),
            'x-push-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'push_webhook_secret' LIMIT 1)
        ),
        body := '{}'::jsonb
    )
    $$
);
