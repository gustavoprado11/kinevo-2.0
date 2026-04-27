-- Migration 111 — Per-set prescription (pyramid / drop-set / cluster / etc.)
--
-- Adds child tables that allow the trainer to prescribe heterogeneous sets
-- (different reps / rest / set_type per set) on top of the existing
-- aggregate columns of `workout_item_templates` and `assigned_workout_items`.
--
-- Retro-compat is absolute: existing rows are NOT touched. Readers fall back
-- to the aggregates when no child rows exist.
--
-- See spec: mobile/specs/active/prescricao-per-set-manual.md

-- ----------------------------------------------------------------------------
-- 1. workout_item_set_templates — Series prescritas por exercício (template)
-- ----------------------------------------------------------------------------
CREATE TABLE workout_item_set_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workout_item_template_id UUID NOT NULL REFERENCES workout_item_templates(id) ON DELETE CASCADE,
    set_number INTEGER NOT NULL CHECK (set_number >= 1),
    set_type TEXT NOT NULL CHECK (set_type IN (
        'warmup', 'normal', 'top', 'backoff', 'drop', 'failure', 'cluster', 'amrap'
    )),
    reps TEXT NOT NULL,
    rest_seconds INTEGER NOT NULL DEFAULT 0 CHECK (rest_seconds >= 0),
    weight_target_kg NUMERIC,
    weight_target_pct1rm NUMERIC,
    rir INTEGER,
    tempo TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT workout_item_set_templates_unique_set_number
        UNIQUE (workout_item_template_id, set_number)
);

CREATE INDEX idx_workout_item_set_templates_item
    ON workout_item_set_templates(workout_item_template_id);
CREATE INDEX idx_workout_item_set_templates_item_order
    ON workout_item_set_templates(workout_item_template_id, set_number);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON workout_item_set_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ----------------------------------------------------------------------------
-- 2. assigned_workout_item_sets — Series prescritas (snapshot por aluno)
-- ----------------------------------------------------------------------------
CREATE TABLE assigned_workout_item_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assigned_workout_item_id UUID NOT NULL REFERENCES assigned_workout_items(id) ON DELETE CASCADE,
    set_number INTEGER NOT NULL CHECK (set_number >= 1),
    set_type TEXT NOT NULL CHECK (set_type IN (
        'warmup', 'normal', 'top', 'backoff', 'drop', 'failure', 'cluster', 'amrap'
    )),
    reps TEXT NOT NULL,
    rest_seconds INTEGER NOT NULL DEFAULT 0 CHECK (rest_seconds >= 0),
    weight_target_kg NUMERIC,
    weight_target_pct1rm NUMERIC,
    rir INTEGER,
    tempo TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT assigned_workout_item_sets_unique_set_number
        UNIQUE (assigned_workout_item_id, set_number)
);

CREATE INDEX idx_assigned_workout_item_sets_item
    ON assigned_workout_item_sets(assigned_workout_item_id);
CREATE INDEX idx_assigned_workout_item_sets_item_order
    ON assigned_workout_item_sets(assigned_workout_item_id, set_number);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON assigned_workout_item_sets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ----------------------------------------------------------------------------
-- 3. method_key — Marca o método/preset usado nos itens pais
-- ----------------------------------------------------------------------------
-- Nullable. Valores válidos: 'standard', 'custom', 'pyramid_down',
-- 'pyramid_up', 'drop_set', 'top_backoff', '5x5', 'cluster'.
-- Sem CHECK constraint — drift entre TS e DB é tratado na UI (chip some).
ALTER TABLE workout_item_templates
    ADD COLUMN IF NOT EXISTS method_key TEXT;

ALTER TABLE assigned_workout_items
    ADD COLUMN IF NOT EXISTS method_key TEXT;

-- ----------------------------------------------------------------------------
-- 4. training_method_presets — Catálogo de presets (sistema + por trainer)
-- ----------------------------------------------------------------------------
CREATE TABLE training_method_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- NULL = preset de sistema (visível a todos os trainers).
    trainer_id UUID REFERENCES trainers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    key TEXT NOT NULL,
    sets_config JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT training_method_presets_unique_key
        UNIQUE (trainer_id, key)
);

CREATE INDEX idx_training_method_presets_trainer
    ON training_method_presets(trainer_id);
CREATE INDEX idx_training_method_presets_system
    ON training_method_presets(key) WHERE trainer_id IS NULL;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON training_method_presets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ----------------------------------------------------------------------------
-- 5. RLS
-- ----------------------------------------------------------------------------
ALTER TABLE workout_item_set_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE assigned_workout_item_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_method_presets ENABLE ROW LEVEL SECURITY;

-- workout_item_set_templates: trainer-only (via cadeia de templates)
CREATE POLICY workout_item_set_templates_trainer_all ON workout_item_set_templates
    FOR ALL USING (
        workout_item_template_id IN (
            SELECT wit.id FROM workout_item_templates wit
            JOIN workout_templates wt ON wit.workout_template_id = wt.id
            JOIN program_templates pt ON wt.program_template_id = pt.id
            WHERE pt.trainer_id = current_trainer_id()
        )
    );

-- assigned_workout_item_sets: trainer ALL + student SELECT (espelha o pai)
CREATE POLICY assigned_workout_item_sets_trainer_all ON assigned_workout_item_sets
    FOR ALL USING (
        assigned_workout_item_id IN (
            SELECT awi.id FROM assigned_workout_items awi
            JOIN assigned_workouts aw ON awi.assigned_workout_id = aw.id
            JOIN assigned_programs ap ON aw.assigned_program_id = ap.id
            WHERE ap.trainer_id = current_trainer_id()
        )
    );

CREATE POLICY assigned_workout_item_sets_student_select ON assigned_workout_item_sets
    FOR SELECT USING (
        assigned_workout_item_id IN (
            SELECT awi.id FROM assigned_workout_items awi
            JOIN assigned_workouts aw ON awi.assigned_workout_id = aw.id
            JOIN assigned_programs ap ON aw.assigned_program_id = ap.id
            WHERE ap.student_id = current_student_id()
        )
    );

-- training_method_presets:
--   - SELECT público (a qualquer trainer autenticado) para presets de sistema.
--   - CRUD próprio para presets do trainer.
CREATE POLICY training_method_presets_system_select ON training_method_presets
    FOR SELECT USING (trainer_id IS NULL);

CREATE POLICY training_method_presets_trainer_all ON training_method_presets
    FOR ALL USING (trainer_id = current_trainer_id())
    WITH CHECK (trainer_id = current_trainer_id());

-- ----------------------------------------------------------------------------
-- 6. Seed dos 6 presets de sistema
-- ----------------------------------------------------------------------------
-- Os JSONs precisam bater com `SYSTEM_PRESETS[key].defaultSetsConfig` em
-- shared/lib/prescription/set-scheme-presets.ts.
INSERT INTO training_method_presets (trainer_id, name, key, description, sets_config) VALUES
(NULL, 'Pirâmide ↓', 'pyramid_down',
 'Reps decrescentes com descanso crescente (12-10-8-6).',
 '[
   {"set_number":1,"set_type":"normal","reps":"12","rest_seconds":90,"weight_target_kg":null,"weight_target_pct1rm":null,"rir":null,"tempo":null,"notes":null},
   {"set_number":2,"set_type":"normal","reps":"10","rest_seconds":90,"weight_target_kg":null,"weight_target_pct1rm":null,"rir":null,"tempo":null,"notes":null},
   {"set_number":3,"set_type":"normal","reps":"8","rest_seconds":120,"weight_target_kg":null,"weight_target_pct1rm":null,"rir":null,"tempo":null,"notes":null},
   {"set_number":4,"set_type":"normal","reps":"6","rest_seconds":180,"weight_target_kg":null,"weight_target_pct1rm":null,"rir":null,"tempo":null,"notes":null}
 ]'::jsonb),

(NULL, 'Pirâmide ↑', 'pyramid_up',
 'Reps crescentes com descanso decrescente (6-8-10-12).',
 '[
   {"set_number":1,"set_type":"normal","reps":"6","rest_seconds":180,"weight_target_kg":null,"weight_target_pct1rm":null,"rir":null,"tempo":null,"notes":null},
   {"set_number":2,"set_type":"normal","reps":"8","rest_seconds":120,"weight_target_kg":null,"weight_target_pct1rm":null,"rir":null,"tempo":null,"notes":null},
   {"set_number":3,"set_type":"normal","reps":"10","rest_seconds":90,"weight_target_kg":null,"weight_target_pct1rm":null,"rir":null,"tempo":null,"notes":null},
   {"set_number":4,"set_type":"normal","reps":"12","rest_seconds":90,"weight_target_kg":null,"weight_target_pct1rm":null,"rir":null,"tempo":null,"notes":null}
 ]'::jsonb),

(NULL, 'Drop-set', 'drop_set',
 'Série base + 2 quedas de carga sem descanso.',
 '[
   {"set_number":1,"set_type":"normal","reps":"10","rest_seconds":0,"weight_target_kg":null,"weight_target_pct1rm":100,"rir":null,"tempo":null,"notes":null},
   {"set_number":2,"set_type":"drop","reps":"8","rest_seconds":0,"weight_target_kg":null,"weight_target_pct1rm":80,"rir":null,"tempo":null,"notes":null},
   {"set_number":3,"set_type":"drop","reps":"8","rest_seconds":0,"weight_target_kg":null,"weight_target_pct1rm":60,"rir":null,"tempo":null,"notes":null}
 ]'::jsonb),

(NULL, 'Top + backoff', 'top_backoff',
 'Série pesada de top + 3 backoffs a ~80%.',
 '[
   {"set_number":1,"set_type":"top","reps":"5","rest_seconds":180,"weight_target_kg":null,"weight_target_pct1rm":90,"rir":null,"tempo":null,"notes":null},
   {"set_number":2,"set_type":"backoff","reps":"8","rest_seconds":120,"weight_target_kg":null,"weight_target_pct1rm":80,"rir":null,"tempo":null,"notes":null},
   {"set_number":3,"set_type":"backoff","reps":"8","rest_seconds":120,"weight_target_kg":null,"weight_target_pct1rm":80,"rir":null,"tempo":null,"notes":null},
   {"set_number":4,"set_type":"backoff","reps":"8","rest_seconds":120,"weight_target_kg":null,"weight_target_pct1rm":80,"rir":null,"tempo":null,"notes":null}
 ]'::jsonb),

(NULL, '5×5', '5x5',
 '5 séries de 5 reps com 180s de descanso.',
 '[
   {"set_number":1,"set_type":"normal","reps":"5","rest_seconds":180,"weight_target_kg":null,"weight_target_pct1rm":null,"rir":null,"tempo":null,"notes":null},
   {"set_number":2,"set_type":"normal","reps":"5","rest_seconds":180,"weight_target_kg":null,"weight_target_pct1rm":null,"rir":null,"tempo":null,"notes":null},
   {"set_number":3,"set_type":"normal","reps":"5","rest_seconds":180,"weight_target_kg":null,"weight_target_pct1rm":null,"rir":null,"tempo":null,"notes":null},
   {"set_number":4,"set_type":"normal","reps":"5","rest_seconds":180,"weight_target_kg":null,"weight_target_pct1rm":null,"rir":null,"tempo":null,"notes":null},
   {"set_number":5,"set_type":"normal","reps":"5","rest_seconds":180,"weight_target_kg":null,"weight_target_pct1rm":null,"rir":null,"tempo":null,"notes":null}
 ]'::jsonb),

(NULL, 'Cluster (rest-pause)', 'cluster',
 'Uma série com microdescansos: 8+4+2.',
 '[
   {"set_number":1,"set_type":"cluster","reps":"8+4+2","rest_seconds":180,"weight_target_kg":null,"weight_target_pct1rm":null,"rir":null,"tempo":null,"notes":null}
 ]'::jsonb);
