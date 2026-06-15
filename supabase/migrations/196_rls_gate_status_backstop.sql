-- 196: Backstop de RLS para alunos desativados pelo treinador.
--
-- Achado pelo mobile-loop (REPORT-MOBILE-2026-06-14): `current_student_id_active()`
-- — usada nas policies de conteúdo pago (assigned_programs/workouts/items,
-- workout_sessions, set_logs) — só negava quando `access_blocked_at IS NOT NULL`.
-- A função canônica `check_student_access` nega também `status IN
-- ('blocked','archived','inactive')` (passo 2). Sem isso na RLS, um aluno
-- desativado pelo treinador (mas sem access_blocked_at setado) ainda lia/gravava
-- treino via deep-link/Watch, contornando o gate (que no app só existe no client).
--
-- Fix mínimo: adicionar a exclusão de status (espelha o passo 2 de
-- check_student_access). NÃO mexe na lógica de contrato/Stripe (grace_period,
-- courtesy, past_due_allowed seguem por access_blocked_at/cron, como antes).
-- Seguro: hoje todos os alunos têm status='active' → ninguém perde acesso.

CREATE OR REPLACE FUNCTION public.current_student_id_active()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT id FROM students
    WHERE auth_user_id = auth.uid()
      AND access_blocked_at IS NULL
      AND status NOT IN ('blocked', 'archived', 'inactive')
$function$;
