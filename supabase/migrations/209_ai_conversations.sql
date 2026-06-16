-- ============================================================================
-- IA do Treinador — Aba dedicada (/assistente): conversas persistidas.
-- ============================================================================
-- Aditiva / backward-compatible. Cria o histórico de conversas do Assistente
-- (estilo Claude Desktop): threads por aluno (ou "Geral") + mensagens com os
-- "parts" (cards de ação executada e confirmações HITL) para reabrir e auditar.
--
-- Coexiste com a F1: o ⌘K (command_bar) segue efêmero; esta aba (surface
-- 'workspace') é a casa conversacional e persistente do MESMO motor MCP+HITL.
-- Metering continua em ai_usage_* (migr 208) — aqui guardamos só o diálogo.

-- ----------------------------------------------------------------------------
-- B1. Conversa (thread). student_id nullable = conversa "Geral" (visão estúdio).
-- ----------------------------------------------------------------------------
create table if not exists public.ai_conversations (
  id              uuid primary key default gen_random_uuid(),
  trainer_id      uuid not null references public.trainers(id) on delete cascade,
  -- ao excluir o aluno NÃO apagamos a conversa: só desvinculamos (vira "Geral").
  student_id      uuid references public.students(id) on delete set null,
  title           text not null default 'Nova conversa',
  last_message_at timestamptz not null default now(),
  message_count   integer not null default 0,
  archived_at     timestamptz,
  created_at      timestamptz not null default now()
);

-- Lista da sidebar: threads ativas do treinador por recência.
create index if not exists idx_ai_conversations_trainer_recent
  on public.ai_conversations (trainer_id, last_message_at desc)
  where archived_at is null;

-- Filtro/agrupamento por aluno.
create index if not exists idx_ai_conversations_student
  on public.ai_conversations (trainer_id, student_id);

-- ----------------------------------------------------------------------------
-- B2. Mensagem. `parts` (jsonb) guarda tool calls/results e cards HITL para
--     reabrir a conversa mostrando o que a IA fez (não só o texto).
--     trainer_id é denormalizado (vem da conversa) p/ RLS e índice simples.
-- ----------------------------------------------------------------------------
create table if not exists public.ai_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  trainer_id      uuid not null references public.trainers(id) on delete cascade,
  role            text not null check (role in ('user', 'assistant')),
  content         text not null default '',
  parts           jsonb not null default '[]'::jsonb,
  credits_cost    integer not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists idx_ai_messages_conversation
  on public.ai_messages (conversation_id, created_at);

-- ----------------------------------------------------------------------------
-- RLS — treinador lê só as próprias linhas; escrita só via service role
-- (endpoints no servidor), espelhando o padrão das tabelas da migr 208.
-- ----------------------------------------------------------------------------
alter table public.ai_conversations enable row level security;
alter table public.ai_messages      enable row level security;

drop policy if exists "ai_conversations_select_own" on public.ai_conversations;
create policy "ai_conversations_select_own"
  on public.ai_conversations for select
  using (trainer_id = current_trainer_id());

drop policy if exists "ai_messages_select_own" on public.ai_messages;
create policy "ai_messages_select_own"
  on public.ai_messages for select
  using (trainer_id = current_trainer_id());
-- Sem policy de INSERT/UPDATE/DELETE para usuários autenticados por design:
-- toda escrita acontece via service role (endpoints da aba no servidor).
