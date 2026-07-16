-- ============================================================================
-- 263: Estúdios — biblioteca de exercícios compartilhada + notificações
-- ============================================================================
-- Decisões Gustavo 16/jul:
--
-- (4) "Todos os exercícios do estúdio ficam liberados para os treinadores e
--     alunos do estúdio" → policies ADITIVAS de SELECT em exercises e
--     trainer_exercise_videos: treinador vê os exercícios/vídeos de COLEGAS
--     ativos do mesmo estúdio; aluno de estúdio vê os de QUALQUER treinador
--     ativo do estúdio (fecha o gap do vídeo custom de coach não-responsável
--     no app do aluno). Escrita continua owner-only. Solo/particular intocados
--     (sem org → policies não casam).
--
-- (3) "Gestor vê tudo; treinador recebe dos alunos vinculados a ele" →
--     notify_trainer_workout_completed e notify_trainer_form_submitted passam
--     a notificar o RESPONSÁVEL (students.coach_id) + os GESTORES do estúdio
--     (owner/admin ativos), com dedup. form_submitted antes ia para o
--     REMETENTE do form (trainer_id da submission) — divergia do treino.
--     Aluno solo/particular: só o responsável (org null → sem gestores).
--     Mensagens continuam notificando só o responsável (conversa é pessoal).
-- ============================================================================

-- Helper: p_trainer e o ator são membros ATIVOS do mesmo estúdio.
create or replace function public.is_org_colleague(p_trainer uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
    select exists (
        select 1
        from organization_members me
        join organization_members them on them.organization_id = me.organization_id
        where me.trainer_id = public.current_trainer_id()
          and me.status = 'active'
          and them.trainer_id = p_trainer
          and them.status = 'active'
    )
$$;
revoke execute on function public.is_org_colleague(uuid) from anon, public;
grant execute on function public.is_org_colleague(uuid) to authenticated, service_role;

-- 1) Treinador vê exercícios custom dos colegas do estúdio.
drop policy if exists exercises_org_select on public.exercises;
create policy exercises_org_select on public.exercises
    for select to authenticated
    using (owner_id is not null and public.is_org_colleague(owner_id));

-- 2) Aluno de estúdio vê exercícios de qualquer treinador ativo do estúdio.
--    Helper SECURITY DEFINER obrigatório: a subquery em organization_members
--    dentro da policy rodaria sob o RLS do ALUNO (que não lê membros) e
--    voltaria vazia.
create or replace function public.student_org_trainer_ids()
returns setof uuid
language sql
stable security definer
set search_path to 'public'
as $$
    select om.trainer_id
    from students st
    join organization_members om on om.organization_id = st.organization_id
    where st.auth_user_id = (select auth.uid())
      and om.status = 'active'
$$;
revoke execute on function public.student_org_trainer_ids() from anon, public;
grant execute on function public.student_org_trainer_ids() to authenticated, service_role;

drop policy if exists exercises_org_student_select on public.exercises;
create policy exercises_org_student_select on public.exercises
    for select to authenticated
    using (
        owner_id is not null
        and owner_id in (select public.student_org_trainer_ids())
    );

-- 3) Vídeos custom: mesmos dois eixos.
drop policy if exists trainer_exercise_videos_org_select on public.trainer_exercise_videos;
create policy trainer_exercise_videos_org_select on public.trainer_exercise_videos
    for select to authenticated
    using (public.is_org_colleague(trainer_id));

drop policy if exists trainer_exercise_videos_org_student_select on public.trainer_exercise_videos;
create policy trainer_exercise_videos_org_student_select on public.trainer_exercise_videos
    for select to authenticated
    using (trainer_id in (select public.student_org_trainer_ids()));

-- 4) Notificações: responsável + gestores do estúdio (dedup por UNION).
CREATE OR REPLACE FUNCTION notify_trainer_workout_completed() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status != 'completed') THEN
        INSERT INTO trainer_notifications (trainer_id, type, title, body, data, category)
        SELECT
            rec.trainer_id,
            'workout_completed',
            s.name || ' completou treino',
            s.name || ' completou ' || COALESCE(aw.name, 'treino'),
            jsonb_build_object(
                'student_id', NEW.student_id,
                'session_id', NEW.id,
                'workout_name', aw.name
            ),
            'students'
        FROM students s
        LEFT JOIN assigned_workouts aw ON aw.id = NEW.assigned_workout_id
        CROSS JOIN LATERAL (
            SELECT s.coach_id AS trainer_id
            UNION
            SELECT om.trainer_id
            FROM organization_members om
            WHERE s.organization_id IS NOT NULL
              AND om.organization_id = s.organization_id
              AND om.status = 'active'
              AND om.role IN ('owner', 'admin')
        ) rec
        WHERE s.id = NEW.student_id
          AND rec.trainer_id IS NOT NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION notify_trainer_form_submitted() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'submitted' THEN
        INSERT INTO trainer_notifications (trainer_id, type, title, body, data, category)
        SELECT
            rec.trainer_id,
            'form_submitted',
            s.name || ' respondeu formulário',
            s.name || ' respondeu ' || COALESCE(ft.title, 'formulário'),
            jsonb_build_object(
                'student_id', NEW.student_id,
                'submission_id', NEW.id,
                'form_title', ft.title
            ),
            'forms'
        FROM students s
        LEFT JOIN form_templates ft ON ft.id = NEW.form_template_id
        CROSS JOIN LATERAL (
            SELECT s.coach_id AS trainer_id
            UNION
            SELECT om.trainer_id
            FROM organization_members om
            WHERE s.organization_id IS NOT NULL
              AND om.organization_id = s.organization_id
              AND om.status = 'active'
              AND om.role IN ('owner', 'admin')
        ) rec
        WHERE s.id = NEW.student_id
          AND rec.trainer_id IS NOT NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
