-- ============================================================================
-- Migration: Exercise Governance (Categories & Muscle Groups)
-- ============================================================================

-- ============================================================================
-- 1. Create muscle_groups table
-- ============================================================================
CREATE TABLE IF NOT EXISTS muscle_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE muscle_groups ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read
CREATE POLICY "Muscle groups are viewable by everyone" ON muscle_groups
    FOR SELECT USING (true);

-- Seed initial muscle groups
INSERT INTO muscle_groups (name) VALUES
('Peito'), 
('Costas'), 
('Pernas'), 
('Ombros'), 
('Bíceps'), 
('Tríceps'), 
('Abdômen'), 
('Cardio'), 
('Mobilidade'), 
('Glúteos'), 
('Panturrilhas'), 
('Antebraço'), 
('Lombar')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- 2. Create exercise_categories table
-- ============================================================================
CREATE TABLE IF NOT EXISTS exercise_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    owner_id UUID REFERENCES trainers(id) ON DELETE CASCADE, -- NULL for system categories
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE exercise_categories ENABLE ROW LEVEL SECURITY;

-- Policy: Read system (owner_id is null) or own (owner_id = current_trainer_id)
CREATE POLICY "Categories viewable by everyone" ON exercise_categories
    FOR SELECT USING (
        owner_id IS NULL OR owner_id = current_trainer_id()
    );

-- Policy: Insert own
CREATE POLICY "Trainers can create categories" ON exercise_categories
    FOR INSERT WITH CHECK (
        owner_id = current_trainer_id()
    );

-- Policy: Update own
CREATE POLICY "Trainers can update own categories" ON exercise_categories
    FOR UPDATE USING (
        owner_id = current_trainer_id()
    );

-- Policy: Delete own
CREATE POLICY "Trainers can delete own categories" ON exercise_categories
    FOR DELETE USING (
        owner_id = current_trainer_id()
    );

-- Seed system categories
INSERT INTO exercise_categories (name, owner_id) VALUES
('Força', NULL),
('Cardio', NULL),
('Funcional', NULL),
('Mobilidade', NULL),
('Técnica', NULL),
('Aquecimento', NULL),
('Alongamento', NULL);

-- ============================================================================
-- 3. Update exercises table
-- ============================================================================

ALTER TABLE exercises ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES exercise_categories(id);

CREATE INDEX IF NOT EXISTS idx_exercises_category ON exercises(category_id);

-- ============================================================================
-- 4. Documentation
-- ============================================================================

COMMENT ON TABLE muscle_groups IS 'Standardized list of muscle groups.';
COMMENT ON TABLE exercise_categories IS 'Categories for exercises (System + Trainer defined).';
COMMENT ON COLUMN exercises.category_id IS 'Reference to exercise classification category.';
