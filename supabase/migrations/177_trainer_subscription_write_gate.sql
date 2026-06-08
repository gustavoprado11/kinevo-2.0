-- 177_trainer_subscription_write_gate
--
-- A1: trava de assinatura do treinador no SERVIDOR (antes era só no app/client,
-- contornável por deep link / app modificado / rotas fora de (trainer-tabs)).
--
-- Como funciona:
--   1. current_trainer_id_active() — espelha current_trainer_id(), mas só devolve
--      o id do treinador se a assinatura MAIS RECENTE estiver 'active'/'trialing'.
--      (mesmo padrão de current_student_id_active() do gate de inadimplência.)
--   2. Uma policy RESTRITIVA por tabela, SÓ para escrita (INSERT/UPDATE/DELETE),
--      que exige assinatura ativa. Policies restritivas são combinadas com AND às
--      permissivas existentes — então NÃO mexemos nas regras de propriedade atuais
--      e NÃO tocamos na LEITURA (treinador sem assinatura ainda VÊ seus dados, só
--      não consegue criar/editar/excluir). Mais seguro: se algo falhar, ele vê um
--      erro ao salvar, nunca "sumiu tudo".
--
-- Escopo: `TO authenticated`. service_role ignora RLS (webhooks Stripe/Asaas,
-- Edge Functions seguem funcionando). A condição
--   (current_trainer_id() IS NULL) OR (current_trainer_id_active() IS NOT NULL)
-- deixa NÃO-treinadores (aluno: current_trainer_id() IS NULL) passarem intactos —
-- só barra um treinador SEM assinatura ativa.
--
-- Ressalva conhecida (edge): um usuário DUAL-ROLE (é treinador E aluno) com a
-- assinatura de TREINADOR cancelada seria barrado de escrever também em tabelas
-- de treinador. Na prática alunos não escrevem nessas tabelas (as permissivas já
-- exigem posse pelo treinador), então o impacto é nulo no fluxo normal.
--
-- Reversão: dropar as policies trainer_active_gate_* e a função.

create or replace function public.current_trainer_id_active()
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $$
    select t.id
    from trainers t
    where t.auth_user_id = auth.uid()
      and (
        select s.status
        from subscriptions s
        where s.trainer_id = t.id
        order by s.created_at desc
        limit 1
      ) in ('active', 'trialing')
$$;

do $$
declare
    tbl text;
    cond constant text :=
        '((current_trainer_id() IS NULL) OR (current_trainer_id_active() IS NOT NULL))';
    tables text[] := array[
        'appointment_exceptions','appointment_groups','assessment_measurements','assessment_sessions',
        'assigned_programs','assigned_workout_item_sets','assigned_workout_items','assigned_workouts',
        'assistant_insights','concierge_requests','exercise_muscle_groups','exercises','form_schedules',
        'form_templates','google_calendar_connections','muscle_groups','pix_keys','prescription_generations',
        'program_form_triggers','program_reports','program_templates','recurring_appointments',
        'student_contracts','student_inbox_items','student_prescription_profiles','students',
        'trainer_api_keys','trainer_exercise_videos','trainer_leads','trainer_notifications',
        'trainer_payment_accounts','trainer_plans','training_method_presets','workout_item_set_templates',
        'workout_item_templates','workout_templates'
    ];
begin
    foreach tbl in array tables loop
        execute format('drop policy if exists %I on public.%I', 'trainer_active_gate_ins', tbl);
        execute format('drop policy if exists %I on public.%I', 'trainer_active_gate_upd', tbl);
        execute format('drop policy if exists %I on public.%I', 'trainer_active_gate_del', tbl);

        execute format(
            'create policy %I on public.%I as restrictive for insert to authenticated with check %s',
            'trainer_active_gate_ins', tbl, cond);
        execute format(
            'create policy %I on public.%I as restrictive for update to authenticated using %s with check %s',
            'trainer_active_gate_upd', tbl, cond, cond);
        execute format(
            'create policy %I on public.%I as restrictive for delete to authenticated using %s',
            'trainer_active_gate_del', tbl, cond);
    end loop;
end $$;
