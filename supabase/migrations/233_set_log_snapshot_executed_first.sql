-- ============================================================================
-- 233: snapshot de set_log registra o exercício EXECUTADO (R16, rodada 2)
-- ============================================================================
-- Auditoria rodada 2 (docs/analise-builder-rodada2-2026-07-06.md), achado R16.
--
-- PROBLEMA
-- --------
-- O trigger da 227 (fill_set_log_snapshot) preferia o snapshot do ITEM
-- (assigned_workout_items.exercise_name = nome PRESCRITO) e só caía para o
-- exercício executado se o item não tivesse snapshot. Quando o aluno faz SWAP
-- no player (executed_exercise_id ≠ prescrito), o log ficava com o nome do
-- exercício que ele NÃO fez — e o leitor novo (get-session-details etc.) dá
-- precedência ao snapshot, então o detalhe da sessão mostrava o exercício
-- errado. O backfill da 227 gravou o mesmo problema no histórico.
--
-- FIX
-- ---
-- 1. Precedência invertida no trigger: executed_exercise_id primeiro (é o que
--    o aluno DE FATO executou), depois o snapshot do item, depois exercise_id.
-- 2. Re-backfill: corrige os snapshots existentes onde há executed_exercise_id
--    e o nome diverge do exercício executado.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fill_set_log_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- FIX (233/R16): o snapshot registra o exercício EXECUTADO — com swap,
    -- executed_exercise_id difere do prescrito e o nome do item estaria errado.
    IF NEW.exercise_name IS NULL AND NEW.executed_exercise_id IS NOT NULL THEN
        SELECT name INTO NEW.exercise_name
        FROM exercises WHERE id = NEW.executed_exercise_id;
    END IF;
    IF NEW.exercise_name IS NULL AND NEW.assigned_workout_item_id IS NOT NULL THEN
        SELECT exercise_name INTO NEW.exercise_name
        FROM assigned_workout_items WHERE id = NEW.assigned_workout_item_id;
    END IF;
    IF NEW.exercise_name IS NULL THEN
        SELECT name INTO NEW.exercise_name
        FROM exercises WHERE id = NEW.exercise_id;
    END IF;
    RETURN NEW;
END;
$$;

-- Re-backfill cirúrgico: só rows com SWAP real (executado ≠ planejado) cujo
-- snapshot diverge do exercício executado — não toca snapshots congelados de
-- exercícios renomeados sem swap.
UPDATE set_logs sl
SET exercise_name = e.name
FROM exercises e
WHERE e.id = sl.executed_exercise_id
  AND sl.executed_exercise_id IS NOT NULL
  AND sl.executed_exercise_id IS DISTINCT FROM coalesce(sl.planned_exercise_id, sl.exercise_id)
  AND sl.exercise_name IS DISTINCT FROM e.name;
