-- 218_traces_ttl.sql
-- LGPD (auditoria 2026-06-22, L2): retenção dos traces do assistente.
--
-- assistant_turn_traces (migr 211) guarda input/output do turno (até 8.000 chars)
-- + args de tool — pode conter dado pessoal/sensível. Política: apagar traces com
-- mais de 90 dias, automaticamente, todo dia (pg_cron).
--
-- Idempotente: cron.schedule(NOME, ...) substitui o job de mesmo nome (upsert).

select cron.schedule(
  'purge-assistant-turn-traces',
  '23 4 * * *', -- 04:23 UTC diariamente
  $$delete from public.assistant_turn_traces where created_at < now() - interval '90 days'$$
);
