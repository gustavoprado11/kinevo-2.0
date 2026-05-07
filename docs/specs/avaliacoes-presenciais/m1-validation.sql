-- ============================================================================
-- M1 — Roteiro de validação manual (Avaliações Presenciais)
-- ============================================================================
-- Pré-requisito: migration 122_assessments_phase1.sql já aplicada (idealmente
-- 2x para confirmar idempotência).
--
-- Como usar:
-- 1. Substitua os 4 placeholders abaixo por UUIDs reais do banco em uso.
--    Os helpers current_trainer_id() e current_student_id() resolvem o
--    chamador via auth.uid() — então é preciso simular o JWT correto antes
--    de cada bloco que muda de identidade.
--
--    {{TRAINER_AUTH_UID}}        — auth.users.id do trainer dono da sessão
--    {{STUDENT_AUTH_UID}}        — auth.users.id do student dono da sessão
--    {{OTHER_TRAINER_AUTH_UID}}  — auth.users.id de um trainer DIFERENTE
--    {{OTHER_STUDENT_AUTH_UID}}  — auth.users.id de um student DIFERENTE
--                                  (não obrigatório para os passos abaixo,
--                                   mas útil para checagens extras)
--
--    {{TRAINER_ID}}              — trainers.id (PK) do trainer dono
--    {{STUDENT_ID}}              — students.id (PK) do student do trainer dono
--
-- 2. Rode bloco por bloco e compare o output contra o "Esperado:" comentado.
-- 3. Use a sessão psql única (mesma conexão) para que SET LOCAL persista
--    dentro de uma transação. Cada STEP que muda de identidade abre uma
--    transação própria via BEGIN ... COMMIT.
--
-- Notas:
-- - Em ambientes Supabase, o helper current_trainer_id() lê auth.uid() via
--   JWT claim "sub". Rodando direto em psql, simulamos com:
--     SET LOCAL "request.jwt.claim.sub" = '<auth_user_uid>';
--     SET LOCAL "request.jwt.claims" = '{"sub":"<auth_user_uid>"}';
--     SET LOCAL ROLE authenticated;
--   (As duas variantes cobrem as diferentes versões do helper.)
--
-- - O cleanup ao final apaga apenas a sessão e o template criados pelo teste.
--   Inbox item gerado pelo finalize_assessment_session é apagado automaticamente
--   via ON DELETE SET NULL na FK; o item em si fica órfão — apague se quiser
--   limpeza total (ver STEP 8).
-- ============================================================================


-- ============================================================================
-- STEP 1 — Criar template assessment de teste (como TRAINER dono)
-- ============================================================================
-- Esperado: retorna 1 row com o id do novo template.
--           A categoria 'assessment' deve ser aceita (constraint nova).
--           delivery_mode='trainer_in_person' deve ser aceito.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '{{TRAINER_AUTH_UID}}';
SET LOCAL "request.jwt.claims" = '{"sub":"{{TRAINER_AUTH_UID}}"}';

INSERT INTO form_templates (trainer_id, title, category, delivery_mode, schema_json, is_active)
VALUES (
    '{{TRAINER_ID}}',
    'M1 Validation — Antropometria mínima',
    'assessment',
    'trainer_in_person',
    '{
        "schema_version": "1.0",
        "sections": [{
            "id": "s1",
            "title": "Antropometria",
            "tests": [{
                "id": "t1",
                "type": "numeric_unit",
                "label": "Peso",
                "metric_key": "weight",
                "unit": "kg"
            }]
        }]
    }'::jsonb,
    true
)
RETURNING id AS template_id;
COMMIT;

-- 👉 Anote o template_id retornado. Use no STEP 2 como {{TEMPLATE_ID}}.


-- ============================================================================
-- STEP 2 — create_assessment_session (como TRAINER dono)
-- ============================================================================
-- Esperado: retorna 1 row com session_id (UUID).
--           Status inicial 'in_progress' (porque scheduled_at = NULL).
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '{{TRAINER_AUTH_UID}}';
SET LOCAL "request.jwt.claims" = '{"sub":"{{TRAINER_AUTH_UID}}"}';

SELECT public.create_assessment_session(
    '{{STUDENT_ID}}'::uuid,
    '{{TEMPLATE_ID}}'::uuid,
    NULL,
    'M1 manual validation'
) AS session_id;
COMMIT;

-- 👉 Anote session_id. Use nos STEPs 3-7 como {{SESSION_ID}}.


-- ============================================================================
-- STEP 3 — save_assessment_measurements (1 medição, como TRAINER dono)
-- ============================================================================
-- Esperado: retorna integer = 1 (número de medições gravadas).
--           Status da sessão deve permanecer 'in_progress'.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '{{TRAINER_AUTH_UID}}';
SET LOCAL "request.jwt.claims" = '{"sub":"{{TRAINER_AUTH_UID}}"}';

SELECT public.save_assessment_measurements(
    '{{SESSION_ID}}'::uuid,
    '[
        {"metric_key":"weight","value_numeric":72.1,"value_unit":"kg"}
    ]'::jsonb
) AS measurements_saved;
COMMIT;


-- ============================================================================
-- STEP 4 — finalize_assessment_session (como TRAINER dono)
-- ============================================================================
-- Esperado: retorna jsonb { session_id, inbox_item_id, completed_at }.
--           assessment_sessions.status passa para 'completed'.
--           Um row aparece em student_inbox_items para o student.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '{{TRAINER_AUTH_UID}}';
SET LOCAL "request.jwt.claims" = '{"sub":"{{TRAINER_AUTH_UID}}"}';

SELECT public.finalize_assessment_session(
    '{{SESSION_ID}}'::uuid,
    '{"bmi": 23.7, "body_fat_percent": 18.2}'::jsonb,
    'finalized via M1 validation'
) AS finalize_result;
COMMIT;


-- ============================================================================
-- STEP 5 — get_assessment_session (como TRAINER dono)
-- ============================================================================
-- Esperado: retorna jsonb com keys { session, student, template, measurements }.
--           measurements deve conter o weight=72.1 do STEP 3.
--           session.status = 'completed', session.computed_metrics.bmi = 23.7.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '{{TRAINER_AUTH_UID}}';
SET LOCAL "request.jwt.claims" = '{"sub":"{{TRAINER_AUTH_UID}}"}';

SELECT public.get_assessment_session('{{SESSION_ID}}'::uuid) AS detail;
COMMIT;


-- ============================================================================
-- STEP 6 — get_assessment_session (como STUDENT dono — sessão completed)
-- ============================================================================
-- Esperado: retorna o MESMO jsonb do STEP 5. Student tem read access porque
--           a sessão está 'completed' e student_id bate.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '{{STUDENT_AUTH_UID}}';
SET LOCAL "request.jwt.claims" = '{"sub":"{{STUDENT_AUTH_UID}}"}';

SELECT public.get_assessment_session('{{SESSION_ID}}'::uuid) AS detail_as_student;
COMMIT;


-- ============================================================================
-- STEP 7 — get_assessment_session (como OUTRO TRAINER) — DEVE FALHAR
-- ============================================================================
-- Esperado: ERROR — 'Session not found or access denied' (do RAISE EXCEPTION
--           no RPC). Outro trainer não tem trainer_id matching nem é student.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '{{OTHER_TRAINER_AUTH_UID}}';
SET LOCAL "request.jwt.claims" = '{"sub":"{{OTHER_TRAINER_AUTH_UID}}"}';

-- O statement abaixo deve abortar a transação com a exceção esperada.
SELECT public.get_assessment_session('{{SESSION_ID}}'::uuid) AS should_fail;
ROLLBACK;


-- ============================================================================
-- STEP 7b (opcional) — get_assessment_session como OUTRO STUDENT — DEVE FALHAR
-- ============================================================================
-- Esperado: ERROR — 'Session not found or access denied'.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '{{OTHER_STUDENT_AUTH_UID}}';
SET LOCAL "request.jwt.claims" = '{"sub":"{{OTHER_STUDENT_AUTH_UID}}"}';

SELECT public.get_assessment_session('{{SESSION_ID}}'::uuid) AS should_fail_student;
ROLLBACK;


-- ============================================================================
-- STEP 8 — Cleanup (como SUPERUSER ou trainer dono)
-- ============================================================================
-- Apaga a sessão criada pelo teste (CASCADE remove measurements e zera FK
-- de student_inbox_items.assessment via ON DELETE SET NULL no inbox_item_id).
-- Apaga também o inbox_item gerado pelo finalize, e o template de teste.
--
-- Roda como superuser (psql direto, sem JWT) para evitar fricção com RLS.
BEGIN;

-- 1) Apaga inbox item criado pelo finalize (achado pelo payload).
DELETE FROM student_inbox_items
 WHERE payload ->> 'assessment_session_id' = '{{SESSION_ID}}';

-- 2) Apaga sessão (CASCADE apaga measurements).
DELETE FROM assessment_sessions
 WHERE id = '{{SESSION_ID}}'::uuid;

-- 3) Apaga template de teste.
DELETE FROM form_templates
 WHERE id = '{{TEMPLATE_ID}}'::uuid;

COMMIT;


-- ============================================================================
-- Verificações pós-teste (opcional)
-- ============================================================================
-- a) Confirma que o template aceita 'assessment' agora:
--    SELECT pg_get_constraintdef(oid)
--      FROM pg_constraint
--     WHERE conname = 'form_templates_category_check';
--    Esperado: CHECK (category IN ('anamnese', 'checkin', 'survey', 'assessment'))
--
-- b) Confirma a constraint de delivery_mode:
--    SELECT pg_get_constraintdef(oid)
--      FROM pg_constraint
--     WHERE conname = 'form_templates_delivery_mode_check';
--
-- c) Confirma RLS habilitado:
--    SELECT relname, relrowsecurity
--      FROM pg_class
--     WHERE relname IN ('assessment_sessions', 'assessment_measurements');
--    Esperado: relrowsecurity = true para ambas.
--
-- d) Confirma policies criadas:
--    SELECT schemaname, tablename, policyname, cmd
--      FROM pg_policies
--     WHERE tablename IN ('assessment_sessions', 'assessment_measurements')
--     ORDER BY tablename, policyname;
--    Esperado:
--      assessment_measurements_student_select | SELECT
--      assessment_measurements_trainer_all    | ALL
--      assessment_sessions_student_select     | SELECT
--      assessment_sessions_trainer_delete     | DELETE
--      assessment_sessions_trainer_insert     | INSERT
--      assessment_sessions_trainer_select     | SELECT
--      assessment_sessions_trainer_update     | UPDATE
--
-- e) Confirma GRANT EXECUTE nos RPCs:
--    SELECT routine_name, grantee, privilege_type
--      FROM information_schema.routine_privileges
--     WHERE routine_name LIKE '%assessment%'
--       AND grantee IN ('authenticated', 'PUBLIC');
--    Esperado: 5 funções, grantee=authenticated, privilege_type=EXECUTE.
--    PUBLIC deve estar AUSENTE (REVOKED).
