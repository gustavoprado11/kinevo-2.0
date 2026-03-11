-- Push tickets table for tracking Expo push notification delivery
CREATE TABLE IF NOT EXISTS push_tickets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id text NOT NULL,
    push_token_id uuid REFERENCES push_tokens(id) ON DELETE CASCADE,
    user_id uuid NOT NULL,
    role text NOT NULL CHECK (role IN ('trainer', 'student')),
    notification_id text,           -- trainer_notifications.id or student_inbox_items.id
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ok', 'error')),
    receipt_status text,            -- from Expo receipt: 'ok' or 'error'
    receipt_message text,           -- error message from Expo
    receipt_error_type text,        -- e.g., 'DeviceNotRegistered', 'MessageTooBig', etc.
    created_at timestamptz NOT NULL DEFAULT now(),
    checked_at timestamptz,

    CONSTRAINT push_tickets_ticket_id_unique UNIQUE (ticket_id)
);

-- Index for cron: find unchecked tickets older than 15 minutes
CREATE INDEX idx_push_tickets_pending ON push_tickets (created_at)
    WHERE status = 'pending';

-- Cleanup index
CREATE INDEX idx_push_tickets_created_at ON push_tickets (created_at);

-- RLS
ALTER TABLE push_tickets ENABLE ROW LEVEL SECURITY;

-- Only service_role can access this table
CREATE POLICY "Service role only" ON push_tickets
    FOR ALL USING (false);
