-- ============================================================================
-- Kinevo — 139 students.access_blocked_*
-- ============================================================================
-- Bloqueio de acesso ao app do aluno por inadimplência.
--
-- Quando access_blocked_at IS NOT NULL, o app do aluno deve:
--   - Bloquear listagem/execução de treinos
--   - Mostrar mensagem "Pagamento pendente — fale com seu treinador"
--   - Manter dados visíveis (histórico, perfil) sem permitir novas ações
--
-- A coluna é populada por:
--   - Edge function de cron (`block_overdue_students_cron`) que respeita
--     trainer_financial_settings.block_on_overdue + overdue_grace_days
--   - Webhook PAYMENT_RECEIVED da Asaas (limpa o bloqueio na hora)
--   - Trainer manualmente, via /api/students/[id]/access (PATCH)
-- ============================================================================

ALTER TABLE students
    ADD COLUMN IF NOT EXISTS access_blocked_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS access_blocked_reason TEXT;

COMMENT ON COLUMN students.access_blocked_at IS
    'Quando o acesso ao app foi bloqueado por inadimplência. NULL = acesso normal.';
COMMENT ON COLUMN students.access_blocked_reason IS
    'Motivo do bloqueio em PT-BR (mostrado pro aluno). Ex: "Pagamento de 12/05/2025 vencido há 4 dias."';

-- Index pra cron e queries de "alunos bloqueados deste trainer" rodarem rápido
CREATE INDEX IF NOT EXISTS idx_students_access_blocked_at
    ON students(access_blocked_at)
    WHERE access_blocked_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_students_coach_blocked
    ON students(coach_id, access_blocked_at)
    WHERE access_blocked_at IS NOT NULL;
