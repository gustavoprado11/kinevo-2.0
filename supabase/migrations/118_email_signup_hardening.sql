-- Email signup hardening — domain blocklist + pattern rejection
--
-- Background: on 2026-05-02/03 we observed three consecutive automated
-- signup waves that registered 70+ bot accounts before being detected:
--   - 33 from @hacker.net (dow_bot_* pattern, 3-hour burst)
--   - 20 from @test.dev (15-second burst)
--   - 5 from @tempmail.dev (2-second burst)
--   - 11 from @test.com matching attack-style local-parts
--     (impersonate_*, trainer_inject_*, escalate_sr*, takeover_*, ...)
--
-- All 73 accounts were deleted before this migration. This trigger is the
-- defense-in-depth layer that prevents the same vector from working again,
-- complementing CAPTCHA and IP rate limiting (separate work, future phase).

-- ─────────────────────────────────────────────────────────────────────────
-- Domain blocklist
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.blocked_email_domains (
    domain      text        PRIMARY KEY,
    reason      text        NOT NULL DEFAULT 'manual',
    blocked_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.blocked_email_domains ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS blocked_email_domains_service_only ON public.blocked_email_domains;
CREATE POLICY blocked_email_domains_service_only
    ON public.blocked_email_domains
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Seed: domains we have firsthand evidence of being abused, plus the
-- well-known disposable-email providers attackers reach for next.
INSERT INTO public.blocked_email_domains (domain, reason) VALUES
    ('hacker.net',        'bot signup wave 2026-05-03'),
    ('tempmail.dev',      'disposable / bot signup wave 2026-05-02'),
    ('test.dev',          'bot signup wave 2026-05-02'),
    ('prooftest.com',     'bot signup wave 2026-05-01'),
    ('mailinator.com',    'disposable email'),
    ('guerrillamail.com', 'disposable email'),
    ('guerrillamail.net', 'disposable email'),
    ('guerrillamail.org', 'disposable email'),
    ('guerrillamail.biz', 'disposable email'),
    ('10minutemail.com',  'disposable email'),
    ('throwawaymail.com', 'disposable email'),
    ('yopmail.com',       'disposable email'),
    ('temp-mail.org',     'disposable email'),
    ('sharklasers.com',   'disposable email'),
    ('grr.la',            'disposable email'),
    ('discard.email',     'disposable email'),
    ('maildrop.cc',       'disposable email'),
    ('getnada.com',       'disposable email'),
    ('trashmail.com',     'disposable email'),
    ('fakeinbox.com',     'disposable email')
ON CONFLICT (domain) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────
-- Validation trigger on auth.users
-- ─────────────────────────────────────────────────────────────────────────
--
-- The trigger runs SECURITY DEFINER so it can read public.blocked_email_domains
-- regardless of the inserting role. search_path is pinned to defeat the
-- well-known trigger-injection-via-search_path attack.

CREATE OR REPLACE FUNCTION public.check_email_signup_allowed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_domain  text;
    v_local   text;
    -- Local-part patterns observed in the May-2026 attack waves. Anchored
    -- at start to keep the rule tight; case-insensitive via the `~*` op.
    v_blocked_pattern text :=
        '^(dow_bot|enum_users|dump_users|hacker_|audit_evidence|audit_trainer|real_trainer|final_enum|final_sr|impersonate|trainer_inject|trainer_direct|trainer_become|escalate_sr|count_check|takeover)';
BEGIN
    IF NEW.email IS NULL OR NEW.email = '' THEN
        RETURN NEW;
    END IF;

    v_domain := lower(split_part(NEW.email, '@', 2));
    v_local  := lower(split_part(NEW.email, '@', 1));

    IF v_domain = '' THEN
        RETURN NEW;
    END IF;

    -- 1. Domain blocklist
    IF EXISTS (SELECT 1 FROM public.blocked_email_domains WHERE domain = v_domain) THEN
        RAISE EXCEPTION 'Email domain not allowed for signup'
            USING errcode = '23514',
                  hint    = 'domain=' || v_domain;
    END IF;

    -- 2. Pattern rejection (automated bot local-parts)
    IF v_local ~* v_blocked_pattern THEN
        RAISE EXCEPTION 'Email pattern not allowed for signup'
            USING errcode = '23514',
                  hint    = 'pattern=blocked';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_email_signup_allowed ON auth.users;
CREATE TRIGGER check_email_signup_allowed
    BEFORE INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.check_email_signup_allowed();

COMMENT ON FUNCTION public.check_email_signup_allowed() IS
    'Rejects signups to blocked email domains or matching automated bot local-part patterns. See migration 118 for context.';

-- The trigger pipeline calls this function on its own — it must never be
-- exposed via PostgREST `/rest/v1/rpc/check_email_signup_allowed`. Revoke
-- EXECUTE from anon / authenticated / public so the function is reachable
-- only by superuser (the trigger executor) and service_role.
REVOKE EXECUTE ON FUNCTION public.check_email_signup_allowed() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_email_signup_allowed() FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_email_signup_allowed() FROM authenticated;
