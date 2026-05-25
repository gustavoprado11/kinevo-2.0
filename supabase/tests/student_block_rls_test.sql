-- student_block_rls_test.sql
-- Teste da migration 162 (A3): enforce do bloqueio de inadimplência na RLS.
--
-- Aplica o DDL da 162 DENTRO de begin..rollback, semeia 1 trainer + 1 aluno
-- BLOQUEADO (access_blocked_at setado) + 1 aluno ATIVO, simula cada usuário com
-- SET ROLE authenticated + request.jwt.claims, e verifica:
--   - aluno bloqueado NÃO lê nem escreve conteúdo pago (RLS barra);
--   - aluno ativo lê/escreve normal (não-regressão);
--   - treinador continua vendo o aluno bloqueado (coach não é afetado).
-- Tudo revertido no rollback → não deixa resíduo.
--
-- Como rodar:
--   - via Supabase MCP: execute_sql com este conteúdo; o SELECT final retorna os checks.
--   - via psql:        psql "$DATABASE_URL" -f supabase/tests/student_block_rls_test.sql
-- Esperado: TODOS os checks com result = PASS.

begin;
create temp table _res(check_name text, expected text, actual text) on commit drop;

-- ===== DDL da migration 162 (revertido no rollback) =====
create or replace function public.current_student_id_active()
 returns uuid language sql stable security definer set search_path to 'public'
as $fn$ select id from students where auth_user_id = auth.uid() and access_blocked_at is null $fn$;
grant execute on function public.current_student_id_active() to authenticated, service_role;

alter policy assigned_programs_student_select on public.assigned_programs
  using (student_id = current_student_id_active());
alter policy assigned_workouts_student_select on public.assigned_workouts
  using (assigned_program_id in (select assigned_programs.id from assigned_programs where assigned_programs.student_id = current_student_id_active()));
alter policy assigned_workout_items_student_select on public.assigned_workout_items
  using (assigned_workout_id in (select aw.id from assigned_workouts aw join assigned_programs ap on aw.assigned_program_id = ap.id where ap.student_id = current_student_id_active()));
alter policy workout_sessions_student_select on public.workout_sessions
  using (student_id = current_student_id_active());
alter policy workout_sessions_student_update on public.workout_sessions
  using (student_id = current_student_id_active());
alter policy workout_sessions_student_insert on public.workout_sessions
  with check ((student_id = current_student_id_active()) and (trainer_id = current_student_coach_id()));
alter policy set_logs_student_select on public.set_logs
  using (workout_session_id in (select workout_sessions.id from workout_sessions where workout_sessions.student_id = current_student_id_active()));
alter policy set_logs_student_update on public.set_logs
  using (workout_session_id in (select workout_sessions.id from workout_sessions where workout_sessions.student_id = current_student_id_active()));
alter policy set_logs_student_insert on public.set_logs
  with check (workout_session_id in (select workout_sessions.id from workout_sessions where workout_sessions.student_id = current_student_id_active()));

do $$
declare
  orig text := current_setting('role');
  tu uuid := gen_random_uuid(); bu uuid := gen_random_uuid(); au uuid := gen_random_uuid();
  t uuid; sb uuid; sa uuid;
  pb uuid; pa uuid; wb uuid; wa uuid; wb2 uuid; wa2 uuid; ib uuid; ia uuid; sesb uuid; sesa uuid;
  bp int; bw int; bi int; bs int; bl int; bins boolean;
  xp int; xw int; xi int; xs int; xl int; xins boolean;
  t_progs int; t_blocked_ses int;
begin
  insert into auth.users(id) values (tu),(bu),(au);
  insert into trainers(auth_user_id,name,email) values (tu,'ZZTEST T','zztest_t@zztest.local') returning id into t;
  insert into students(auth_user_id,name,email,coach_id,status,access_blocked_at)
    values (bu,'ZZTEST Blocked','zztest_b@zztest.local',t,'active', now()) returning id into sb;
  insert into students(auth_user_id,name,email,coach_id,status,access_blocked_at)
    values (au,'ZZTEST Active','zztest_a@zztest.local',t,'active', null) returning id into sa;
  insert into assigned_programs(student_id,trainer_id,name) values (sb,t,'ZZTEST Prog B') returning id into pb;
  insert into assigned_workouts(assigned_program_id,name,order_index) values (pb,'W',0) returning id into wb;
  insert into assigned_workouts(assigned_program_id,name,order_index) values (pb,'W2',1) returning id into wb2;
  insert into assigned_workout_items(assigned_workout_id,item_type,order_index) values (wb,'exercise',0) returning id into ib;
  insert into workout_sessions(student_id,trainer_id,assigned_workout_id,assigned_program_id) values (sb,t,wb,pb) returning id into sesb;
  insert into set_logs(workout_session_id,assigned_workout_item_id,set_number) values (sesb,ib,1);
  insert into assigned_programs(student_id,trainer_id,name) values (sa,t,'ZZTEST Prog A') returning id into pa;
  insert into assigned_workouts(assigned_program_id,name,order_index) values (pa,'W',0) returning id into wa;
  insert into assigned_workouts(assigned_program_id,name,order_index) values (pa,'W2',1) returning id into wa2;
  insert into assigned_workout_items(assigned_workout_id,item_type,order_index) values (wa,'exercise',0) returning id into ia;
  insert into workout_sessions(student_id,trainer_id,assigned_workout_id,assigned_program_id) values (sa,t,wa,pa) returning id into sesa;
  insert into set_logs(workout_session_id,assigned_workout_item_id,set_number) values (sesa,ia,1);

  -- ===== Aluno BLOQUEADO: não lê nada e não insere (sessao nova wb2 → so a RLS barra) =====
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims', json_build_object('sub',bu::text)::text, true);
  select count(*) into bp from assigned_programs where student_id=sb;
  select count(*) into bw from assigned_workouts where id=wb;
  select count(*) into bi from assigned_workout_items where id=ib;
  select count(*) into bs from workout_sessions where id=sesb;
  select count(*) into bl from set_logs where workout_session_id=sesb;
  begin insert into workout_sessions(student_id,trainer_id,assigned_workout_id,assigned_program_id) values (sb,t,wb2,pb); bins:=true;
  exception when others then bins:=false; end;
  perform set_config('role',orig,true);

  -- ===== Aluno ATIVO: lê o próprio e insere (não-regressão; sessao nova wa2) =====
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims', json_build_object('sub',au::text)::text, true);
  select count(*) into xp from assigned_programs where student_id=sa;
  select count(*) into xw from assigned_workouts where id=wa;
  select count(*) into xi from assigned_workout_items where id=ia;
  select count(*) into xs from workout_sessions where id=sesa;
  select count(*) into xl from set_logs where workout_session_id=sesa;
  begin insert into workout_sessions(student_id,trainer_id,assigned_workout_id,assigned_program_id) values (sa,t,wa2,pa); xins:=true;
  exception when others then xins:=false; end;
  perform set_config('role',orig,true);

  -- ===== Treinador: vê os 2 alunos E a sessao do aluno bloqueado (não é afetado) =====
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims', json_build_object('sub',tu::text)::text, true);
  select count(*) into t_progs from assigned_programs where trainer_id=t and name like 'ZZTEST Prog%';
  select count(*) into t_blocked_ses from workout_sessions where student_id=sb;
  perform set_config('role',orig,true);

  insert into _res values
   ('BLOCKED le proprio programa','0',bp::text),
   ('BLOCKED le proprio workout','0',bw::text),
   ('BLOCKED le proprio item','0',bi::text),
   ('BLOCKED le propria sessao','0',bs::text),
   ('BLOCKED le proprio set_log','0',bl::text),
   ('BLOCKED NAO insere sessao (RLS)','false',bins::text),
   ('ACTIVE le proprio programa','1',xp::text),
   ('ACTIVE le proprio workout','1',xw::text),
   ('ACTIVE le proprio item','1',xi::text),
   ('ACTIVE le propria sessao','1',xs::text),
   ('ACTIVE le proprio set_log','1',xl::text),
   ('ACTIVE insere sessao [NAO-REGRESSAO]','true',xins::text),
   ('TRAINER ve programas dos 2 alunos','2',t_progs::text),
   ('TRAINER ve sessao do aluno BLOQUEADO','1',t_blocked_ses::text);
end$$;

select check_name, expected, actual, case when expected=actual then 'PASS' else '*** FAIL ***' end as result
from _res order by check_name;
rollback;
