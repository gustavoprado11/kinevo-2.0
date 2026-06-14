-- 191: Índices de cobertura nas 20 foreign keys sem índice (advisor 0001_unindexed_foreign_keys).
-- Sem índice na coluna da FK, DELETE/UPDATE na tabela-pai faz seq scan na filha p/ validar a
-- constraint, e joins por essas colunas ficam lentos. Tabelas de volume pequeno → CREATE INDEX
-- normal (não CONCURRENTLY, p/ rodar dentro da transação da migration).
-- Lista introspeccionada do banco em 2026-06-14 (production-runtime-loop).

CREATE INDEX IF NOT EXISTS idx_appointment_groups_coach_id ON public.appointment_groups(coach_id);
CREATE INDEX IF NOT EXISTS idx_assessment_sessions_inbox_item_id ON public.assessment_sessions(inbox_item_id);
CREATE INDEX IF NOT EXISTS idx_assessment_sessions_template_id ON public.assessment_sessions(template_id);
CREATE INDEX IF NOT EXISTS idx_assigned_programs_source_template_id ON public.assigned_programs(source_template_id);
CREATE INDEX IF NOT EXISTS idx_assigned_workout_items_source_template_id ON public.assigned_workout_items(source_template_id);
CREATE INDEX IF NOT EXISTS idx_assigned_workouts_source_template_id ON public.assigned_workouts(source_template_id);
CREATE INDEX IF NOT EXISTS idx_exercise_synergies_secondary_group_id ON public.exercise_synergies(secondary_group_id);
CREATE INDEX IF NOT EXISTS idx_feedback_coach_id ON public.feedback(coach_id);
CREATE INDEX IF NOT EXISTS idx_form_schedules_form_template_id ON public.form_schedules(form_template_id);
CREATE INDEX IF NOT EXISTS idx_mcp_oauth_codes_trainer_id ON public.mcp_oauth_codes(trainer_id);
CREATE INDEX IF NOT EXISTS idx_mcp_tool_usage_logs_api_key_id ON public.mcp_tool_usage_logs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_payouts_pix_key_id ON public.payouts(pix_key_id);
CREATE INDEX IF NOT EXISTS idx_program_form_triggers_form_template_id ON public.program_form_triggers(form_template_id);
CREATE INDEX IF NOT EXISTS idx_push_errors_push_token_id ON public.push_errors(push_token_id);
CREATE INDEX IF NOT EXISTS idx_push_tickets_push_token_id ON public.push_tickets(push_token_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_trainer_id ON public.push_tokens(trainer_id);
CREATE INDEX IF NOT EXISTS idx_recurring_appointments_appointment_group_id ON public.recurring_appointments(appointment_group_id);
CREATE INDEX IF NOT EXISTS idx_trainer_leads_converted_to_student_id ON public.trainer_leads(converted_to_student_id);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_post_workout_submission_id ON public.workout_sessions(post_workout_submission_id);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_pre_workout_submission_id ON public.workout_sessions(pre_workout_submission_id);
