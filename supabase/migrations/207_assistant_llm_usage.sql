-- Ledger genérico de uso de LLM por treinador.
--
-- Contexto: hoje o custo de LLM só é persistido para a PRESCRIÇÃO
-- (tabela prescription_generations + telemetry). O enricher de insights e o
-- chat do assistente apenas fazem console.log do custo — nada amarrado ao
-- trainer_id por chamada. Esta tabela é o primeiro medidor genérico; seu
-- primeiro escritor é o endpoint de rascunho de mensagem do loop de retenção
-- (/api/assistant/draft-message).

create table if not exists public.assistant_llm_usage (
    id uuid primary key default gen_random_uuid(),
    trainer_id uuid not null references public.trainers(id) on delete cascade,
    -- Qual superfície gerou o gasto (ex.: 'draft_message'). Texto livre para
    -- permitir novas features sem migration.
    feature text not null,
    model text not null,
    input_tokens integer not null default 0,
    output_tokens integer not null default 0,
    cost_usd numeric(10, 6) not null default 0,
    -- Insight que originou a geração, quando aplicável.
    insight_id uuid references public.assistant_insights(id) on delete set null,
    created_at timestamptz not null default now()
);

create index if not exists idx_assistant_llm_usage_trainer
    on public.assistant_llm_usage (trainer_id, created_at desc);

alter table public.assistant_llm_usage enable row level security;

-- Treinador lê o próprio uso (base para um futuro painel de custo).
drop policy if exists "assistant_llm_usage_select_own" on public.assistant_llm_usage;
create policy "assistant_llm_usage_select_own"
    on public.assistant_llm_usage for select
    using (trainer_id = current_trainer_id());

-- Escrita acontece via service role (endpoint no servidor). Sem policy de
-- INSERT para usuários autenticados por design.
