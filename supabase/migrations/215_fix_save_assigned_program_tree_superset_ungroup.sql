-- ============================================================================
-- 215_fix_save_assigned_program_tree_superset_ungroup.sql
-- ============================================================================
-- Fix do bug "Item % does not belong to workout" ao salvar um programa no editor.
--
-- CAUSA RAIZ
-- ----------
-- A FK assigned_workout_items.parent_item_id é ON DELETE CASCADE. Dentro de
-- save_assigned_program_tree (197), para cada treino fazemos:
--     1) DELETE dos itens que saíram da árvore (id <> ALL(kept));
--     2) upsert dos itens que ficaram.
-- Quando o treinador DESAGRUPA um superset no editor, o item-pai (type
-- 'superset') sai da árvore mas seus filhos PERMANECEM — agora como itens-raiz.
-- No passo (1) o pai-superset é deletado e, por causa do CASCADE, arrasta junto
-- os filhos que ainda apontam pra ele no banco (o reparent só aconteceria no
-- passo 2). No passo (2), ao tentar dar UPDATE nesses filhos (que o payload
-- manda manter), o WHERE não acha a linha (foi cascateada) e dispara
-- 'Item % does not belong to workout', abortando a transação inteira.
--
-- Reproduzido em prod: programa e3ecc124…, Treino C, superset eeb8bca1 com os
-- filhos b9e01e9c (Pistol no Banco) e c146b2ad (Remada Baixa Supinada).
--
-- FIX
-- ---
-- Antes do DELETE de cada treino, "soltamos" (parent_item_id = NULL) todos os
-- itens que VÃO PERMANECER nesse treino. Assim o CASCADE do delete do pai não
-- alcança nenhum filho que o cliente quer manter. O upsert seguinte reescreve
-- parent_item_id corretamente (NULL para raiz, id do pai para filho de superset),
-- então soltar antes é seguro e idempotente dentro da transação.
--
-- Aditivo / backward-compatible: apenas CREATE OR REPLACE da função.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.save_assigned_program_tree(p_program_id uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_trainer uuid;
    v_prog jsonb := p_payload->'program';
    v_w jsonb;
    v_i jsonb;
    v_c jsonb;
    v_wid uuid;
    v_iid uuid;
    v_kept_workouts uuid[];
    v_kept_items uuid[];
BEGIN
    v_trainer := current_trainer_id();
    IF v_trainer IS NULL THEN
        RAISE EXCEPTION 'Not a trainer';
    END IF;

    -- Posse do programa
    PERFORM 1 FROM assigned_programs WHERE id = p_program_id AND trainer_id = v_trainer;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Program not found for current trainer';
    END IF;

    -- Metadados do programa (status/datas já resolvidos pelo cliente)
    UPDATE assigned_programs SET
        name = coalesce(v_prog->>'name', name),
        description = v_prog->>'description',
        duration_weeks = nullif(v_prog->>'duration_weeks','')::int,
        status = coalesce(v_prog->>'status', status),
        started_at = (v_prog->>'started_at')::timestamptz,
        scheduled_start_date = (v_prog->>'scheduled_start_date')::timestamptz,
        updated_at = now()
    WHERE id = p_program_id AND trainer_id = v_trainer;

    -- Treinos a manter (ids não-nulos no payload)
    SELECT coalesce(array_agg((w->>'id')::uuid), '{}')
    INTO v_kept_workouts
    FROM jsonb_array_elements(coalesce(p_payload->'workouts','[]'::jsonb)) w
    WHERE (w->>'id') IS NOT NULL;

    DELETE FROM assigned_workouts
    WHERE assigned_program_id = p_program_id
      AND id <> ALL(v_kept_workouts);

    FOR v_w IN SELECT * FROM jsonb_array_elements(coalesce(p_payload->'workouts','[]'::jsonb))
    LOOP
        IF (v_w->>'id') IS NULL THEN
            INSERT INTO assigned_workouts (assigned_program_id, name, order_index, scheduled_days)
            VALUES (
                p_program_id,
                v_w->>'name',
                (v_w->>'order_index')::int,
                coalesce((SELECT array_agg(e::int) FROM jsonb_array_elements_text(coalesce(v_w->'scheduled_days','[]'::jsonb)) e), '{}')
            )
            RETURNING id INTO v_wid;
        ELSE
            v_wid := (v_w->>'id')::uuid;
            UPDATE assigned_workouts SET
                name = v_w->>'name',
                order_index = (v_w->>'order_index')::int,
                scheduled_days = coalesce((SELECT array_agg(e::int) FROM jsonb_array_elements_text(coalesce(v_w->'scheduled_days','[]'::jsonb)) e), '{}'),
                updated_at = now()
            WHERE id = v_wid AND assigned_program_id = p_program_id;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Workout % does not belong to program', v_wid;
            END IF;
        END IF;

        -- Itens a manter neste treino (raiz + filhos)
        SELECT coalesce(array_agg(x), '{}') INTO v_kept_items
        FROM (
            SELECT (it->>'id')::uuid AS x
            FROM jsonb_array_elements(coalesce(v_w->'items','[]'::jsonb)) it
            WHERE (it->>'id') IS NOT NULL
            UNION ALL
            SELECT (ch->>'id')::uuid
            FROM jsonb_array_elements(coalesce(v_w->'items','[]'::jsonb)) it,
                 jsonb_array_elements(coalesce(it->'children','[]'::jsonb)) ch
            WHERE (ch->>'id') IS NOT NULL
        ) q;

        -- FIX (215): solta do pai os itens que vão permanecer ANTES de deletar.
        -- A FK parent_item_id é ON DELETE CASCADE; sem isto, deletar um pai-superset
        -- que saiu da árvore (ex.: superset desagrupado) cascatearia e apagaria
        -- filhos que o payload manda manter, fazendo o upsert abaixo disparar
        -- 'Item % does not belong to workout'. O upsert reescreve parent_item_id.
        UPDATE assigned_workout_items
        SET parent_item_id = NULL
        WHERE assigned_workout_id = v_wid
          AND parent_item_id IS NOT NULL
          AND id = ANY(v_kept_items);

        DELETE FROM assigned_workout_items
        WHERE assigned_workout_id = v_wid
          AND id <> ALL(v_kept_items);

        FOR v_i IN SELECT * FROM jsonb_array_elements(coalesce(v_w->'items','[]'::jsonb))
        LOOP
            IF (v_i->>'id') IS NULL THEN
                INSERT INTO assigned_workout_items (
                    assigned_workout_id, parent_item_id, item_type, order_index,
                    exercise_id, substitute_exercise_ids, sets, reps, rest_seconds,
                    notes, item_config, method_key, rounds,
                    exercise_name, exercise_muscle_group, exercise_equipment
                ) VALUES (
                    v_wid, NULL, v_i->>'item_type', (v_i->>'order_index')::int,
                    (v_i->>'exercise_id')::uuid,
                    coalesce((SELECT array_agg(e::uuid) FROM jsonb_array_elements_text(coalesce(v_i->'substitute_exercise_ids','[]'::jsonb)) e), '{}'),
                    nullif(v_i->>'sets','')::int, v_i->>'reps', nullif(v_i->>'rest_seconds','')::int,
                    v_i->>'notes', coalesce(v_i->'item_config','{}'::jsonb), v_i->>'method_key', nullif(v_i->>'rounds','')::int,
                    v_i->>'exercise_name', v_i->>'exercise_muscle_group', v_i->>'exercise_equipment'
                )
                RETURNING id INTO v_iid;
            ELSE
                v_iid := (v_i->>'id')::uuid;
                UPDATE assigned_workout_items SET
                    parent_item_id = NULL,
                    item_type = v_i->>'item_type',
                    order_index = (v_i->>'order_index')::int,
                    exercise_id = (v_i->>'exercise_id')::uuid,
                    substitute_exercise_ids = coalesce((SELECT array_agg(e::uuid) FROM jsonb_array_elements_text(coalesce(v_i->'substitute_exercise_ids','[]'::jsonb)) e), '{}'),
                    sets = nullif(v_i->>'sets','')::int,
                    reps = v_i->>'reps',
                    rest_seconds = nullif(v_i->>'rest_seconds','')::int,
                    notes = v_i->>'notes',
                    item_config = coalesce(v_i->'item_config','{}'::jsonb),
                    method_key = v_i->>'method_key',
                    rounds = nullif(v_i->>'rounds','')::int,
                    exercise_name = v_i->>'exercise_name',
                    exercise_muscle_group = v_i->>'exercise_muscle_group',
                    exercise_equipment = v_i->>'exercise_equipment',
                    updated_at = now()
                WHERE id = v_iid AND assigned_workout_id = v_wid;
                IF NOT FOUND THEN
                    RAISE EXCEPTION 'Item % does not belong to workout', v_iid;
                END IF;
            END IF;

            -- Substitui as linhas de set_scheme do item
            DELETE FROM assigned_workout_item_sets WHERE assigned_workout_item_id = v_iid;
            INSERT INTO assigned_workout_item_sets (
                assigned_workout_item_id, set_number, set_type, reps, rest_seconds,
                weight_target_kg, weight_target_pct1rm, rir, tempo, notes, round_number
            )
            SELECT v_iid,
                (s->>'set_number')::int, s->>'set_type', s->>'reps', nullif(s->>'rest_seconds','')::int,
                nullif(s->>'weight_target_kg','')::numeric, nullif(s->>'weight_target_pct1rm','')::numeric,
                nullif(s->>'rir','')::int, s->>'tempo', s->>'notes', nullif(s->>'round_number','')::int
            FROM jsonb_array_elements(coalesce(v_i->'set_rows','[]'::jsonb)) s;

            -- Filhos (supersets) — V1 não persiste set_scheme em filho
            FOR v_c IN SELECT * FROM jsonb_array_elements(coalesce(v_i->'children','[]'::jsonb))
            LOOP
                IF (v_c->>'id') IS NULL THEN
                    INSERT INTO assigned_workout_items (
                        assigned_workout_id, parent_item_id, item_type, order_index,
                        exercise_id, substitute_exercise_ids, sets, reps, rest_seconds,
                        notes, item_config, method_key, rounds,
                        exercise_name, exercise_muscle_group, exercise_equipment
                    ) VALUES (
                        v_wid, v_iid, v_c->>'item_type', (v_c->>'order_index')::int,
                        (v_c->>'exercise_id')::uuid,
                        coalesce((SELECT array_agg(e::uuid) FROM jsonb_array_elements_text(coalesce(v_c->'substitute_exercise_ids','[]'::jsonb)) e), '{}'),
                        nullif(v_c->>'sets','')::int, v_c->>'reps', nullif(v_c->>'rest_seconds','')::int,
                        v_c->>'notes', coalesce(v_c->'item_config','{}'::jsonb), NULL, 1,
                        v_c->>'exercise_name', v_c->>'exercise_muscle_group', v_c->>'exercise_equipment'
                    );
                ELSE
                    UPDATE assigned_workout_items SET
                        parent_item_id = v_iid,
                        item_type = v_c->>'item_type',
                        order_index = (v_c->>'order_index')::int,
                        exercise_id = (v_c->>'exercise_id')::uuid,
                        substitute_exercise_ids = coalesce((SELECT array_agg(e::uuid) FROM jsonb_array_elements_text(coalesce(v_c->'substitute_exercise_ids','[]'::jsonb)) e), '{}'),
                        sets = nullif(v_c->>'sets','')::int,
                        reps = v_c->>'reps',
                        rest_seconds = nullif(v_c->>'rest_seconds','')::int,
                        notes = v_c->>'notes',
                        item_config = coalesce(v_c->'item_config','{}'::jsonb),
                        method_key = NULL,
                        rounds = 1,
                        exercise_name = v_c->>'exercise_name',
                        exercise_muscle_group = v_c->>'exercise_muscle_group',
                        exercise_equipment = v_c->>'exercise_equipment',
                        updated_at = now()
                    WHERE id = (v_c->>'id')::uuid AND assigned_workout_id = v_wid;
                    IF NOT FOUND THEN
                        RAISE EXCEPTION 'Child item % does not belong to workout', (v_c->>'id');
                    END IF;
                END IF;
            END LOOP;
        END LOOP;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'program_id', p_program_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_assigned_program_tree(uuid, jsonb) TO authenticated;
