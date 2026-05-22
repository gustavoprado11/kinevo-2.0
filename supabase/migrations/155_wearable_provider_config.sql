-- ============================================================================
-- Config de provider de wearable cloud (Oura/Whoop) — server-side only.
-- Guarda client_id/secret/verification_token/callback_url lidos pelas edge
-- functions (não há ferramenta MCP pra setar secrets de function; mesmo padrão
-- service-role-only de wearable_oauth_tokens).
-- Os VALORES (com o client_secret) são inseridos fora do repo, via execute_sql.
-- ============================================================================
create table if not exists public.wearable_provider_config (
    source text primary key check (source in ('oura', 'whoop')),
    client_id text not null,
    client_secret text not null,
    verification_token text,
    callback_url text,
    updated_at timestamptz not null default now()
);

alter table public.wearable_provider_config enable row level security;
-- Sem policies: apenas service_role (edge functions) acessa.

comment on table public.wearable_provider_config is
    'Credenciais OAuth do app do provider (Oura/Whoop). Server-side only (service_role). Hardening futuro: Supabase Vault.';
