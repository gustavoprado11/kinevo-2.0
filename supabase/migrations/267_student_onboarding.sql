-- 267 — Onboarding do aluno no mobile (boas-vindas no primeiro login +
-- hint de primeiro treino). Backward-compatible: só adições.
--
-- Contexto: o aluno tem apenas SELECT no próprio registro de students
-- (students_self_select, migration 001) — não há self-UPDATE. A escrita do
-- estado de onboarding sai por RPC SECURITY DEFINER com allowlist de chaves,
-- no mesmo padrão de log_product_event (migration 266). Leitura continua
-- pela coluna, coberta pela policy de SELECT existente.

alter table students
    add column if not exists onboarding_state jsonb not null default '{}'::jsonb;

-- Marca uma etapa de onboarding do aluno logado. Nunca lança (onboarding
-- jamais quebra fluxo de produto). Atualiza TODAS as linhas do auth_user_id:
-- o welcome é da pessoa, não do vínculo com um coach específico.
create or replace function mark_student_onboarding(p_key text)
returns void
language plpgsql security definer set search_path = public as $$
begin
    if auth.uid() is null then return; end if;
    if p_key not in ('welcome_seen', 'first_workout_hint_seen') then return; end if;

    update students
    set onboarding_state = coalesce(onboarding_state, '{}'::jsonb)
            || jsonb_build_object(p_key, true, p_key || '_at', now()),
        updated_at = now()
    where auth_user_id = auth.uid();
exception when others then
    return;
end $$;

revoke all on function mark_student_onboarding(text) from public, anon;
grant execute on function mark_student_onboarding(text) to authenticated;

-- Backfill: aluno que já concluiu treino conhece o app — boas-vindas de novato
-- para ele seria ruído. Marca welcome_seen (e o hint de primeiro treino, pelo
-- mesmo motivo) para quem já tem sessão completada.
update students s
set onboarding_state = coalesce(s.onboarding_state, '{}'::jsonb)
        || '{"welcome_seen": true, "first_workout_hint_seen": true}'::jsonb
where exists (
    select 1 from workout_sessions ws
    where ws.student_id = s.id and ws.status = 'completed'
);
