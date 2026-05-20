-- Kinevo MCP Server: API Keys for trainer authentication
-- Each trainer can generate up to 5 active API keys to connect via Claude.ai / ChatGPT

CREATE TABLE public.trainer_api_keys (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id  uuid NOT NULL REFERENCES public.trainers(id) ON DELETE CASCADE,
  key_hash    text NOT NULL,
  key_prefix  text NOT NULL,
  name        text NOT NULL DEFAULT 'Minha API Key',
  created_at  timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at  timestamptz
);

CREATE INDEX idx_trainer_api_keys_trainer_id ON public.trainer_api_keys(trainer_id);
CREATE INDEX idx_trainer_api_keys_prefix_active ON public.trainer_api_keys(key_prefix) WHERE revoked_at IS NULL;

ALTER TABLE public.trainer_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trainers can manage own api keys"
  ON public.trainer_api_keys
  FOR ALL
  USING (trainer_id = current_trainer_id())
  WITH CHECK (trainer_id = current_trainer_id());

CREATE POLICY "Service role full access on trainer_api_keys"
  ON public.trainer_api_keys
  FOR ALL
  USING (auth.role() = 'service_role');
