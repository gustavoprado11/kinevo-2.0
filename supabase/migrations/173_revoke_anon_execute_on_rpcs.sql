-- Security hardening (RLS audit, 2026-06): remove anon (logged-out) EXECUTE on
-- SECURITY DEFINER RPCs. Each RPC was already verified to gate on the caller
-- internally, but logged-out users have no business calling them. We KEEP the
-- predicate helpers that RLS policies depend on (revoking those would break RLS
-- evaluation for everyone). Authenticated users and the backend keep access.

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT (p.oid::regprocedure)::text AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.prorettype <> 'pg_catalog.trigger'::regtype
      AND p.proname NOT IN (
        -- helpers referenced inside RLS policies — MUST stay callable by anon/authenticated
        'can_read_student','can_write_student','current_member_org_ids',
        'current_student_coach_id','current_student_id','current_student_id_active',
        'current_trainer_id','is_org_manager','is_org_member','is_trainer','is_student',
        'check_student_access'
      )
  LOOP
    EXECUTE 'REVOKE EXECUTE ON FUNCTION ' || r.sig || ' FROM anon, public';
    EXECUTE 'GRANT EXECUTE ON FUNCTION ' || r.sig || ' TO authenticated, service_role';
  END LOOP;
END $$;
