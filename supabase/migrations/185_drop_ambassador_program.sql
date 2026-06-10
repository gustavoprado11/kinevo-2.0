-- ============================================================================
-- Migration 185: drop do programa de embaixadores (morto)
--
-- Contexto (auditoria 09/06/2026, achado crítico #2 — drift): as 5 tabelas
-- do programa de embaixadores existiam só em produção (migration cloud
-- 116_ambassadors), sem CREATE local e sem NENHUMA referência no código —
-- o código do programa foi removido em mai/2026 (backup completo em
-- ~/kinevo-embaixadores-backup-20260506). Verificado em 10/06/2026:
-- todas com 0 linhas; nenhum uso em web/mobile/shared/edge functions;
-- nenhum cron, view ou RPC dependente (apenas os 2 trigger functions
-- dropados abaixo).
--
-- Drop autorizado por Gustavo em 10/06/2026.
-- ============================================================================

drop table if exists public.ambassador_events cascade;
drop table if exists public.ambassador_payouts cascade;
drop table if exists public.commissions cascade;
drop table if exists public.referrals cascade;
drop table if exists public.ambassadors cascade;

drop function if exists public.emit_ambassador_created_event() cascade;
drop function if exists public.set_ambassador_email_normalized() cascade;
