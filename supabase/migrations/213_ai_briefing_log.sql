-- A1 — marcador de idempotência do briefing proativo da manhã (aditiva).
--
-- O cron morning-briefing iterava TODOS os treinadores sem marcador por dia: um
-- retry/duplo-hit do Vercel gerava push duplicado + 2ª cobrança de crédito do
-- briefing. Esta tabela registra (trainer_id, briefed_on) após entregar o briefing
-- do dia; o cron pula quem já está marcado. PK composta garante 1 por treinador/dia.
--
-- Escrita só via service role (cron). RLS habilitado sem policy de escrita; um
-- select próprio é liberado para o treinador (defesa em profundidade / debug).

create table if not exists public.ai_briefing_log (
  trainer_id  uuid not null references public.trainers(id) on delete cascade,
  briefed_on  date not null,
  created_at  timestamptz not null default now(),
  primary key (trainer_id, briefed_on)
);

alter table public.ai_briefing_log enable row level security;

-- Leitura própria (o treinador só vê os próprios marcadores). Escrita: service role.
drop policy if exists ai_briefing_log_select_own on public.ai_briefing_log;
create policy ai_briefing_log_select_own
  on public.ai_briefing_log
  for select
  using (trainer_id = public.current_trainer_id());
