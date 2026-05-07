-- ============================================================================
-- Kinevo — M1 Rollback Script
-- ============================================================================
-- Reverte tudo que foi aplicado pela migration 122_assessments_phase1.sql.
--
-- Use este script SOMENTE em emergência. Roda em ordem inversa da migration.
-- Idempotente (todos os comandos usam IF EXISTS / DROP IF EXISTS).
--
-- ⚠️ Atenção: dropar as tabelas APAGA todas as sessões e medições gravadas.
--    Se já houver dados em produção, faça backup antes.
-- ============================================================================

-- 1) RPCs (drop em ordem inversa de criação para evitar dependências)
DROP FUNCTION IF EXISTS public.finalize_assessment_session(UUID, JSONB, TEXT);
DROP FUNCTION IF EXISTS public.save_assessment_measurements(UUID, JSONB);
DROP FUNCTION IF EXISTS public.create_assessment_session(UUID, UUID, TIMESTAMPTZ, TEXT);
DROP FUNCTION IF EXISTS public.get_assessment_session(UUID);
DROP FUNCTION IF EXISTS public.get_assessment_sessions(UUID, TEXT, INT);

-- 2) Tabelas (CASCADE remove policies, indexes, triggers, FKs dependentes)
DROP TABLE IF EXISTS public.assessment_measurements CASCADE;
DROP TABLE IF EXISTS public.assessment_sessions CASCADE;

-- 3) Reverter alterações em form_templates
ALTER TABLE form_templates DROP CONSTRAINT IF EXISTS form_templates_delivery_mode_check;
ALTER TABLE form_templates DROP COLUMN IF EXISTS delivery_mode;

-- Restaurar CHECK original (sem 'assessment')
ALTER TABLE form_templates DROP CONSTRAINT IF EXISTS form_templates_category_check;
ALTER TABLE form_templates ADD CONSTRAINT form_templates_category_check
    CHECK (category IN ('anamnese', 'checkin', 'survey'));

-- ============================================================================
-- Verificação pós-rollback
-- ============================================================================
-- Rodar para conferir que o rollback foi limpo:
--
-- SELECT to_regclass('public.assessment_sessions');       -- deve retornar NULL
-- SELECT to_regclass('public.assessment_measurements');   -- deve retornar NULL
-- SELECT proname FROM pg_proc WHERE proname LIKE '%assessment%';  -- deve estar vazio
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'form_templates' AND column_name = 'delivery_mode';  -- vazio
-- SELECT pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE conname = 'form_templates_category_check';
--   -- esperado: CHECK ((category = ANY (ARRAY['anamnese'::text, 'checkin'::text, 'survey'::text])))
