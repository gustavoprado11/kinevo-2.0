-- ============================================================================
-- Kinevo — 124 form_templates: categoria 'feedback' (Feedback do programa)
-- ============================================================================
-- M16 introduz 4 cards de tipo no Step 1 do Form Builder:
-- Anamnese, Check-in, Pesquisa, Feedback do programa.
-- A categoria 'feedback' não existia no CHECK constraint — adicionada aqui.
--
-- Backward-compat: rows existentes (anamnese, checkin, survey, assessment)
-- continuam válidos. Apenas amplia o universo de valores aceitos.
-- ============================================================================

ALTER TABLE form_templates DROP CONSTRAINT IF EXISTS form_templates_category_check;
ALTER TABLE form_templates ADD CONSTRAINT form_templates_category_check
    CHECK (category IN ('anamnese', 'checkin', 'survey', 'assessment', 'feedback'));
