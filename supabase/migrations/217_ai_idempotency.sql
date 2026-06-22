-- 217_ai_idempotency.sql
-- C4 + C6 (auditoria 2026-06-22): idempotência do turno e da ação confirmada.
--
-- C4 — turno: client_message_id (UUID gerado no client por envio) dedup o re-envio
-- do MESMO turno (double-submit / retry de rede) → não re-roda o LLM nem re-executa
-- writes. Unique parcial por conversa.
--
-- C6 — ação confirmada (HITL): tabela de idempotência por idempotency_key (UUID do
-- card de confirmação). O execute-tool "reserva" a key atomicamente antes de
-- executar; um 2º clique no card (ou retry) com a mesma key NÃO re-executa — devolve
-- o resultado salvo. Protege contra contrato/pagamento duplicado.

-- ── C4: coluna de idempotência do turno ──
alter table public.ai_messages
  add column if not exists client_message_id uuid;

create unique index if not exists uq_ai_messages_client_msg
  on public.ai_messages (conversation_id, client_message_id)
  where client_message_id is not null;

-- ── C6: tabela de idempotência de ações confirmadas ──
create table if not exists public.ai_action_idempotency (
  idempotency_key uuid primary key,
  trainer_id      uuid not null references public.trainers(id) on delete cascade,
  tool_name       text not null,
  status          text not null default 'processing' check (status in ('processing', 'done')),
  result          jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists idx_ai_action_idempotency_created
  on public.ai_action_idempotency (created_at);

-- RLS: dono lê; escrita só via service role (sem policy de insert/update — igual às
-- demais tabelas de IA).
alter table public.ai_action_idempotency enable row level security;

drop policy if exists "ai_action_idempotency_select_own" on public.ai_action_idempotency;
create policy "ai_action_idempotency_select_own"
  on public.ai_action_idempotency for select
  using (trainer_id = current_trainer_id());
