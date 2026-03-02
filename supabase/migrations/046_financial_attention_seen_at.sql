-- ============================================================================
-- Kinevo — 046 Add financial_attention_seen_at to trainers
-- ============================================================================
-- Tracks when the trainer last viewed the financial pages.
-- The sidebar badge only counts attention items that changed AFTER this
-- timestamp, so it clears after the trainer visits /financial or
-- /financial/subscriptions and only reappears when something new happens.
-- ============================================================================

ALTER TABLE public.trainers
  ADD COLUMN IF NOT EXISTS financial_attention_seen_at TIMESTAMPTZ;
