-- ============================================================================
-- Kinevo — 108 Scheduled Notifications (Fase 5 — Lembretes push)
-- ============================================================================
-- Tabela de pushes **futuros** agendados (MVP: lembrete 1h antes de um
-- agendamento). O server action insere N linhas ao criar/remarcar rotina,
-- o dispatcher (Edge Function) varre a cada 5min e converte `pending` →
-- `student_inbox_items`, disparando o pipeline existente de push (Expo).
--
-- Pushes **imediatos** (rotina criada, remarcada, cancelada) continuam
-- fluindo pelo caminho direto: server action → INSERT em
-- `student_inbox_items` → trigger 098 → Edge Function send-push.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Estender o tipo permitido de student_inbox_items pra incluir 'appointment'.
-- Usado pelos pushes imediatos de agendamentos.
-- ----------------------------------------------------------------------------
ALTER TABLE student_inbox_items
    DROP CONSTRAINT IF EXISTS student_inbox_items_type_check;
ALTER TABLE student_inbox_items
    ADD CONSTRAINT student_inbox_items_type_check
    CHECK (type IN (
        'form_request',
        'feedback',
        'system_alert',
        'text_message',
        'program_assigned',
        'program_report_published',
        'appointment'
    ));

-- ----------------------------------------------------------------------------
-- scheduled_notifications — push futuros pendentes
-- ----------------------------------------------------------------------------
CREATE TABLE scheduled_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Alvo
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,

    -- Quando disparar
    scheduled_for TIMESTAMPTZ NOT NULL,

    -- Conteúdo do push
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Contexto (permite cancelar/atualizar quando o agendamento muda)
    source TEXT NOT NULL CHECK (source IN ('appointment_reminder')),
    recurring_appointment_id UUID
        REFERENCES recurring_appointments(id) ON DELETE CASCADE,
    occurrence_date DATE NOT NULL,

    -- Estado
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'sent', 'canceled', 'failed')),
    sent_at TIMESTAMPTZ,
    last_error TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Uma ocorrência específica só tem um lembrete por fonte
    UNIQUE (recurring_appointment_id, occurrence_date, source)
);

-- Index parcial pra consulta do dispatcher: WHERE status='pending' AND scheduled_for <= now()
CREATE INDEX idx_scheduled_notifications_dispatch
    ON scheduled_notifications(scheduled_for)
    WHERE status = 'pending';

CREATE INDEX idx_scheduled_notifications_recurring
    ON scheduled_notifications(recurring_appointment_id)
    WHERE recurring_appointment_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
ALTER TABLE scheduled_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trainer can read own scheduled notifications"
    ON scheduled_notifications FOR SELECT
    USING (trainer_id = current_trainer_id());

CREATE POLICY "Service role full access scheduled_notifications"
    ON scheduled_notifications FOR ALL
    USING (auth.role() = 'service_role');

COMMENT ON TABLE scheduled_notifications IS
    'Pushes futuros pendentes (MVP: lembrete 1h antes de agendamentos). Dispatcher roda a cada 5min via pg_cron.';

-- ============================================================================
-- pg_cron: dispara as Edge Functions
-- ============================================================================
-- A URL é hardcoded pra evitar dependência de settings `app.*` (padrão
-- estabelecido na migration 098). Authorization não é necessário porque
-- a Edge Function valida internamente via `verify_jwt=false` e checagem
-- explícita do service_role_key quando apropriado.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove jobs antigos (idempotência de migração).
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'dispatch-scheduled-notifications') THEN
        PERFORM cron.unschedule('dispatch-scheduled-notifications');
    END IF;
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'extend-scheduled-notifications') THEN
        PERFORM cron.unschedule('extend-scheduled-notifications');
    END IF;
END $$;

-- Dispatcher: a cada 5 minutos, envia lembretes prontos.
SELECT cron.schedule(
    'dispatch-scheduled-notifications',
    '*/5 * * * *',
    $$
    SELECT net.http_post(
        url := 'https://lylksbtgrihzepbteest.supabase.co/functions/v1/dispatch-scheduled-notifications',
        body := '{}'::jsonb,
        headers := '{"Content-Type": "application/json"}'::jsonb
    )
    $$
);

-- Extend: diariamente às 2h (São Paulo ≈ 5h UTC), garante janela de 30 dias.
SELECT cron.schedule(
    'extend-scheduled-notifications',
    '0 5 * * *',
    $$
    SELECT net.http_post(
        url := 'https://lylksbtgrihzepbteest.supabase.co/functions/v1/extend-scheduled-notifications',
        body := '{}'::jsonb,
        headers := '{"Content-Type": "application/json"}'::jsonb
    )
    $$
);
