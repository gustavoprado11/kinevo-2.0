-- ============================================================================
-- 261: Estúdios — alunos PARTICULARES do coach (carteira pessoal)
-- ============================================================================
-- Decisão Gustavo 16/jul: coach de estúdio pode atender alunos próprios na
-- MESMA conta, desde que tenha plano solo PAGO (qualquer pago; sem trial; o
-- Gratuito não vale para coach de estúdio — o gate roda no app, em
-- assertCanCreateStudent / MCP / edge fn create-student).
--
-- Mecânica: students.is_private = true → o aluno NÃO herda organization_id
-- (fica fora do estúdio: invisível aos colegas e ao gestor, fora do cap da
-- faixa — as policies org e os RPCs 259/260 já exigem organization_id not
-- null, então a exclusão é automática). Para treinador solo o flag é inócuo
-- (o derive já não acha org).
--
-- is_private é coluna de POSSE: imutável via PostgREST (mesmo guard de
-- coach_id/organization_id) — mover aluno estúdio↔particular mexe em billing
-- e visibilidade, então só via action dedicada (service_role), quando existir.
-- ============================================================================

alter table public.students
    add column if not exists is_private boolean not null default false;

-- 1) Derive: aluno particular NÃO nasce na org.
create or replace function public.students_derive_org_id()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
    if new.organization_id is null
       and new.coach_id is not null
       and coalesce(new.is_private, false) = false then
        select om.organization_id into new.organization_id
        from organization_members om
        where om.trainer_id = new.coach_id
          and om.status = 'active'
        limit 1;
    end if;
    return new;
end;
$$;

-- 2) Guard: is_private imutável para authenticated (junto de coach_id/org_id).
create or replace function public.guard_student_ownership_columns()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
    if auth.role() = 'service_role' then
        return new;
    end if;
    if new.coach_id is distinct from old.coach_id then
        raise exception 'coach_id é imutável por esta via (use a reatribuição do estúdio)';
    end if;
    if new.organization_id is distinct from old.organization_id then
        raise exception 'organization_id é imutável por esta via';
    end if;
    if new.is_private is distinct from old.is_private then
        raise exception 'is_private é imutável por esta via';
    end if;
    return new;
end;
$$;

-- 3) Lista do mobile devolve is_private (badge "Particular"). Patch in-place da
--    definição viva (mesma técnica da 260): injeta a coluna no SELECT sem
--    reproduzir o corpo — falha alto se o texto âncora tiver driftado.
DO $patch$
DECLARE
    v_def text;
BEGIN
    v_def := pg_get_functiondef('public.get_trainer_students_list()'::regprocedure);
    IF position('s.is_trainer_profile,' in v_def) = 0 THEN
        RAISE EXCEPTION 'get_trainer_students_list: âncora s.is_trainer_profile não encontrada — revisar manualmente';
    END IF;
    IF position('s.is_private' in v_def) > 0 THEN
        RETURN; -- já aplicado (idempotente)
    END IF;
    EXECUTE replace(v_def, 's.is_trainer_profile,', 's.is_trainer_profile,
               s.is_private,');
END $patch$;
