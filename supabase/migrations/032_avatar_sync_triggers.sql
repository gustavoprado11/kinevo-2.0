-- Migration 032: Bidirectional avatar sync between trainer and self-student
-- When trainer updates avatar on Web → syncs to their student profile (mobile)
-- When trainer updates avatar on Mobile (as student) → syncs back to trainer profile (web)

-- 1. Trainer → Student sync (Web update propagates to mobile)
CREATE OR REPLACE FUNCTION sync_trainer_avatar_to_student()
RETURNS TRIGGER AS $$
BEGIN
  -- Only sync when avatar_url actually changed
  IF NEW.avatar_url IS DISTINCT FROM OLD.avatar_url THEN
    UPDATE students
    SET avatar_url = NEW.avatar_url,
        updated_at = now()
    WHERE coach_id = NEW.id
      AND is_trainer_profile = true;
  END IF;

  -- Also sync name if it changed
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    UPDATE students
    SET name = NEW.name,
        updated_at = now()
    WHERE coach_id = NEW.id
      AND is_trainer_profile = true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_sync_trainer_avatar_to_student
  AFTER UPDATE ON trainers
  FOR EACH ROW
  EXECUTE FUNCTION sync_trainer_avatar_to_student();

-- 2. Student → Trainer sync (Mobile update propagates to web)
CREATE OR REPLACE FUNCTION sync_student_avatar_to_trainer()
RETURNS TRIGGER AS $$
BEGIN
  -- Only sync for trainer self-student profiles
  IF NEW.is_trainer_profile = true AND NEW.avatar_url IS DISTINCT FROM OLD.avatar_url THEN
    UPDATE trainers
    SET avatar_url = NEW.avatar_url,
        updated_at = now()
    WHERE id = NEW.coach_id;
  END IF;

  -- Also sync name back if changed
  IF NEW.is_trainer_profile = true AND NEW.name IS DISTINCT FROM OLD.name THEN
    UPDATE trainers
    SET name = NEW.name,
        updated_at = now()
    WHERE id = NEW.coach_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_sync_student_avatar_to_trainer
  AFTER UPDATE ON students
  FOR EACH ROW
  EXECUTE FUNCTION sync_student_avatar_to_trainer();

-- 3. Initial sync: copy current trainer avatars to their self-students
UPDATE students s
SET avatar_url = t.avatar_url
FROM trainers t
WHERE s.coach_id = t.id
  AND s.is_trainer_profile = true
  AND t.avatar_url IS NOT NULL
  AND (s.avatar_url IS NULL OR s.avatar_url != t.avatar_url);
