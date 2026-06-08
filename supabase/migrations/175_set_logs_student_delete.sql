-- 175_set_logs_student_delete
--
-- Permite que o ALUNO apague os próprios set_logs. Necessário para:
--   • C2: desmarcar uma série (remover o registro já gravado);
--   • C4: trocar exercício com reset (limpar os set_logs órfãos do exercício
--     antigo no mesmo assigned_workout_item_id).
--
-- Antes desta policy, set_logs só tinha INSERT/SELECT/UPDATE para o aluno —
-- então qualquer DELETE do client era silenciosamente bloqueado pela RLS
-- (0 linhas, sem erro), deixando séries "removidas" ainda valendo no histórico.
--
-- Escopo idêntico ao da policy de UPDATE (set_logs_student_update): apenas
-- set_logs de sessões do próprio aluno, via current_student_id_active()
-- (mantém o gate de inadimplência consistente com insert/update).

create policy set_logs_student_delete on public.set_logs
  for delete
  using (
    workout_session_id in (
      select id
      from public.workout_sessions
      where student_id = current_student_id_active()
    )
  );
