-- ============================================================================
-- 196_activate_draft_program_rpc.sql
-- ============================================================================
-- Permite ativar um programa em rascunho (status='draft') a partir do app
-- mobile (modo treinador). Espelha a lógica do web (activateAssignedProgram):
--   1. valida que todo treino tem dia agendado
--   2. encerra o programa ativo/expirado atual do aluno
--   3. vira o rascunho em 'active' (started_at = agora, calcula expires_at)
--   4. insere notificação no inbox do aluno (realtime atualiza o app dele)
--
-- Observação: o push nativo continua sendo disparado apenas no fluxo web
-- (precisa de env server-side). Aqui a notificação de inbox + realtime do
-- assigned_programs já fazem o programa aparecer para o aluno.
--
-- SECURITY DEFINER + checagem de current_trainer_id() garante que só o dono
-- ativa o próprio rascunho. Aditivo e backward-compatible.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.activate_draft_program(p_program_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_trainer_id UUID;
    v_student_id UUID;
    v_name TEXT;
    v_duration_weeks INT;
    v_missing TEXT[];
    v_now TIMESTAMPTZ := now();
    v_expires TIMESTAMPTZ;
BEGIN
    v_trainer_id := current_trainer_id();
    IF v_trainer_id IS NULL THEN
        RAISE EXCEPTION 'Not a trainer';
    END IF;

    -- Carrega o rascunho garantindo posse do treinador
    SELECT ap.student_id, ap.name, ap.duration_weeks
    INTO v_student_id, v_name, v_duration_weeks
    FROM assigned_programs ap
    WHERE ap.id = p_program_id
      AND ap.trainer_id = v_trainer_id
      AND ap.status = 'draft';

    IF v_student_id IS NULL THEN
        RAISE EXCEPTION 'Draft program not found for current trainer';
    END IF;

    -- Todo treino precisa de pelo menos um dia agendado
    SELECT array_agg(aw.name ORDER BY aw.order_index)
    INTO v_missing
    FROM assigned_workouts aw
    WHERE aw.assigned_program_id = p_program_id
      AND (aw.scheduled_days IS NULL OR array_length(aw.scheduled_days, 1) IS NULL);

    IF v_missing IS NOT NULL THEN
        RAISE EXCEPTION 'missing_scheduled_days:%', array_to_string(v_missing, ', ');
    END IF;

    IF v_duration_weeks IS NOT NULL THEN
        v_expires := v_now + (v_duration_weeks * INTERVAL '7 days');
    END IF;

    -- Encerra o programa ativo/expirado atual do aluno
    UPDATE assigned_programs
    SET status = 'completed', completed_at = v_now, updated_at = v_now
    WHERE student_id = v_student_id
      AND trainer_id = v_trainer_id
      AND id <> p_program_id
      AND status IN ('active', 'expired');

    -- Ativa o rascunho
    UPDATE assigned_programs
    SET status = 'active', started_at = v_now, updated_at = v_now, expires_at = v_expires
    WHERE id = p_program_id
      AND trainer_id = v_trainer_id
      AND status = 'draft';

    -- Notifica o aluno (inbox); realtime do assigned_programs faz o app refazer o fetch
    INSERT INTO student_inbox_items (student_id, trainer_id, type, status, title, subtitle, payload)
    VALUES (
        v_student_id, v_trainer_id, 'program_assigned', 'unread',
        'Novo programa de treino!',
        v_name || ' está disponível no seu app.',
        jsonb_build_object('program_id', p_program_id, 'program_name', v_name)
    );

    RETURN jsonb_build_object(
        'success', true,
        'program_id', p_program_id,
        'student_id', v_student_id
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.activate_draft_program(UUID) TO authenticated;
