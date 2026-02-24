-- Migration 031: Auto-create student profile for trainers
-- When a trainer signs up, they automatically get a student record
-- linked to themselves + a courtesy contract (lifetime free access).
-- IMPORTANT: Existing students are never modified or disconnected.

-- 1. Add column to identify the trainer's own student profile
ALTER TABLE students ADD COLUMN is_trainer_profile BOOLEAN DEFAULT false;

-- 2. Function to auto-create student + courtesy contract on trainer insert
--    Uses SECURITY DEFINER to bypass RLS.
--    Handles edge case: if a student with the same (coach_id, email) already
--    exists (e.g. trainer previously created a student using their own email),
--    we adopt that record as the trainer profile instead of creating a duplicate.
CREATE OR REPLACE FUNCTION create_trainer_self_student()
RETURNS TRIGGER AS $$
DECLARE
  new_student_id UUID;
BEGIN
  -- Check if a student with the same coach_id + email already exists
  SELECT id INTO new_student_id
  FROM students
  WHERE coach_id = NEW.id AND email = NEW.email;

  IF new_student_id IS NOT NULL THEN
    -- Adopt existing student as trainer profile
    UPDATE students
    SET is_trainer_profile = true,
        auth_user_id = NEW.auth_user_id
    WHERE id = new_student_id;
  ELSE
    -- Create new student record linked to the trainer
    INSERT INTO students (auth_user_id, coach_id, name, email, status, modality, is_trainer_profile)
    VALUES (NEW.auth_user_id, NEW.id, NEW.name, NEW.email, 'active', 'online', true)
    RETURNING id INTO new_student_id;
  END IF;

  -- Create courtesy contract if none exists for this student
  IF NOT EXISTS (
    SELECT 1 FROM student_contracts WHERE student_id = new_student_id
  ) THEN
    INSERT INTO student_contracts (student_id, trainer_id, plan_id, amount, status, billing_type, block_on_fail, start_date)
    VALUES (new_student_id, NEW.id, NULL, 0, 'active', 'courtesy', false, now());
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Trigger fires after every new trainer is created
CREATE TRIGGER trg_create_trainer_self_student
  AFTER INSERT ON trainers
  FOR EACH ROW
  EXECUTE FUNCTION create_trainer_self_student();

-- 4. Backfill for existing trainers
-- Step A: If trainer already has a student with matching email, adopt it
UPDATE students s
SET is_trainer_profile = true,
    auth_user_id = t.auth_user_id
FROM trainers t
WHERE s.coach_id = t.id
  AND s.email = t.email
  AND s.is_trainer_profile = false;

-- Step B: For trainers who still don't have a self-student, create one
INSERT INTO students (auth_user_id, coach_id, name, email, status, modality, is_trainer_profile)
SELECT t.auth_user_id, t.id, t.name, t.email, 'active', 'online', true
FROM trainers t
WHERE NOT EXISTS (
  SELECT 1 FROM students s WHERE s.coach_id = t.id AND s.is_trainer_profile = true
)
AND NOT EXISTS (
  SELECT 1 FROM students s WHERE s.coach_id = t.id AND s.email = t.email
);

-- Step C: Create courtesy contracts for all trainer self-students that lack one
INSERT INTO student_contracts (student_id, trainer_id, plan_id, amount, status, billing_type, block_on_fail, start_date)
SELECT s.id, s.coach_id, NULL, 0, 'active', 'courtesy', false, now()
FROM students s
WHERE s.is_trainer_profile = true
AND NOT EXISTS (
  SELECT 1 FROM student_contracts sc WHERE sc.student_id = s.id
);
