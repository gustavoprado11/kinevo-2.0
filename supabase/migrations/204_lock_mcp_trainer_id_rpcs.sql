-- Security hardening (MCP audit, 2026-06-15): lock down the `p_trainer_id`
-- RPC overloads added in migrations 200/201/202/203.
--
-- THE PROBLEM
-- These overloads are SECURITY DEFINER and derive the tenant scope ENTIRELY
-- from the caller-supplied first argument `p_trainer_id` (guarded only by a
-- NULL check), never comparing it against the authenticated principal. They
-- were intended to be called ONLY by the MCP server, which uses the
-- service-role client and passes a `trainer_id` already validated against the
-- OAuth token. But:
--   * 200 / 201 explicitly GRANTed EXECUTE to `authenticated`, and
--   * 202 / 203 had no grant at all, inheriting the default EXECUTE to PUBLIC
--     (anon + authenticated) — this project has no `ALTER DEFAULT PRIVILEGES`
--     baseline, it revokes per-function (see migration 173, which ran before
--     these signatures existed and so never touched them).
-- Result: any logged-in user (trainer OR student) — and for 202/203 even an
-- anonymous holder of the public anon key — could call these directly via
-- PostgREST `/rest/v1/rpc/...`, pass a VICTIM trainer's UUID, and read or write
-- that trainer's data (assessment health PII, forms, programs), bypassing RLS.
--
-- THE FIX
-- These overloads are only ever reached through the trusted MCP service-role
-- path (the web/mobile apps call the OLDER overloads WITHOUT `p_trainer_id`,
-- which resolve identity from the JWT via current_trainer_id() and are left
-- untouched here). So we restrict EXECUTE to `service_role` only. The web
-- "enviar formulário" action, which was the one authenticated caller of the
-- 5-arg assign_form_to_students, is moved to the admin (service-role) client in
-- the same change set — so no legitimate `authenticated` caller remains.
--
-- IMPORTANT: do NOT re-grant these overloads to `authenticated`/`anon`/PUBLIC.
-- Their tenant scope is caller-supplied; only the trusted service-role backend
-- (which validates the trainer identity itself) may call them.

-- 200 — program template tree (MCP-only; web uses the 1-arg jsonb overload)
REVOKE EXECUTE ON FUNCTION public.create_program_template_tree(uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_program_template_tree(uuid, jsonb)
  TO service_role;

-- 201 — assign form, 5-arg explicit-trainer overload (MCP + web admin client).
-- The web action now passes the admin client, so authenticated no longer needs it.
REVOKE EXECUTE ON FUNCTION public.assign_form_to_students(uuid, uuid, uuid[], timestamptz, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_form_to_students(uuid, uuid, uuid[], timestamptz, text)
  TO service_role;

-- 202 — assessment overloads (MCP-only; web/mobile use the 122 overloads
-- without p_trainer_id). These are the highest-severity holes (health PII +
-- previously anon-readable).
REVOKE EXECUTE ON FUNCTION public.create_assessment_session(uuid, uuid, uuid, timestamptz, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_assessment_session(uuid, uuid, uuid, timestamptz, text)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.save_assessment_measurements(uuid, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_assessment_measurements(uuid, uuid, jsonb)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.finalize_assessment_session(uuid, uuid, jsonb, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_assessment_session(uuid, uuid, jsonb, text)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_assessment_sessions(uuid, uuid, text, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_assessment_sessions(uuid, uuid, text, integer)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_assessment_session(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_assessment_session(uuid, uuid)
  TO service_role;

-- 203 — assign program, explicit-trainer overload (MCP-only; web uses
-- save_assigned_program_tree / the older overloads).
REVOKE EXECUTE ON FUNCTION public.assign_program_to_student(uuid, uuid, uuid, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_program_to_student(uuid, uuid, uuid, timestamptz)
  TO service_role;
