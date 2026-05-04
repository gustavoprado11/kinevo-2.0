-- Extend the signup local-part regex with reconnaissance-style patterns
-- observed on 2026-05-02 prior to the bot signup waves of 2026-05-02/03.
--
-- Specifically: `test_enum_check@gmail.com` self-registered ~1 hour before
-- the @test.dev wave, validated the signup funnel by creating 13 sessions
-- in 3 minutes, then never completed onboarding. Same actor profile as the
-- subsequent waves but on a non-blocklisted domain (gmail.com) — caught
-- here at the local-part layer instead.
--
-- Adds: test_enum, test_recon, test_check, test_audit
-- (Tight enough to skip false positives on legitimate dev test accounts
--  like "test_user", "tester", "testing".)
--
-- Migration 118 is the prerequisite. This file replaces the function body
-- only — the trigger and the blocked_email_domains table stay as-is.

CREATE OR REPLACE FUNCTION public.check_email_signup_allowed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_domain  text;
    v_local   text;
    v_blocked_pattern text :=
        '^(dow_bot|enum_users|dump_users|hacker_|audit_evidence|audit_trainer|real_trainer|final_enum|final_sr|impersonate|trainer_inject|trainer_direct|trainer_become|escalate_sr|count_check|takeover|test_enum|test_recon|test_check|test_audit)';
BEGIN
    IF NEW.email IS NULL OR NEW.email = '' THEN
        RETURN NEW;
    END IF;

    v_domain := lower(split_part(NEW.email, '@', 2));
    v_local  := lower(split_part(NEW.email, '@', 1));

    IF v_domain = '' THEN
        RETURN NEW;
    END IF;

    IF EXISTS (SELECT 1 FROM public.blocked_email_domains WHERE domain = v_domain) THEN
        RAISE EXCEPTION 'Email domain not allowed for signup'
            USING errcode = '23514',
                  hint    = 'domain=' || v_domain;
    END IF;

    IF v_local ~* v_blocked_pattern THEN
        RAISE EXCEPTION 'Email pattern not allowed for signup'
            USING errcode = '23514',
                  hint    = 'pattern=blocked';
    END IF;

    RETURN NEW;
END;
$$;

-- Re-revoke EXECUTE — CREATE OR REPLACE preserves grants in most Postgres
-- versions but we re-apply to be explicit and resilient across upgrades.
REVOKE EXECUTE ON FUNCTION public.check_email_signup_allowed() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_email_signup_allowed() FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_email_signup_allowed() FROM authenticated;
