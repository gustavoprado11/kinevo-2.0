-- ============================================================================
-- 226_consultoria_ia_validation.sql
-- ============================================================================
-- Consultoria IA — Fase 1 do loop "IA rascunha, humano CREF valida".
-- Plano: docs/rede-consultoria-ia/PLANO.md §5.
--
-- Máquina de estados da consultoria (1 pedido por aluno em aberto):
--   awaiting_anamnese  → anamnese (Avaliação Inicial) enviada, aluno ainda não respondeu
--   ready_to_generate  → anamnese respondida + triagem verde/amarela; aguarda geração
--   generating         → pipeline de prescrição rodando
--   blocked            → triagem VERMELHA (contraindicação PAR-Q) — nenhum rascunho
--                        é gerado; exige conduta manual (liberação médica)
--   pending_validation → rascunho IA criado (assigned_programs status='draft' +
--                        prescription_generations 'pending_review'); aguarda o
--                        PORTÃO de validação humana
--   approved           → treinador validou: programa ativado + carimbo CREF
--   rejected           → treinador rejeitou (rejection_reason)
--
-- O carimbo CREF é DENORMALIZADO em assigned_programs (snapshot legal no momento
-- da validação — não muda se o treinador editar o CREF depois) para o aluno ler
-- pela RLS que já existe ("Students can view their own programs").
--
-- Aditivo e backward-compatible. Nenhuma tabela/coluna existente é alterada
-- além das 3 colunas novas (nullable) em assigned_programs.
-- ============================================================================

-- ── Tabela de pedidos de consultoria ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.consultoria_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainer_id UUID NOT NULL REFERENCES public.trainers(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,

    status TEXT NOT NULL DEFAULT 'awaiting_anamnese'
        CHECK (status IN (
            'awaiting_anamnese', 'ready_to_generate', 'generating',
            'blocked', 'pending_validation', 'approved', 'rejected'
        )),

    -- Anamnese que alimentou a triagem/geração (Avaliação Inicial, system_key
    -- 'initial_assessment' — inclui os 7 itens PAR-Q).
    anamnese_submission_id UUID REFERENCES public.form_submissions(id) ON DELETE SET NULL,

    -- Resultado da triagem determinística (lib/consultoria/triage.ts).
    -- triage_flags: [{ key, severity: 'yellow'|'red', label, detail? }]
    triage_level TEXT CHECK (triage_level IN ('green', 'yellow', 'red')),
    triage_flags JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Elos com o pipeline de prescrição existente.
    generation_id UUID REFERENCES public.prescription_generations(id) ON DELETE SET NULL,
    program_id UUID REFERENCES public.assigned_programs(id) ON DELETE SET NULL,

    -- Telemetria anti-carimbo (M4: tempo em revisão) + trilha de auditoria.
    review_started_at TIMESTAMPTZ,
    validated_at TIMESTAMPTZ,
    validator_cref TEXT,
    rejection_reason TEXT,
    error_message TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.consultoria_requests IS
    'Pedidos de Consultoria IA: anamnese → triagem PAR-Q → rascunho IA → validação humana CREF. docs/rede-consultoria-ia/PLANO.md';

CREATE INDEX IF NOT EXISTS idx_consultoria_requests_trainer_status
    ON public.consultoria_requests (trainer_id, status);
CREATE INDEX IF NOT EXISTS idx_consultoria_requests_student
    ON public.consultoria_requests (student_id);

-- 1 pedido em aberto por aluno (aprovados/rejeitados são histórico).
CREATE UNIQUE INDEX IF NOT EXISTS uq_consultoria_requests_open_per_student
    ON public.consultoria_requests (student_id)
    WHERE status IN (
        'awaiting_anamnese', 'ready_to_generate', 'generating',
        'blocked', 'pending_validation'
    );

-- RLS: só o treinador dono (mesmo padrão de student_prescription_profiles/034).
ALTER TABLE public.consultoria_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Trainer manages own consultoria requests" ON public.consultoria_requests;
CREATE POLICY "Trainer manages own consultoria requests"
    ON public.consultoria_requests
    FOR ALL
    USING (trainer_id = public.current_trainer_id())
    WITH CHECK (trainer_id = public.current_trainer_id());

-- updated_at automático (reusa public.update_updated_at() da migration 001).
DROP TRIGGER IF EXISTS set_updated_at_on_consultoria_requests ON public.consultoria_requests;
CREATE TRIGGER set_updated_at_on_consultoria_requests
    BEFORE UPDATE ON public.consultoria_requests
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── Carimbo CREF no programa (visível ao aluno pela RLS existente) ──────────
ALTER TABLE public.assigned_programs
    ADD COLUMN IF NOT EXISTS validated_by_name TEXT,
    ADD COLUMN IF NOT EXISTS validator_cref TEXT,
    ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.assigned_programs.validated_by_name IS
    'Snapshot do nome do profissional que validou a prescrição (Consultoria IA).';
COMMENT ON COLUMN public.assigned_programs.validator_cref IS
    'Snapshot do CREF (ex.: "042319-G/SP") no momento da validação — trilha legal.';
COMMENT ON COLUMN public.assigned_programs.validated_at IS
    'Quando o profissional validou/ativou a prescrição da Consultoria IA.';
