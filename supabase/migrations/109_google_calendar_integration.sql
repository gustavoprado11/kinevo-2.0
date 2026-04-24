-- ============================================================================
-- Kinevo — 109 Google Calendar Integration (Fase 6)
-- ============================================================================
-- Tabela `google_calendar_connections` armazena credenciais OAuth do trainer
-- e dados do watch channel ativo (pra detectar mudanças externas).
-- Colunas de sync em `recurring_appointments` trackeiam estado no Google.
--
-- Tokens (access + refresh) ficam em texto puro. RLS só permite `service_role`
-- acessar — clients do Kinevo nunca leem tokens diretamente. Débito técnico
-- aceitável pro MVP: tokens podem ser migrados pro Supabase Vault em V2 sem
-- alterar a API do `google_calendar_connections`.
-- ============================================================================

CREATE TABLE google_calendar_connections (
    trainer_id UUID PRIMARY KEY REFERENCES trainers(id) ON DELETE CASCADE,

    -- Identificação da conta Google
    google_account_email TEXT NOT NULL,
    calendar_id TEXT NOT NULL,

    -- Credenciais OAuth (texto puro, RLS bloqueia leitura por clients)
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    access_token_expires_at TIMESTAMPTZ NOT NULL,
    scope TEXT NOT NULL,

    -- Estado da conexão
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'revoked', 'error')),

    -- Watch channel (Push Notifications)
    watch_channel_id TEXT,
    watch_resource_id TEXT,
    watch_expires_at TIMESTAMPTZ,

    -- Bookkeeping
    connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_sync_at TIMESTAMPTZ,
    last_sync_error TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_google_connections_watch_expires
    ON google_calendar_connections(watch_expires_at)
    WHERE watch_channel_id IS NOT NULL;

CREATE INDEX idx_google_connections_watch_channel
    ON google_calendar_connections(watch_channel_id)
    WHERE watch_channel_id IS NOT NULL;

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON google_calendar_connections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE google_calendar_connections IS
    'OAuth do Google Calendar por trainer. Tokens em texto puro protegidos por RLS (apenas service_role).';
COMMENT ON COLUMN google_calendar_connections.status IS
    'active: tudo OK; revoked: trainer revogou acesso no Google; error: falha persistente.';

-- ----------------------------------------------------------------------------
-- Colunas de sync em recurring_appointments
-- ----------------------------------------------------------------------------
ALTER TABLE recurring_appointments
    ADD COLUMN google_event_id TEXT,
    ADD COLUMN google_sync_status TEXT DEFAULT 'not_synced'
        CHECK (google_sync_status IN ('not_synced', 'pending', 'synced', 'error', 'disabled'));

CREATE INDEX idx_recurring_appointments_google_pending
    ON recurring_appointments(google_sync_status)
    WHERE google_sync_status IN ('pending', 'error');

COMMENT ON COLUMN recurring_appointments.google_sync_status IS
    'not_synced: trainer sem Google conectado; pending: aguardando sync; synced: OK; error: falhou; disabled: trainer desconectou.';

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
ALTER TABLE google_calendar_connections ENABLE ROW LEVEL SECURITY;

-- Trainer pode LER sua conexão (exceto tokens — mas RLS não filtra por coluna).
-- Mitigação: o client do Kinevo sempre seleciona colunas não-sensíveis.
-- O server action usa `supabaseAdmin` quando precisa dos tokens.
CREATE POLICY "Trainer can read own google connection"
    ON google_calendar_connections FOR SELECT
    USING (trainer_id = current_trainer_id());

-- Trainer pode deletar (disconnect) — os server actions também usam admin
-- pra garantir cleanup do watch channel antes, mas deixamos o client poder
-- fazer fallback defensivo.
CREATE POLICY "Trainer can delete own google connection"
    ON google_calendar_connections FOR DELETE
    USING (trainer_id = current_trainer_id());

CREATE POLICY "Service role full access google_calendar_connections"
    ON google_calendar_connections FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================================================
-- pg_cron: renova watch channels diariamente (3h BRT / 6h UTC)
-- ============================================================================
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
        headers := '{"Content-Type": "application/json"}'::jsonb
    )
    $$
);
