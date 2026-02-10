-- ============================================================================
-- Migration: Exercise Governance V2 (Junction Table & Custom Groups)
-- ============================================================================

-- ============================================================================
-- 1. Update muscle_groups table structure
-- ============================================================================

-- Add owner_id to allow custom groups per trainer
ALTER TABLE muscle_groups ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES trainers(id) ON DELETE CASCADE;

-- Update unique constraint to be (normalized name, owner_id)
-- Note: We treat NULL owner_id (System) as a unique namespace too.
-- PostgreSQL allows multiple NULLs in unique constraints by default, 
-- but we only want one "System - Peito".
-- We'll use a unique index with COALESCE or similar, BUT
-- simpler strategy: Check existence before insert in app logic.
-- For DB constraint: 
ALTER TABLE muscle_groups DROP CONSTRAINT IF EXISTS muscle_groups_name_key;

-- Unique name for System groups (owner_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_muscle_groups_name_system 
ON muscle_groups(name) WHERE owner_id IS NULL;

-- Unique name per Trainer
CREATE UNIQUE INDEX IF NOT EXISTS idx_muscle_groups_name_trainer 
ON muscle_groups(owner_id, name) WHERE owner_id IS NOT NULL;

-- RLS Policies for muscle_groups
DROP POLICY IF EXISTS "Muscle groups are viewable by everyone" ON muscle_groups;

CREATE POLICY "View System or Own Groups" ON muscle_groups
    FOR SELECT USING (
        owner_id IS NULL OR owner_id = current_trainer_id()
    );

CREATE POLICY "Trainers can create own groups" ON muscle_groups
    FOR INSERT WITH CHECK (
        owner_id = current_trainer_id()
    );

CREATE POLICY "Trainers can update own groups" ON muscle_groups
    FOR UPDATE USING (
        owner_id = current_trainer_id()
    );

CREATE POLICY "Trainers can delete own groups" ON muscle_groups
    FOR DELETE USING (
        owner_id = current_trainer_id()
    );

-- ============================================================================
-- 2. Create Junction Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS exercise_muscle_groups (
    exercise_id UUID REFERENCES exercises(id) ON DELETE CASCADE,
    muscle_group_id UUID REFERENCES muscle_groups(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    PRIMARY KEY (exercise_id, muscle_group_id)
);

-- RLS for Junction
ALTER TABLE exercise_muscle_groups ENABLE ROW LEVEL SECURITY;

-- If you can see the exercise, you can see its tags
CREATE POLICY "View Junction if can view Exercise" ON exercise_muscle_groups
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM exercises e 
            WHERE e.id = exercise_muscle_groups.exercise_id
        )
    );

-- Trainers can manage tags for their own exercises
CREATE POLICY "Manage Junction for Own Exercises" ON exercise_muscle_groups
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM exercises e
            WHERE e.id = exercise_muscle_groups.exercise_id
            AND e.owner_id = current_trainer_id()
        )
    );

-- ============================================================================
-- 3. Data Migration (Array -> Junction)
-- ============================================================================

DO $$
DECLARE
    r_exercise RECORD;
    v_muscle_name TEXT;
    v_muscle_id UUID;
    v_owner_id UUID;
BEGIN
    -- Loop over all exercises that have muscle_groups content
    FOR r_exercise IN 
        SELECT id, owner_id, muscle_groups 
        FROM exercises 
        WHERE muscle_groups IS NOT NULL AND array_length(muscle_groups, 1) > 0
    LOOP
        -- Loop over each muscle string in the array
        FOREACH v_muscle_name IN ARRAY r_exercise.muscle_groups
        LOOP
            -- 1. Try to find existing System Group
            SELECT id INTO v_muscle_id FROM muscle_groups 
            WHERE name ILIKE v_muscle_name AND owner_id IS NULL;

            -- 2. If not found, try to find existing Owner Group (if exercise has owner)
            IF v_muscle_id IS NULL AND r_exercise.owner_id IS NOT NULL THEN
                SELECT id INTO v_muscle_id FROM muscle_groups 
                WHERE name ILIKE v_muscle_name AND owner_id = r_exercise.owner_id;
            END IF;

            -- 3. If still null, create it
            IF v_muscle_id IS NULL THEN
                -- If exercise is System (owner null), create System group
                -- If exercise is Trainer, create Trainer group
                v_owner_id := r_exercise.owner_id;
                
                INSERT INTO muscle_groups (name, owner_id)
                VALUES (v_muscle_name, v_owner_id)
                ON CONFLICT DO NOTHING -- Handle race conditions or dupes in same array
                RETURNING id INTO v_muscle_id;
                
                -- If ON CONFLICT hit (it existed but we missed it?), fetch it back
                IF v_muscle_id IS NULL THEN
                     IF v_owner_id IS NULL THEN
                        SELECT id INTO v_muscle_id FROM muscle_groups WHERE name = v_muscle_name AND owner_id IS NULL;
                     ELSE
                        SELECT id INTO v_muscle_id FROM muscle_groups WHERE name = v_muscle_name AND owner_id = v_owner_id;
                     END IF;
                END IF;
            END IF;

            -- 4. Insert Relation
            IF v_muscle_id IS NOT NULL THEN
                INSERT INTO exercise_muscle_groups (exercise_id, muscle_group_id)
                VALUES (r_exercise.id, v_muscle_id)
                ON CONFLICT DO NOTHING;
            END IF;
            
            -- Reset for next iteration
            v_muscle_id := NULL;
        END LOOP;
    END LOOP;
END $$;

-- ============================================================================
-- 4. Cleanup (Post-Migration)
-- ============================================================================

-- Drop Categories (Conceptual Correction)
-- Note: We might want to migrate categories to muscle groups too?
-- User said: "Categoria... na verdade deveria representar grupos musculares".
-- So, let's migrate any existing Categories as Muscle Groups as well!

DO $$
DECLARE
    r_cat RECORD;
    v_muscle_id UUID;
BEGIN
    -- Loop exercises with categories
    FOR r_cat IN 
        SELECT e.id AS ex_id, e.owner_id, c.name AS cat_name
        FROM exercises e
        JOIN exercise_categories c ON e.category_id = c.id
    LOOP
        -- Same logic: Find or Create Muscle Group for this category name
        
        -- 1. Search System
        SELECT id INTO v_muscle_id FROM muscle_groups WHERE name ILIKE r_cat.cat_name AND owner_id IS NULL;
        
        -- 2. Search Owner
        IF v_muscle_id IS NULL AND r_cat.owner_id IS NOT NULL THEN
             SELECT id INTO v_muscle_id FROM muscle_groups WHERE name ILIKE r_cat.cat_name AND owner_id = r_cat.owner_id;
        END IF;
        
        -- 3. Create
        IF v_muscle_id IS NULL THEN
            INSERT INTO muscle_groups (name, owner_id)
            VALUES (r_cat.cat_name, r_cat.owner_id)
            ON CONFLICT DO NOTHING
            RETURNING id INTO v_muscle_id;
            
            IF v_muscle_id IS NULL THEN
                 -- Fallback fetch
                 IF r_cat.owner_id IS NULL THEN
                    SELECT id INTO v_muscle_id FROM muscle_groups WHERE name = r_cat.cat_name AND owner_id IS NULL;
                 ELSE
                    SELECT id INTO v_muscle_id FROM muscle_groups WHERE name = r_cat.cat_name AND owner_id = r_cat.owner_id;
                 END IF;
            END IF;
        END IF;

        -- 4. Link
        IF v_muscle_id IS NULL THEN
             -- Rare edge case
             RAISE NOTICE 'Could not migrate category %', r_cat.cat_name;
        ELSE
            INSERT INTO exercise_muscle_groups (exercise_id, muscle_group_id)
            VALUES (r_cat.ex_id, v_muscle_id)
            ON CONFLICT DO NOTHING;
        END IF;
        
        v_muscle_id := NULL;
    END LOOP;
END $$;

-- Now drop the columns/tables
ALTER TABLE exercises DROP COLUMN IF EXISTS category_id;
-- We KEEP the muscle_groups array column for a moment or drop it? 
-- User requirements: "Consistência de dados". Array is dangerous.
-- Let's Rename it to legacy just in case, then drop later? Or Drop now to force usage of new table.
-- Dropping is cleaner for V2.
ALTER TABLE exercises DROP COLUMN IF EXISTS muscle_groups;
ALTER TABLE exercises DROP COLUMN IF EXISTS muscle_group_legacy; -- if it still existed

DROP TABLE IF EXISTS exercise_categories;

-- ============================================================================
-- 5. Documentation
-- ============================================================================

COMMENT ON TABLE exercise_muscle_groups IS 'Junction table for Exercises <-> Muscle Groups (M:N).';
COMMENT ON COLUMN muscle_groups.owner_id IS 'Owner of the custom group. NULL = System Standard.';
