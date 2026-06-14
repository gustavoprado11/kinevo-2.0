-- 195: Rate limiter durável e atômico (substitui o Map em memória de lib/rate-limit.ts).
--
-- Achado pelo security-loop (REPORT-SEGURANCA-2026-06-14): o limiter em `new Map`
-- é por-instância → em serverless (Vercel) cada lambda tem o seu, e os limites
-- perMinute/perDay nunca convergem → orçamento de LLM/MCP furável por concorrência.
--
-- Backend: tabela de eventos + função SECURITY DEFINER que faz check+insert ATÔMICO
-- sob pg_advisory_xact_lock por chave (fecha o TOCTOU entre instâncias). Sem infra
-- nova (usa o Postgres que já existe). Chamada só pelo server via supabaseAdmin.

create table if not exists public.rate_limit_events (
  id bigint generated always as identity primary key,
  key text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_rate_limit_events_key_created
  on public.rate_limit_events (key, created_at);

-- Service-role-only: RLS ligado sem policy = deny p/ anon/authenticated; a função
-- (SECURITY DEFINER) e o service_role bypassam. (Mesmo padrão de wearable_oauth_tokens.)
alter table public.rate_limit_events enable row level security;

create or replace function public.consume_rate_limit(
  p_key text,
  p_per_minute int,
  p_per_day int
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_minute int;
  v_day int;
begin
  -- Serializa chamadas concorrentes da MESMA chave (entre instâncias) até o commit.
  perform pg_advisory_xact_lock(hashtext(p_key)::bigint);

  -- Poda eventos antigos desta chave (limita crescimento da tabela).
  delete from public.rate_limit_events
    where key = p_key and created_at < now() - interval '1 day';

  select count(*) into v_minute from public.rate_limit_events
    where key = p_key and created_at > now() - interval '1 minute';
  if v_minute >= p_per_minute then
    return jsonb_build_object('allowed', false, 'scope', 'minute');
  end if;

  select count(*) into v_day from public.rate_limit_events
    where key = p_key and created_at > now() - interval '1 day';
  if v_day >= p_per_day then
    return jsonb_build_object('allowed', false, 'scope', 'day');
  end if;

  insert into public.rate_limit_events (key) values (p_key);
  return jsonb_build_object('allowed', true);
end;
$$;

-- Só o server (service_role) chama; não exponha via PostgREST a anon/authenticated.
revoke execute on function public.consume_rate_limit(text, int, int) from public, anon, authenticated;
