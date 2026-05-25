-- Security fix (A1): lock down the access-block RPCs.
--
-- block_student_access / unblock_student_access / block_overdue_students are
-- SECURITY DEFINER and do NOT verify the caller. Postgres grants EXECUTE to
-- PUBLIC by default, so any authenticated user (or anon with the public key)
-- could call them directly via PostgREST RPC:
--   - a delinquent student self-unblocks their access  -> revenue bypass
--   - a trainer blocks another trainer's students      -> cross-tenant tampering
--
-- Every legitimate caller uses the service_role admin client (web API routes
-- that already check ownership, the Asaas webhook, and the daily cron). So we
-- simply remove EXECUTE for everyone except service_role.

REVOKE EXECUTE ON FUNCTION public.unblock_student_access(UUID)        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.block_student_access(UUID, TEXT)    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.block_overdue_students()            FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.unblock_student_access(UUID)         TO service_role;
GRANT EXECUTE ON FUNCTION public.block_student_access(UUID, TEXT)     TO service_role;
GRANT EXECUTE ON FUNCTION public.block_overdue_students()             TO service_role;
