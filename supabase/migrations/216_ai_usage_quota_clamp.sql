-- 216_ai_usage_quota_clamp.sql
-- C1 (auditoria 2026-06-22): cobrança de crédito de IA ATÔMICA com CLAMP no limite.
--
-- Problema: increment_ai_usage soma cego (sem teto) e o gate (checkQuota) lê ANTES
-- do turno e grava DEPOIS — TOCTOU. Resultado: todo treinador estoura a cota todo
-- ciclo (o último turno passa o gate e ultrapassa o limite), e turnos concorrentes
-- ou em loop multiplicam o estouro.
--
-- Fix: consume_ai_usage faz o upsert ATÔMICO mas LIMITA credits_used a p_limit
-- (LEAST) — o medidor do treinador NUNCA passa do teto do plano, nem sob
-- concorrência. cost_usd_micros segue REAL (reconciliação de margem). p_limit NULL
-- = sem teto (ex.: briefing proativo). Retorna o credits_used resultante.
--
-- Backward-compat: NÃO mexe em increment_ai_usage (o código já em produção o chama).
-- O código novo passa a chamar consume_ai_usage; a função antiga fica órfã e inócua.

create or replace function public.consume_ai_usage(
  p_trainer_id uuid,
  p_period_type text,
  p_period_start date,
  p_credits integer,
  p_cost_micros bigint,
  p_limit integer default null
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- p_limit NULL → sem teto (usa int max). Negativo → 0 (defensivo).
  v_cap  integer := greatest(coalesce(p_limit, 2147483647), 0);
  v_used integer;
begin
  insert into public.ai_usage_periods (
    trainer_id, period_type, period_start, credits_used, cost_usd_micros, turns_count
  )
  values (
    p_trainer_id, p_period_type, p_period_start,
    least(greatest(p_credits, 0), v_cap),
    p_cost_micros, 1
  )
  on conflict (trainer_id, period_type, period_start) do update
    set credits_used    = least(
                            public.ai_usage_periods.credits_used + greatest(excluded.credits_used, 0),
                            v_cap
                          ),
        cost_usd_micros = public.ai_usage_periods.cost_usd_micros + excluded.cost_usd_micros,
        turns_count     = public.ai_usage_periods.turns_count + 1,
        updated_at      = now()
  returning public.ai_usage_periods.credits_used into v_used;

  return v_used;
end;
$$;

-- Escrita só via service role (servidor), igual a increment_ai_usage.
revoke execute on function public.consume_ai_usage(uuid, text, date, integer, bigint, integer)
  from public, anon, authenticated;
