-- 166_trainer_leads.sql
-- Lead capture da landing pública do trainer (/com/[slug]).
-- O lead anônimo submete um formulário que vira uma row aqui.
-- Trainer gerencia em /leads (web) + mobile Trainer Mode.
--
-- Backward compatible: tabela nova, sem dependências externas além de
-- public.trainers e public.students (FK opcional p/ rastreio de conversão).
-- Spec: web/specs/active/landing-publica-trainer/SPEC.md

CREATE TABLE IF NOT EXISTS public.trainer_leads (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainer_id              UUID NOT NULL REFERENCES public.trainers(id) ON DELETE CASCADE,
    -- Dados do lead.
    name                    TEXT NOT NULL,
    email                   TEXT NOT NULL,
    whatsapp                TEXT NOT NULL,
    goal                    TEXT, -- 'emagrecer' | 'massa' | 'performance' | 'mobilidade' | 'saude' | livre
    level                   TEXT, -- 'iniciante' | 'intermediario' | 'avancado'
    message                 TEXT,
    -- Pipeline.
    status                  TEXT NOT NULL DEFAULT 'new'
                              CHECK (status IN ('new','contacted','converted','archived')),
    -- Audit/atribuição.
    source                  TEXT NOT NULL DEFAULT 'landing_public',
    source_slug             TEXT,
    ip_hash                 TEXT,
    user_agent              TEXT,
    -- Conversão.
    contacted_at            TIMESTAMPTZ,
    converted_to_student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trainer_leads_owner
    ON public.trainer_leads (trainer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_trainer_leads_status
    ON public.trainer_leads (trainer_id, status, created_at DESC);

-- Usado pra rate-limit / dedup soft por IP (em janela curta).
CREATE INDEX IF NOT EXISTS idx_trainer_leads_ip
    ON public.trainer_leads (ip_hash, created_at DESC);

ALTER TABLE public.trainer_leads ENABLE ROW LEVEL SECURITY;

-- Trainer só vê os próprios leads. Inserção pública é feita via service_role
-- (supabaseAdmin) na server action — não há policy de INSERT pública aqui
-- de propósito (defesa em profundidade: lead inserts SEMPRE passam pela action).
CREATE POLICY trainer_leads_own ON public.trainer_leads
    FOR ALL USING (trainer_id = current_trainer_id())
    WITH CHECK (trainer_id = current_trainer_id());

COMMENT ON TABLE  public.trainer_leads IS 'Leads recebidos pela landing pública /com/[slug].';
COMMENT ON COLUMN public.trainer_leads.source      IS 'Origem do lead (landing_public, futuro: ig_dm, qr_code, ...).';
COMMENT ON COLUMN public.trainer_leads.source_slug IS 'Slug da landing no momento do submit (auditoria).';
COMMENT ON COLUMN public.trainer_leads.ip_hash     IS 'SHA-256 do IP — rate-limit/dedup sem reter PII.';
COMMENT ON COLUMN public.trainer_leads.status      IS 'new → contacted → converted | archived.';
