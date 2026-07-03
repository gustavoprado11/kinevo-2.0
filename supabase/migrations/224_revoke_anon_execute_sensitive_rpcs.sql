-- 224 — Defense-in-depth: remove EXECUTE de `anon` em RPCs SECURITY DEFINER que
-- SÓ fazem sentido para um usuário autenticado (treinador/aluno). Todas já se
-- auto-autorizam internamente (RAISE se current_trainer_id()/current_student_id()
-- não for dono), então isto é hardening, não correção de bug explorável.
--
-- IMPORTANTE: NÃO tocamos nos helpers de RLS (current_trainer_id, is_trainer,
-- can_read_student, ...) nem em funções de trigger. Esses são avaliados DENTRO
-- das policies e removê-los de `anon` faria queries anônimas (login, página
-- pública /com/[slug]) falharem com "permission denied for function".
--
-- `authenticated` mantém o grant próprio (o REVOKE de PUBLIC não o remove).

REVOKE EXECUTE ON FUNCTION public.save_assigned_program_tree(uuid, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.activate_draft_program(uuid)          FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_student_self_email(text)                  FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_student_notification_preferences(jsonb)   FROM anon;
