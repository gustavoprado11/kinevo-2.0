-- 037_exercise_metadata_seed.sql
-- Curadoria automática de metadados por padrão de nome e grupo muscular
-- Apenas exercícios do sistema (owner_id IS NULL)
--
-- ORDEM IMPORTA: UPDATEs posteriores sobrescrevem anteriores.
-- Regras do fundador (2025-02-25):
--   - difficulty_level é preferência/desempate, NÃO filtro de elegibilidade
--   - Cardio e Mobilidade: advanced como proxy de exclusão
--   - Bíceps, Tríceps, Antebraço: session_position = 'last'
-- Ajustes aprovados (2026-02-25):
--   - Compostos Sumô: nome prevalece sobre grupo Adutores para session_position
--   - Panturrilha no nome: is_primary_movement = false sempre
--   - Grupo Abdominais: is_primary_movement = false sempre

-- ============================================================
-- 1. Movimentos primários (is_primary_movement + session_position = 'first')
-- ============================================================
UPDATE exercises
SET is_primary_movement = true, session_position = 'first'
WHERE owner_id IS NULL AND is_archived = false
AND (
  name ILIKE '%Supino%'
  OR name ILIKE '%Agachamento%'
  OR name ILIKE '%Remada%'
  OR name ILIKE '%Puxada%'
  OR name ILIKE '%Barra Fixa%'
  OR name ILIKE '%Desenvolvimento%'
  OR name ILIKE '%Leg Press%'
  OR name ILIKE '%Stiff%'
  OR name ILIKE '%Levantamento Terra%'
  OR name ILIKE '%Elevação de Quadril%'
  OR name ILIKE '%Hip Thrust%'
  OR name ILIKE '%Paralela%'
  OR name ILIKE '%Mergulho%'
  OR name ILIKE '%Afundo%'
  OR name ILIKE '%Passada%'
  OR name ILIKE '%Hack%'
  OR name ILIKE '%Búlgaro%'
  OR name ILIKE '%Abdução%'
);

-- ============================================================
-- 2. Finalizadores por grupo muscular (session_position = 'last')
--    Sobrescreve session_position para exercícios de grupos finalizadores.
--    EXCEÇÃO: compostos que contêm Agachamento/Stiff/Levantamento Terra
--    no nome mantêm 'first' — nome prevalece sobre grupo para compostos.
-- ============================================================
UPDATE exercises e
SET session_position = 'last'
WHERE owner_id IS NULL AND is_archived = false
AND EXISTS (
  SELECT 1 FROM exercise_muscle_groups emg
  JOIN muscle_groups mg ON mg.id = emg.muscle_group_id
  WHERE emg.exercise_id = e.id
  AND mg.name IN (
    'Panturrilha',
    'Abdominais',
    'Adutores',
    'Antebraço',
    'Oblíquos',
    'Bíceps',
    'Tríceps'
  )
)
AND NOT (
  name ILIKE '%Agachamento%'
  OR name ILIKE '%Stiff%'
  OR name ILIKE '%Levantamento Terra%'
);

-- ============================================================
-- 2b. Correção: exercícios com 'Panturrilha' no nome nunca são primários
--     (ex: Panturrilha Hack, Panturrilha no Leg Press)
-- ============================================================
UPDATE exercises
SET is_primary_movement = false, session_position = 'last'
WHERE owner_id IS NULL AND is_archived = false
AND name ILIKE '%Panturrilha%';

-- ============================================================
-- 2c. Correção: exercícios dos grupos Abdominais e Tríceps nunca são primários
--     Abdominais: Abdominal Infra Paralelas, Abdominal Oblíquo Barra Fixa
--     Tríceps: Tríceps Paralela Máquina, Tríceps Paralelas no Gráviton
-- ============================================================
UPDATE exercises e
SET is_primary_movement = false
WHERE owner_id IS NULL AND is_archived = false
AND EXISTS (
  SELECT 1 FROM exercise_muscle_groups emg
  JOIN muscle_groups mg ON mg.id = emg.muscle_group_id
  WHERE emg.exercise_id = e.id
  AND mg.name IN ('Abdominais', 'Tríceps')
);

-- ============================================================
-- 3. difficulty_level = 'beginner' por implemento + grupo muscular principal
--    Condição: nome contém implemento E pertence a grupo muscular grande
-- ============================================================
UPDATE exercises e
SET difficulty_level = 'beginner'
WHERE owner_id IS NULL AND is_archived = false
AND (
  name ILIKE '%Halter%'
  OR name ILIKE '%Haltere%'
  OR name ILIKE '%Máquina%'
  OR name ILIKE '%Maquina%'
  OR name ILIKE '%Cabo%'
  OR name ILIKE '%TRX%'
  OR name ILIKE '%Elástico%'
  OR name ILIKE '%Elastico%'
  OR name ILIKE '%Fita%'
  OR name ILIKE '%Kettlebell%'
)
AND EXISTS (
  SELECT 1 FROM exercise_muscle_groups emg
  JOIN muscle_groups mg ON mg.id = emg.muscle_group_id
  WHERE emg.exercise_id = e.id
  AND mg.name IN (
    'Peito',
    'Costas',
    'Ombros',
    'Quadríceps',
    'Glúteo',
    'Posterior de Coxa'
  )
);

-- ============================================================
-- 4. difficulty_level = 'beginner' para grupos acessórios
--    Independente do nome — são grupos acessórios por natureza
-- ============================================================
UPDATE exercises e
SET difficulty_level = 'beginner'
WHERE owner_id IS NULL AND is_archived = false
AND EXISTS (
  SELECT 1 FROM exercise_muscle_groups emg
  JOIN muscle_groups mg ON mg.id = emg.muscle_group_id
  WHERE emg.exercise_id = e.id
  AND mg.name IN ('Abdominais', 'Panturrilha', 'Adutores')
);

-- ============================================================
-- 5. difficulty_level = 'advanced' por padrão de nome
--    Sobrescreve beginner se conflitar (ex: Abdominal Dragon Fly)
-- ============================================================
UPDATE exercises
SET difficulty_level = 'advanced'
WHERE owner_id IS NULL AND is_archived = false
AND (
  name ILIKE '%Nórdica%'
  OR name ILIKE '%Nordica%'
  OR name ILIKE '%Dragon%'
  OR name ILIKE '%Olímpico%'
  OR name ILIKE '%Olimpico%'
  OR name ILIKE '%Overhead Squat%'
  OR name ILIKE '%Agachamento Overhead%'
  OR name ILIKE '%Clean%'
  OR name ILIKE '%Snatch%'
  OR name ILIKE '%Pistol%'
  OR name ILIKE '%Handstand%'
  OR name ILIKE '%Muscle Up%'
);

-- ============================================================
-- 6. difficulty_level = 'advanced' para Cardio e Mobilidade
--    Proxy de exclusão da seleção automática do builder
--    Inclui 'Moblidade' (typo existente no banco)
-- ============================================================
UPDATE exercises e
SET difficulty_level = 'advanced'
WHERE owner_id IS NULL AND is_archived = false
AND EXISTS (
  SELECT 1 FROM exercise_muscle_groups emg
  JOIN muscle_groups mg ON mg.id = emg.muscle_group_id
  WHERE emg.exercise_id = e.id
  AND mg.name IN ('Cardio', 'Mobilidade', 'Moblidade')
);
