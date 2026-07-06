-- ============================================================================
-- 227: Histórico de execução sobrevive à edição/deleção da prescrição (C1)
-- ============================================================================
-- Auditoria do builder (docs/analise-builder-2026-07-06.md), achado C1.
--
-- Problema: as FKs de execução nasceram NOT NULL + ON DELETE CASCADE (001):
--   set_logs.assigned_workout_item_id  → apagar um exercício de um programa
--     ativo (RPC save_assigned_program_tree ou saves client-side do mobile)
--     apagava todas as séries já logadas daquele exercício;
--   workout_sessions.assigned_workout_id → remover um treino apagava as
--     sessões executadas inteiras (com seus set_logs);
--   workout_sessions.assigned_program_id → deletar um programa antigo apagava
--     todo o histórico de sessões dele.
--
-- Princípio: o histórico de execução pertence ao aluno e é imutável — deleção
-- de prescrição desassocia (SET NULL), nunca apaga. Deletar o ALUNO continua
-- cascateando tudo (correto, LGPD).
--
-- Como o nome do treino/exercício vivia só na linha de prescrição, as tabelas
-- de execução ganham snapshots de exibição, backfillados e mantidos por
-- trigger de INSERT (cobre todos os writers: mobile, watch, sala de treino).

-- ----------------------------------------------------------------------------
-- 1) Snapshots de exibição
-- ----------------------------------------------------------------------------
ALTER TABLE workout_sessions ADD COLUMN IF NOT EXISTS workout_name TEXT;
ALTER TABLE set_logs ADD COLUMN IF NOT EXISTS exercise_name TEXT;

-- ----------------------------------------------------------------------------
-- 2) Backfill (roda antes da troca das FKs; joins ainda íntegros)
-- ----------------------------------------------------------------------------
UPDATE workout_sessions ws
SET workout_name = aw.name
FROM assigned_workouts aw
WHERE ws.assigned_workout_id = aw.id
  AND ws.workout_name IS NULL;

UPDATE set_logs sl
SET exercise_name = awi.exercise_name
FROM assigned_workout_items awi
WHERE sl.assigned_workout_item_id = awi.id
  AND sl.exercise_name IS NULL
  AND awi.exercise_name IS NOT NULL;

-- Itens antigos sem snapshot próprio: cai para o exercício executado/planejado
UPDATE set_logs sl
SET exercise_name = e.name
FROM exercises e
WHERE sl.exercise_name IS NULL
  AND e.id = coalesce(sl.executed_exercise_id, sl.exercise_id);

-- ----------------------------------------------------------------------------
-- 3) Triggers para preencher snapshots daqui em diante
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fill_workout_session_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.workout_name IS NULL AND NEW.assigned_workout_id IS NOT NULL THEN
        SELECT name INTO NEW.workout_name
        FROM assigned_workouts WHERE id = NEW.assigned_workout_id;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_workout_sessions_fill_snapshot ON workout_sessions;
CREATE TRIGGER trg_workout_sessions_fill_snapshot
    BEFORE INSERT ON workout_sessions
    FOR EACH ROW EXECUTE FUNCTION public.fill_workout_session_snapshot();

CREATE OR REPLACE FUNCTION public.fill_set_log_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.exercise_name IS NULL AND NEW.assigned_workout_item_id IS NOT NULL THEN
        SELECT exercise_name INTO NEW.exercise_name
        FROM assigned_workout_items WHERE id = NEW.assigned_workout_item_id;
    END IF;
    IF NEW.exercise_name IS NULL THEN
        SELECT name INTO NEW.exercise_name
        FROM exercises WHERE id = coalesce(NEW.executed_exercise_id, NEW.exercise_id);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_logs_fill_snapshot ON set_logs;
CREATE TRIGGER trg_set_logs_fill_snapshot
    BEFORE INSERT ON set_logs
    FOR EACH ROW EXECUTE FUNCTION public.fill_set_log_snapshot();

-- ----------------------------------------------------------------------------
-- 4) FKs de execução: CASCADE → SET NULL (+ colunas anuláveis)
--    Nomes de constraint resolvidos dinamicamente por segurança.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    v_name TEXT;
BEGIN
    -- set_logs.assigned_workout_item_id
    ALTER TABLE set_logs ALTER COLUMN assigned_workout_item_id DROP NOT NULL;
    SELECT conname INTO v_name FROM pg_constraint
    WHERE conrelid = 'set_logs'::regclass AND contype = 'f'
      AND 'assigned_workout_item_id' = ANY (
          SELECT attname FROM pg_attribute
          WHERE attrelid = conrelid AND attnum = ANY (conkey));
    IF v_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE set_logs DROP CONSTRAINT %I', v_name);
    END IF;
    ALTER TABLE set_logs
        ADD CONSTRAINT set_logs_assigned_workout_item_id_fkey
        FOREIGN KEY (assigned_workout_item_id)
        REFERENCES assigned_workout_items(id) ON DELETE SET NULL;

    -- workout_sessions.assigned_workout_id
    ALTER TABLE workout_sessions ALTER COLUMN assigned_workout_id DROP NOT NULL;
    SELECT conname INTO v_name FROM pg_constraint
    WHERE conrelid = 'workout_sessions'::regclass AND contype = 'f'
      AND 'assigned_workout_id' = ANY (
          SELECT attname FROM pg_attribute
          WHERE attrelid = conrelid AND attnum = ANY (conkey));
    IF v_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE workout_sessions DROP CONSTRAINT %I', v_name);
    END IF;
    ALTER TABLE workout_sessions
        ADD CONSTRAINT workout_sessions_assigned_workout_id_fkey
        FOREIGN KEY (assigned_workout_id)
        REFERENCES assigned_workouts(id) ON DELETE SET NULL;

    -- workout_sessions.assigned_program_id
    ALTER TABLE workout_sessions ALTER COLUMN assigned_program_id DROP NOT NULL;
    SELECT conname INTO v_name FROM pg_constraint
    WHERE conrelid = 'workout_sessions'::regclass AND contype = 'f'
      AND 'assigned_program_id' = ANY (
          SELECT attname FROM pg_attribute
          WHERE attrelid = conrelid AND attnum = ANY (conkey));
    IF v_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE workout_sessions DROP CONSTRAINT %I', v_name);
    END IF;
    ALTER TABLE workout_sessions
        ADD CONSTRAINT workout_sessions_assigned_program_id_fkey
        FOREIGN KEY (assigned_program_id)
        REFERENCES assigned_programs(id) ON DELETE SET NULL;
END
$$;

COMMENT ON COLUMN workout_sessions.workout_name IS
    'Snapshot do nome do treino no momento da execução (227). Sobrevive à deleção da prescrição.';
COMMENT ON COLUMN set_logs.exercise_name IS
    'Snapshot do nome do exercício no momento da execução (227). Sobrevive à deleção da prescrição.';
