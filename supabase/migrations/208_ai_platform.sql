-- ============================================================================
-- IA do Treinador — Plataforma (Fase 0): tiers, metering por crédito, limites.
-- ============================================================================
-- Aditiva / backward-compatible. Não altera nenhum comportamento existente.
--
-- Contexto: a migration 207 (`assistant_llm_usage`) é um ledger GENÉRICO de
-- custo bruto de LLM por chamada. Esta migration introduz uma camada DIFERENTE:
-- o ORÇAMENTO POR CRÉDITO da plataforma de IA do treinador (tier + cota mensal),
-- usado para gate de uso e billing. As duas coexistem (custo real vs. crédito).
--
-- Ver spec: web/specs/active/ai-trainer-platform/SPEC.md §5 (Domínio A) e
-- web/specs/active/chat-first-workspace/SPEC.md §Metering.

-- ----------------------------------------------------------------------------
-- A1. Tier de IA por treinador (override manual; precedente: ai_prescriptions_enabled, migr 036)
-- ----------------------------------------------------------------------------
-- default 'free' = "SEM override". A resolução de tier (lib/auth/get-ai-tier.ts)
-- trata pagante-ativo-sem-price como 'essencial'. NÃO fazer backfill deste campo
-- para 'essencial': como override é definido por "ai_tier != 'free'", um valor
-- gravado aqui congelaria upgrades futuros derivados do price do Stripe.
alter table public.trainers
  add column if not exists ai_tier text not null default 'free'
    check (ai_tier in ('free', 'essencial', 'pro_ia', 'premium_ia'));

-- ----------------------------------------------------------------------------
-- A2. Preço do Stripe na assinatura → deriva o tier do plano pago (nullable)
-- ----------------------------------------------------------------------------
-- Nasce NULL; o webhook do Stripe passa a gravar sub.items.data[0].price.id.
alter table public.subscriptions
  add column if not exists stripe_price_id text;

-- ----------------------------------------------------------------------------
-- A3. Metering por crédito
-- ----------------------------------------------------------------------------
-- Janela de cota por treinador (uma linha por período corrente).
create table if not exists public.ai_usage_periods (
  id              uuid primary key default gen_random_uuid(),
  trainer_id      uuid not null references public.trainers(id) on delete cascade,
  period_type     text not null check (period_type in ('week', 'month')),
  period_start    date not null,
  credits_used    integer not null default 0,
  cost_usd_micros bigint not null default 0,
  turns_count     integer not null default 0,
  updated_at      timestamptz not null default now(),
  unique (trainer_id, period_type, period_start)
);

-- Log de eventos (analytics / reconciliação de custo real por superfície).
create table if not exists public.ai_usage_events (
  id                  uuid primary key default gen_random_uuid(),
  trainer_id          uuid not null references public.trainers(id) on delete cascade,
  created_at          timestamptz not null default now(),
  action_class        text not null,  -- 'query' | 'write' | 'prescription' | 'bulk'
  credits             integer not null,
  input_tokens        integer,
  cached_input_tokens integer,
  output_tokens       integer,
  cost_usd_micros     bigint,
  model               text,
  -- Qual superfície gerou o evento (analytics por superfície).
  surface             text check (surface in ('command_bar', 'workspace', 'canvas', 'proactive', 'mobile', 'voice'))
);

create index if not exists idx_ai_usage_events_trainer
  on public.ai_usage_events (trainer_id, created_at desc);

-- Incremento atômico (evita race entre instâncias serverless).
create or replace function public.increment_ai_usage(
  p_trainer_id uuid,
  p_period_type text,
  p_period_start date,
  p_credits integer,
  p_cost_micros bigint
) returns void language sql set search_path = '' as $$
  insert into public.ai_usage_periods (
    trainer_id, period_type, period_start, credits_used, cost_usd_micros, turns_count
  )
  values (p_trainer_id, p_period_type, p_period_start, p_credits, p_cost_micros, 1)
  on conflict (trainer_id, period_type, period_start) do update
    set credits_used    = public.ai_usage_periods.credits_used + excluded.credits_used,
        cost_usd_micros = public.ai_usage_periods.cost_usd_micros + excluded.cost_usd_micros,
        turns_count     = public.ai_usage_periods.turns_count + 1,
        updated_at      = now();
$$;

-- Escrita só via service role (servidor). Tira o execute de anon/authenticated.
revoke execute on function public.increment_ai_usage(uuid, text, date, integer, bigint) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- A4. Free trials por ação (mecânica "1× cada ação" do tier Gratuito)
-- ----------------------------------------------------------------------------
create table if not exists public.ai_free_trials (
  trainer_id   uuid not null references public.trainers(id) on delete cascade,
  action_class text not null,
  used_at      timestamptz not null default now(),
  primary key (trainer_id, action_class)
);

-- ----------------------------------------------------------------------------
-- A5. Top-ups de crédito (pagamento avulso) — SÓ A TABELA (lógica é v1.1)
-- ----------------------------------------------------------------------------
create table if not exists public.ai_credit_topups (
  id                       uuid primary key default gen_random_uuid(),
  trainer_id               uuid not null references public.trainers(id) on delete cascade,
  credits                  integer not null,
  cost_brl_cents           integer not null,
  stripe_payment_intent_id text,
  consumed_in_period       date,
  created_at               timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- RLS — treinador lê só as próprias linhas; escrita só via service role.
-- ----------------------------------------------------------------------------
alter table public.ai_usage_periods enable row level security;
alter table public.ai_usage_events  enable row level security;
alter table public.ai_free_trials   enable row level security;
alter table public.ai_credit_topups enable row level security;

drop policy if exists "ai_usage_periods_select_own" on public.ai_usage_periods;
create policy "ai_usage_periods_select_own"
  on public.ai_usage_periods for select
  using (trainer_id = current_trainer_id());

drop policy if exists "ai_usage_events_select_own" on public.ai_usage_events;
create policy "ai_usage_events_select_own"
  on public.ai_usage_events for select
  using (trainer_id = current_trainer_id());

drop policy if exists "ai_free_trials_select_own" on public.ai_free_trials;
create policy "ai_free_trials_select_own"
  on public.ai_free_trials for select
  using (trainer_id = current_trainer_id());

drop policy if exists "ai_credit_topups_select_own" on public.ai_credit_topups;
create policy "ai_credit_topups_select_own"
  on public.ai_credit_topups for select
  using (trainer_id = current_trainer_id());
-- Sem policy de INSERT/UPDATE/DELETE para usuários autenticados por design:
-- toda escrita acontece via service role (endpoints/webhook no servidor).
