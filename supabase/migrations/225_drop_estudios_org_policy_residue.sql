-- 225 — Aposenta o plano de policies org-scoped da feature "Estúdios"
-- (abandonada). Essas policies PERMISSIVE são OR'd com as policies base
-- por-treinador e formam um caminho cross-tenant: um membro de organização lê
-- (e, se gestor / org 'open', escreve) dados de OUTRO membro. Como a feature foi
-- descontinuada e a única org existente é a "Academia Teste Kinevo" (interna),
-- removemos o plano inteiro.
--
-- SEGURANÇA DA MUDANÇA (verificado ao vivo antes de aplicar):
--   • Toda tabela afetada mantém 4–8 policies base (coach_id/trainer_id =
--     current_trainer_id()), cobrindo SELECT/INSERT/UPDATE/DELETE → NÃO vira
--     deny-all.
--   • can_write_student/can_read_student (que embutem a lógica org) só eram
--     referenciadas por estas policies _org_ → após o DROP ficam inertes.
--   • Não tocamos em organizations/organization_members/appointment_groups
--     (tabelas próprias do recurso) nem nos helpers is_org_member/is_org_manager.
--   • Para um treinador SOLO (sem org) estas policies nunca concediam nada
--     (is_org_member = false), então nenhum acesso legítimo é reduzido.

DROP POLICY IF EXISTS appointment_exceptions_org_read      ON public.appointment_exceptions;
DROP POLICY IF EXISTS appointment_exceptions_org_write     ON public.appointment_exceptions;
DROP POLICY IF EXISTS assigned_programs_org_read           ON public.assigned_programs;
DROP POLICY IF EXISTS assigned_programs_org_write          ON public.assigned_programs;
DROP POLICY IF EXISTS assigned_workout_item_sets_org_read  ON public.assigned_workout_item_sets;
DROP POLICY IF EXISTS assigned_workout_item_sets_org_write ON public.assigned_workout_item_sets;
DROP POLICY IF EXISTS assigned_workout_items_org_read      ON public.assigned_workout_items;
DROP POLICY IF EXISTS assigned_workout_items_org_write     ON public.assigned_workout_items;
DROP POLICY IF EXISTS assigned_workouts_org_read           ON public.assigned_workouts;
DROP POLICY IF EXISTS assigned_workouts_org_write          ON public.assigned_workouts;
DROP POLICY IF EXISTS exercises_org_read                   ON public.exercises;
DROP POLICY IF EXISTS exercises_org_write                  ON public.exercises;
DROP POLICY IF EXISTS messages_org_insert                  ON public.messages;
DROP POLICY IF EXISTS messages_org_read                    ON public.messages;
DROP POLICY IF EXISTS messages_org_update                  ON public.messages;
DROP POLICY IF EXISTS program_templates_org_read           ON public.program_templates;
DROP POLICY IF EXISTS program_templates_org_write          ON public.program_templates;
DROP POLICY IF EXISTS recurring_appointments_org_read      ON public.recurring_appointments;
DROP POLICY IF EXISTS recurring_appointments_org_write     ON public.recurring_appointments;
DROP POLICY IF EXISTS set_logs_org_read                    ON public.set_logs;
DROP POLICY IF EXISTS students_org_read                    ON public.students;
DROP POLICY IF EXISTS students_org_update                  ON public.students;
DROP POLICY IF EXISTS trainers_org_read                    ON public.trainers;
DROP POLICY IF EXISTS workout_item_templates_org_read      ON public.workout_item_templates;
DROP POLICY IF EXISTS workout_item_templates_org_write     ON public.workout_item_templates;
DROP POLICY IF EXISTS workout_sessions_org_read            ON public.workout_sessions;
DROP POLICY IF EXISTS workout_templates_org_read           ON public.workout_templates;
DROP POLICY IF EXISTS workout_templates_org_write          ON public.workout_templates;
