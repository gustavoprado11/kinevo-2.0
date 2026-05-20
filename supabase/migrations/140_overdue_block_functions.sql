-- ============================================================================
-- Kinevo — 140 funções SQL pro bloqueio de inadimplentes
-- ============================================================================
--
-- 3 funções:
--   1. block_overdue_students()
--      Cron diário. Pra cada trainer com block_on_overdue=true e grace_days
--      configurado, marca como bloqueado os alunos que têm contrato vencido
--      além do período de tolerância.
--
--   2. unblock_student_access(student_id)
--      Limpa o bloqueio. Chamada pelo webhook PAYMENT_RECEIVED da Asaas e
--      pela API de "desbloqueio manual" do trainer.
--
--   3. block_student_access(student_id, reason)
--      Bloqueia manualmente. Chamada pela API quando o trainer quer
--      forçar o bloqueio (raro mas útil).
--
-- Edge function / pg_cron schedule:
--   SELECT cron.schedule('block-overdue-daily', '0 6 * * *',
--                         $$SELECT public.block_overdue_students()$$);
--   (6h UTC = 3h Brasília — antes do app estar muito ativo)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Bloqueio em lote (cron)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.block_overdue_students()
RETURNS TABLE (
    student_id UUID,
    trainer_id UUID,
    days_overdue INTEGER,
    reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    blocked_count INTEGER := 0;
BEGIN
    -- Pega trainers com bloqueio ativado e seus respectivos grace_days
    -- Aplica join com student_contracts vencidos + students não bloqueados
    RETURN QUERY
    WITH targets AS (
        SELECT
            s.id AS student_id,
            s.coach_id AS trainer_id,
            sc.current_period_end,
            tfs.overdue_grace_days,
            EXTRACT(DAY FROM (now() - sc.current_period_end))::INTEGER AS days_overdue,
            sc.amount
        FROM students s
        JOIN trainer_financial_settings tfs ON tfs.trainer_id = s.coach_id
        JOIN student_contracts sc ON sc.student_id = s.id AND sc.trainer_id = s.coach_id
        WHERE tfs.block_on_overdue = true
          AND s.access_blocked_at IS NULL
          AND sc.status IN ('past_due', 'overdue')
          AND sc.current_period_end IS NOT NULL
          AND sc.current_period_end < (now() - (tfs.overdue_grace_days || ' days')::INTERVAL)
    ),
    updates AS (
        UPDATE students s
        SET access_blocked_at = now(),
            access_blocked_reason = format(
                'Pagamento de %s vencido há %s dias.',
                to_char(t.current_period_end::date, 'DD/MM/YYYY'),
                t.days_overdue
            )
        FROM targets t
        WHERE s.id = t.student_id
        RETURNING s.id, s.coach_id, s.access_blocked_reason
    )
    SELECT
        u.id AS student_id,
        u.coach_id AS trainer_id,
        t.days_overdue,
        u.access_blocked_reason AS reason
    FROM updates u
    JOIN targets t ON t.student_id = u.id;

    GET DIAGNOSTICS blocked_count = ROW_COUNT;
    RAISE NOTICE '[block_overdue_students] blocked % students', blocked_count;
END;
$$;

COMMENT ON FUNCTION public.block_overdue_students() IS
    'Cron diário: bloqueia alunos vencidos respeitando settings do trainer (block_on_overdue + grace_days).';

-- ---------------------------------------------------------------------------
-- 2. Desbloqueio individual
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.unblock_student_access(p_student_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    was_blocked BOOLEAN;
BEGIN
    UPDATE students
    SET access_blocked_at = NULL,
        access_blocked_reason = NULL
    WHERE id = p_student_id
      AND access_blocked_at IS NOT NULL
    RETURNING true INTO was_blocked;

    RETURN COALESCE(was_blocked, false);
END;
$$;

COMMENT ON FUNCTION public.unblock_student_access(UUID) IS
    'Limpa o bloqueio de acesso de um aluno. Retorna true se estava bloqueado, false se já estava livre.';

-- ---------------------------------------------------------------------------
-- 3. Bloqueio individual manual
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.block_student_access(
    p_student_id UUID,
    p_reason TEXT DEFAULT 'Bloqueado manualmente pelo treinador.'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    affected BOOLEAN;
BEGIN
    UPDATE students
    SET access_blocked_at = now(),
        access_blocked_reason = p_reason
    WHERE id = p_student_id
    RETURNING true INTO affected;

    RETURN COALESCE(affected, false);
END;
$$;

COMMENT ON FUNCTION public.block_student_access(UUID, TEXT) IS
    'Bloqueia o acesso de um aluno manualmente (com motivo customizado).';
