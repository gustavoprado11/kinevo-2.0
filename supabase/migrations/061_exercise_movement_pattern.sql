-- ============================================================================
-- Migration 061: Add movement_pattern column to exercises
-- ============================================================================
-- Part of Sprint 2 — Tags de Exercício + Pipeline de Filtragem Inteligente
-- This column classifies each exercise by its biomechanical movement pattern.
-- Populated via a TypeScript inference script after migration.

ALTER TABLE exercises
ADD COLUMN movement_pattern TEXT
CHECK (movement_pattern IN (
  'squat',       -- agachamento, leg press, hack squat
  'hinge',       -- stiff, bom dia, hip thrust, elevação de quadril
  'lunge',       -- afundo, passada, búlgaro
  'push_h',      -- supino (todas variações)
  'push_v',      -- desenvolvimento (todas variações)
  'pull_h',      -- remada (todas variações)
  'pull_v',      -- puxada, barra fixa (todas variações)
  'isolation',   -- rosca, extensão, elevação lateral, abdução, etc.
  'core',        -- prancha, abdominal, oblíquo
  'carry'        -- farmer walk, etc. (raro)
));

-- Index for filtering by movement pattern
CREATE INDEX idx_exercises_movement_pattern ON exercises(movement_pattern)
  WHERE movement_pattern IS NOT NULL;
