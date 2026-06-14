-- 190: Fecha write cross-tenant em block_student_access / unblock_student_access.
--
-- Achado pelo loop de produção (docs/dev-loops/REPORT-PRODUCAO-2026-06-14.md) e
-- confirmado no banco: ambas as funções são SECURITY DEFINER (ignoram RLS), com
-- EXECUTE concedido a `authenticated`, e fazem UPDATE students WHERE id = p_student_id
-- SEM filtro de dono (coach_id). Expostas via PostgREST (/rest/v1/rpc/...), permitiam
-- que QUALQUER usuário logado — inclusive um aluno — bloqueasse/desbloqueasse qualquer
-- aluno por UUID, e que um aluno inadimplente se auto-desbloqueasse, furando o gate.
--
-- O caminho legítimo (web/src/app/api/students/[id]/access/route.ts) valida coach_id
-- e chama via service_role, que tem BYPASS e não é afetado por este REVOKE.

REVOKE EXECUTE ON FUNCTION public.block_student_access(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.unblock_student_access(uuid)    FROM PUBLIC, anon, authenticated;

-- service_role e postgres seguem com EXECUTE (caminho legítimo via API route).
