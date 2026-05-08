-- ============================================================================
-- Kinevo — 123 Assessment seed templates (M6)
-- ============================================================================
-- Insere 5 templates de sistema (trainer_id IS NULL) para o módulo de
-- Avaliações Presenciais. Resolve o atrito de M4: trainer abria a aba
-- "Avaliações Presenciais" e precisava criar template do zero antes de
-- iniciar uma sessão.
--
-- Templates:
--   1. assessment_anthropometry_basic   — Antropometria mínima (5 min)
--   2. assessment_jackson_pollock_3     — J&P 3 dobras (10 min)
--   3. assessment_jackson_pollock_7     — J&P 7 dobras (15 min)
--   4. assessment_petroski_4            — Petroski 4 dobras BR (10 min)
--   5. assessment_initial_complete      — Avaliação Inicial Presencial (15 min)
--
-- Pattern: igual a 066_system_form_templates.sql.
--   - trainer_id = NULL  (system, visível a todos os trainers)
--   - category = 'assessment'
--   - delivery_mode = 'trainer_in_person'
--   - created_source = 'system'
--   - is_active = true
--   - is_default_for_new_students = false  (não auto-atribui)
--   - schema segue AssessmentTemplateSchema (shared/types/assessments.ts):
--       sections[].tests[] com tipos numeric_unit / protocol / computed
--
-- Idempotência: ON CONFLICT (system_key) DO NOTHING.
-- Não cria RLS — coberto por policies existentes em form_templates (template
-- com trainer_id IS NULL é visível a qualquer trainer autenticado, conforme
-- migration 102_security_hardening_ownership.sql).
-- ============================================================================

-- ============================================================================
-- 1) Antropometria mínima — assessment_anthropometry_basic
-- ============================================================================
INSERT INTO form_templates (
    trainer_id,
    title,
    description,
    category,
    system_key,
    delivery_mode,
    schema_json,
    is_active,
    is_default_for_new_students,
    created_source
)
VALUES (
    NULL,
    'Antropometria mínima',
    'Avaliação rápida de medidas corporais básicas: peso, estatura, circunferências de cintura e quadril, com cálculo automático de IMC e relação cintura-quadril (RCQ).',
    'assessment',
    'assessment_anthropometry_basic',
    'trainer_in_person',
    $anthro${
  "schema_version": "1.0",
  "layout": { "estimated_minutes": 5 },
  "sections": [
    {
      "id": "antropometria",
      "title": "Antropometria",
      "tests": [
        { "id": "weight", "type": "numeric_unit", "label": "Peso", "metric_key": "weight_kg", "unit": "kg", "required": true, "min": 30, "max": 250 },
        { "id": "height", "type": "numeric_unit", "label": "Estatura", "metric_key": "height_m", "unit": "m", "required": true, "min": 1.0, "max": 2.5, "hint": "Em metros — ex: 1,78" }
      ]
    },
    {
      "id": "circunferencias",
      "title": "Circunferências",
      "tests": [
        { "id": "waist", "type": "numeric_unit", "label": "Cintura", "metric_key": "waist_cm", "unit": "cm", "required": true, "min": 50, "max": 200 },
        { "id": "hip", "type": "numeric_unit", "label": "Quadril", "metric_key": "hip_cm", "unit": "cm", "required": true, "min": 60, "max": 220 }
      ]
    },
    {
      "id": "calculados",
      "title": "Calculados",
      "tests": [
        { "id": "bmi", "type": "computed", "label": "IMC", "metric_key": "bmi", "formula_id": "bmi", "inputs": ["weight_kg", "height_m"] },
        { "id": "rcq", "type": "computed", "label": "RCQ", "metric_key": "rcq", "formula_id": "rcq", "inputs": ["waist_cm", "hip_cm"] }
      ]
    }
  ]
}$anthro$::jsonb,
    true,
    false,
    'system'
)
ON CONFLICT (system_key) DO NOTHING;

-- ============================================================================
-- 2) Jackson & Pollock — 3 dobras
-- ============================================================================
INSERT INTO form_templates (
    trainer_id,
    title,
    description,
    category,
    system_key,
    delivery_mode,
    schema_json,
    is_active,
    is_default_for_new_students,
    created_source
)
VALUES (
    NULL,
    'Composição corporal — Jackson & Pollock 3 dobras',
    'Avaliação de composição corporal com o protocolo de 3 dobras de Jackson & Pollock. Sites variam por sexo (homens: peitoral/abdominal/coxa; mulheres: tríceps/supra-ilíaca/coxa). Inclui antropometria base e cálculo de IMC.',
    'assessment',
    'assessment_jackson_pollock_3',
    'trainer_in_person',
    $jp3${
  "schema_version": "1.0",
  "layout": { "estimated_minutes": 10 },
  "sections": [
    {
      "id": "antropometria",
      "title": "Antropometria",
      "tests": [
        { "id": "weight", "type": "numeric_unit", "label": "Peso", "metric_key": "weight_kg", "unit": "kg", "required": true, "min": 30, "max": 250 },
        { "id": "height", "type": "numeric_unit", "label": "Estatura", "metric_key": "height_m", "unit": "m", "required": true, "min": 1.0, "max": 2.5, "hint": "Em metros — ex: 1,78" }
      ]
    },
    {
      "id": "dobras",
      "title": "Dobras Cutâneas",
      "tests": [
        { "id": "skinfolds_jp3", "type": "protocol", "label": "Jackson & Pollock — 3 dobras", "protocol": "jackson_pollock_3" }
      ]
    },
    {
      "id": "calculados",
      "title": "Calculados",
      "tests": [
        { "id": "bmi", "type": "computed", "label": "IMC", "metric_key": "bmi", "formula_id": "bmi", "inputs": ["weight_kg", "height_m"] }
      ]
    }
  ]
}$jp3$::jsonb,
    true,
    false,
    'system'
)
ON CONFLICT (system_key) DO NOTHING;

-- ============================================================================
-- 3) Jackson & Pollock — 7 dobras
-- ============================================================================
INSERT INTO form_templates (
    trainer_id,
    title,
    description,
    category,
    system_key,
    delivery_mode,
    schema_json,
    is_active,
    is_default_for_new_students,
    created_source
)
VALUES (
    NULL,
    'Composição corporal — Jackson & Pollock 7 dobras',
    'Avaliação de composição corporal com o protocolo de 7 dobras de Jackson & Pollock — considerada padrão-ouro entre os protocolos clássicos. Sites idênticos para ambos os sexos. Inclui antropometria base e cálculo de IMC.',
    'assessment',
    'assessment_jackson_pollock_7',
    'trainer_in_person',
    $jp7${
  "schema_version": "1.0",
  "layout": { "estimated_minutes": 15 },
  "sections": [
    {
      "id": "antropometria",
      "title": "Antropometria",
      "tests": [
        { "id": "weight", "type": "numeric_unit", "label": "Peso", "metric_key": "weight_kg", "unit": "kg", "required": true, "min": 30, "max": 250 },
        { "id": "height", "type": "numeric_unit", "label": "Estatura", "metric_key": "height_m", "unit": "m", "required": true, "min": 1.0, "max": 2.5, "hint": "Em metros — ex: 1,78" }
      ]
    },
    {
      "id": "dobras",
      "title": "Dobras Cutâneas",
      "tests": [
        { "id": "skinfolds_jp7", "type": "protocol", "label": "Jackson & Pollock — 7 dobras", "protocol": "jackson_pollock_7" }
      ]
    },
    {
      "id": "calculados",
      "title": "Calculados",
      "tests": [
        { "id": "bmi", "type": "computed", "label": "IMC", "metric_key": "bmi", "formula_id": "bmi", "inputs": ["weight_kg", "height_m"] }
      ]
    }
  ]
}$jp7$::jsonb,
    true,
    false,
    'system'
)
ON CONFLICT (system_key) DO NOTHING;

-- ============================================================================
-- 4) Petroski — 4 dobras (validado para população brasileira)
-- ============================================================================
INSERT INTO form_templates (
    trainer_id,
    title,
    description,
    category,
    system_key,
    delivery_mode,
    schema_json,
    is_active,
    is_default_for_new_students,
    created_source
)
VALUES (
    NULL,
    'Composição corporal — Petroski 4 dobras (BR)',
    'Avaliação de composição corporal com o protocolo de Petroski — equação validada para a população adulta brasileira. Sites: subescapular, tríceps, supra-ilíaca e panturrilha. Inclui antropometria base e cálculo de IMC.',
    'assessment',
    'assessment_petroski_4',
    'trainer_in_person',
    $pet4${
  "schema_version": "1.0",
  "layout": { "estimated_minutes": 10 },
  "sections": [
    {
      "id": "antropometria",
      "title": "Antropometria",
      "tests": [
        { "id": "weight", "type": "numeric_unit", "label": "Peso", "metric_key": "weight_kg", "unit": "kg", "required": true, "min": 30, "max": 250 },
        { "id": "height", "type": "numeric_unit", "label": "Estatura", "metric_key": "height_m", "unit": "m", "required": true, "min": 1.0, "max": 2.5, "hint": "Em metros — ex: 1,78" }
      ]
    },
    {
      "id": "dobras",
      "title": "Dobras Cutâneas",
      "tests": [
        { "id": "skinfolds_petroski4", "type": "protocol", "label": "Petroski — 4 dobras", "protocol": "petroski_4" }
      ]
    },
    {
      "id": "calculados",
      "title": "Calculados",
      "tests": [
        { "id": "bmi", "type": "computed", "label": "IMC", "metric_key": "bmi", "formula_id": "bmi", "inputs": ["weight_kg", "height_m"] }
      ]
    }
  ]
}$pet4$::jsonb,
    true,
    false,
    'system'
)
ON CONFLICT (system_key) DO NOTHING;

-- ============================================================================
-- 5) Avaliação Inicial Presencial — assessment_initial_complete
-- ============================================================================
-- Versão "completa" para primeira sessão presencial. Sem anamnese textual
-- (o schema de assessment não suporta perguntas single_choice/short_text;
-- para anamnese, usar o template "Avaliação Inicial" — system_key
-- 'initial_assessment', category 'anamnese', criado em migration 065).
-- ============================================================================
INSERT INTO form_templates (
    trainer_id,
    title,
    description,
    category,
    system_key,
    delivery_mode,
    schema_json,
    is_active,
    is_default_for_new_students,
    created_source
)
VALUES (
    NULL,
    'Avaliação Inicial Presencial',
    'Sessão completa para primeira avaliação presencial: antropometria, circunferências, dobras (Petroski 4) e cálculos automáticos. Para anamnese de saúde (PAR-Q, histórico, objetivos), use o template ''Avaliação Inicial'' na aba Anamnese.',
    'assessment',
    'assessment_initial_complete',
    'trainer_in_person',
    $initial${
  "schema_version": "1.0",
  "layout": { "estimated_minutes": 15 },
  "sections": [
    {
      "id": "antropometria",
      "title": "Antropometria",
      "tests": [
        { "id": "weight", "type": "numeric_unit", "label": "Peso", "metric_key": "weight_kg", "unit": "kg", "required": true, "min": 30, "max": 250 },
        { "id": "height", "type": "numeric_unit", "label": "Estatura", "metric_key": "height_m", "unit": "m", "required": true, "min": 1.0, "max": 2.5, "hint": "Em metros — ex: 1,78" }
      ]
    },
    {
      "id": "circunferencias",
      "title": "Circunferências",
      "tests": [
        { "id": "waist", "type": "numeric_unit", "label": "Cintura", "metric_key": "waist_cm", "unit": "cm", "required": true, "min": 50, "max": 200 },
        { "id": "hip", "type": "numeric_unit", "label": "Quadril", "metric_key": "hip_cm", "unit": "cm", "required": true, "min": 60, "max": 220 }
      ]
    },
    {
      "id": "dobras",
      "title": "Dobras Cutâneas",
      "tests": [
        { "id": "skinfolds_petroski4", "type": "protocol", "label": "Petroski — 4 dobras", "protocol": "petroski_4" }
      ]
    },
    {
      "id": "calculados",
      "title": "Calculados",
      "tests": [
        { "id": "bmi", "type": "computed", "label": "IMC", "metric_key": "bmi", "formula_id": "bmi", "inputs": ["weight_kg", "height_m"] },
        { "id": "rcq", "type": "computed", "label": "RCQ", "metric_key": "rcq", "formula_id": "rcq", "inputs": ["waist_cm", "hip_cm"] }
      ]
    }
  ]
}$initial$::jsonb,
    true,
    false,
    'system'
)
ON CONFLICT (system_key) DO NOTHING;

-- ============================================================================
-- Sanity check (opcional, comentado): após apply, validar com:
--   SELECT system_key, title, jsonb_array_length(schema_json->'sections') AS n_sections
--   FROM form_templates
--   WHERE trainer_id IS NULL AND category = 'assessment'
--   ORDER BY system_key;
-- Esperado: 5 linhas, todas com n_sections >= 2.
-- ============================================================================
