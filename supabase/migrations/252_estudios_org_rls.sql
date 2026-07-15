-- ============================================================================
-- 252: Estúdios v1 — RLS org-aware para alunos compartilhados
-- ============================================================================
-- Vários treinadores por estúdio; TODOS leem e editam os alunos do estúdio
-- (decisão Gustavo 15/jul: visibilidade open total). students.coach_id passa a
-- ser apenas o "treinador responsável" (informativo/reatribuível, nunca NULL —
-- o app do aluno resolve chat/branding/sessões por ele).
--
-- LIÇÃO DA 225 (redesign anti-furo): a tentativa anterior deu acesso a dados
-- DO OUTRO TREINADOR (exercises, program_templates, trainers) só por
-- co-membership — caminho cross-tenant. Aqui o gate deriva SEMPRE do ALUNO da
-- linha (students.organization_id + is_org_member), nunca do trainer_id da
-- linha e nunca via join em trainers. Bibliotecas, financeiro e trainers NÃO
-- recebem policy org nenhuma.
--
-- Aditivo por construção: policies PERMISSIVE OR'd com as base por-treinador;
-- para aluno solo (organization_id IS NULL) o predicado é falso → contas solo
-- byte a byte como hoje. DELETE não ganha policy org (fica nos server actions
-- com admin client + assertStudentAccess).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Helper único das policies: o ator alcança este aluno via estúdio?
-- ----------------------------------------------------------------------------
create or replace function public.can_access_org_student(p_student uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
    select exists (
        select 1 from students s
        where s.id = p_student
          and s.organization_id is not null
          and public.is_org_member(s.organization_id)
    )
$$;

revoke execute on function public.can_access_org_student(uuid) from anon, public;
grant execute on function public.can_access_org_student(uuid) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. Choke point de vinculação: aluno novo de coach de estúdio nasce na org.
--    Trigger (e não app) porque os INSERTs vêm de 3 caminhos service-role
--    (action web, MCP kinevo_create_student, conversão de lead) — todos passam
--    por aqui. Deriva do coach_id, nunca do JWT.
-- ----------------------------------------------------------------------------
create or replace function public.students_derive_org_id()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
    if new.organization_id is null and new.coach_id is not null then
        select om.organization_id into new.organization_id
        from organization_members om
        where om.trainer_id = new.coach_id
          and om.status = 'active'
        limit 1;
    end if;
    return new;
end;
$$;

drop trigger if exists trg_students_derive_org on public.students;
create trigger trg_students_derive_org
    before insert on public.students
    for each row execute function public.students_derive_org_id();

-- ----------------------------------------------------------------------------
-- 2b. Imutabilidade das COLUNAS DE POSSE para o papel authenticated.
--
--   As policies org validam o EIXO de tenancy da linha (org do aluno), mas RLS
--   não enxerga OLD — sem isto, um coach comum poderia, via PostgREST direto,
--   reescrever students.coach_id / students.organization_id (roubar/desanexar
--   aluno, F1/F2) ou assigned_programs.trainer_id (forjar autoria, F3), tudo
--   dentro do que o WITH CHECK aceita. Reatribuição e vinculação legítimas
--   passam por supabaseAdmin (service_role), que é isento deste trigger.
-- ----------------------------------------------------------------------------
create or replace function public.guard_student_ownership_columns()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
    if auth.role() = 'service_role' then
        return new;
    end if;
    if new.coach_id is distinct from old.coach_id then
        raise exception 'coach_id é imutável por esta via (use a reatribuição do estúdio)';
    end if;
    if new.organization_id is distinct from old.organization_id then
        raise exception 'organization_id é imutável por esta via';
    end if;
    return new;
end;
$$;

drop trigger if exists trg_students_guard_ownership on public.students;
create trigger trg_students_guard_ownership
    before update on public.students
    for each row execute function public.guard_student_ownership_columns();

create or replace function public.guard_program_trainer_id()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
    if auth.role() = 'service_role' then
        return new;
    end if;
    if new.trainer_id is distinct from old.trainer_id then
        raise exception 'trainer_id do programa é imutável por esta via';
    end if;
    return new;
end;
$$;

drop trigger if exists trg_assigned_programs_guard_trainer on public.assigned_programs;
create trigger trg_assigned_programs_guard_trainer
    before update on public.assigned_programs
    for each row execute function public.guard_program_trainer_id();

-- ----------------------------------------------------------------------------
-- 3. Policies org — students (SELECT + UPDATE; sem INSERT/DELETE org)
--    WITH CHECK idêntico ao USING: impede mover o aluno para org alheia ou
--    "desligar" organization_id por UPDATE cruzado (a linha resultante precisa
--    continuar numa org da qual o ator é membro).
-- ----------------------------------------------------------------------------
drop policy if exists students_org_member_select on public.students;
create policy students_org_member_select on public.students
    for select to authenticated
    using (organization_id is not null and public.is_org_member(organization_id));

drop policy if exists students_org_member_update on public.students;
create policy students_org_member_update on public.students
    for update to authenticated
    using (organization_id is not null and public.is_org_member(organization_id))
    with check (organization_id is not null and public.is_org_member(organization_id));

-- ----------------------------------------------------------------------------
-- 4. Prescrição (árvore de programa): leitura E escrita cruzada via client RLS.
--    O gate desce sempre à raiz students via can_access_org_student.
-- ----------------------------------------------------------------------------
drop policy if exists assigned_programs_org_select on public.assigned_programs;
create policy assigned_programs_org_select on public.assigned_programs
    for select to authenticated
    using (public.can_access_org_student(student_id));

-- INSERT pina trainer_id ao ator: um coach prescreve como ELE MESMO (mesmo ao
-- atuar no aluno de um colega). Sem isso, o org branch (só student_id) deixaria
-- forjar autoria (trainer_id de colega) ou plantar programa no roster de um
-- treinador externo. UPDATE de trainer_id é bloqueado pelo trigger de
-- imutabilidade abaixo (o org UPDATE precisa permitir coach B editar programa
-- cujo trainer_id = coach A, então não dá para pinar no WITH CHECK).
drop policy if exists assigned_programs_org_insert on public.assigned_programs;
create policy assigned_programs_org_insert on public.assigned_programs
    for insert to authenticated
    with check (
        public.can_access_org_student(student_id)
        and trainer_id = public.current_trainer_id()
    );

drop policy if exists assigned_programs_org_update on public.assigned_programs;
create policy assigned_programs_org_update on public.assigned_programs
    for update to authenticated
    using (public.can_access_org_student(student_id))
    with check (public.can_access_org_student(student_id));

drop policy if exists assigned_workouts_org_select on public.assigned_workouts;
create policy assigned_workouts_org_select on public.assigned_workouts
    for select to authenticated
    using (exists (
        select 1 from assigned_programs ap
        where ap.id = assigned_program_id
          and public.can_access_org_student(ap.student_id)
    ));

drop policy if exists assigned_workouts_org_insert on public.assigned_workouts;
create policy assigned_workouts_org_insert on public.assigned_workouts
    for insert to authenticated
    with check (exists (
        select 1 from assigned_programs ap
        where ap.id = assigned_program_id
          and public.can_access_org_student(ap.student_id)
    ));

drop policy if exists assigned_workouts_org_update on public.assigned_workouts;
create policy assigned_workouts_org_update on public.assigned_workouts
    for update to authenticated
    using (exists (
        select 1 from assigned_programs ap
        where ap.id = assigned_program_id
          and public.can_access_org_student(ap.student_id)
    ))
    with check (exists (
        select 1 from assigned_programs ap
        where ap.id = assigned_program_id
          and public.can_access_org_student(ap.student_id)
    ));

drop policy if exists assigned_workout_items_org_select on public.assigned_workout_items;
create policy assigned_workout_items_org_select on public.assigned_workout_items
    for select to authenticated
    using (exists (
        select 1
        from assigned_workouts aw
        join assigned_programs ap on ap.id = aw.assigned_program_id
        where aw.id = assigned_workout_id
          and public.can_access_org_student(ap.student_id)
    ));

drop policy if exists assigned_workout_items_org_insert on public.assigned_workout_items;
create policy assigned_workout_items_org_insert on public.assigned_workout_items
    for insert to authenticated
    with check (exists (
        select 1
        from assigned_workouts aw
        join assigned_programs ap on ap.id = aw.assigned_program_id
        where aw.id = assigned_workout_id
          and public.can_access_org_student(ap.student_id)
    ));

drop policy if exists assigned_workout_items_org_update on public.assigned_workout_items;
create policy assigned_workout_items_org_update on public.assigned_workout_items
    for update to authenticated
    using (exists (
        select 1
        from assigned_workouts aw
        join assigned_programs ap on ap.id = aw.assigned_program_id
        where aw.id = assigned_workout_id
          and public.can_access_org_student(ap.student_id)
    ))
    with check (exists (
        select 1
        from assigned_workouts aw
        join assigned_programs ap on ap.id = aw.assigned_program_id
        where aw.id = assigned_workout_id
          and public.can_access_org_student(ap.student_id)
    ));

drop policy if exists assigned_workout_item_sets_org_select on public.assigned_workout_item_sets;
create policy assigned_workout_item_sets_org_select on public.assigned_workout_item_sets
    for select to authenticated
    using (exists (
        select 1
        from assigned_workout_items awi
        join assigned_workouts aw on aw.id = awi.assigned_workout_id
        join assigned_programs ap on ap.id = aw.assigned_program_id
        where awi.id = assigned_workout_item_id
          and public.can_access_org_student(ap.student_id)
    ));

drop policy if exists assigned_workout_item_sets_org_insert on public.assigned_workout_item_sets;
create policy assigned_workout_item_sets_org_insert on public.assigned_workout_item_sets
    for insert to authenticated
    with check (exists (
        select 1
        from assigned_workout_items awi
        join assigned_workouts aw on aw.id = awi.assigned_workout_id
        join assigned_programs ap on ap.id = aw.assigned_program_id
        where awi.id = assigned_workout_item_id
          and public.can_access_org_student(ap.student_id)
    ));

drop policy if exists assigned_workout_item_sets_org_update on public.assigned_workout_item_sets;
create policy assigned_workout_item_sets_org_update on public.assigned_workout_item_sets
    for update to authenticated
    using (exists (
        select 1
        from assigned_workout_items awi
        join assigned_workouts aw on aw.id = awi.assigned_workout_id
        join assigned_programs ap on ap.id = aw.assigned_program_id
        where awi.id = assigned_workout_item_id
          and public.can_access_org_student(ap.student_id)
    ))
    with check (exists (
        select 1
        from assigned_workout_items awi
        join assigned_workouts aw on aw.id = awi.assigned_workout_id
        join assigned_programs ap on ap.id = aw.assigned_program_id
        where awi.id = assigned_workout_item_id
          and public.can_access_org_student(ap.student_id)
    ));

-- ----------------------------------------------------------------------------
-- 5. Histórico e acompanhamento: SOMENTE LEITURA cruzada no v1.
--    (Escrita de sessão/set_logs continua com o responsável e com os RPCs
--    service-role; mensagem cruzada de escrita fica fora do v1.)
-- ----------------------------------------------------------------------------
drop policy if exists workout_sessions_org_select on public.workout_sessions;
create policy workout_sessions_org_select on public.workout_sessions
    for select to authenticated
    using (public.can_access_org_student(student_id));

drop policy if exists set_logs_org_select on public.set_logs;
create policy set_logs_org_select on public.set_logs
    for select to authenticated
    using (exists (
        select 1 from workout_sessions ws
        where ws.id = workout_session_id
          and public.can_access_org_student(ws.student_id)
    ));

drop policy if exists messages_org_select on public.messages;
create policy messages_org_select on public.messages
    for select to authenticated
    using (public.can_access_org_student(student_id));

drop policy if exists form_submissions_org_select on public.form_submissions;
create policy form_submissions_org_select on public.form_submissions
    for select to authenticated
    using (public.can_access_org_student(student_id));

drop policy if exists form_schedules_org_select on public.form_schedules;
create policy form_schedules_org_select on public.form_schedules
    for select to authenticated
    using (public.can_access_org_student(student_id));

drop policy if exists student_inbox_items_org_select on public.student_inbox_items;
create policy student_inbox_items_org_select on public.student_inbox_items
    for select to authenticated
    using (public.can_access_org_student(student_id));

drop policy if exists student_prescription_profiles_org_select on public.student_prescription_profiles;
create policy student_prescription_profiles_org_select on public.student_prescription_profiles
    for select to authenticated
    using (public.can_access_org_student(student_id));

-- ----------------------------------------------------------------------------
-- 6. Diretório de membros da org (nomes/avatars dos colegas SEM policy em
--    trainers — a 225 fechou esse caminho de propósito). Também conserta a aba
--    Equipe, que mostra '—' porque o embed trainers devolve null pós-225.
-- ----------------------------------------------------------------------------
create or replace function public.get_org_members_directory(p_org uuid)
returns table (
    trainer_id uuid,
    name text,
    email text,
    avatar_url text,
    role text,
    status text,
    is_coach boolean
)
language sql
stable security definer
set search_path to 'public'
as $$
    select om.trainer_id, t.name, t.email, t.avatar_url, om.role, om.status, om.is_coach
    from organization_members om
    join trainers t on t.id = om.trainer_id
    where om.organization_id = p_org
      and public.is_org_member(p_org)
      and om.status in ('active', 'inactive')
    order by (om.role = 'owner') desc, t.name
$$;

revoke execute on function public.get_org_members_directory(uuid) from anon, public;
grant execute on function public.get_org_members_directory(uuid) to authenticated, service_role;
