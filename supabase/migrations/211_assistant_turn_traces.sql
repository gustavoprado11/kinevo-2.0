-- ============================================================================
-- IA do Treinador — Trace por turno (observabilidade + dataset de evals).
-- ============================================================================
-- Aditiva / backward-compatible. Complementa ai_usage_* (migr 208): aquela mede
-- CUSTO/CRÉDITO; esta guarda O QUE ACONTECEU no turno — input, tools+args,
-- confirmação HITL, output, tokens, prompt_version, intents.
--
-- Três usos:
--   1. Depuração: reconstruir um turno que deu errado.
--   2. Auditoria: registrar toda ação sensível confirmada (kind='confirmed_action').
--   3. Dataset de evals: minerar turnos reais (esp. falhas) para virar casos.
--
-- Escrita só via service role (endpoints/motor). Leitura: o treinador vê só as
-- próprias linhas (RLS), espelhando ai_usage_events / ai_messages.
--
-- PRIVACIDADE: `input`/`output`/`tools.args` podem conter dados do aluno — mesma
-- sensibilidade de ai_messages.parts (migr 209). Considere uma rotina de retenção
-- (ex.: purgar traces > 90 dias) num cron futuro.

create table if not exists public.assistant_turn_traces (
  id              uuid primary key default gen_random_uuid(),
  trainer_id      uuid not null references public.trainers(id) on delete cascade,
  -- ao excluir o aluno NÃO apagamos o trace: desvinculamos (auditoria preservada).
  student_id      uuid references public.students(id) on delete set null,

  -- 'turn'             = turno conduzido por LLM (⌘K, workspace, chat, voz...);
  -- 'confirmed_action' = execução de uma CONFIRM_TOOL após o card HITL (sem LLM).
  kind            text not null default 'turn'
                    check (kind in ('turn', 'confirmed_action')),

  surface         text,            -- AiSurface (command_bar | workspace | chat | voice | ...)
  route           text,            -- tela atual do treinador (subsetting de intenção)
  prompt_version  text,            -- system-prompt.PROMPT_VERSION (correlaciona prompt × métrica)
  model           text,            -- modelo LLM do turno (null em confirmed_action)

  input           text not null default '',   -- mensagem do treinador (ou gatilho proativo)
  output          text not null default '',    -- resposta do assistente

  -- Tools executadas neste turno: [{ toolName, args, ok }].
  tools           jsonb not null default '[]'::jsonb,
  -- Confirmação HITL pendente, se o turno parou num card: { toolName, destructive }.
  confirmation    jsonb,

  intents         text[] not null default '{}',   -- ToolIntent[] resolvidas (subsetting)

  credits         integer not null default 0,
  input_tokens    integer,
  output_tokens   integer,
  cost_usd_micros bigint,

  created_at      timestamptz not null default now()
);

-- Histórico do treinador por recência (auditoria + mineração de evals).
create index if not exists idx_assistant_turn_traces_trainer_recent
  on public.assistant_turn_traces (trainer_id, created_at desc);

-- Filtrar rapidamente as ações sensíveis confirmadas (auditoria).
create index if not exists idx_assistant_turn_traces_confirmed
  on public.assistant_turn_traces (trainer_id, created_at desc)
  where kind = 'confirmed_action';

-- ----------------------------------------------------------------------------
-- RLS — treinador lê só as próprias linhas; escrita só via service role.
-- ----------------------------------------------------------------------------
alter table public.assistant_turn_traces enable row level security;

drop policy if exists "assistant_turn_traces_select_own" on public.assistant_turn_traces;
create policy "assistant_turn_traces_select_own"
  on public.assistant_turn_traces for select
  using (trainer_id = current_trainer_id());
-- Sem policy de INSERT/UPDATE/DELETE para usuários autenticados por design:
-- toda escrita acontece via service role (motor de turno e endpoints do servidor).
