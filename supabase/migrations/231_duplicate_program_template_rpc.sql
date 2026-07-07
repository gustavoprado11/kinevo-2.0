-- ============================================================================
-- 231: duplicate_program_template — duplicação transacional na biblioteca (R12)
-- ============================================================================
-- Auditoria rodada 2 (docs/analise-builder-rodada2-2026-07-06.md), achado R12.
--
-- PROBLEMA
-- --------
-- A action web duplicate-program.ts copiava template em N+1 client-side e:
--   1. NÃO copiava method_key/rounds nem workout_item_set_templates — um
--      template com drop-set/pirâmide duplicava só com agregados órfãos
--      (aluno atribuído da cópia recebia 9 séries idênticas com reps literal
--      "3× 10/10/10", sem cargas por série e sem chip de método).
--   2. NÃO copiava program_form_triggers (check-ins).
--   3. Engolia erros parciais (if (!newWorkout) continue) — cópia truncada
--      silenciosa na biblioteca.
--
-- FIX
-- ---
-- RPC transacional única (mesma família da 184/197/198). Copia programa +
-- treinos + itens raiz (com method_key/rounds) + séries por item
-- (workout_item_set_templates) + filhos de superset (normalizados V1:
-- method NULL/rounds 1, sem set rows — não propaga lixo pré-228) +
-- check-ins (program_form_triggers).
--
-- Autorização: mesma convenção da 184 — service_role passa direto;
-- usuário autenticado precisa ser o trainer dono (auth.uid()).
-- ============================================================================

create or replace function public.duplicate_program_template(
    p_trainer_id uuid,
    p_template_id uuid
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_original public.program_templates%rowtype;
    v_w public.workout_templates%rowtype;
    v_i public.workout_item_templates%rowtype;
    v_new_id uuid;
    v_new_wid uuid;
    v_new_iid uuid;
begin
    if auth.role() is distinct from 'service_role' then
        if not exists (
            select 1 from public.trainers t
            where t.id = p_trainer_id and t.auth_user_id = auth.uid()
        ) then
            raise exception 'Unauthorized' using errcode = '42501';
        end if;
    end if;

    select * into v_original
    from public.program_templates pt
    where pt.id = p_template_id and pt.trainer_id = p_trainer_id;
    if not found then
        raise exception 'Template not found';
    end if;

    insert into public.program_templates (trainer_id, name, description, duration_weeks, is_template)
    values (p_trainer_id, v_original.name || ' (Cópia)', v_original.description,
            v_original.duration_weeks, true)
    returning id into v_new_id;

    for v_w in
        select * from public.workout_templates
        where program_template_id = p_template_id
        order by order_index
    loop
        insert into public.workout_templates (program_template_id, name, order_index, frequency)
        values (v_new_id, v_w.name, v_w.order_index, v_w.frequency)
        returning id into v_new_wid;

        for v_i in
            select * from public.workout_item_templates
            where workout_template_id = v_w.id and parent_item_id is null
            order by order_index
        loop
            insert into public.workout_item_templates (
                workout_template_id, parent_item_id, item_type, order_index,
                exercise_id, substitute_exercise_ids, sets, reps, rest_seconds,
                notes, exercise_function, item_config, method_key, rounds
            ) values (
                v_new_wid, null, v_i.item_type, v_i.order_index,
                v_i.exercise_id, coalesce(v_i.substitute_exercise_ids, '{}'),
                v_i.sets, v_i.reps, v_i.rest_seconds,
                v_i.notes, v_i.exercise_function, coalesce(v_i.item_config, '{}'::jsonb),
                v_i.method_key, coalesce(v_i.rounds, 1)
            ) returning id into v_new_iid;

            -- Séries por fase do item raiz (a parte que a action antiga perdia)
            insert into public.workout_item_set_templates (
                workout_item_template_id, set_number, set_type, reps, rest_seconds,
                weight_target_kg, weight_target_pct1rm, rir, tempo, notes, round_number
            )
            select v_new_iid, st.set_number, st.set_type, st.reps, st.rest_seconds,
                   st.weight_target_kg, st.weight_target_pct1rm, st.rir, st.tempo,
                   st.notes, st.round_number
            from public.workout_item_set_templates st
            where st.workout_item_template_id = v_i.id;

            -- Filhos de superset, normalizados V1 (method NULL / rounds 1); set
            -- rows de filho NÃO são copiadas de propósito (lixo pré-228).
            insert into public.workout_item_templates (
                workout_template_id, parent_item_id, item_type, order_index,
                exercise_id, substitute_exercise_ids, sets, reps, rest_seconds,
                notes, exercise_function, item_config, method_key, rounds
            )
            select v_new_wid, v_new_iid, c.item_type, c.order_index,
                   c.exercise_id, coalesce(c.substitute_exercise_ids, '{}'),
                   c.sets, c.reps, c.rest_seconds,
                   c.notes, c.exercise_function, coalesce(c.item_config, '{}'::jsonb),
                   null, 1
            from public.workout_item_templates c
            where c.parent_item_id = v_i.id;
        end loop;
    end loop;

    -- Check-ins do template (a action antiga nunca copiou)
    insert into public.program_form_triggers (
        program_template_id, form_template_id, trainer_id, trigger_type, is_active
    )
    select v_new_id, t.form_template_id, p_trainer_id, t.trigger_type, t.is_active
    from public.program_form_triggers t
    where t.program_template_id = p_template_id;

    return v_new_id;
end;
$$;

revoke execute on function public.duplicate_program_template(uuid, uuid) from public, anon;
grant execute on function public.duplicate_program_template(uuid, uuid) to authenticated, service_role;
