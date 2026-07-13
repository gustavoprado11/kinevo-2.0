-- Estilo de Prescrição do treinador (MVP) — spec: web/specs/active/assistente-estilo-prescricao.md
--
-- O treinador configura como ELE prescreve (split, reps, descansos, volume, métodos,
-- exercícios favoritos, progressão) e o Assistente passa a montar programas assim.
-- O perfil nasce de duas fontes: mineração dos programas que ele já prescreveu +
-- uma entrevista roteirizada dentro do /assistente. Só a proposta APROVADA pelo
-- treinador vira estilo — por isso o rascunho da entrevista vive na conversa, não aqui.

-- Perfil aprovado. NULL = treinador ainda não configurou (o Assistente segue os
-- defaults do playbook de build). Shape: PrescriptionStyle (shared/types/prescription.ts).
ALTER TABLE trainers
    ADD COLUMN IF NOT EXISTS prescription_style jsonb;

COMMENT ON COLUMN trainers.prescription_style IS
    'Estilo de prescrição aprovado pelo treinador (PrescriptionStyle v1). Injetado como bloco <<ESTILO_DO_TREINADOR>> nos turnos de build do Assistente. NULL = não configurado.';

-- A entrevista é uma conversa especial do assistente: o motor entra em modo roteirizado
-- (sem ponte MCP, sem consumo de créditos) e a ROTA é a fonte de verdade do progresso.
ALTER TABLE ai_conversations
    ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'default';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ai_conversations_kind_check'
    ) THEN
        ALTER TABLE ai_conversations
            ADD CONSTRAINT ai_conversations_kind_check
            CHECK (kind IN ('default', 'style_interview'));
    END IF;
END $$;

-- Rascunho da entrevista: { mined, answers: Record<SlotId,string>, proposed }.
-- Guardar aqui (e não em trainers) é o que permite abandonar no meio e retomar do
-- slot certo sem nunca ter salvado um estilo pela metade.
ALTER TABLE ai_conversations
    ADD COLUMN IF NOT EXISTS style_state jsonb;

COMMENT ON COLUMN ai_conversations.style_state IS
    'Rascunho da entrevista de estilo: { mined, answers, proposed }. Limpo quando o estilo é salvo em trainers.prescription_style.';
