-- ============================================================
-- Migration 127: Push error log table
--
-- Background
-- ----------
-- The Expo Push API can reject pushes with various error types
-- (DeviceNotRegistered, InvalidCredentials, MessageRateExceeded,
-- MessageTooBig, etc.). Today the Edge Function `send-push-notification`
-- and the Next.js helper `web/src/lib/push-notifications.ts` only handle
-- DeviceNotRegistered (which marks the token inactive). Everything else
-- is logged via console.error and lost — there's no durable record we can
-- query for delivery-health monitoring.
--
-- This table records every non-OK ticket returned by Expo so we can:
--   - Detect APNs/FCM credential breakage (InvalidCredentials cluster).
--   - Detect rate limit pressure (MessageRateExceeded cluster).
--   - Detect payload-size regressions (MessageTooBig cluster).
--   - Build a /admin/push-health dashboard later (Fase 11 §9).
--
-- Schema notes
-- ------------
--   * push_token_id is a soft FK (ON DELETE SET NULL) so we keep the
--     historical error row even if the token is later cleaned up.
--   * user_id is NOT a FK — it can point at either auth.users (trainers)
--     or students.auth_user_id (students), and we don't want a hard
--     constraint that breaks cleanup workflows.
--   * raw_ticket is the entire Expo ticket JSON, kept for forensics.
--   * RLS: paridade com public.push_tickets — `USING (false)` fecha
--     leitura/escrita para todos os roles exceto service_role (que
--     bypassa policy). Edge Function e Next.js server actions usam
--     service_role.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.push_errors (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    push_token_id   UUID REFERENCES public.push_tokens(id) ON DELETE SET NULL,
    user_id         UUID NOT NULL,
    role            TEXT NOT NULL CHECK (role IN ('trainer', 'student')),
    notification_id TEXT,
    error_type      TEXT,
    error_message   TEXT,
    raw_ticket      JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_errors_recent
    ON public.push_errors(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_push_errors_by_type
    ON public.push_errors(error_type, created_at DESC);

ALTER TABLE public.push_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only"
    ON public.push_errors
    FOR ALL
    USING (false);

COMMENT ON TABLE public.push_errors IS
    'Log of non-OK tickets returned by Expo Push API. Service-role write only. Used for delivery-health monitoring.';

COMMENT ON COLUMN public.push_errors.role IS
    'Which side the failing push was targeted at: trainer or student.';
COMMENT ON COLUMN public.push_errors.error_type IS
    'Expo error string: DeviceNotRegistered, InvalidCredentials, MessageRateExceeded, MessageTooBig, etc.';
COMMENT ON COLUMN public.push_errors.raw_ticket IS
    'Full Expo Push ticket object (including details.error and details.fault).';
