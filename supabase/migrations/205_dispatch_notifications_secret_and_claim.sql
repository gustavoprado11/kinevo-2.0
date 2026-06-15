-- Security hardening (loop de segurança, 2026-06-15): a Edge Function
-- dispatch-scheduled-notifications roda com verify_jwt=false e o cron pg_net
-- (migration 108) a chamava SEM header de auth — qualquer POST anônimo
-- disparava o job, e sob concorrência o inbox/push podia duplicar.
--
-- Fix (acompanha a edge function atualizada):
--   1. CHECK de status passa a aceitar 'processing' (claim atômico do worker).
--   2. O cron dispatch-scheduled-notifications passa a enviar x-push-secret
--      (mesmo secret do send-push-notification, já no Vault). A edge valida
--      fail-closed; o claim pending→processing torna o processamento idempotente.
--
-- ORDEM DE DEPLOY (zero downtime), espelhando a migration 180:
--   1. Aplicar esta migration: o cron passa a enviar o header; a edge ANTIGA
--      ignora o header extra — nada quebra.
--   2. Deploy da edge function atualizada (passa a EXIGIR o header). O cron já
--      o envia desde o passo 1 — sem janela de 401.
--
-- O secret 'push_webhook_secret' já existe no Vault (migration 180) e o env
-- PUSH_WEBHOOK_SECRET já está setado no projeto. Nada novo a provisionar.

-- 1. Permite o estado intermediário 'processing' usado pelo claim atômico.
ALTER TABLE public.scheduled_notifications
    DROP CONSTRAINT IF EXISTS scheduled_notifications_status_check;
ALTER TABLE public.scheduled_notifications
    ADD CONSTRAINT scheduled_notifications_status_check
    CHECK (status IN ('pending', 'processing', 'sent', 'canceled', 'failed'));

-- 2. Reagenda o cron do dispatcher enviando o header x-push-secret (lido do
--    Vault em runtime; rotacionar = atualizar o Vault, sem tocar no cron).
--    Só o job 'dispatch-scheduled-notifications' muda; 'extend-...' fica igual.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'dispatch-scheduled-notifications') THEN
        PERFORM cron.unschedule('dispatch-scheduled-notifications');
    END IF;
END $$;

SELECT cron.schedule(
    'dispatch-scheduled-notifications',
    '*/5 * * * *',
    $$
    SELECT net.http_post(
        url := 'https://lylksbtgrihzepbteest.supabase.co/functions/v1/dispatch-scheduled-notifications',
        body := '{}'::jsonb,
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-push-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'push_webhook_secret' LIMIT 1)
        )
    )
    $$
);
