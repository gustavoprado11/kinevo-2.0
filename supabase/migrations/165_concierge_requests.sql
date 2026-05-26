-- 165_concierge_requests.sql
-- Lead capture do "Concierge de biblioteca de vídeos": personal trainer
-- pede pra equipe montar a biblioteca de vídeos por ele em 24h.
--
-- Métricas: contagem por trainer, taxa de retorno, "source" identifica onde
-- o trainer clicou (botão fixo da Biblioteca, link do estado vazio do
-- exercício, etc.). Backward-compat: tabela nova, sem dependências externas.

CREATE TABLE IF NOT EXISTS public.concierge_requests (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainer_id    UUID NOT NULL REFERENCES public.trainers(id) ON DELETE CASCADE,
    -- Origem do clique: biblioteca_button | exercise_empty | settings_link | ...
    source        TEXT NOT NULL DEFAULT 'unknown',
    -- Canal escolhido p/ continuar a conversa.
    channel       TEXT NOT NULL DEFAULT 'whatsapp',
    requested_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes         TEXT
);

CREATE INDEX IF NOT EXISTS idx_concierge_requests_trainer_at
    ON public.concierge_requests (trainer_id, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_concierge_requests_recent
    ON public.concierge_requests (requested_at DESC);

ALTER TABLE public.concierge_requests ENABLE ROW LEVEL SECURITY;

-- O trainer só vê/insere seus próprios registros. Analytics globais lêem via
-- service_role (supabaseAdmin), que bypassa RLS.
CREATE POLICY concierge_requests_trainer_own ON public.concierge_requests
    FOR ALL USING (trainer_id = current_trainer_id())
    WITH CHECK (trainer_id = current_trainer_id());

COMMENT ON TABLE public.concierge_requests IS 'Lead capture do Concierge de biblioteca de vídeos.';
COMMENT ON COLUMN public.concierge_requests.source  IS 'Onde clicou (biblioteca_button | exercise_empty | ...).';
COMMENT ON COLUMN public.concierge_requests.channel IS 'Canal de continuidade (whatsapp | email | ...).';
