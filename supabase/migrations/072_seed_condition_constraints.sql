-- ============================================================================
-- Kinevo — 072 Seed Condition Constraints (Phase 1b)
-- ============================================================================
-- Populates exercise_condition_constraints from condition-mappings.ts.
-- Promotes condition safety from prompt-only text to enforced DB constraints.
--
-- Source data:
--   - contraindicated_patterns: only acl_post_op has ['lunge']
--   - cautious_muscle_groups: 6 conditions define cautious groups
--   - recommended exercises: patellofemoral + hip conditions benefit from
--     glute med work (inferred from prescription_rules)
-- ============================================================================

-- ============================================================================
-- 1) Contraindicated: ACL post-op → lunge pattern exercises
-- ============================================================================

INSERT INTO exercise_condition_constraints (exercise_id, condition_id, constraint_type, notes)
SELECT e.id, 'acl_post_op', 'contraindicated',
    'Padrão lunge contraindicado pós-LCA — sem exercícios de avanço ou passada'
FROM exercises e
WHERE e.movement_pattern = 'lunge'
  AND e.owner_id IS NULL
ON CONFLICT (exercise_id, condition_id, constraint_type) DO NOTHING;

-- ============================================================================
-- 2) Cautious: Conditions with cautious_muscle_groups
-- ============================================================================

-- Patellofemoral pain → Quadríceps exercises require caution
INSERT INTO exercise_condition_constraints (exercise_id, condition_id, constraint_type, notes)
SELECT DISTINCT e.id, 'patellofemoral_pain', 'cautious',
    'Limitar flexão de joelho a 80°. Preferir cadeia fechada com amplitude controlada.'
FROM exercises e
JOIN exercise_muscle_groups emg ON emg.exercise_id = e.id
JOIN muscle_groups mg ON mg.id = emg.muscle_group_id
WHERE mg.name = 'Quadríceps' AND mg.owner_id IS NULL
  AND e.owner_id IS NULL
ON CONFLICT (exercise_id, condition_id, constraint_type) DO NOTHING;

-- Meniscus → Quadríceps exercises require caution
INSERT INTO exercise_condition_constraints (exercise_id, condition_id, constraint_type, notes)
SELECT DISTINCT e.id, 'meniscus', 'cautious',
    'Evitar flexão >90° e rotação sob carga. Cadeia fechada com amplitude controlada.'
FROM exercises e
JOIN exercise_muscle_groups emg ON emg.exercise_id = e.id
JOIN muscle_groups mg ON mg.id = emg.muscle_group_id
WHERE mg.name = 'Quadríceps' AND mg.owner_id IS NULL
  AND e.owner_id IS NULL
ON CONFLICT (exercise_id, condition_id, constraint_type) DO NOTHING;

-- ACL post-op → Quadríceps and Posterior de Coxa require caution
INSERT INTO exercise_condition_constraints (exercise_id, condition_id, constraint_type, notes)
SELECT DISTINCT e.id, 'acl_post_op', 'cautious',
    'Confirmar fase de reabilitação. Cadeia fechada preferencial. Sem pivô.'
FROM exercises e
JOIN exercise_muscle_groups emg ON emg.exercise_id = e.id
JOIN muscle_groups mg ON mg.id = emg.muscle_group_id
WHERE mg.name IN ('Quadríceps', 'Posterior de Coxa') AND mg.owner_id IS NULL
  AND e.owner_id IS NULL
  AND e.movement_pattern != 'lunge'  -- Already contraindicated above
ON CONFLICT (exercise_id, condition_id, constraint_type) DO NOTHING;

-- Cervical → Trapézio exercises require caution
INSERT INTO exercise_condition_constraints (exercise_id, condition_id, constraint_type, notes)
SELECT DISTINCT e.id, 'cervical', 'cautious',
    'Evitar compressão cervical direta. Evitar encolhimentos pesados.'
FROM exercises e
JOIN exercise_muscle_groups emg ON emg.exercise_id = e.id
JOIN muscle_groups mg ON mg.id = emg.muscle_group_id
WHERE mg.name = 'Trapézio' AND mg.owner_id IS NULL
  AND e.owner_id IS NULL
ON CONFLICT (exercise_id, condition_id, constraint_type) DO NOTHING;

-- Shoulder impingement → Ombros exercises require caution
INSERT INTO exercise_condition_constraints (exercise_id, condition_id, constraint_type, notes)
SELECT DISTINCT e.id, 'shoulder_impingement', 'cautious',
    'Evitar elevação >90° com carga se doloroso. Incluir rotação externa.'
FROM exercises e
JOIN exercise_muscle_groups emg ON emg.exercise_id = e.id
JOIN muscle_groups mg ON mg.id = emg.muscle_group_id
WHERE mg.name = 'Ombros' AND mg.owner_id IS NULL
  AND e.owner_id IS NULL
ON CONFLICT (exercise_id, condition_id, constraint_type) DO NOTHING;

-- Shoulder instability → Ombros and Peito exercises require caution
INSERT INTO exercise_condition_constraints (exercise_id, condition_id, constraint_type, notes)
SELECT DISTINCT e.id, 'shoulder_instability', 'cautious',
    'Evitar abdução + rotação externa máxima. Supino pegada moderada.'
FROM exercises e
JOIN exercise_muscle_groups emg ON emg.exercise_id = e.id
JOIN muscle_groups mg ON mg.id = emg.muscle_group_id
WHERE mg.name IN ('Ombros', 'Peito') AND mg.owner_id IS NULL
  AND e.owner_id IS NULL
ON CONFLICT (exercise_id, condition_id, constraint_type) DO NOTHING;

-- Hip pain → Glúteo and Adutores exercises require caution
INSERT INTO exercise_condition_constraints (exercise_id, condition_id, constraint_type, notes)
SELECT DISTINCT e.id, 'hip_pain', 'cautious',
    'Evitar flexão >90° e adução forçada se dolorosas. Amplitudes indolores.'
FROM exercises e
JOIN exercise_muscle_groups emg ON emg.exercise_id = e.id
JOIN muscle_groups mg ON mg.id = emg.muscle_group_id
WHERE mg.name IN ('Glúteo', 'Adutores') AND mg.owner_id IS NULL
  AND e.owner_id IS NULL
ON CONFLICT (exercise_id, condition_id, constraint_type) DO NOTHING;

-- Pregnancy → Abdominais exercises require caution
INSERT INTO exercise_condition_constraints (exercise_id, condition_id, constraint_type, notes)
SELECT DISTINCT e.id, 'pregnancy', 'cautious',
    'Evitar decúbito dorsal após 1º tri. Sem crunch/sit-up. Intensidade moderada.'
FROM exercises e
JOIN exercise_muscle_groups emg ON emg.exercise_id = e.id
JOIN muscle_groups mg ON mg.id = emg.muscle_group_id
WHERE mg.name = 'Abdominais' AND mg.owner_id IS NULL
  AND e.owner_id IS NULL
ON CONFLICT (exercise_id, condition_id, constraint_type) DO NOTHING;

-- ============================================================================
-- 3) Update movement_pattern_family and fatigue_class for curated exercises
-- ============================================================================

-- Movement pattern family based on existing movement_pattern
UPDATE exercises SET movement_pattern_family = CASE movement_pattern
    WHEN 'squat'     THEN 'knee_dominant'
    WHEN 'lunge'     THEN 'knee_dominant'
    WHEN 'hinge'     THEN 'hip_dominant'
    WHEN 'push_h'    THEN 'horizontal_push'
    WHEN 'push_v'    THEN 'vertical_push'
    WHEN 'pull_h'    THEN 'horizontal_pull'
    WHEN 'pull_v'    THEN 'vertical_pull'
    WHEN 'core'      THEN 'core_stability'
    WHEN 'isolation' THEN NULL  -- Determined per exercise below
    ELSE NULL
END
WHERE movement_pattern IS NOT NULL
  AND is_ai_curated = true;

-- Isolation exercises: classify into upper vs lower based on muscle group
UPDATE exercises SET movement_pattern_family = 'isolation_lower'
WHERE movement_pattern = 'isolation'
  AND is_ai_curated = true
  AND EXISTS (
      SELECT 1 FROM exercise_muscle_groups emg
      JOIN muscle_groups mg ON mg.id = emg.muscle_group_id
      WHERE emg.exercise_id = exercises.id
        AND mg.name IN ('Quadríceps', 'Posterior de Coxa', 'Glúteo', 'Panturrilha', 'Adutores')
        AND mg.owner_id IS NULL
  );

UPDATE exercises SET movement_pattern_family = 'isolation_upper'
WHERE movement_pattern = 'isolation'
  AND is_ai_curated = true
  AND movement_pattern_family IS NULL
  AND EXISTS (
      SELECT 1 FROM exercise_muscle_groups emg
      JOIN muscle_groups mg ON mg.id = emg.muscle_group_id
      WHERE emg.exercise_id = exercises.id
        AND mg.name IN ('Bíceps', 'Tríceps', 'Ombros', 'Antebraço', 'Trapézio')
        AND mg.owner_id IS NULL
  );

-- Fatigue class based on movement pattern and primary movement status
UPDATE exercises SET fatigue_class = 'high'
WHERE is_ai_curated = true
  AND is_primary_movement = true
  AND movement_pattern IN ('squat', 'hinge', 'push_h', 'pull_h');

UPDATE exercises SET fatigue_class = 'moderate'
WHERE is_ai_curated = true
  AND fatigue_class = 'moderate'  -- Only update defaults
  AND (is_primary_movement = true OR movement_pattern IN ('lunge', 'push_v', 'pull_v'));

UPDATE exercises SET fatigue_class = 'low'
WHERE is_ai_curated = true
  AND movement_pattern IN ('isolation', 'core', 'carry');
