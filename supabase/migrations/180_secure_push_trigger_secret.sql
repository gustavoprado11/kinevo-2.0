-- ============================================================
-- Migration 180: Autenticar os triggers de push com shared secret
--
-- Problema (análise noturna 09/06/2026, achado crítico #1): a Edge Function
-- send-push-notification roda com verify_jwt=false e os triggers da
-- migration 098 chamam via pg_net sem nenhum header de auth — qualquer um
-- pode POSTar payload arbitrário e disparar push para qualquer usuário.
--
-- Solução: os triggers passam a enviar o header x-push-secret, lido do
-- Supabase Vault (secret 'push_webhook_secret'). A Edge Function valida o
-- header contra o env PUSH_WEBHOOK_SECRET (fail-closed).
--
-- ORDEM DE DEPLOY (zero downtime):
--   1. Criar o secret no Vault (SQL editor, NÃO commitar o valor):
--        select vault.create_secret('<valor-aleatorio-forte>', 'push_webhook_secret');
--   2. Aplicar esta migration (triggers passam a enviar o header; a edge
--      antiga ignora o header extra — nada quebra).
--   3. supabase secrets set PUSH_WEBHOOK_SECRET=<mesmo valor>
--   4. Deploy da edge function atualizada (passa a exigir o header).
--
-- Fallback consciente: se o secret não existir no Vault, o trigger envia
-- SEM header e loga warning — o push continua funcionando até o passo 4,
-- quando a edge passa a rejeitar. O gate de segurança é a edge function.
-- ============================================================

CREATE OR REPLACE FUNCTION notify_push_on_trainer_notification()
RETURNS TRIGGER AS $$
DECLARE
    payload JSONB;
    push_secret TEXT;
    req_headers JSONB;
BEGIN
    payload := jsonb_build_object(
        'type', 'INSERT',
        'table', 'trainer_notifications',
        'record', row_to_json(NEW)::jsonb
    );

    SELECT decrypted_secret INTO push_secret
    FROM vault.decrypted_secrets
    WHERE name = 'push_webhook_secret'
    LIMIT 1;

    IF push_secret IS NULL THEN
        RAISE WARNING '[push-trigger] vault secret push_webhook_secret ausente — chamando edge sem auth header';
        req_headers := '{"Content-Type": "application/json"}'::jsonb;
    ELSE
        req_headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-push-secret', push_secret
        );
    END IF;

    PERFORM net.http_post(
        url := 'https://lylksbtgrihzepbteest.supabase.co/functions/v1/send-push-notification',
        body := payload,
        headers := req_headers
    );

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[push-trigger] Failed to call Edge Function: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, vault;

CREATE OR REPLACE FUNCTION notify_push_on_student_inbox_item()
RETURNS TRIGGER AS $$
DECLARE
    payload JSONB;
    push_secret TEXT;
    req_headers JSONB;
BEGIN
    payload := jsonb_build_object(
        'type', 'INSERT',
        'table', 'student_inbox_items',
        'record', row_to_json(NEW)::jsonb
    );

    SELECT decrypted_secret INTO push_secret
    FROM vault.decrypted_secrets
    WHERE name = 'push_webhook_secret'
    LIMIT 1;

    IF push_secret IS NULL THEN
        RAISE WARNING '[push-trigger] vault secret push_webhook_secret ausente — chamando edge sem auth header';
        req_headers := '{"Content-Type": "application/json"}'::jsonb;
    ELSE
        req_headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-push-secret', push_secret
        );
    END IF;

    PERFORM net.http_post(
        url := 'https://lylksbtgrihzepbteest.supabase.co/functions/v1/send-push-notification',
        body := payload,
        headers := req_headers
    );

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[push-trigger] Failed to call Edge Function: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, vault;

-- Os triggers em si (on_trainer_notification_push / on_student_inbox_item_push)
-- não mudam — apenas o corpo das funções acima foi substituído.
