-- 176_student_self_update_rpcs
--
-- M3: a tabela `students` só tinha policies de SELECT (aluno) e ALL (treinador) —
-- NÃO havia policy de UPDATE para o aluno. Então o app salvando preferências de
-- notificação (app/profile/notifications.tsx) e e-mail pós-verificação
-- (app/(auth)/verify-email.tsx) afetava 0 linhas SEM erro (PostgREST não acusa
-- UPDATE bloqueado por RLS) — as preferências aparentavam salvar mas não.
--
-- Em vez de uma policy de UPDATE ampla (risco de escalonamento por coluna: o
-- aluno poderia escrever trainer_id/coach_id/access_blocked_at/stripe_*), usamos
-- RPCs SECURITY DEFINER que atualizam SOMENTE a coluna-alvo da PRÓPRIA linha
-- (auth_user_id = auth.uid()).

create or replace function public.update_student_notification_preferences(p_prefs jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
    update public.students
       set notification_preferences = p_prefs
     where auth_user_id = auth.uid();
end;
$$;

create or replace function public.update_student_self_email(p_email text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
    update public.students
       set email = p_email
     where auth_user_id = auth.uid();
end;
$$;

-- Só usuários autenticados (nunca anon) — consistente com a migration 173.
revoke all on function public.update_student_notification_preferences(jsonb) from public;
revoke all on function public.update_student_self_email(text) from public;
grant execute on function public.update_student_notification_preferences(jsonb) to authenticated;
grant execute on function public.update_student_self_email(text) to authenticated;
