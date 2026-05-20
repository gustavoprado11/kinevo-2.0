-- MCP OAuth 2.1 support: dynamic client registration, auth codes, access tokens

-- Clients registered via OAuth Dynamic Client Registration (RFC7591)
CREATE TABLE public.mcp_oauth_clients (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     text UNIQUE NOT NULL,
  client_name   text NOT NULL DEFAULT 'MCP Client',
  redirect_uris text[] NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_mcp_oauth_clients_client_id ON public.mcp_oauth_clients(client_id);

-- Temporary authorization codes (short-lived, single-use)
CREATE TABLE public.mcp_oauth_codes (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                  text UNIQUE NOT NULL,
  client_id             text NOT NULL,
  trainer_id            uuid NOT NULL REFERENCES public.trainers(id) ON DELETE CASCADE,
  redirect_uri          text NOT NULL,
  code_challenge        text NOT NULL,
  code_challenge_method text NOT NULL DEFAULT 'S256',
  scope                 text,
  state                 text,
  expires_at            timestamptz NOT NULL,
  used_at               timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_mcp_oauth_codes_code ON public.mcp_oauth_codes(code) WHERE used_at IS NULL;

-- OAuth access + refresh tokens
CREATE TABLE public.mcp_oauth_tokens (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token_hash   text UNIQUE NOT NULL,
  refresh_token_hash  text UNIQUE,
  client_id           text NOT NULL,
  trainer_id          uuid NOT NULL REFERENCES public.trainers(id) ON DELETE CASCADE,
  scope               text,
  expires_at          timestamptz NOT NULL,
  refresh_expires_at  timestamptz,
  revoked_at          timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_mcp_oauth_tokens_access ON public.mcp_oauth_tokens(access_token_hash) WHERE revoked_at IS NULL;
CREATE INDEX idx_mcp_oauth_tokens_refresh ON public.mcp_oauth_tokens(refresh_token_hash) WHERE revoked_at IS NULL;
CREATE INDEX idx_mcp_oauth_tokens_trainer ON public.mcp_oauth_tokens(trainer_id);

-- RLS: service role only (all OAuth operations use admin client)
ALTER TABLE public.mcp_oauth_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_oauth_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_oauth_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.mcp_oauth_clients FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON public.mcp_oauth_codes FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON public.mcp_oauth_tokens FOR ALL USING (auth.role() = 'service_role');
