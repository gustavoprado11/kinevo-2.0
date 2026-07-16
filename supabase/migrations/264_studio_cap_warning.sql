-- ============================================================================
-- 264: Estúdios — aviso proativo ao gestor no limiar da faixa
-- ============================================================================
-- Decisão 16/jul: o gestor deve ser avisado quando o estúdio se aproxima do
-- cap (80% da faixa) e quando o atinge — sem depender de abrir o painel.
-- Trigger em students (e não app) porque aluno entra na org por 4 caminhos:
-- criação web/edge fn/MCP (INSERT com org via trigger derive) e classificação
-- da carteira (UPDATE setando organization_id). Dispara EXATAMENTE no
-- cruzamento (count == ceil(80%) ou == limite) → 1 aviso por travessia.
-- Org sem plan_tier (manual/comp) = sem limite → sem aviso.
-- ============================================================================

create or replace function public.notify_studio_cap_threshold()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
    v_plan text;
    v_limit int;
    v_count int;
    v_threshold int;
begin
    if new.organization_id is null or coalesce(new.is_trainer_profile, false) then
        return new;
    end if;
    -- só quando a linha ENTROU na org agora (insert já com org, ou update que setou)
    if tg_op = 'UPDATE' and old.organization_id is not distinct from new.organization_id then
        return new;
    end if;

    select plan_tier into v_plan from organizations where id = new.organization_id;
    v_limit := case v_plan
        when 'studio_50' then 50
        when 'studio_100' then 100
        when 'studio_200' then 200
        else null  -- custom/manual = ilimitado
    end;
    if v_limit is null then return new; end if;

    select count(*) into v_count
    from students
    where organization_id = new.organization_id
      and is_trainer_profile is not true;

    v_threshold := ceil(v_limit * 0.8);
    if v_count = v_threshold or v_count = v_limit then
        insert into trainer_notifications (trainer_id, type, title, body, data, category)
        select om.trainer_id,
               'studio_cap_warning',
               case when v_count = v_limit then 'Estúdio no limite da faixa' else 'Estúdio perto do limite da faixa' end,
               'O estúdio está com ' || v_count || ' de ' || v_limit || ' alunos. ' ||
               case when v_count = v_limit
                    then 'Novos alunos serão bloqueados — faça upgrade em Estúdio → Plano.'
                    else 'Considere a próxima faixa em Estúdio → Plano.' end,
               jsonb_build_object('organization_id', new.organization_id, 'count', v_count, 'limit', v_limit),
               'billing'
        from organization_members om
        where om.organization_id = new.organization_id
          and om.status = 'active'
          and om.role in ('owner', 'admin');
    end if;

    return new;
end;
$$;

drop trigger if exists trg_students_studio_cap on public.students;
create trigger trg_students_studio_cap
    after insert or update of organization_id on public.students
    for each row execute function public.notify_studio_cap_threshold();
