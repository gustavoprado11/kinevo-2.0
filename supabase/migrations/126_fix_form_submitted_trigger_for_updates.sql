-- ============================================================
-- Migration 126: Fix form_submitted trigger to fire on draft → submitted UPDATES
--
-- Background
-- ----------
-- The trigger `on_form_submitted` on `public.form_submissions` was defined as
-- `AFTER INSERT`. The function `notify_trainer_form_submitted()` correctly
-- guards `IF NEW.status = 'submitted'` and inserts a row into
-- `trainer_notifications`. However, the trigger only fires on INSERT, so any
-- submission that is created as `status='draft'` first and only later
-- transitions to `status='submitted'` via UPDATE silently skips the trigger
-- entirely.
--
-- Empirical evidence (A.3 investigation, 2026-05-12):
--   - INSERT with status='submitted' directly → trigger fires, notification
--     row appears (validated).
--   - INSERT with status='draft' followed by UPDATE to status='submitted'
--     → trigger does NOT fire (validated). This is the inline pre/post
--     workout flow path.
--
-- Fix
-- ---
-- PostgreSQL constraints on trigger WHEN clauses:
--   * `TG_OP` is only available inside PL/pgSQL function bodies, not in WHEN.
--   * A WHEN clause that references OLD cannot also cover INSERT events
--     (INSERT triggers have no OLD row).
--
-- So we split into two triggers that share the same function:
--   1. `on_form_submitted_insert` (AFTER INSERT) — fires when NEW.status='submitted'.
--      Already-working behavior preserved.
--   2. `on_form_submitted_update` (AFTER UPDATE OF status) — fires only when
--      status transitions INTO 'submitted' (so subsequent updates of an
--      already-submitted row don't re-notify). NEW behavior, fixes the bug.
--
-- The function `notify_trainer_form_submitted()` is left untouched — it
-- already does the correct thing once invoked.
-- ============================================================

DROP TRIGGER IF EXISTS on_form_submitted ON public.form_submissions;
DROP TRIGGER IF EXISTS on_form_submitted_insert ON public.form_submissions;
DROP TRIGGER IF EXISTS on_form_submitted_update ON public.form_submissions;

CREATE TRIGGER on_form_submitted_insert
    AFTER INSERT ON public.form_submissions
    FOR EACH ROW
    WHEN (NEW.status = 'submitted')
    EXECUTE FUNCTION public.notify_trainer_form_submitted();

CREATE TRIGGER on_form_submitted_update
    AFTER UPDATE OF status ON public.form_submissions
    FOR EACH ROW
    WHEN (
        NEW.status = 'submitted'
        AND OLD.status IS DISTINCT FROM 'submitted'
    )
    EXECUTE FUNCTION public.notify_trainer_form_submitted();
