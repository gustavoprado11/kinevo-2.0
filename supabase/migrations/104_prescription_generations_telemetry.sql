-- Phase 2.5 — Telemetry columns on prescription_generations + feature flag on trainers.
--
-- Idempotent (ADD COLUMN IF NOT EXISTS). No backfill — columns start NULL and
-- are populated by future generations that run through the instrumented path.
-- rules_violations_json is observability, not a gate: the rules-validator corrects
-- violations inline; this column records what was detected.

ALTER TABLE public.prescription_generations
    ADD COLUMN IF NOT EXISTS tokens_input_new integer,
    ADD COLUMN IF NOT EXISTS tokens_input_cached integer,
    ADD COLUMN IF NOT EXISTS tokens_output integer,
    ADD COLUMN IF NOT EXISTS cost_usd numeric(10, 6),
    ADD COLUMN IF NOT EXISTS model_used text,
    ADD COLUMN IF NOT EXISTS retry_count smallint DEFAULT 0,
    ADD COLUMN IF NOT EXISTS prompt_version text,
    ADD COLUMN IF NOT EXISTS rules_violations_count smallint DEFAULT 0,
    ADD COLUMN IF NOT EXISTS rules_violations_json jsonb;

COMMENT ON COLUMN public.prescription_generations.rules_violations_json IS
    'Domain-rule violations detected post-generation (§4 of spec 06). Populated by rules-validator. Informational, not a gate.';

-- Trainer-level feature flag for the smart v2 pipeline. Default off; enabled
-- manually for dogfood trainers during the phased rollout.
ALTER TABLE public.trainers
    ADD COLUMN IF NOT EXISTS smart_v2_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.trainers.smart_v2_enabled IS
    'Phase 2.5 prescription pipeline (structured outputs, 3-layer prompt, rules-validator, telemetry). Off by default.';
