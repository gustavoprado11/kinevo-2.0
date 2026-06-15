-- 200_fix_function_search_path.sql
--
-- Advisor de segurança (lint 0011_function_search_path_mutable): 8 funções em
-- public estavam com search_path mutável (proconfig=null). Todas são
-- SECURITY INVOKER (prosecdef=false) — não há escalonamento de privilégio — mas
-- vale pinar o search_path pra eliminar o WARN e tornar a resolução de objetos
-- determinística.
--
-- Escolha: SET search_path = pg_catalog, public (em vez de '').
-- Motivo: get_last_exercise_metrics / get_previous_exercise_sets / get_smart_substitutes
-- referenciam tabelas de public (workout_sessions, set_logs, exercises,
-- exercise_muscle_groups) E funções de extensão (unaccent, similarity) que vivem
-- no schema public — todas sem qualificação. Pinar em 'pg_catalog, public'
-- preserva o comportamento atual sem reescrever nenhum corpo de função.
-- ALTER FUNCTION ... SET search_path não altera o corpo: zero mudança de lógica.

ALTER FUNCTION public.calculate_session_duration()                 SET search_path = pg_catalog, public;
ALTER FUNCTION public.get_last_exercise_metrics(uuid, uuid)        SET search_path = pg_catalog, public;
ALTER FUNCTION public.get_previous_exercise_sets(uuid, uuid)       SET search_path = pg_catalog, public;
ALTER FUNCTION public.get_smart_substitutes(uuid, integer)         SET search_path = pg_catalog, public;
ALTER FUNCTION public.guard_wearable_source_priority()             SET search_path = pg_catalog, public;
ALTER FUNCTION public.trg_trainer_financial_settings_updated_at()  SET search_path = pg_catalog, public;
ALTER FUNCTION public.update_updated_at()                          SET search_path = pg_catalog, public;
ALTER FUNCTION public.wearable_source_priority(text)               SET search_path = pg_catalog, public;
