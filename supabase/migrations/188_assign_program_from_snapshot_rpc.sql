-- ============================================================================
-- Migration 188: assign_program_from_snapshot — atribuição transacional (IA)
--
-- Problema (mesma classe do achado crítico #4 da auditoria 09/06/2026, já
-- resolvido para o caminho template pela migration 184): o caminho de assign
-- a partir de snapshot de IA (web/src/lib/ai-prescription/assign-from-snapshot.ts,
-- usado por POST /api/programs/assign quando o mobile envia generationId)
-- materializava assigned_programs + assigned_workouts + assigned_workout_items
-- em N round-trips SEM transação, com delete compensatório best-effort.
-- Pior gap: o UPDATE que completa os programas vigentes do aluno rodava ANTES
-- do bloco protegido — se o insert do programa falhasse, o aluno ficava sem
-- programa ativo nenhum e sem rollback possível.
--
-- Esta RPC move todos os writes para uma única transação no banco:
--   - trava a geração (FOR UPDATE) e re-valida ownership (triple filter
--     id + trainer + student) e idempotência (status <> 'approved' — protege
--     contra double-tap no mobile mesmo sob corrida)
--   - completa o programa vigente (active OU expired) apenas em atribuição
--     imediata, como o helper TS fazia
--   - materializa programa, treinos e itens a partir do snapshot JÁ FILTRADO
--     pelo caller (catálogo de exercise_ids, sanitização de substitutos e
--     override de workoutSchedule continuam no TS — a RPC só materializa)
--   - aprova a geração e linka o programa criado; bump opcional de
--     trainer_edits_count quando o trainer persistiu um snapshot editado
-- Falha em qualquer passo desfaz tudo; o aluno nunca fica sem programa válido.
-- Notificação ao aluno fica FORA da RPC, nos callers (best-effort).
--
-- Mensagens de erro estáveis (contrato com o TS — NÃO alterar):
--   'generation_not_found'        → GenerationNotFoundError
--   'generation_already_approved' → GenerationAlreadyApprovedError
--
-- Autorização: SECURITY DEFINER. service_role passa direto; usuário
-- autenticado precisa ser o trainer dono (auth.uid() → trainers.auth_user_id).
-- Ownership de aluno e da geração é validado sempre, para qualquer caller.
-- ============================================================================

create or replace function public.assign_program_from_snapshot(
    p_generation_id uuid,
    p_trainer_id uuid,
    p_student_id uuid,
    p_is_scheduled boolean,
    p_start_date timestamptz,
    p_snapshot jsonb,
    p_bump_edits boolean
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_generation public.prescription_generations%rowtype;
    v_status text;
    v_started_at timestamptz;
    v_expires_at timestamptz;
    v_duration_weeks int;
    v_program_id uuid;
    v_workout jsonb;
    v_workout_id uuid;
begin
    if auth.role() is distinct from 'service_role' then
        if not exists (
            select 1 from public.trainers t
            where t.id = p_trainer_id and t.auth_user_id = auth.uid()
        ) then
            raise exception 'Unauthorized' using errcode = '42501';
        end if;
    end if;

    if not exists (
        select 1 from public.students s
        where s.id = p_student_id and s.coach_id = p_trainer_id
    ) then
        raise exception 'Student not found or unauthorized';
    end if;

    -- Triple filter (id + trainer + student) + lock: serializa double-taps
    -- concorrentes na mesma geração — o segundo espera o lock e cai no check
    -- de status abaixo.
    select * into v_generation
    from public.prescription_generations pg
    where pg.id = p_generation_id
      and pg.trainer_id = p_trainer_id
      and pg.student_id = p_student_id
    for update;
    if not found then
        raise exception 'generation_not_found';
    end if;

    if v_generation.status = 'approved' then
        raise exception 'generation_already_approved';
    end if;

    if p_is_scheduled then
        v_status := 'scheduled';
        v_started_at := null;
    else
        v_status := 'active';
        v_started_at := now();

        update public.assigned_programs
        set status = 'completed',
            completed_at = now(),
            updated_at = now()
        where student_id = p_student_id
          and status in ('active', 'expired');
    end if;

    -- duration_weeks fica null quando o snapshot omite ou traz valor <= 0
    -- (NULL é melhor que um 4 fabricado — ver log Fase 2.5.4 §5).
    v_duration_weeks := case
        when jsonb_typeof(p_snapshot -> 'program' -> 'duration_weeks') = 'number'
             and (p_snapshot -> 'program' ->> 'duration_weeks')::numeric > 0
            then floor((p_snapshot -> 'program' ->> 'duration_weeks')::numeric)::int
        else null
    end;

    v_expires_at := case
        when v_started_at is not null and v_duration_weeks is not null
            then v_started_at + (v_duration_weeks * interval '1 week')
        else null
    end;

    insert into public.assigned_programs (
        student_id, trainer_id, source_template_id, name, description,
        duration_weeks, status, started_at, scheduled_start_date,
        current_week, expires_at, ai_generated, prescription_generation_id
    ) values (
        p_student_id, p_trainer_id, null,
        p_snapshot -> 'program' ->> 'name',
        p_snapshot -> 'program' ->> 'description',
        v_duration_weeks, v_status, v_started_at,
        case when p_is_scheduled then p_start_date end,
        1, v_expires_at, true, p_generation_id
    ) returning id into v_program_id;

    -- Snapshot v2.5 é flat — sem parent/child (supersets). Se o pipeline
    -- passar a emitir parent_item_id, adicionar um segundo passe aqui
    -- (como a 184 faz para filhos de superset).
    for v_workout in
        select w from jsonb_array_elements(p_snapshot -> 'workouts') w
    loop
        insert into public.assigned_workouts
            (assigned_program_id, source_template_id, name, order_index, scheduled_days)
        values (
            v_program_id,
            null,
            v_workout ->> 'name',
            (v_workout ->> 'order_index')::int,
            coalesce((
                select array_agg(d.v::int order by d.v::int)
                from jsonb_array_elements_text(v_workout -> 'scheduled_days') d(v)
            ), '{}')
        ) returning id into v_workout_id;

        insert into public.assigned_workout_items (
            assigned_workout_id, source_template_id, parent_item_id,
            item_type, order_index, exercise_id, exercise_name,
            exercise_muscle_group, exercise_equipment, exercise_function,
            sets, reps, rest_seconds, notes, substitute_exercise_ids, item_config
        )
        select
            v_workout_id, null, null,
            it ->> 'item_type',
            (it ->> 'order_index')::int,
            (it ->> 'exercise_id')::uuid,
            it ->> 'exercise_name',
            it ->> 'exercise_muscle_group',
            it ->> 'exercise_equipment',
            it ->> 'exercise_function',
            (it ->> 'sets')::int,
            it ->> 'reps',
            (it ->> 'rest_seconds')::int,
            it ->> 'notes',
            coalesce((
                select array_agg(s.v::uuid)
                from jsonb_array_elements_text(it -> 'substitute_exercise_ids') s(v)
            ), '{}'),
            coalesce(it -> 'item_config', '{}'::jsonb)
        from jsonb_array_elements(v_workout -> 'items') it;
    end loop;

    update public.prescription_generations
    set status = 'approved',
        approved_at = now(),
        assigned_program_id = v_program_id,
        updated_at = now(),
        trainer_edits_count = case
            when p_bump_edits then coalesce(trainer_edits_count, 0) + 1
            else trainer_edits_count
        end
    where id = p_generation_id;

    return v_program_id;
end;
$$;

revoke all on function public.assign_program_from_snapshot(uuid, uuid, uuid, boolean, timestamptz, jsonb, boolean) from public;
revoke all on function public.assign_program_from_snapshot(uuid, uuid, uuid, boolean, timestamptz, jsonb, boolean) from anon;
grant execute on function public.assign_program_from_snapshot(uuid, uuid, uuid, boolean, timestamptz, jsonb, boolean) to authenticated;
grant execute on function public.assign_program_from_snapshot(uuid, uuid, uuid, boolean, timestamptz, jsonb, boolean) to service_role;
