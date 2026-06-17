-- A3 — incluir 'chat' no CHECK de ai_usage_events.surface (aditiva, reversível).
--
-- 208 definiu o CHECK inline SEM 'chat', mas metering.ts/chat/route.ts gravam
-- surface='chat' (superfície primária do funil). Todo insert do chat violava o
-- CHECK e o log de custo/analytics do chat nunca persistia. O insert é best-effort
-- (logado, não lança) e os créditos vêm de RPC separado, então não havia perda de
-- cobrança — mas a observabilidade do chat ficava cega.
--
-- CHECK de coluna inline → Postgres nomeia como <tabela>_<coluna>_check.
-- Reversível: re-adicionar o check sem 'chat'.

alter table public.ai_usage_events
  drop constraint if exists ai_usage_events_surface_check;

alter table public.ai_usage_events
  add constraint ai_usage_events_surface_check
  check (surface in ('chat', 'command_bar', 'workspace', 'canvas', 'proactive', 'mobile', 'voice'));
